const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');
const { attachPagination } = require('../../../middleware/validation');
const { sendPathDownload } = require('../../shared/http');

const createCustomersRouter = ({ customerValidation, authMiddleware, attachmentUpload, useCases }) => {
  const router = express.Router();

  router.get('/', authMiddleware(['admin']), attachPagination(), asyncHandler(async (req, res) => {
    const result = await useCases.listCustomers({ pagination: req.pagination });
    if (result?.pagination) {
      res.json({ success: true, count: result.pagination.totalItems, data: { customers: result.items, pagination: result.pagination }, message: 'Customers retrieved successfully' });
      return;
    }

    res.json({ success: true, data: result, message: 'Customers retrieved successfully' });
  }));

  router.post('/', authMiddleware(['admin']), customerValidation.create, asyncHandler(async (req, res) => {
    const customer = await useCases.createCustomer(req.body);
    res.status(201).json({ success: true, data: customer, message: 'Customer created successfully' });
  }));

  router.get('/lookup/by-document', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const customer = await useCases.findCustomerByDocument({ documentNumber: req.query.documentNumber });
    res.json({ success: true, data: { customer }, message: 'Customer found successfully' });
  }));

  router.patch('/:id', authMiddleware(['admin']), customerValidation.update, asyncHandler(async (req, res) => {
    const customer = await useCases.updateCustomer({
      customerId: req.params.id,
      payload: req.body,
    });
    res.json({ success: true, data: customer, message: 'Customer updated successfully' });
  }));

  router.delete('/:id', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    await useCases.deleteCustomer({ customerId: req.params.id });
    res.json({ success: true, message: 'Customer deleted successfully' });
  }));

  router.patch('/:id/restore', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const customer = await useCases.restoreCustomer({
      actor: req.user,
      customerId: req.params.id,
    });
    res.json({ success: true, data: { customer }, message: 'Customer restored successfully' });
  }));

  router.get('/:id/documents', authMiddleware(['admin', 'customer']), asyncHandler(async (req, res) => {
    const documents = await useCases.listCustomerDocuments({ actor: req.user, customerId: req.params.id });
    res.json({ success: true, count: documents.length, data: { documents } });
  }));

  router.post('/:id/documents', authMiddleware(['admin']), attachmentUpload.single('file'), asyncHandler(async (req, res) => {
    const document = await useCases.uploadCustomerDocument({
      actor: req.user,
      customerId: req.params.id,
      file: req.file,
      metadata: req.body,
    });
    res.status(201).json({ success: true, message: 'Customer document uploaded successfully', data: { document } });
  }));

  router.get('/:id/documents/:documentId/download', authMiddleware(['admin', 'customer']), asyncHandler(async (req, res) => {
    const download = await useCases.downloadCustomerDocument({
      actor: req.user,
      customerId: req.params.id,
      documentId: req.params.documentId,
    });
    sendPathDownload(res, {
      absolutePath: download.absolutePath,
      fileName: download.document.originalName,
    });
  }));

  router.delete('/:id/documents/:documentId', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    await useCases.deleteCustomerDocument({
      actor: req.user,
      customerId: req.params.id,
      documentId: req.params.documentId,
    });
    res.json({ success: true, message: 'Document deleted successfully' });
  }));

  return router;
};

module.exports = {
  createCustomersRouter,
};
