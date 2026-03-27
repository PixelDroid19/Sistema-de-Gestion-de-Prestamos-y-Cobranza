const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');
const { createPaymentRouter } = require('./paymentRouter');
const { attachPagination } = require('../../../middleware/validation');

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

  router.post('/simulations', authMiddleware(), loanValidation.simulate, asyncHandler(async (req, res) => {
    const simulation = await useCases.createSimulation(req.body);
    res.json({
      success: true,
      message: 'Loan simulation generated successfully',
      data: {
        simulation: {
          lateFeeMode: simulation.lateFeeMode,
          summary: simulation.summary,
          schedule: simulation.schedule,
        },
      },
    });
  }));

  router.get('/workbench/graph', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.loadDagWorkbenchGraph({ actor: req.user, scopeKey: req.query.scope });
    res.json({ success: true, data: { graph: result.graphVersion } });
  }));

  router.post('/workbench/graph', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.saveDagWorkbenchGraph({
      actor: req.user,
      scopeKey: req.body.scopeKey,
      name: req.body.name,
      graph: req.body.graph,
    });
    res.status(201).json({ success: true, message: 'DAG graph saved successfully', data: { graph: result } });
  }));

  router.post('/workbench/graph/validate', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const validation = await useCases.validateDagWorkbenchGraph({
      actor: req.user,
      scopeKey: req.body.scopeKey,
      graph: req.body.graph,
    });
    res.json({ success: true, data: { validation } });
  }));

  router.post('/workbench/graph/simulations', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.simulateDagWorkbenchGraph({
      actor: req.user,
      scopeKey: req.body.scopeKey,
      graph: req.body.graph,
      simulationInput: req.body.simulationInput,
    });
    res.json({
      success: true,
      message: 'DAG workbench simulation generated successfully',
      data: {
        graph: result.graphVersion,
        validation: result.validation,
        simulation: result.simulation,
        summary: result.summary,
      },
    });
  }));

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

  router.patch('/workbench/graphs/:graphId/status', authMiddleware(['admin']), asyncHandler(async (req, res) => {
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

  router.get('/customer/:customerId', authMiddleware(['customer']), attachPagination(), asyncHandler(async (req, res) => {
    const result = await useCases.listLoansByCustomer({ actor: req.user, customerId: req.params.customerId, pagination: req.pagination });
    res.json({ success: true, count: result.pagination?.totalItems ?? result.loans.length, data: result });
  }));

  router.get('/recovery-roster', authMiddleware(['admin']), attachPagination(), asyncHandler(async (req, res) => {
    const result = await useCases.listRecoveryRoster({ actor: req.user, pagination: req.pagination });

    if (result?.pagination) {
      res.json({ success: true, count: result.pagination.totalItems, data: { recoveryRoster: result.items, pagination: result.pagination } });
      return;
    }

    res.json({ success: true, count: result.length, data: { recoveryRoster: result } });
  }));

  router.get('/recovery-roster/:recoveryAssigneeId/loans', authMiddleware(['admin']), attachPagination(), asyncHandler(async (req, res) => {
    const result = await useCases.listLoansByRecoveryAssignee({ actor: req.user, recoveryAssigneeId: req.params.recoveryAssigneeId, pagination: req.pagination });
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

  router.patch('/:id/status', authMiddleware(['admin']), loanValidation.updateStatus, asyncHandler(async (req, res) => {
    const loan = await useCases.updateLoanStatus({ actor: req.user, loanId: req.params.id, status: req.body.status });
    res.json({ success: true, message: `Loan status updated to ${req.body.status}`, data: { loan } });
  }));

  router.patch('/:id/recovery-assignment', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const loan = await useCases.assignRecoveryAssignee({ actor: req.user, loanId: req.params.id, recoveryAssigneeId: req.body.recoveryAssigneeId });
    res.json({ success: true, message: 'Recovery assignment updated successfully', data: { loan } });
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
    const calendar = await useCases.getPaymentCalendar({ actor: req.user, loanId: req.params.id });
    res.json({ success: true, data: { calendar } });
  }));

  router.get('/:id/payoff-quote', authMiddleware(), loanValidation.payoffQuote, asyncHandler(async (req, res) => {
    const payoffQuote = await useCases.getPayoffQuote({ actor: req.user, loanId: req.params.id, asOfDate: req.query.asOfDate });
    res.json({ success: true, data: { payoffQuote } });
  }));

  router.post('/:id/payoff-executions', authMiddleware(['customer']), loanValidation.payoffExecute, asyncHandler(async (req, res) => {
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

    res.setHeader('Content-Type', download.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${download.fileName}"`);
    res.send(download.buffer);
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

    res.download(download.absolutePath, download.attachment.originalName);
  }));

  router.delete('/:id', authMiddleware(['customer', 'admin']), asyncHandler(async (req, res) => {
    await useCases.deleteLoan({ actor: req.user, loanId: req.params.id });
    res.json({ success: true, message: 'Loan deleted successfully' });
  }));

  router.get('/:id', authMiddleware(), asyncHandler(async (req, res) => {
    const loan = await useCases.getLoanById({ actor: req.user, loanId: req.params.id });
    res.json({ success: true, data: { loan } });
  }));

  return router;
};

module.exports = {
  createCreditsRouter,
};
