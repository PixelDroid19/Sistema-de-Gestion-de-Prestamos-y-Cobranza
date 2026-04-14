const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');
const { attachPagination } = require('../../../middleware/validation');
const { sendBufferDownload, sendPathDownload } = require('../../shared/http');

const createPayoutsRouter = ({ authMiddleware, attachmentUpload, paymentValidation, useCases }) => {
  const router = express.Router();

  // List all payments (admin only)
  router.get('/', authMiddleware(['admin']), attachPagination(), asyncHandler(async (req, res) => {
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
    const result = await useCases.createCapitalPayment({
      actor: req.user,
      ...req.body,
      strategy: req.body?.strategy,
    });
    res.status(201).json({
      success: true,
      message: 'Capital reduction payment created successfully',
      data: {
        payment: result.payment,
        allocation: result.allocation,
        loan: result.loan,
        strategy: req.body?.strategy || 'REDUCE_TIME',
        strategyApplied: 'REDUCE_TIME',
      },
    });
  }));

  router.post('/calculate-total-debt', authMiddleware(['admin', 'customer']), asyncHandler(async (req, res) => {
    const result = await useCases.calculateTotalDebt({
      actor: req.user,
      loanId: req.body.loanId,
      asOfDate: req.body.asOfDate,
    });
    res.json({ success: true, data: result });
  }));

  router.post('/pay-total-debt', authMiddleware(['customer']), asyncHandler(async (req, res) => {
    const result = await useCases.payTotalDebt({
      actor: req.user,
      loanId: req.body.loanId,
      asOfDate: req.body.asOfDate,
      quotedTotal: req.body.quotedTotal,
    });
    res.status(201).json({
      success: true,
      message: 'Total debt paid successfully',
      data: {
        payment: result.payment,
        loan: result.loan,
        allocation: result.allocation,
      },
    });
  }));

  // Annul installment (admin only)
  router.post('/annul/:loanId', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.annulInstallment({
      actor: req.user,
      loanId: req.params.loanId,
      installmentNumber: req.body?.installmentNumber,
      reason: req.body?.reason,
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

  // Get payments for a specific loan
  router.get('/loan/:loanId', authMiddleware(), attachPagination(), asyncHandler(async (req, res) => {
    const result = await useCases.listPaymentsByLoan({ actor: req.user, loanId: req.params.loanId, pagination: req.pagination });
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

  router.patch('/:paymentId/metadata', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const payment = await useCases.updatePaymentMetadata({
      actor: req.user,
      paymentId: req.params.paymentId,
      payload: req.body,
    });
    res.json({ success: true, message: 'Payment metadata updated successfully', data: { payment } });
  }));

  router.get('/:paymentId/documents', authMiddleware(['admin', 'customer']), asyncHandler(async (req, res) => {
    const documents = await useCases.listPaymentDocuments({ actor: req.user, paymentId: req.params.paymentId });
    res.json({ success: true, count: documents.length, data: { documents } });
  }));

  router.post('/:paymentId/documents', authMiddleware(['admin']), attachmentUpload.single('file'), asyncHandler(async (req, res) => {
    const document = await useCases.uploadPaymentDocument({
      actor: req.user,
      paymentId: req.params.paymentId,
      file: req.file,
      metadata: req.body,
    });
    res.status(201).json({ success: true, message: 'Payment document uploaded successfully', data: { document } });
  }));

  router.get('/:paymentId/documents/:documentId/download', authMiddleware(['admin', 'customer']), asyncHandler(async (req, res) => {
    const download = await useCases.downloadPaymentDocument({
      actor: req.user,
      paymentId: req.params.paymentId,
      documentId: req.params.documentId,
    });
    sendPathDownload(res, {
      absolutePath: download.absolutePath,
      fileName: download.document.originalName,
    });
  }));

  // TASK-009: PDF voucher download endpoint
  router.get('/:paymentId/voucher/pdf', authMiddleware(['admin', 'customer']), asyncHandler(async (req, res) => {
    const voucher = await useCases.getPaymentVoucher({
      actor: req.user,
      paymentId: req.params.paymentId,
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
