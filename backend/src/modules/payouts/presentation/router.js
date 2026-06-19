const express = require('express');
const { asyncHandler, AuthorizationError, ValidationError } = require('@/utils/errorHandler');
const { attachPagination } = require('@/middleware/validation');
const { sendBufferDownload, sendPathDownload } = require('@/modules/shared/http');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');

/**
 * Composes payout and voucher routes from authorization, upload middleware,
 * payment validation and payout use cases.
 * @param {{ authMiddleware: Function, attachmentUpload: object, paymentValidation: object, useCases: object }} dependencies
 * @returns {import('express').Router} Express router for administrative payment collection.
 */
const createPayoutsRouter = ({ authMiddleware, attachmentUpload, paymentValidation, useCases }) => {
  const router = express.Router();
  const requirePermission = (permission) => authMiddleware({ permissions: [permission] });
  const resolveIdempotencyKey = (req) => req.headers['idempotency-key'] || null;
  const isBackofficeActor = (actor) => ['admin', 'employee'].includes(actor?.role);
  const assertBackofficeActor = (actor, message) => {
    if (!isBackofficeActor(actor)) {
      throw new AuthorizationError(message);
    }
  };
  const requireBackofficeIdempotencyKey = (req) => (
    isBackofficeActor(req.user) ? requireIdempotencyKey(req) : null
  );
  const requireIdempotencyKey = (req) => {
    const rawKey = resolveIdempotencyKey(req);
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (typeof key !== 'string' || key.trim() === '') {
      throw new ValidationError('El encabezado Idempotency-Key es obligatorio para operaciones financieras');
    }

    return key.trim();
  };
  /**
   * Parse positive route identifiers without accepting exponent, decimal or
   * mixed alphanumeric values.
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

  // List all payments (authorized backoffice users only).
  router.get('/', requirePermission('PAYMENTS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    if (req.query.loanId !== undefined && req.query.loanId !== null && req.query.loanId !== '') {
      const loanId = parseRequiredRouteId(req.query.loanId, 'loanId');
      const result = await useCases.listPaymentsByLoan({ actor: req.user, loanId, pagination: req.pagination });
      if (result?.pagination) {
        res.json({
          success: true,
          count: result.pagination.totalItems,
          data: {
            payments: result.items,
            loan: result.loan,
            pagination: result.pagination,
          },
        });
        return;
      }

      res.json({
        success: true,
        count: Array.isArray(result?.payments) ? result.payments.length : 0,
        data: {
          payments: Array.isArray(result?.payments) ? result.payments : [],
          loan: result?.loan || null,
        },
      });
      return;
    }

    const result = await useCases.listPayments({
      actor: req.user,
      pagination: req.pagination,
      filters: {
        search: req.query.search,
        status: req.query.status,
      },
    });
    if (result?.pagination) {
      res.json({ success: true, count: result.pagination.totalItems, data: { payments: result.items, pagination: result.pagination } });
      return;
    }

    res.json({ success: true, count: result.length, data: result });
  }));

  // Create regular payment (authorized backoffice users only).
  router.post('/', requirePermission('PAYMENTS_CREATE'), paymentValidation.create, asyncHandler(async (req, res) => {
    const result = await useCases.createPayment({ actor: req.user, ...req.body, idempotencyKey: requireIdempotencyKey(req) });
    res.status(201).json({
      success: true,
      message: 'Pago registrado correctamente',
      data: {
        payment: result.payment,
        allocation: result.allocation,
        loan: result.loan,
      },
    });
  }));

  // Create partial payment (authorized backoffice users only).
  router.post('/partial', requirePermission('PAYMENTS_CREATE'), asyncHandler(async (req, res) => {
    assertBackofficeActor(req.user, 'Solo usuarios administrativos autorizados pueden crear pagos parciales.');
    const result = await useCases.createPartialPayment({ actor: req.user, ...req.body, idempotencyKey: requireBackofficeIdempotencyKey(req) });
    res.status(201).json({
      success: true,
      message: 'Abono parcial registrado correctamente',
      data: {
        payment: result.payment,
        allocation: result.allocation,
        loan: result.loan,
      },
    });
  }));

  // Project a capital reduction (dry-run) so the UI preview reuses the apply engine.
  router.post('/capital/preview', requirePermission('PAYMENTS_CREATE'), asyncHandler(async (req, res) => {
    assertBackofficeActor(req.user, 'Solo usuarios administrativos autorizados pueden simular abonos a capital.');
    const preview = await useCases.previewCapitalPayment({
      actor: req.user,
      loanId: req.body?.loanId,
      amount: req.body?.amount,
      strategy: req.body?.strategy,
      newTermMonths: req.body?.newTermMonths,
    });
    res.json({ success: true, data: { preview } });
  }));

  // Create capital reduction payment (authorized backoffice users only).
  router.post('/capital', requirePermission('PAYMENTS_CREATE'), asyncHandler(async (req, res) => {
    assertBackofficeActor(req.user, 'Solo usuarios administrativos autorizados pueden registrar abonos a capital.');
    const result = await useCases.createCapitalPayment({
      actor: req.user,
      ...req.body,
      strategy: req.body?.strategy,
      idempotencyKey: requireBackofficeIdempotencyKey(req),
    });
    res.status(201).json({
      success: true,
      message: 'Abono a capital registrado correctamente',
      data: {
        payment: result.payment,
        allocation: result.allocation,
        loan: result.loan,
        strategy: result.allocation?.strategyRequested || req.body?.strategy || 'reduce_term',
        strategyApplied: result.allocation?.strategyApplied || 'reduce_term',
      },
    });
  }));

  router.post('/calculate-total-debt', requirePermission('PAYMENTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const result = await useCases.calculateTotalDebt({
      actor: req.user,
      loanId: req.body.loanId,
      asOfDate: req.body.asOfDate,
    });
    res.json({ success: true, data: result });
  }));

  router.post('/pay-total-debt', requirePermission('PAYMENTS_CREATE'), asyncHandler(async (req, res) => {
    const result = await useCases.payTotalDebt({
      actor: req.user,
      loanId: req.body.loanId,
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

  // Annul installment (authorized backoffice users only).
  router.post('/annul/:loanId', requirePermission('PAYMENTS_REVERSE'), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.loanId, 'loanId');
    const result = await useCases.annulInstallment({
      actor: req.user,
      loanId,
      installmentNumber: req.body?.installmentNumber,
      reason: req.body?.reason,
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

  // Get payments for a specific loan
  router.get('/loan/:loanId', requirePermission('PAYMENTS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    const loanId = parseRequiredRouteId(req.params.loanId, 'loanId');
    const result = await useCases.listPaymentsByLoan({ actor: req.user, loanId, pagination: req.pagination });
    if (result?.pagination) {
      res.json({
        success: true,
        count: result.pagination.totalItems,
        data: {
          payments: result.items,
          loan: result.loan,
          pagination: result.pagination,
        },
      });
      return;
    }

    res.json({
      success: true,
      count: Array.isArray(result?.payments) ? result.payments.length : 0,
      data: {
        payments: Array.isArray(result?.payments) ? result.payments : [],
        loan: result?.loan || null,
      },
    });
  }));

  router.patch('/:paymentId/metadata', requirePermission('PAYMENTS_UPDATE'), asyncHandler(async (req, res) => {
    const paymentId = parseRequiredRouteId(req.params.paymentId, 'paymentId');
    const payment = await useCases.updatePaymentMetadata({
      actor: req.user,
      paymentId,
      payload: req.body,
    });
    res.json({ success: true, message: 'Datos del pago actualizados correctamente', data: { payment } });
  }));

  router.get('/:paymentId/documents', requirePermission('PAYMENTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const paymentId = parseRequiredRouteId(req.params.paymentId, 'paymentId');
    const documents = await useCases.listPaymentDocuments({ actor: req.user, paymentId });
    res.json({ success: true, count: documents.length, data: { documents } });
  }));

  router.post('/:paymentId/documents', requirePermission('PAYMENTS_UPDATE'), attachmentUpload.single('file'), asyncHandler(async (req, res) => {
    const paymentId = parseRequiredRouteId(req.params.paymentId, 'paymentId');
    const document = await useCases.uploadPaymentDocument({
      actor: req.user,
      paymentId,
      file: req.file,
      metadata: req.body,
    });
    res.status(201).json({ success: true, message: 'Documento de pago cargado correctamente', data: { document } });
  }));

  router.get('/:paymentId/documents/:documentId/download', requirePermission('PAYMENTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const paymentId = parseRequiredRouteId(req.params.paymentId, 'paymentId');
    const documentId = parseRequiredRouteId(req.params.documentId, 'documentId');
    const download = await useCases.downloadPaymentDocument({
      actor: req.user,
      paymentId,
      documentId,
    });
    sendPathDownload(res, {
      absolutePath: download.absolutePath,
      fileName: download.document.originalName,
    });
  }));

  router.get('/:paymentId/voucher/pdf', requirePermission('PAYMENTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const paymentId = parseRequiredRouteId(req.params.paymentId, 'paymentId');
    const voucher = await useCases.getPaymentVoucher({
      actor: req.user,
      paymentId,
    });
    sendBufferDownload(res, {
      contentType: 'application/pdf',
      fileName: voucher.filename,
      buffer: voucher.buffer,
    });
  }));

  return router;
};

module.exports = {
  createPayoutsRouter,
};
