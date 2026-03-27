const express = require('express');
const { asyncHandler, ValidationError } = require('../../../utils/errorHandler');
const { createPaymentApplicationService } = require('../application/paymentApplicationService');
const { createLoanViewService } = require('../application/loanFinancials');

const createPaymentRouter = ({ authMiddleware, paymentApplicationService } = {}) => {
  const router = express.Router();

  const loanViewService = createLoanViewService();
  const paymentService = paymentApplicationService || createPaymentApplicationService({ loanViewService });

  const validateProcessPaymentBody = (req, res, next) => {
    const { loanId, paymentAmount, paymentDate } = req.body;

    if (!loanId) {
      throw new ValidationError('loanId is required');
    }

    if (!paymentAmount) {
      throw new ValidationError('paymentAmount is required');
    }

    if (typeof paymentAmount === 'string' && paymentAmount.trim() === '') {
      throw new ValidationError('paymentAmount cannot be empty');
    }

    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new ValidationError('paymentAmount must be a number greater than 0');
    }

    if (!paymentDate) {
      throw new ValidationError('paymentDate is required');
    }

    const parsedDate = new Date(paymentDate);
    if (isNaN(parsedDate.getTime())) {
      throw new ValidationError('paymentDate must be a valid ISO8601 date string');
    }

    next();
  };

  const { paymentLimiter } = require('../../../middleware/rateLimiter');

  /**
   * Process a payment using the DAG workbench logic.
   */
  router.post('/process', 
    authMiddleware ? authMiddleware() : (req, res, next) => { req.user = { id: 0, role: 'system' }; next(); }, 
    paymentLimiter,
    validateProcessPaymentBody, 
    asyncHandler(async (req, res) => {
      const { loanId, paymentAmount, paymentDate, idempotencyKey: bodyKey } = req.body;
      const actorId = req.user?.id || 0;
      const idempotencyKey = req.headers['idempotency-key'] || bodyKey;

      const result = await paymentService.processPayment({
        loanId,
        paymentAmount,
        paymentDate,
        actorId,
        idempotencyKey,
      });

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        transactionId: result.transactionId,
        status: result.status,
        newBalance: result.newBalance,
        breakdown: result.breakdown,
        paymentId: result.paymentId,
        idempotent: result.idempotent || false,
      },
    });
  }));

  return router;
};

module.exports = {
  createPaymentRouter,
};
