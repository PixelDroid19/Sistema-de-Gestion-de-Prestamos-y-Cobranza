const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { NotFoundError, ValidationError, AuthorizationError, globalErrorHandler } = require('@/utils/errorHandler');
const { createAssociatesRouter } = require('@/modules/associates/presentation/router');
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

  req.user = { id: 1, role, name: 'Admin Test' };
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
      async listAssociates(input) {
        calls.push(['listAssociates', input]);
        return {
          items: associates,
          pagination: { page: 1, pageSize: 25, totalItems: 2, totalPages: 1 },
        };
      },
      async createAssociate(input) {
        calls.push(['createAssociate', input]);
        return { id: 5, ...input.payload };
      },
      async getAssociateById(id) {
        calls.push(['getAssociateById', id]);
        return { id: Number(id), name: 'Ana Associate' };
      },
      async updateAssociate(input) {
        calls.push(['updateAssociate', input]);
        return { id: Number(input.associateId), ...input.payload };
      },
      async deleteAssociate(input) {
        calls.push(['deleteAssociate', input]);
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
    path: '/?search=Ana&status=active',
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
    data: { associates, pagination: { page: 1, pageSize: 25, totalItems: 2, totalPages: 1 } },
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
  assert.deepEqual(calls[0], ['listAssociates', {
    pagination: { page: 1, pageSize: 25, limit: 25, offset: 0 },
    filters: { search: 'Ana', status: 'active' },
  }]);
  assert.deepEqual(calls[1], ['createAssociate', { actor: { id: 1, role: 'admin', name: 'Admin Test' }, payload }]);
  assert.deepEqual(calls[3], ['updateAssociate', { actor: { id: 1, role: 'admin', name: 'Admin Test' }, associateId: '5', payload: { status: 'inactive' } }]);
  assert.deepEqual(calls[4], ['deleteAssociate', { actor: { id: 1, role: 'admin', name: 'Admin Test' }, associateId: '5' }]);
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

test('createAssociatesRouter GET /:id/installments returns installments data', async () => {
  const calls = [];
  const router = createAssociatesRouter({
    associateValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async getAssociateInstallments({ actor, associateId }) {
        calls.push(['getAssociateInstallments', actor, associateId]);
        return {
          associateId: Number(associateId),
          installments: [
            { id: 1, installmentNumber: 1, amount: 100, dueDate: new Date('2026-01-01'), status: 'paid' },
            { id: 2, installmentNumber: 2, amount: 100, dueDate: new Date('2026-02-01'), status: 'pending' },
          ],
          totals: { totalPending: 100, totalPaid: 100, totalOverdue: 0 },
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/12/installments',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.installments.associateId, 12);
  assert.equal(response.body.data.installments.installments.length, 2);
  assert.equal(response.body.data.installments.totals.totalPending, 100);
});

test('createAssociatesRouter POST /:id/installments/:installmentNumber/pay marks installment as paid', async () => {
  const calls = [];
  const router = createAssociatesRouter({
    associateValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async payAssociateInstallment({ actor, associateId, installmentNumber, payload }) {
        calls.push(['payAssociateInstallment', actor, associateId, installmentNumber, payload]);
        return {
          success: true,
          installment: {
            id: 2,
            installmentNumber: Number(installmentNumber),
            amount: 100,
            dueDate: new Date('2026-02-01'),
            status: 'paid',
            paidAt: new Date(),
            paidBy: actor.id,
          },
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
    path: '/12/installments/2/pay',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { paymentDate: '2026-02-15' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.installment.installment.status, 'paid');
  assert.deepEqual(calls[0], ['payAssociateInstallment', { id: 1, role: 'admin', name: 'Admin Test' }, '12', '2', { paymentDate: '2026-02-15' }]);
});

test('createAssociatesRouter GET /:id/calendar-events returns calendar data', async () => {
  const calls = [];
  const router = createAssociatesRouter({
    associateValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async getAssociateCalendar({ actor, associateId, startDate, endDate }) {
        calls.push(['getAssociateCalendar', actor, associateId, startDate, endDate]);
        return {
          associateId: Number(associateId),
          startDate,
          endDate,
          events: [
            { id: 1, type: 'contribution', amount: 500, date: new Date('2026-01-15'), displayType: 'Aporte', displayAmount: '+500.00' },
          ],
          summary: { contributionCount: 1, distributionCount: 0, installmentCount: 0, pendingInstallments: 0 },
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/12/calendar-events?startDate=2026-01-01&endDate=2026-12-31',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.calendar.associateId, 12);
  assert.equal(response.body.data.calendar.events.length, 1);
  assert.equal(response.body.data.calendar.summary.contributionCount, 1);
});

test('createAssociatesRouter rejects socio from accessing another associate installments', async () => {
  const router = createAssociatesRouter({
    associateValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async getAssociateInstallments() {
        throw new AuthorizationError('Socio users can only access their linked associate data');
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
    path: '/12/installments',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'socio' },
  });

  assert.equal(response.statusCode, 403);
});
