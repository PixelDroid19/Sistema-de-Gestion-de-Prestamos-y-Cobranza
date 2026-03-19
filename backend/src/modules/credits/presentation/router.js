const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createCreditsRouter = ({ authMiddleware, loanValidation, useCases }) => {
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
