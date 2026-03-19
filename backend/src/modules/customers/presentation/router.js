const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createCustomersRouter = ({ customerValidation, authMiddleware, attachmentUpload, useCases }) => {
  const router = express.Router();

  router.get('/', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const customers = await useCases.listCustomers();
    res.json({ success: true, data: customers, message: 'Customers retrieved successfully' });
  }));

  router.post('/', authMiddleware(['admin']), customerValidation.create, asyncHandler(async (req, res) => {
    const customer = await useCases.createCustomer(req.body);
    res.status(201).json({ success: true, data: customer, message: 'Customer created successfully' });
  }));

  router.get('/:id/documents', authMiddleware(['admin', 'agent', 'customer']), asyncHandler(async (req, res) => {
    const documents = await useCases.listCustomerDocuments({ actor: req.user, customerId: req.params.id });
    res.json({ success: true, count: documents.length, data: { documents } });
  }));

  router.post('/:id/documents', authMiddleware(['admin', 'agent']), attachmentUpload.single('file'), asyncHandler(async (req, res) => {
    const document = await useCases.uploadCustomerDocument({
      actor: req.user,
      customerId: req.params.id,
      file: req.file,
      metadata: req.body,
    });
    res.status(201).json({ success: true, message: 'Customer document uploaded successfully', data: { document } });
  }));

  router.get('/:id/documents/:documentId/download', authMiddleware(['admin', 'agent', 'customer']), asyncHandler(async (req, res) => {
    const download = await useCases.downloadCustomerDocument({
      actor: req.user,
      customerId: req.params.id,
      documentId: req.params.documentId,
    });
    res.download(download.absolutePath, download.document.originalName);
  }));

  return router;
};

module.exports = {
  createCustomersRouter,
};
