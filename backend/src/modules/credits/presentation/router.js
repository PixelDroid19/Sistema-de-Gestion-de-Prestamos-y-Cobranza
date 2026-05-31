const express = require('express');
const { asyncHandler, ValidationError } = require('@/utils/errorHandler');
const { createPaymentRouter } = require('./paymentRouter');
const { attachPagination } = require('@/middleware/validation');
const { sendBufferDownload, sendPathDownload } = require('@/modules/shared/http');
const { validateCurrencyPrecision } = require('@/modules/shared/money');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');

const SEARCH_AMOUNT_LABELS = {
  minAmount: 'monto mínimo',
  maxAmount: 'monto máximo',
};
const CALCULATION_PROFILE_RESPONSE_REQUIRED_MESSAGE = 'El cálculo de crédito no devolvió una versión de perfil activa.';
const getSearchAmountLabel = (fieldName) => SEARCH_AMOUNT_LABELS[fieldName] || 'monto';

/**
 * Composes the credit HTTP surface from authorization, upload middleware,
 * validation, credit use cases and payment-domain services.
 * @param {{ authMiddleware: Function, attachmentUpload: object, loanValidation: object, useCases: object, paymentApplicationService: object, loanAccessPolicy: object }} dependencies
 * @returns {import('express').Router} Express router for credit lifecycle, servicing and attachments.
 */
