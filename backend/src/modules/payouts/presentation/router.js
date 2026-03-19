const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createPayoutsRouter = ({ authMiddleware, paymentValidation, useCases }) => {
  const router = express.Router();

  router.get('/', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const payments = await useCases.listPayments({ actor: req.user });
    res.json({ success: true, count: payments.length, data: payments });
  }));

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

  router.get('/loan/:loanId', authMiddleware(), asyncHandler(async (req, res) => {
    const payments = await useCases.listPaymentsByLoan({ actor: req.user, loanId: req.params.loanId });
    res.json({ success: true, count: payments.length, data: payments });
  }));

  return router;
};

module.exports = {
  createPayoutsRouter,
};
