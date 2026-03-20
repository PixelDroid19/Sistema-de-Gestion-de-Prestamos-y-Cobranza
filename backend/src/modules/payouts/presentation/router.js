const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createPayoutsRouter = ({ authMiddleware, paymentValidation, useCases }) => {
  const router = express.Router();

  // List all payments (admin only)
  router.get('/', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const payments = await useCases.listPayments({ actor: req.user });
    res.json({ success: true, count: payments.length, data: payments });
  }));

  // Create regular payment (customer)
  router.post('/', authMiddleware(['customer']), paymentValidation.create, asyncHandler(async (req, res) => {
    const result = await useCases.createPayment({ actor: req.user, ...req.body });
    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: {
        payment: result.payment,
        allocation: result.allocation,
        loan: result.loan,
      },
    });
  }));

  // Create partial payment (admin or customer)
  router.post('/partial', authMiddleware(['admin', 'customer']), asyncHandler(async (req, res) => {
    const result = await useCases.createPartialPayment({ actor: req.user, ...req.body });
    res.status(201).json({
      success: true,
      message: 'Partial payment created successfully',
      data: {
        payment: result.payment,
        allocation: result.allocation,
        loan: result.loan,
      },
    });
  }));

  // Create capital reduction payment (admin only)
  router.post('/capital', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.createCapitalPayment({ actor: req.user, ...req.body });
    res.status(201).json({
      success: true,
      message: 'Capital reduction payment created successfully',
      data: {
        payment: result.payment,
        allocation: result.allocation,
        loan: result.loan,
      },
    });
  }));

  // Annul installment (admin or agent)
  router.post('/annul/:loanId', authMiddleware(['admin', 'agent']), asyncHandler(async (req, res) => {
    const result = await useCases.annulInstallment({ actor: req.user, loanId: req.params.loanId });
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

  // Get payments for a specific loan
  router.get('/loan/:loanId', authMiddleware(), asyncHandler(async (req, res) => {
    const payments = await useCases.listPaymentsByLoan({ actor: req.user, loanId: req.params.loanId });
    res.json({ success: true, count: payments.length, data: payments });
  }));

  return router;
};

module.exports = {
  createPayoutsRouter,
};
