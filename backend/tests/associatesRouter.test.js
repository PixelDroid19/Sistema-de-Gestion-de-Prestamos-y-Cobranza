const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { NotFoundError, ValidationError, globalErrorHandler } = require('../src/utils/errorHandler');
const { createAssociatesRouter } = require('../src/modules/associates/presentation/router');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const roleAwareAuth = (roles = []) => (req, res, next) => {
  const role = req.headers['x-test-role'] || 'admin';
  if (roles.length > 0 && !roles.includes(role)) {
    res.status(403).json({ success: false, error: { message: 'Access denied', statusCode: 403 } });
    return;
  }

  req.user = { id: 1, role };
  next();
};

const associateValidation = {
  create(req, res, next) {
    next();
  },
  update(req, res, next) {
    next();
  },
  proportionalDistribution(req, res, next) {
    next();
  },
};

test('createAssociatesRouter serves CRUD contract responses', async () => {
  const calls = [];
  const associates = [
    { id: 4, name: 'Ana Associate' },
    { id: 3, name: 'Luis Associate' },
  ];
  const router = createAssociatesRouter({
    associateValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async listAssociates() {
        calls.push(['listAssociates']);
        return associates;
      },
      async createAssociate(payload) {
        calls.push(['createAssociate', payload]);
        return { id: 5, ...payload };
      },
      async getAssociateById(id) {
        calls.push(['getAssociateById', id]);
        return { id: Number(id), name: 'Ana Associate' };
      },
      async updateAssociate(id, payload) {
        calls.push(['updateAssociate', id, payload]);
        return { id: Number(id), ...payload };
      },
      async deleteAssociate(id) {
        calls.push(['deleteAssociate', id]);
      },
      async createProportionalProfitDistribution({ payload }) {
        calls.push(['createProportionalProfitDistribution', payload]);
        return {
          batchKey: 'batch-1',
          declaredAmount: '100.00',
          idempotencyStatus: 'created',
          idempotencyKey: null,
          createdRows: [{ id: 9, amount: 60 }],
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const payload = {
    name: 'New Associate',
    email: 'new.associate@example.com',
    phone: '+573001112255',
    status: 'active',
  };

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const createResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: payload,
  });
  const readResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/5',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const updateResponse = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/5',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { status: 'inactive' },
  });
  const deleteResponse = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/5',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const proportionalResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/distributions/proportional',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { amount: '100.00' },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.body, {
    success: true,
    count: 2,
    data: { associates },
  });
  assert.equal(createResponse.statusCode, 201);
  assert.deepEqual(createResponse.body, {
    success: true,
    message: 'Associate created successfully',
    data: { associate: { id: 5, ...payload } },
  });
  assert.equal(readResponse.statusCode, 200);
  assert.deepEqual(readResponse.body, {
    success: true,
    data: { associate: { id: 5, name: 'Ana Associate' } },
  });
  assert.equal(updateResponse.statusCode, 200);
  assert.deepEqual(updateResponse.body, {
    success: true,
    message: 'Associate updated successfully',
    data: { associate: { id: 5, status: 'inactive' } },
  });
  assert.equal(deleteResponse.statusCode, 200);
  assert.deepEqual(deleteResponse.body, {
    success: true,
    message: 'Associate deleted successfully',
  });
  assert.equal(proportionalResponse.statusCode, 201);
  assert.deepEqual(proportionalResponse.body, {
    success: true,
    message: 'Proportional profit distribution created successfully',
    data: {
      distribution: {
        batchKey: 'batch-1',
        declaredAmount: '100.00',
        idempotencyStatus: 'created',
        idempotencyKey: null,
        createdRows: [{ id: 9, amount: 60 }],
      },
    },
  });
});

test('createAssociatesRouter replays proportional distributions safely for repeated idempotency keys', async () => {
  const router = createAssociatesRouter({
    associateValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async createProportionalProfitDistribution({ idempotencyKey, payload }) {
        assert.equal(idempotencyKey, 'assoc-proportional-2026-03');
        assert.equal(payload.amount, '100.00');
        return {
          batchKey: 'batch-1',
          declaredAmount: '100.00',
          idempotencyStatus: 'replayed',
          idempotencyKey,
          createdRows: [{ id: 9, amount: 60 }],
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/distributions/proportional',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'admin',
      'idempotency-key': 'assoc-proportional-2026-03',
    },
    body: { amount: '100.00' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    message: 'Proportional profit distribution replayed safely',
    data: {
      distribution: {
        batchKey: 'batch-1',
        declaredAmount: '100.00',
        idempotencyStatus: 'replayed',
        idempotencyKey: 'assoc-proportional-2026-03',
        createdRows: [{ id: 9, amount: 60 }],
      },
    },
  });
});

test('createAssociatesRouter surfaces missing-record errors', async () => {
  const router = createAssociatesRouter({
    associateValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async listAssociates() {
        throw new Error('listAssociates should not be called');
      },
      async createAssociate() {
        throw new Error('createAssociate should not be called');
      },
      async getAssociateById() {
        throw new NotFoundError('Associate');
      },
      async updateAssociate() {
        throw new Error('updateAssociate should not be called');
      },
      async deleteAssociate() {
        throw new Error('deleteAssociate should not be called');
      },
      async createProportionalProfitDistribution() {
        throw new Error('createProportionalProfitDistribution should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/999',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.message, 'Associate not found');
});

test('createAssociatesRouter surfaces proportional distribution validation and authorization errors', async () => {
  const router = createAssociatesRouter({
    associateValidation: {
      ...associateValidation,
      proportionalDistribution(req, res, next) {
        const error = new ValidationError('Validation failed');
        error.errors = [{ field: 'amount', message: 'Amount must be positive' }];
        next(error);
      },
    },
    authMiddleware: roleAwareAuth,
    useCases: {
      async createProportionalProfitDistribution() {
        throw new Error('createProportionalProfitDistribution should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const validationResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/distributions/proportional',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { amount: '0' },
  });

  assert.equal(validationResponse.statusCode, 400);
  assert.equal(validationResponse.body.error.validationErrors[0].field, 'amount');

  const unauthorizedResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/distributions/proportional',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'socio' },
    body: { amount: '100.00' },
  });

  assert.equal(unauthorizedResponse.statusCode, 403);
});
