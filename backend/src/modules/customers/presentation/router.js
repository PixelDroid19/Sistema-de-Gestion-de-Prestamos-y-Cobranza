const express = require('express');
const { asyncHandler, ValidationError } = require('@/utils/errorHandler');
const { attachPagination } = require('@/middleware/validation');
const { sendPathDownload } = require('@/modules/shared/http');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');

/**
 * Composes customer CRUD and document routes from validation, authorization,
 * upload middleware and customer use cases.
 * @param {{ customerValidation: object, authMiddleware: Function, attachmentUpload: object, useCases: object }} dependencies
 * @returns {import('express').Router} Express router for administrative customer records.
 */
const createCustomersRouter = ({ customerValidation, authMiddleware, attachmentUpload, useCases }) => {
  const router = express.Router();
  const requirePermission = (permission) => authMiddleware({ permissions: [permission] });
  /**
   * Parses required route identifiers without accepting partial numeric coercion.
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

  router.get('/', requirePermission('CLIENTS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    const filters = {
      search: req.query.search,
      status: req.query.status,
      registeredWithin: req.query.registeredWithin,
    };
    const hasFilters = Object.values(filters).some((value) => value !== undefined);
    const input = {
      pagination: req.pagination,
    };

    if (hasFilters) {
      input.filters = filters;
    }

    const result = await useCases.listCustomers(input);
    if (result?.pagination) {
      res.json({ success: true, count: result.pagination.totalItems, data: { customers: result.items, pagination: result.pagination }, message: 'Clientes obtenidos correctamente' });
      return;
    }

    res.json({ success: true, data: result, message: 'Clientes obtenidos correctamente' });
  }));

  router.post('/', requirePermission('CLIENTS_CREATE'), customerValidation.create, asyncHandler(async (req, res) => {
    const customer = await useCases.createCustomer({ actor: req.user, payload: req.body });
    res.status(201).json({ success: true, data: customer, message: 'Cliente creado correctamente' });
  }));

  router.get('/lookup/by-document', requirePermission('CLIENTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const customer = await useCases.findCustomerByDocument({ documentNumber: req.query.documentNumber });
    res.json({ success: true, data: { customer }, message: 'Cliente encontrado correctamente' });
  }));

  router.get('/:id', requirePermission('CLIENTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.id, 'customerId');
    const customer = await useCases.getCustomerById({ customerId });
    res.json({ success: true, data: { customer }, message: 'Cliente obtenido correctamente' });
  }));

  router.patch('/:id', requirePermission('CLIENTS_UPDATE'), customerValidation.update, asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.id, 'customerId');
    const customer = await useCases.updateCustomer({
      actor: req.user,
      customerId,
      payload: req.body,
    });
    res.json({ success: true, data: customer, message: 'Cliente actualizado correctamente' });
  }));

  router.delete('/:id', requirePermission('CLIENTS_DELETE'), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.id, 'customerId');
    await useCases.deleteCustomer({ actor: req.user, customerId });
    res.json({ success: true, message: 'Cliente eliminado correctamente' });
  }));

  router.patch('/:id/restore', requirePermission('CLIENTS_UPDATE'), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.id, 'customerId');
    const customer = await useCases.restoreCustomer({
      actor: req.user,
      customerId,
    });
    res.json({ success: true, data: { customer }, message: 'Cliente restaurado correctamente' });
  }));

  router.get('/:id/documents', requirePermission('CLIENTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.id, 'customerId');
    const documents = await useCases.listCustomerDocuments({ actor: req.user, customerId });
    res.json({ success: true, count: documents.length, data: { documents } });
  }));

  router.post('/:id/documents', requirePermission('CLIENTS_UPDATE'), attachmentUpload.single('file'), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.id, 'customerId');
    const document = await useCases.uploadCustomerDocument({
      actor: req.user,
      customerId,
      file: req.file,
      metadata: req.body,
    });
    res.status(201).json({ success: true, message: 'Documento del cliente cargado correctamente', data: { document } });
  }));

  router.get('/:id/documents/:documentId/download', requirePermission('CLIENTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.id, 'customerId');
    const documentId = parseRequiredRouteId(req.params.documentId, 'documentId');
    const download = await useCases.downloadCustomerDocument({
      actor: req.user,
      customerId,
      documentId,
    });
    sendPathDownload(res, {
      absolutePath: download.absolutePath,
      fileName: download.document.originalName,
    });
  }));

  router.delete('/:id/documents/:documentId', requirePermission('CLIENTS_DELETE'), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.id, 'customerId');
    const documentId = parseRequiredRouteId(req.params.documentId, 'documentId');
    await useCases.deleteCustomerDocument({
      actor: req.user,
      customerId,
      documentId,
    });
    res.json({ success: true, message: 'Documento eliminado correctamente' });
  }));

  return router;
};

module.exports = {
  createCustomersRouter,
};