const createCreditsRouter = ({ authMiddleware, attachmentUpload, loanValidation, useCases, paymentApplicationService, loanAccessPolicy }) => {
  const router = express.Router();
  const requirePermission = (permission) => authMiddleware({ permissions: [permission] });
  const resolveIdempotencyKey = (req) => req.headers['idempotency-key'] || null;
  const requireIdempotencyKey = (req) => {
    const rawKey = resolveIdempotencyKey(req);
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (typeof key !== 'string' || key.trim() === '') {
      throw new ValidationError('El encabezado Idempotency-Key es obligatorio para operaciones financieras');
    }

    return key.trim();
  };
  /**
   * Parses optional credit amount filters without accepting exponent notation
   * or JavaScript partial-number coercions.
   * @param {string|number|null|undefined} value
   * @param {string} fieldName
   * @returns {number|undefined}
   */
  const parseOptionalCreditAmountFilter = (value, fieldName) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (!validateCurrencyPrecision(value)) {
      throw new ValidationError(`El ${getSearchAmountLabel(fieldName)} debe ser un valor monetario válido.`);
    }

    const amount = Number(typeof value === 'string' ? value.trim() : value);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ValidationError(`El ${getSearchAmountLabel(fieldName)} debe ser mayor o igual a 0.`);
    }

    return amount;
  };
  /**
   * Parses comma-separated loan ID query filters without accepting exponent,
   * decimal, or mixed alphanumeric identifiers.
   * @param {string|string[]|null|undefined} value
   * @returns {number[]}
   */
  const parseOptionalLoanIdList = (value) => {
    const rawLoanIds = Array.isArray(value)
      ? value.join(',')
      : String(value || '');
    const entries = rawLoanIds
      .split(',')
      .map((loanId) => loanId.trim())
      .filter(Boolean);

    for (const loanId of entries) {
      if (!validateIntegerId(loanId)) {
        throw new ValidationError(buildInvalidIntegerIdMessage('loanIds'));
      }
    }

    return entries.map((loanId) => Number(loanId));
  };
  /**
   * Parses required route identifiers without accepting exponent notation,
   * decimals, zero, negatives, or mixed alphanumeric values.
   * @param {string|number} value
   * @param {string} fieldName
   * @returns {number}
   */
  const parseRequiredRouteId = (value, fieldName) => {
    if (!validateIntegerId(value)) {
      throw new ValidationError(buildInvalidIntegerIdMessage(fieldName));
    }

    return Number(String(value).trim());
  };

  const paymentRouter = createPaymentRouter({
    authMiddleware,
    paymentApplicationService,
    loanAccessPolicy,
  });
  router.use('/payments', paymentRouter);

  router.get('/', requirePermission('CREDITS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    const result = await useCases.listLoans({ actor: req.user, pagination: req.pagination });
    if (result?.pagination) {
      res.json({ success: true, count: result.pagination.totalItems, data: { loans: result.items, pagination: result.pagination } });
      return;
    }

    res.json({ success: true, count: result.length, data: { loans: result } });
  }));

  const sendCreditCalculation = async (req, res) => {
    const calculation = await useCases.createCreditCalculation(req.body);
    if (!calculation.calculationVersionId || !calculation.calculationProfileVersionId) {
      throw new ValidationError(CALCULATION_PROFILE_RESPONSE_REQUIRED_MESSAGE);
    }

    res.json({
      success: true,
      message: 'Cálculo de crédito generado correctamente',
      data: {
        calculation: {
          calculationVersionId: calculation.calculationVersionId,
          calculationProfileVersionId: calculation.calculationProfileVersionId,
          method: calculation.method,
          inputs: calculation.inputs,
          lateFeeMode: calculation.lateFeeMode,
          summary: calculation.summary,
          schedule: calculation.schedule,
          policySnapshot: calculation.policySnapshot ?? null,
          explanation: calculation.explanation ?? null,
        },
      },
    });
  };

  router.post('/calculations', requirePermission('CREDITS_VIEW_ALL'), loanValidation.simulate, asyncHandler(sendCreditCalculation));

  router.get('/customer/:customerId', requirePermission('CREDITS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.customerId, 'customerId');
    const result = await useCases.listLoansByCustomer({ actor: req.user, customerId, pagination: req.pagination });
    res.json({ success: true, count: result.pagination?.totalItems ?? result.loans.length, data: result });
  }));

  router.post('/', requirePermission('CREDITS_CREATE'), loanValidation.create, asyncHandler(async (req, res) => {
    const loan = await useCases.createLoan({
      actor: req.user,
      payload: req.body,
      idempotencyKey: requireIdempotencyKey(req),
    });
    res.status(201).json({
      success: true,
      message: 'Solicitud de crédito registrada correctamente',
      data: {
        loan,
        financialSummary: loan.financialSnapshot,
      },
    });
  }));

  // Keep specific/static paths before any '/:id' route to avoid shadowing.
  router.get('/statistics', requirePermission('DASHBOARD_VIEW_ALL'), asyncHandler(async (req, res) => {
    const statistics = await useCases.getLoanStatistics();
    res.json({ success: true, data: { statistics } });
  }));

  router.get('/due-payments', requirePermission('CREDITS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, error: { message: 'La fecha de consulta es obligatoria.' } });
    }
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, error: { message: 'La fecha de consulta debe ser válida.' } });
    }
    const duePayments = await useCases.getDuePayments({ date: parsedDate });
    res.json({ success: true, count: duePayments.length, data: { duePayments } });
  }));

  router.get('/search', requirePermission('CREDITS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    const filters = {
      search: req.query.search,
      status: req.query.status,
      minAmount: parseOptionalCreditAmountFilter(req.query.minAmount, 'minAmount'),
      maxAmount: parseOptionalCreditAmountFilter(req.query.maxAmount, 'maxAmount'),
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

  router.get('/calendar/overview', requirePermission('CREDITS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const loanIds = parseOptionalLoanIdList(req.query.loanIds);

    const calendar = await useCases.getPaymentCalendarOverview({
      actor: req.user,
      loanIds,
      asOfDate: req.query.asOfDate,
      filters: {
        search: req.query.search,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: req.query.limit,
      },
    });

    res.json({ success: true, data: { calendar } });
  }));

  router.patch('/:id/status', requirePermission('CREDITS_UPDATE'), loanValidation.updateStatus, asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const loan = await useCases.updateLoanStatus({ actor: req.user, loanId, status: req.body.status });
    res.json({ success: true, message: 'Estado del crédito actualizado correctamente', data: { loan } });
  }));

  router.patch('/:id/recovery-status', requirePermission('CREDITS_UPDATE'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const loan = await useCases.updateRecoveryStatus({ actor: req.user, loanId, recoveryStatus: req.body.recoveryStatus });
    res.json({ success: true, message: 'Estado de recuperación actualizado correctamente', data: { loan } });
  }));

  router.get('/:id/attachments', requirePermission('CREDITS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const attachments = await useCases.listLoanAttachments({ actor: req.user, loanId });
    res.json({ success: true, count: attachments.length, data: { attachments } });
  }));

  router.get('/:id/alerts', requirePermission('CREDITS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const alerts = await useCases.listLoanAlerts({ actor: req.user, loanId });
    res.json({ success: true, count: alerts.length, data: { alerts } });
  }));

  router.post('/:id/follow-ups', requirePermission('CREDITS_UPDATE'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const result = await useCases.createLoanFollowUp({ actor: req.user, loanId, payload: req.body });
    res.status(201).json({
      success: true,
      message: 'Recordatorio de seguimiento creado correctamente',
      data: result,
    });
  }));

  router.patch('/:loanId/alerts/:alertId/status', requirePermission('CREDITS_UPDATE'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.loanId, 'loanId');
    const alertId = parseRequiredRouteId(req.params.alertId, 'alertId');
    const alert = await useCases.updateLoanAlertStatus({
      actor: req.user,
      loanId,
      alertId,
      payload: req.body,
    });
    res.json({ success: true, message: 'Alerta del crédito actualizada correctamente', data: { alert } });
  }));

  router.get('/:id/calendar', requirePermission('CREDITS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const calendar = await useCases.getPaymentCalendar({ actor: req.user, loanId, asOfDate: req.query.asOfDate });
    res.json({ success: true, data: { calendar } });
  }));

  router.get('/:loanId/installments/:installmentNumber/quote', requirePermission('CREDITS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.loanId, 'loanId');
    const installmentNumber = parseRequiredRouteId(req.params.installmentNumber, 'installmentNumber');
    const quote = await useCases.getInstallmentQuote({
      actor: req.user,
      loanId,
      installmentNumber,
      asOfDate: req.query.asOfDate,
    });
    res.json({ success: true, data: { quote } });
  }));

  router.get('/:id/payoff-quote', requirePermission('CREDITS_VIEW_ALL'), loanValidation.payoffQuote, asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const payoffQuote = await useCases.getPayoffQuote({ actor: req.user, loanId, asOfDate: req.query.asOfDate });
    res.json({ success: true, data: { payoffQuote } });
  }));

  router.post('/:id/payoff-executions', requirePermission('PAYMENTS_CREATE'), loanValidation.payoffExecute, asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const result = await useCases.executePayoff({
      actor: req.user,
      loanId,
      asOfDate: req.body.asOfDate,
      quotedTotal: req.body.quotedTotal,
      idempotencyKey: requireIdempotencyKey(req),
    });

    res.status(201).json({
      success: true,
      message: 'Pago total registrado correctamente',
      data: {
        payment: result.payment,
        loan: result.loan,
        allocation: result.allocation,
      },
    });
  }));

  router.get('/:id/promises', requirePermission('CREDITS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const promises = await useCases.listPromisesToPay({ actor: req.user, loanId });
    res.json({ success: true, count: promises.length, data: { promises } });
  }));

  router.post('/:id/promises', requirePermission('CREDITS_UPDATE'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const promise = await useCases.createPromiseToPay({ actor: req.user, loanId, payload: req.body });
    res.status(201).json({ success: true, message: 'Promesa de pago creada correctamente', data: { promise } });
  }));

  router.patch('/:loanId/promises/:promiseId/status', requirePermission('CREDITS_UPDATE'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.loanId, 'loanId');
    const promiseId = parseRequiredRouteId(req.params.promiseId, 'promiseId');
    const promise = await useCases.updatePromiseToPayStatus({
      actor: req.user,
      loanId,
      promiseId,
      payload: req.body,
    });
    res.json({ success: true, message: 'Promesa de pago actualizada correctamente', data: { promise } });
  }));

  router.get('/:loanId/promises/:promiseId/download', requirePermission('CREDITS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.loanId, 'loanId');
    const promiseId = parseRequiredRouteId(req.params.promiseId, 'promiseId');
    const download = await useCases.downloadPromiseToPay({
      actor: req.user,
      loanId,
      promiseId,
    });

    sendBufferDownload(res, download);
  }));

  router.post('/:id/attachments', requirePermission('CREDITS_UPDATE'), attachmentUpload.single('file'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const attachment = await useCases.createLoanAttachment({
      actor: req.user,
      loanId,
      file: req.file,
      metadata: req.body,
    });

    res.status(201).json({
      success: true,
      message: 'Documento del crédito cargado correctamente',
      data: { attachment },
    });
  }));

  router.get('/:id/attachments/:attachmentId/download', requirePermission('CREDITS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const attachmentId = parseRequiredRouteId(req.params.attachmentId, 'attachmentId');
    const download = await useCases.downloadLoanAttachment({
      actor: req.user,
      loanId,
      attachmentId,
    });

    sendPathDownload(res, {
      absolutePath: download.absolutePath,
      fileName: download.attachment.originalName,
    });
  }));

  router.delete('/:id', requirePermission('CREDITS_DELETE'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    await useCases.deleteLoan({ actor: req.user, loanId });
    res.json({ success: true, message: 'Crédito cancelado correctamente' });
  }));

  router.get('/:id', requirePermission('CREDITS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.id, 'loanId');
    const loan = await useCases.getLoanById({ actor: req.user, loanId });
    res.json({ success: true, data: { loan } });
  }));

  // Update payment method (admin only, not reconciled)
  router.patch('/:loanId/payments/:paymentId', requirePermission('PAYMENTS_UPDATE'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.loanId, 'loanId');
    const paymentId = parseRequiredRouteId(req.params.paymentId, 'paymentId');
    const payment = await paymentApplicationService.updatePaymentMethod({
      loanId,
      paymentId,
      paymentMethod: req.body.paymentMethod,
      actor: req.user,
    });
    res.json({ success: true, message: 'Método de pago actualizado correctamente', data: { payment } });
  }));

  // Annul installment (admin only)
  router.post('/:loanId/installments/:installmentNumber/annul', requirePermission('PAYMENTS_REVERSE'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.loanId, 'loanId');
    const installmentNumber = parseRequiredRouteId(req.params.installmentNumber, 'installmentNumber');
    const result = await paymentApplicationService.annulInstallment({
      loanId,
      installmentNumber,
      actor: req.user,
      reason: req.body.reason,
      idempotencyKey: requireIdempotencyKey(req),
    });
    res.status(201).json({
      success: true,
      message: 'Cuota anulada correctamente',
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
    const loanId = parseRequiredRouteId(req.params.loanId, 'loanId');
    const loan = await useCases.updateLateFeeRate({
      actor: req.user,
      loanId,
      lateFeeRate,
    });
    res.json({ success: true, message: 'Tasa de mora actualizada correctamente', data: { loan } });
  }));

  return router;
};

module.exports = {
  createCreditsRouter,
};
