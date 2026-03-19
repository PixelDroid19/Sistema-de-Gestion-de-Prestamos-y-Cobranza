const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createCreditsRouter = ({ authMiddleware, attachmentUpload, loanValidation, useCases }) => {
  const router = express.Router();

  router.get('/', authMiddleware(), asyncHandler(async (req, res) => {
    const loans = await useCases.listLoans({ actor: req.user });
    res.json({ success: true, count: loans.length, data: { loans } });
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

  router.get('/customer/:customerId', authMiddleware(['customer']), asyncHandler(async (req, res) => {
    const result = await useCases.listLoansByCustomer({ actor: req.user, customerId: req.params.customerId });
    res.json({ success: true, count: result.loans.length, data: result });
  }));

  router.get('/agent/:agentId', authMiddleware(['agent']), asyncHandler(async (req, res) => {
    const result = await useCases.listLoansByAgent({ actor: req.user, agentId: req.params.agentId });
    res.json({ success: true, count: result.loans.length, data: result });
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

  router.patch('/:id/status', authMiddleware(['admin', 'agent']), loanValidation.updateStatus, asyncHandler(async (req, res) => {
    const loan = await useCases.updateLoanStatus({ actor: req.user, loanId: req.params.id, status: req.body.status });
    res.json({ success: true, message: `Loan status updated to ${req.body.status}`, data: { loan } });
  }));

  router.patch('/:id/assign-agent', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const loan = await useCases.assignAgent({ actor: req.user, loanId: req.params.id, agentId: req.body.agentId });
    res.json({ success: true, message: 'Agent assigned successfully', data: { loan } });
  }));

  router.patch('/:id/recovery-status', authMiddleware(['admin', 'agent']), asyncHandler(async (req, res) => {
    const loan = await useCases.updateRecoveryStatus({ actor: req.user, loanId: req.params.id, recoveryStatus: req.body.recoveryStatus });
    res.json({ success: true, message: 'Recovery status updated successfully', data: { loan } });
  }));

  router.get('/:id/attachments', authMiddleware(), asyncHandler(async (req, res) => {
    const attachments = await useCases.listLoanAttachments({ actor: req.user, loanId: req.params.id });
    res.json({ success: true, count: attachments.length, data: { attachments } });
  }));

  router.get('/:id/alerts', authMiddleware(['admin', 'agent']), asyncHandler(async (req, res) => {
    const alerts = await useCases.listLoanAlerts({ actor: req.user, loanId: req.params.id });
    res.json({ success: true, count: alerts.length, data: { alerts } });
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

  router.get('/:id/promises', authMiddleware(['admin', 'agent']), asyncHandler(async (req, res) => {
    const promises = await useCases.listPromisesToPay({ actor: req.user, loanId: req.params.id });
    res.json({ success: true, count: promises.length, data: { promises } });
  }));

  router.post('/:id/promises', authMiddleware(['admin', 'agent']), asyncHandler(async (req, res) => {
    const promise = await useCases.createPromiseToPay({ actor: req.user, loanId: req.params.id, payload: req.body });
    res.status(201).json({ success: true, message: 'Promise to pay created successfully', data: { promise } });
  }));

  router.post('/:id/attachments', authMiddleware(['admin', 'agent']), attachmentUpload.single('file'), asyncHandler(async (req, res) => {
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

  router.delete('/:id', authMiddleware(['customer', 'admin', 'agent']), asyncHandler(async (req, res) => {
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
