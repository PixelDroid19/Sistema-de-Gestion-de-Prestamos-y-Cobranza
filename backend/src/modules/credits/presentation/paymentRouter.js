const express = require('express');
const { asyncHandler, ValidationError } = require('@/utils/errorHandler');
const { createPaymentApplicationService } = require('@/modules/credits/application/paymentApplicationService');
const { createLoanViewService } = require('@/modules/credits/application/loanFinancials');
const { normalizeOperationalDate } = require('@/modules/shared/dateUtils');
const { parsePositiveCurrencyAmount } = require('@/modules/shared/money');
const { validateIntegerId } = require('@/modules/shared/validators');

/**
 * Composes the installment-payment subrouter used by the credits module,
 * including payment authorization, validation and idempotency enforcement.
 * @param {{ authMiddleware?: Function, paymentApplicationService?: object, loanAccessPolicy?: object }} dependencies
 * @returns {import('express').Router} Express router for processing credit installment payments.
 */
const createPaymentRouter = ({ authMiddleware, paymentApplicationService, loanAccessPolicy } = {}) => {
  const router = express.Router();
  const requirePermission = (permission) => authMiddleware({ permissions: [permission] });

  const loanViewService = createLoanViewService();
  const paymentService = paymentApplicationService || createPaymentApplicationService({ loanViewService });
  const resolveRequiredIdempotencyKey = (req) => {
    const rawKey = req.headers['idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (typeof key !== 'string' || key.trim() === '') {
      throw new ValidationError('El encabezado Idempotency-Key es obligatorio para operaciones financieras');
    }

    return key.trim();
  };

  const validateProcessPaymentBody = (req, res, next) => {
    const { loanId, paymentAmount, paymentDate, installmentNumber } = req.body;

    if (!loanId) {
      throw new ValidationError('El crédito es obligatorio');
    }

    if (!paymentAmount) {
      throw new ValidationError('El monto del pago es obligatorio');
    }

    if (typeof paymentAmount === 'string' && paymentAmount.trim() === '') {
      throw new ValidationError('El monto del pago no puede estar vacío');
    }

    if (parsePositiveCurrencyAmount(paymentAmount) === null) {
      throw new ValidationError('El monto del pago debe ser un número mayor que 0');
    }

    if (!paymentDate) {
      throw new ValidationError('La fecha de pago es obligatoria');
    }

    try {
      normalizeOperationalDate(paymentDate, 'paymentDate');
    } catch (_error) {
      throw new ValidationError('La fecha de pago debe ser una fecha válida');
    }

    if (installmentNumber !== undefined && installmentNumber !== null && installmentNumber !== '') {
      if (!validateIntegerId(installmentNumber)) {
        throw new ValidationError('El número de cuota debe ser un entero positivo');
      }
    }

    next();
  };

  const { paymentLimiter } = require('@/middleware/rateLimiter');

  /**
   * Process an installment payment for authorized backoffice operators.
   */
  router.post('/process', 
    authMiddleware ? requirePermission('PAYMENTS_CREATE') : (req, res, next) => { req.user = { id: 0, role: 'system' }; next(); },
    paymentLimiter,
    validateProcessPaymentBody, 
    asyncHandler(async (req, res) => {
      const { loanId, paymentAmount, paymentDate, paymentMethod, installmentNumber } = req.body;
      const actorId = req.user?.id || 0;
      const idempotencyKey = resolveRequiredIdempotencyKey(req);

      const result = await paymentService.processPayment({
        loanId,
        paymentAmount,
        paymentDate,
        paymentMethod,
        installmentNumber,
        actorId,
        idempotencyKey,
      });

    res.status(200).json({
      success: true,
      message: 'Pago procesado correctamente',
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
