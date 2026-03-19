const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { globalErrorHandler } = require('../src/utils/errorHandler');

const { createCustomersRouter } = require('../src/modules/customers/presentation/router');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const allowAuth = () => (req, res, next) => {
  req.user = { id: 1, role: 'admin' };
  next();
};

const customerValidation = {
  create(req, res, next) {
    next();
  },
};

test('createCustomersRouter serves list and create contract responses', async () => {
  const calls = [];
  const customers = [
    { id: 4, name: 'Ana Customer', email: 'ana@example.com' },
    { id: 3, name: 'Luis Customer', email: 'luis@example.com' },
  ];
  const router = createCustomersRouter({
    customerValidation,
    authMiddleware: allowAuth,
    attachmentUpload: { single() { return (req, res, next) => next(); } },
    useCases: {
      async listCustomers() {
        calls.push(['listCustomers']);
        return customers;
      },
      async createCustomer(payload) {
        calls.push(['createCustomer', payload]);
        return {
          id: 5,
          ...payload,
        };
      },
      async listCustomerDocuments() {
        return [];
      },
      async uploadCustomerDocument() {
        return { id: 9 };
      },
      async downloadCustomerDocument() {
        return { document: { originalName: 'doc.pdf' }, absolutePath: 'doc.pdf' };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const createPayload = {
    name: 'New Customer',
    email: 'new@example.com',
    phone: '+573001112244',
  };

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });
  const createResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
    body: createPayload,
  });

  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.body, {
    success: true,
    data: customers,
    message: 'Customers retrieved successfully',
  });
  assert.equal(createResponse.statusCode, 201);
  assert.deepEqual(createResponse.body, {
    success: true,
    data: {
      id: 5,
      name: 'New Customer',
      email: 'new@example.com',
      phone: '+573001112244',
    },
    message: 'Customer created successfully',
  });
  assert.deepEqual(calls, [
    ['listCustomers'],
    ['createCustomer', createPayload],
  ]);
});

test('createCustomersRouter serves customer document routes', async () => {
  const calls = [];
  const router = createCustomersRouter({
    customerValidation,
    authMiddleware: allowAuth,
    attachmentUpload: {
      single() {
        return (req, res, next) => {
          req.file = {
            path: '/tmp/customer-doc.pdf',
            filename: 'customer-doc.pdf',
            originalname: 'Customer Doc.pdf',
            mimetype: 'application/pdf',
            size: 100,
          };
          req.body = { customerVisible: 'true' };
          next();
        };
      },
    },
    useCases: {
      async listCustomers() { return []; },
      async createCustomer() { return {}; },
      async listCustomerDocuments(input) {
        calls.push(['listCustomerDocuments', input.customerId]);
        return [{ id: 1, originalName: 'Customer Doc.pdf' }];
      },
      async uploadCustomerDocument(input) {
        calls.push(['uploadCustomerDocument', input.customerId]);
        return { id: 2, originalName: 'Customer Doc.pdf' };
      },
      async downloadCustomerDocument(input) {
        calls.push(['downloadCustomerDocument', input.documentId]);
        return { document: { originalName: 'Customer Doc.pdf' }, absolutePath: __filename };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/7/documents',
    headers: { authorization: 'Bearer valid-token' },
  });
  const uploadResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/7/documents',
    headers: { authorization: 'Bearer valid-token' },
    body: {},
  });

  const downloadResponse = await fetch(`http://127.0.0.1:${activeServer.address().port}/7/documents/2/download`, {
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.body.count, 1);
  assert.equal(uploadResponse.statusCode, 201);
  assert.equal(uploadResponse.body.data.document.id, 2);
  assert.equal(downloadResponse.status, 200);
  assert.deepEqual(calls, [
    ['listCustomerDocuments', '7'],
    ['uploadCustomerDocument', '7'],
    ['downloadCustomerDocument', '2'],
  ]);
});
