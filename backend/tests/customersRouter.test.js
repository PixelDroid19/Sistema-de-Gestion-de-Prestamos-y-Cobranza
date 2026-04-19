const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { globalErrorHandler } = require('@/utils/errorHandler');

const { createCustomersRouter } = require('@/modules/customers/presentation/router');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const allowAuth = () => (req, res, next) => {
  req.user = { id: 1, role: 'admin', name: 'Admin Test' };
  next();
};

const customerValidation = {
  create(req, res, next) {
    next();
  },
  update(req, res, next) {
    next();
  },
};

test('createCustomersRouter serves list and create contract responses', async () => {
  const calls = [];
  const customers = [
    {
      id: 4,
      name: 'Ana Customer',
      email: 'ana@example.com',
      loanCount: 2,
      activeLoans: 1,
      loanSummary: { totalLoans: 2, activeLoans: 1, totalOutstandingBalance: 450, latestLoanId: 91, latestLoanStatus: 'approved' },
    },
    {
      id: 3,
      name: 'Luis Customer',
      email: 'luis@example.com',
      loanCount: 0,
      activeLoans: 0,
      loanSummary: { totalLoans: 0, activeLoans: 0, totalOutstandingBalance: 0, latestLoanId: null, latestLoanStatus: null },
    },
  ];
  const router = createCustomersRouter({
    customerValidation,
    authMiddleware: allowAuth,
    attachmentUpload: { single() { return (req, res, next) => next(); } },
    useCases: {
      async listCustomers(input) {
        calls.push(['listCustomers', input]);
        return {
          items: customers,
          pagination: { page: 1, pageSize: 25, totalItems: 2, totalPages: 1 },
        };
      },
      async createCustomer(input) {
        calls.push(['createCustomer', input]);
        return {
          id: 5,
          ...input.payload,
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
    count: 2,
    data: { customers, pagination: { page: 1, pageSize: 25, totalItems: 2, totalPages: 1 } },
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
    ['listCustomers', { pagination: { page: 1, pageSize: 25, limit: 25, offset: 0 } }],
    ['createCustomer', { actor: { id: 1, role: 'admin', name: 'Admin Test' }, payload: createPayload }],
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

test('createCustomersRouter serves update contract responses', async () => {
  const calls = [];
  const router = createCustomersRouter({
    customerValidation,
    authMiddleware: allowAuth,
    attachmentUpload: { single() { return (req, res, next) => next(); } },
    useCases: {
      async listCustomers() { return []; },
      async createCustomer() { return {}; },
      async updateCustomer(input) {
        calls.push(['updateCustomer', input]);
        return {
          id: Number(input.customerId),
          ...input.payload,
        };
      },
      async deleteCustomer() { return { success: true }; },
      async findCustomerByDocument() { return {}; },
      async listCustomerDocuments() { return []; },
      async uploadCustomerDocument() { return { id: 1 }; },
      async downloadCustomerDocument() { return { document: { originalName: 'doc.pdf' }, absolutePath: __filename }; },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const payload = {
    name: 'Updated Customer',
    status: 'inactive',
    phone: '+573001112255',
  };

  const response = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/7',
    headers: { authorization: 'Bearer valid-token' },
    body: payload,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: {
      id: 7,
      name: 'Updated Customer',
      status: 'inactive',
      phone: '+573001112255',
    },
    message: 'Customer updated successfully',
  });
  assert.deepEqual(calls, [
    ['updateCustomer', { actor: { id: 1, role: 'admin', name: 'Admin Test' }, customerId: '7', payload }],
  ]);
});

test('globalErrorHandler returns conflict payload when unique constraint path metadata is missing', async () => {
  const app = express();

  app.post('/', async (req, res, next) => {
    const error = new Error('duplicate key value violates unique constraint');
    error.name = 'SequelizeUniqueConstraintError';
    error.errors = [];
    error.fields = { email: 'duplicate@example.com' };
    next(error);
  });
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/',
    body: {},
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, {
    success: false,
    error: {
      message: 'email already exists',
      statusCode: 409,
    },
  });
});

test('globalErrorHandler reports primary-key uniqueness conflicts without generic resource wording', async () => {
  const app = express();

  app.post('/', async (req, res, next) => {
    const error = new Error('duplicate key value violates unique constraint "Customers_pkey"');
    error.name = 'SequelizeUniqueConstraintError';
    error.errors = [];
    error.parent = { constraint: 'Customers_pkey' };
    next(error);
  });
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/',
    body: {},
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, {
    success: false,
    error: {
      message: 'Customer id already exists',
      statusCode: 409,
    },
  });
});
