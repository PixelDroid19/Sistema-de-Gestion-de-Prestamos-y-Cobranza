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
    message: 'Clientes obtenidos correctamente',
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
    message: 'Cliente creado correctamente',
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
  assert.equal(uploadResponse.body.message, 'Documento del cliente cargado correctamente');
  assert.equal(uploadResponse.body.data.document.id, 2);
  assert.equal(downloadResponse.status, 200);
  assert.deepEqual(calls, [
    ['listCustomerDocuments', 7],
    ['uploadCustomerDocument', 7],
    ['downloadCustomerDocument', 2],
  ]);
});

test('createCustomersRouter rejects malformed route identifiers before executing customer operations', async () => {
  const calls = [];
  const router = createCustomersRouter({
    customerValidation,
    authMiddleware: allowAuth,
    attachmentUpload: {
      single() {
        return (req, _res, next) => {
          req.file = { path: '/tmp/customer-doc.pdf', originalname: 'Customer Doc.pdf' };
          next();
        };
      },
    },
    useCases: {
      async getCustomerById(input) {
        calls.push(['getCustomerById', input.customerId]);
        return { id: Number(input.customerId) };
      },
      async updateCustomer(input) {
        calls.push(['updateCustomer', input.customerId]);
        return { id: Number(input.customerId) };
      },
      async deleteCustomer(input) {
        calls.push(['deleteCustomer', input.customerId]);
      },
      async restoreCustomer(input) {
        calls.push(['restoreCustomer', input.customerId]);
        return { id: Number(input.customerId) };
      },
      async listCustomerDocuments(input) {
        calls.push(['listCustomerDocuments', input.customerId]);
        return [];
      },
      async uploadCustomerDocument(input) {
        calls.push(['uploadCustomerDocument', input.customerId]);
        return { id: 1 };
      },
      async downloadCustomerDocument(input) {
        calls.push(['downloadCustomerDocument', input.customerId, input.documentId]);
        return { document: { originalName: 'Customer Doc.pdf' }, absolutePath: __filename };
      },
      async deleteCustomerDocument(input) {
        calls.push(['deleteCustomerDocument', input.customerId, input.documentId]);
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message },
    });
  });
  activeServer = await listen(app);

  const cases = [
    { method: 'GET', path: '/7abc', field: /customerId/i },
    { method: 'PATCH', path: '/1e2', field: /customerId/i, body: { name: 'Cliente QA' } },
    { method: 'DELETE', path: '/1.5', field: /customerId/i },
    { method: 'PATCH', path: '/abc/restore', field: /customerId/i },
    { method: 'GET', path: '/abc/documents', field: /customerId/i },
    { method: 'POST', path: '/abc/documents', field: /customerId/i, body: {} },
    { method: 'GET', path: '/7/documents/abc/download', field: /documentId/i },
    { method: 'DELETE', path: '/7/documents/1e2', field: /documentId/i },
  ];

  for (const routeCase of cases) {
    const response = await requestJson(activeServer, {
      method: routeCase.method,
      path: routeCase.path,
      headers: { authorization: 'Bearer valid-token' },
      body: routeCase.body,
    });
    assert.equal(response.statusCode, 400, routeCase.path);
    assert.match(response.body.error.message, routeCase.field);
  }
  assert.deepEqual(calls, []);
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
    message: 'Cliente actualizado correctamente',
  });
  assert.deepEqual(calls, [
    ['updateCustomer', { actor: { id: 1, role: 'admin', name: 'Admin Test' }, customerId: 7, payload }],
  ]);
});

test('createCustomersRouter serves customer detail contract responses', async () => {
  const calls = [];
  const router = createCustomersRouter({
    customerValidation,
    authMiddleware: allowAuth,
    attachmentUpload: { single() { return (req, res, next) => next(); } },
    useCases: {
      async listCustomers() { return []; },
      async createCustomer() { return {}; },
      async getCustomerById(input) {
        calls.push(['getCustomerById', input]);
        return {
          id: 7,
          name: 'Cliente Detalle',
          status: 'active',
          loanCount: 1,
        };
      },
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

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/7',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: {
      customer: {
        id: 7,
        name: 'Cliente Detalle',
        status: 'active',
        loanCount: 1,
      },
    },
    message: 'Cliente obtenido correctamente',
  });
  assert.deepEqual(calls, [
    ['getCustomerById', { customerId: 7 }],
  ]);
});

test('createCustomersRouter serves lookup, restore, delete, and document deletion messages', async () => {
  const calls = [];
  const router = createCustomersRouter({
    customerValidation,
    authMiddleware: allowAuth,
    attachmentUpload: { single() { return (req, res, next) => next(); } },
    useCases: {
      async listCustomers() { return []; },
      async createCustomer() { return {}; },
      async findCustomerByDocument(input) {
        calls.push(['findCustomerByDocument', input]);
        return { id: 8, documentNumber: input.documentNumber };
      },
      async deleteCustomer(input) {
        calls.push(['deleteCustomer', input]);
      },
      async restoreCustomer(input) {
        calls.push(['restoreCustomer', input]);
        return { id: Number(input.customerId), status: 'active' };
      },
      async listCustomerDocuments() { return []; },
      async uploadCustomerDocument() { return { id: 1 }; },
      async downloadCustomerDocument() { return { document: { originalName: 'doc.pdf' }, absolutePath: __filename }; },
      async deleteCustomerDocument(input) {
        calls.push(['deleteCustomerDocument', input]);
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const lookupResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/lookup/by-document?documentNumber=CC-123',
    headers: { authorization: 'Bearer valid-token' },
  });
  const deleteResponse = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/8',
    headers: { authorization: 'Bearer valid-token' },
  });
  const restoreResponse = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/8/restore',
    headers: { authorization: 'Bearer valid-token' },
  });
  const deleteDocumentResponse = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/8/documents/3',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(lookupResponse.statusCode, 200);
  assert.equal(lookupResponse.body.message, 'Cliente encontrado correctamente');
  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(deleteResponse.body.message, 'Cliente eliminado correctamente');
  assert.equal(restoreResponse.statusCode, 200);
  assert.equal(restoreResponse.body.message, 'Cliente restaurado correctamente');
  assert.equal(deleteDocumentResponse.statusCode, 200);
  assert.equal(deleteDocumentResponse.body.message, 'Documento eliminado correctamente');
  assert.deepEqual(calls, [
    ['findCustomerByDocument', { documentNumber: 'CC-123' }],
    ['deleteCustomer', { actor: { id: 1, role: 'admin', name: 'Admin Test' }, customerId: 8 }],
    ['restoreCustomer', { actor: { id: 1, role: 'admin', name: 'Admin Test' }, customerId: 8 }],
    ['deleteCustomerDocument', { actor: { id: 1, role: 'admin', name: 'Admin Test' }, customerId: 8, documentId: 3 }],
  ]);
});

test('createCustomersRouter forwards list filters to the customer use case', async () => {
  const calls = [];
  const router = createCustomersRouter({
    customerValidation,
    authMiddleware: allowAuth,
    attachmentUpload: { single() { return (req, res, next) => next(); } },
    useCases: {
      async listCustomers(input) {
        calls.push(input);
        return {
          items: [],
          pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
        };
      },
      async createCustomer() { return {}; },
      async updateCustomer() { return {}; },
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

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/?page=2&pageSize=10&search=ana&status=inactive&registeredWithin=month',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [
    {
      pagination: { page: 2, pageSize: 10, limit: 10, offset: 10 },
      filters: { search: 'ana', status: 'inactive', registeredWithin: 'month' },
    },
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
