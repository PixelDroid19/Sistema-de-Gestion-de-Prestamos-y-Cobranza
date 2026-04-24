const express = require('express');
const { asyncHandler } = require('@/utils/errorHandler');
const { createPaymentRouter } = require('./paymentRouter');
const { attachPagination } = require('@/middleware/validation');
const { sendBufferDownload, sendPathDownload } = require('@/modules/shared/http');
const { workbenchLimiter } = require('@/middleware/rateLimiter');

const createCreditsRouter = ({ authMiddleware, attachmentUpload, loanValidation, useCases, paymentApplicationService }) => {
  const router = express.Router();

  const paymentRouter = createPaymentRouter({
    authMiddleware,
    paymentApplicationService,
  });
  router.use('/payments', paymentRouter);

  router.get('/', authMiddleware(), attachPagination(), asyncHandler(async (req, res) => {
    const result = await useCases.listLoans({ actor: req.user, pagination: req.pagination });
    if (result?.pagination) {
      res.json({ success: true, count: result.pagination.totalItems, data: { loans: result.items, pagination: result.pagination } });
      return;
    }

    res.json({ success: true, count: result.length, data: { loans: result } });
  }));

  const sendCreditCalculation = async (req, res) => {
    const calculation = await (useCases.createCreditCalculation || useCases.createSimulation)(req.body);
    res.json({
      success: true,
      message: 'Credit calculation generated successfully',
      data: {
        calculation: {
          lateFeeMode: calculation.lateFeeMode,
          summary: calculation.summary,
          schedule: calculation.schedule,
          graphVersionId: calculation.graphVersionId ?? null,
        },
        simulation: {
          lateFeeMode: calculation.lateFeeMode,
          summary: calculation.summary,
          schedule: calculation.schedule,
          graphVersionId: calculation.graphVersionId ?? null,
        },
      },
    });
  };

  router.post('/calculations', authMiddleware(), loanValidation.simulate, asyncHandler(sendCreditCalculation));

  // Compatibility alias for older clients. New frontend code uses /calculations.
  router.post('/simulations', authMiddleware(), loanValidation.simulate, asyncHandler(sendCreditCalculation));

  router.get('/workbench/scopes', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.listDagWorkbenchScopes({ actor: req.user });
    res.json({ success: true, data: { scopes: result.scopes } });
  }));

  router.get('/workbench/graph', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.loadDagWorkbenchGraph({ actor: req.user, scopeKey: req.query.scope });
    res.json({ success: true, data: { graph: result.graphVersion } });
  }));

  router.post('/workbench/graph', authMiddleware(['admin']), workbenchLimiter, asyncHandler(async (req, res) => {
    const result = await useCases.saveDagWorkbenchGraph({
      actor: req.user,
      scopeKey: req.body.scopeKey,
      name: req.body.name,
      graph: req.body.graph,
      commitMessage: req.body.commitMessage,
    });
    res.status(201).json({
      success: true,
      message: 'DAG graph saved successfully',
      data: {
        graph: result.graphVersion,
        validation: result.validation,
      },
    });
  }));

  router.post('/workbench/graph/validate', authMiddleware(['admin']), workbenchLimiter, asyncHandler(async (req, res) => {
    const validation = await useCases.validateDagWorkbenchGraph({
      actor: req.user,
      scopeKey: req.body.scopeKey,
      graph: req.body.graph,
    });
    res.json({ success: true, data: { validation } });
  }));

  const sendWorkbenchCalculation = async (req, res) => {
    const workbenchPayload = {
      actor: req.user,
      scopeKey: req.body.scopeKey,
      graph: req.body.graph,
    };
    if (req.body.calculationInput !== undefined) {
      workbenchPayload.calculationInput = req.body.calculationInput;
    }
    if (req.body.simulationInput !== undefined) {
      workbenchPayload.simulationInput = req.body.simulationInput;
    }

    const result = await (useCases.calculateDagWorkbenchGraph || useCases.simulateDagWorkbenchGraph)(workbenchPayload);
    res.json({
      success: true,
      message: 'DAG workbench calculation generated successfully',
      data: {
        graph: result.graphVersion,
        validation: result.validation,
        calculation: result.calculation,
        simulation: result.simulation,
        summary: result.summary,
      },
    });
  };

  router.post('/workbench/graph/calculations', authMiddleware(['admin']), workbenchLimiter, asyncHandler(sendWorkbenchCalculation));

  // Compatibility alias for older clients. New frontend code uses /graph/calculations.
  router.post('/workbench/graph/simulations', authMiddleware(['admin']), workbenchLimiter, asyncHandler(sendWorkbenchCalculation));

  router.get('/workbench/graph/summary', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const summary = await useCases.getDagWorkbenchSummary({ actor: req.user, scopeKey: req.query.scope });
    res.json({ success: true, data: { summary } });
  }));

  // ── DAG Formula Management Endpoints ──────────────────────────────────────
  router.get('/workbench/graphs', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.listDagWorkbenchGraphs({ actor: req.user, scopeKey: req.query.scope });
    res.json({ success: true, data: { graphs: result.graphs } });
  }));

  router.get('/workbench/graphs/:graphId', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.getDagWorkbenchGraphDetails({ actor: req.user, graphId: Number(req.params.graphId) });
    res.json({ success: true, data: { graph: result.graph } });
  }));

  router.patch('/workbench/graphs/:graphId/status', authMiddleware(['admin']), workbenchLimiter, asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid status. Must be "active" or "inactive".' } });
    }

    const useCase = status === 'active' ? useCases.activateDagWorkbenchGraph : useCases.deactivateDagWorkbenchGraph;
    const result = await useCase({ actor: req.user, graphId: Number(req.params.graphId) });
    res.json({ success: true, message: `Graph ${status === 'active' ? 'activated' : 'deactivated'} successfully`, data: { graph: result.graph } });
  }));

  router.delete('/workbench/graphs/:graphId', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    await useCases.deleteDagWorkbenchGraph({ actor: req.user, graphId: Number(req.params.graphId) });
    res.json({ success: true, message: 'Graph deleted successfully' });
  }));

  // ── Graph History & Diff Endpoints ───────────────────────────────────────
  router.get('/workbench/graphs/:graphId/history', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.getDagWorkbenchGraphHistory({ actor: req.user, graphId: Number(req.params.graphId) });
    res.json({ success: true, data: { history: result.history } });
  }));

  router.get('/workbench/graphs/:graphId/diff', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.getDagWorkbenchGraphDiff({
      actor: req.user,
      graphId: Number(req.params.graphId),
      compareToGraphId: req.query.compareToGraphId ? Number(req.query.compareToGraphId) : undefined,
      compareToVersionId: Number(req.query.compareToVersionId),
    });
    res.json({ success: true, data: { diff: result.diff } });
  }));

  router.post('/workbench/graphs/:graphId/restore', authMiddleware(['admin']), workbenchLimiter, asyncHandler(async (req, res) => {
    const result = await useCases.restoreDagWorkbenchGraph({
      actor: req.user,
      graphId: Number(req.params.graphId),
      commitMessage: req.body.commitMessage,
    });
    res.status(201).json({ success: true, data: { graph: result.graph } });
  }));

  // ── Variable Registry Endpoints ──────────────────────────────────────────
  router.get('/workbench/variables', authMiddleware(['admin']), attachPagination(), asyncHandler(async (req, res) => {
    const filters = {
      type: req.query.type,
      source: req.query.source,
      status: req.query.status,
    };
    const result = await useCases.listDagVariables({ actor: req.user, filters, pagination: req.pagination });
    res.json({ success: true, count: result.pagination?.totalItems ?? result.items?.length ?? 0, data: { variables: result.items ?? result, pagination: result.pagination } });
  }));

  router.post('/workbench/variables', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const variable = await useCases.createDagVariable({ actor: req.user, payload: req.body });
    res.status(201).json({ success: true, data: { variable } });
  }));

  router.patch('/workbench/variables/:id', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const variable = await useCases.updateDagVariable({ id: Number(req.params.id), payload: req.body });
    res.json({ success: true, data: { variable } });
  }));

  router.delete('/workbench/variables/:id', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    await useCases.deleteDagVariable({ id: Number(req.params.id) });
    res.json({ success: true, message: 'Variable deleted successfully' });
  }));

  router.get('/customer/:customerId', authMiddleware(['customer']), attachPagination(), asyncHandler(async (req, res) => {
    const result = await useCases.listLoansByCustomer({ actor: req.user, customerId: req.params.customerId, pagination: req.pagination });
    res.json({ success: true, count: result.pagination?.totalItems ?? result.loans.length, data: result });
  }));

  router.post('/', authMiddleware(['customer', 'admin']), loanValidation.create, asyncHandler(async (req, res) => {
    const loan = await useCases.createLoan({ actor: req.user, payload: req.body });
    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully',
      data: {
        loan,
        financialSummary: loan.financialSnapshot,
      },
    });
  }));

  // Keep specific/static paths before any '/:id' route to avoid shadowing.
  router.get('/statistics', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const statistics = await useCases.getLoanStatistics();
    res.json({ success: true, data: { statistics } });
  }));

  router.get('/due-payments', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, error: { message: 'date parameter is required' } });
    }
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, error: { message: 'Invalid date format' } });
    }
    const duePayments = await useCases.getDuePayments({ date: parsedDate });
    res.json({ success: true, count: duePayments.length, data: { duePayments } });
  }));

  router.get('/search', authMiddleware(), attachPagination(), asyncHandler(async (req, res) => {
    const filters = {
      search: req.query.search,
      status: req.query.status,
      minAmount: req.query.minAmount ? Number(req.query.minAmount) : undefined,
      maxAmount: req.query.maxAmount ? Number(req.query.maxAmount) : undefined,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };
    const result = await useCases.searchLoans({ actor: req.user, filters, pagination: req.pagination });
    if (result.pagination) {
      res.json({ success: true, count: result.pagination.totalItems, data: { loans: result.items, pagination: result.pagination } });
      return;
    }
    res.json({ success: true, count: result.length, data: { loans: result } });
  }));

  router.patch('/:id/status', authMiddleware(['admin']), loanValidation.updateStatus, asyncHandler(async (req, res) => {
    const loan = await useCases.updateLoanStatus({ actor: req.user, loanId: req.params.id, status: req.body.status });
    res.json({ success: true, message: `Loan status updated to ${req.body.status}`, data: { loan } });
  }));

  router.patch('/:id/recovery-status', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const loan = await useCases.updateRecoveryStatus({ actor: req.user, loanId: req.params.id, recoveryStatus: req.body.recoveryStatus });
    res.json({ success: true, message: 'Recovery status updated successfully', data: { loan } });
  }));

  router.get('/:id/attachments', authMiddleware(), asyncHandler(async (req, res) => {
    const attachments = await useCases.listLoanAttachments({ actor: req.user, loanId: req.params.id });
    res.json({ success: true, count: attachments.length, data: { attachments } });
  }));

  router.get('/:id/alerts', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const alerts = await useCases.listLoanAlerts({ actor: req.user, loanId: req.params.id });
    res.json({ success: true, count: alerts.length, data: { alerts } });
  }));

  router.post('/:id/follow-ups', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.createLoanFollowUp({ actor: req.user, loanId: req.params.id, payload: req.body });
    res.status(201).json({
      success: true,
      message: 'Follow-up reminder created successfully',
      data: result,
    });
  }));

  router.patch('/:loanId/alerts/:alertId/status', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const alert = await useCases.updateLoanAlertStatus({
      actor: req.user,
      loanId: req.params.loanId,
      alertId: req.params.alertId,
      payload: req.body,
    });
    res.json({ success: true, message: 'Loan alert updated successfully', data: { alert } });
  }));

  router.get('/:id/calendar', authMiddleware(), asyncHandler(async (req, res) => {
    const calendar = await useCases.getPaymentCalendar({ actor: req.user, loanId: req.params.id, asOfDate: req.query.asOfDate });
    res.json({ success: true, data: { calendar } });
  }));

  router.get('/:loanId/installments/:installmentNumber/quote', authMiddleware(['admin', 'customer']), asyncHandler(async (req, res) => {
    const quote = await useCases.getInstallmentQuote({
      actor: req.user,
      loanId: req.params.loanId,
      installmentNumber: req.params.installmentNumber,
      asOfDate: req.query.asOfDate,
    });
    res.json({ success: true, data: { quote } });
  }));

  router.get('/:id/payoff-quote', authMiddleware(), loanValidation.payoffQuote, asyncHandler(async (req, res) => {
    const payoffQuote = await useCases.getPayoffQuote({ actor: req.user, loanId: req.params.id, asOfDate: req.query.asOfDate });
    res.json({ success: true, data: { payoffQuote } });
  }));

  router.post('/:id/payoff-executions', authMiddleware(['admin', 'customer']), loanValidation.payoffExecute, asyncHandler(async (req, res) => {
    const result = await useCases.executePayoff({
      actor: req.user,
      loanId: req.params.id,
      asOfDate: req.body.asOfDate,
      quotedTotal: req.body.quotedTotal,
    });

    res.status(201).json({
      success: true,
      message: 'Payoff executed successfully',
      data: {
        payment: result.payment,
        loan: result.loan,
        allocation: result.allocation,
      },
    });
  }));

  router.get('/:id/promises', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const promises = await useCases.listPromisesToPay({ actor: req.user, loanId: req.params.id });
    res.json({ success: true, count: promises.length, data: { promises } });
  }));

  router.post('/:id/promises', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const promise = await useCases.createPromiseToPay({ actor: req.user, loanId: req.params.id, payload: req.body });
    res.status(201).json({ success: true, message: 'Promise to pay created successfully', data: { promise } });
  }));

  router.patch('/:loanId/promises/:promiseId/status', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const promise = await useCases.updatePromiseToPayStatus({
      actor: req.user,
      loanId: req.params.loanId,
      promiseId: req.params.promiseId,
      payload: req.body,
    });
    res.json({ success: true, message: 'Promise to pay updated successfully', data: { promise } });
  }));

  router.get('/:loanId/promises/:promiseId/download', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const download = await useCases.downloadPromiseToPay({
      actor: req.user,
      loanId: req.params.loanId,
      promiseId: req.params.promiseId,
    });

    sendBufferDownload(res, download);
  }));

  router.post('/:id/attachments', authMiddleware(['admin']), attachmentUpload.single('file'), asyncHandler(async (req, res) => {
    const attachment = await useCases.createLoanAttachment({
      actor: req.user,
      loanId: req.params.id,
      file: req.file,
      metadata: req.body,
    });

    res.status(201).json({
      success: true,
      message: 'Attachment uploaded successfully',
      data: { attachment },
    });
  }));

  router.get('/:id/attachments/:attachmentId/download', authMiddleware(), asyncHandler(async (req, res) => {
    const download = await useCases.downloadLoanAttachment({
      actor: req.user,
      loanId: req.params.id,
      attachmentId: req.params.attachmentId,
    });

    sendPathDownload(res, {
      absolutePath: download.absolutePath,
      fileName: download.attachment.originalName,
    });
  }));

  router.delete('/:id', authMiddleware(['customer', 'admin']), asyncHandler(async (req, res) => {
    await useCases.deleteLoan({ actor: req.user, loanId: req.params.id });
    res.json({ success: true, message: 'Loan deleted successfully' });
  }));

  router.get('/:id', authMiddleware(), asyncHandler(async (req, res) => {
    const loan = await useCases.getLoanById({ actor: req.user, loanId: req.params.id });
    res.json({ success: true, data: { loan } });
  }));

  // Update payment method (admin only, not reconciled)
  router.patch('/:loanId/payments/:paymentId', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const payment = await paymentApplicationService.updatePaymentMethod({
      loanId: req.params.loanId,
      paymentId: req.params.paymentId,
      paymentMethod: req.body.paymentMethod,
      actor: req.user,
    });
    res.json({ success: true, message: 'Payment method updated successfully', data: { payment } });
  }));

  // Annul installment (admin only)
  router.post('/:loanId/installments/:installmentNumber/annul', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await paymentApplicationService.annulInstallment({
      loanId: req.params.loanId,
      installmentNumber: req.params.installmentNumber,
      actor: req.user,
      reason: req.body.reason,
    });
    res.status(201).json({
      success: true,
      message: 'Installment annulled successfully',
      data: {
        payment: result.payment,
        annulment: result.annulment,
        loan: result.loan,
      },
    });
  }));

  // Update late fee rate
  router.patch('/:loanId/late-fee-rate', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const { lateFeeRate } = req.body;
    const loan = await useCases.updateLateFeeRate({
      actor: req.user,
      loanId: req.params.loanId,
      lateFeeRate,
    });
    res.json({ success: true, message: 'Late fee rate updated successfully', data: { loan } });
  }));

  return router;
};

module.exports = {
  createCreditsRouter,
};
