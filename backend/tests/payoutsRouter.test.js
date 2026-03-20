const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createPayoutsRouter } = require('../src/modules/payouts/presentation/router');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const allowAuth = () => (req, res, next) => {
  req.user = {
    id: 3,
    role: req.headers['x-test-role'] || 'admin',
  };
  next();
};

const paymentValidation = {
  create(req, res, next) {
    next();
  },
};

const unexpectedUseCase = (name) => async () => {
  throw new Error(`${name} should not be called`);
};

test('createPayoutsRouter serves list and create contract responses', async () => {
  const calls = [];
  const payments = [
    { id: 71, loanId: 8, amount: 250 },
    { id: 72, loanId: 8, amount: 125 },
  ];
  const router = createPayoutsRouter({
    authMiddleware: allowAuth,
    paymentValidation,
    useCases: {
      async listPayments() {
        calls.push(['listPayments', { actor: { id: 3, role: 'admin' } }]);
        return payments;
      },
      async createPayment(payload) {
        calls.push(['createPayment', payload]);
        return {
          payment: { id: 73, loanId: payload.loanId, amount: payload.amount },
          allocation: { appliedToPrincipal: 200, remainingBalance: 0 },
          loan: { id: payload.loanId, status: 'paid' },
        };
      },
      async listPaymentsByLoan() {
        throw new Error('listPaymentsByLoan should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const createPayload = {
    loanId: 8,
    amount: 200,
  };

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'admin',
    },
  });
  const createResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'customer',
    },
    body: createPayload,
  });

  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.body, {
    success: true,
    count: 2,
    data: payments,
  });
  assert.equal(createResponse.statusCode, 201);
  assert.deepEqual(createResponse.body, {
    success: true,
    message: 'Payment created successfully',
    data: {
      payment: {
        id: 73,
        loanId: 8,
        amount: 200,
      },
      allocation: {
        appliedToPrincipal: 200,
        remainingBalance: 0,
      },
      loan: {
        id: 8,
        status: 'paid',
      },
    },
  });
  assert.deepEqual(calls, [
    ['listPayments', { actor: { id: 3, role: 'admin' } }],
    ['createPayment', { actor: { id: 3, role: 'customer' }, ...createPayload }],
  ]);
});

test('createPayoutsRouter serves loan payment lookup contract responses', async () => {
  const calls = [];
  const payments = [
    { id: 81, loanId: 22, amount: 90 },
    { id: 82, loanId: 22, amount: 110 },
  ];
  const router = createPayoutsRouter({
    authMiddleware: allowAuth,
    paymentValidation,
    useCases: {
      async listPayments() {
        throw new Error('listPayments should not be called');
      },
      async createPayment() {
        throw new Error('createPayment should not be called');
      },
      async listPaymentsByLoan(input) {
        calls.push(['listPaymentsByLoan', input]);
        return payments;
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/loan/22',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'customer',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    count: 2,
    data: payments,
  });
  assert.deepEqual(calls, [
    ['listPaymentsByLoan', { actor: { id: 3, role: 'customer' }, loanId: '22' }],
  ]);
});

test('createPayoutsRouter serves partial, capital, and annulment contract responses', async () => {
  const calls = [];
  const router = createPayoutsRouter({
    authMiddleware: allowAuth,
    paymentValidation,
    useCases: {
      listPayments: unexpectedUseCase('listPayments'),
      createPayment: unexpectedUseCase('createPayment'),
      async createPartialPayment(payload) {
        calls.push(['createPartialPayment', payload]);
        return {
          payment: { id: 91, amount: payload.amount, paymentType: 'partial' },
          allocation: { remainingBalance: 50 },
          loan: { id: payload.loanId, status: 'active' },
        };
      },
      async createCapitalPayment(payload) {
        calls.push(['createCapitalPayment', payload]);
        return {
          payment: { id: 92, amount: payload.amount, paymentType: 'capital' },
          allocation: { principalApplied: payload.amount },
          loan: { id: payload.loanId, status: 'active' },
        };
      },
      async annulInstallment(payload) {
        calls.push(['annulInstallment', payload]);
        return {
          payment: { id: 93, status: 'annulled' },
          annulment: { installmentNumber: 2 },
          loan: { id: Number(payload.loanId), status: 'active' },
        };
      },
      listPaymentsByLoan: unexpectedUseCase('listPaymentsByLoan'),
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const partialResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/partial',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { loanId: 15, amount: 40 },
  });
  const capitalResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/capital',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { loanId: 15, amount: 60 },
  });
  const annulResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/annul/15',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'agent' },
  });

  assert.equal(partialResponse.statusCode, 201);
  assert.equal(capitalResponse.statusCode, 201);
  assert.equal(annulResponse.statusCode, 201);
  assert.deepEqual(calls, [
    ['createPartialPayment', { actor: { id: 3, role: 'admin' }, loanId: 15, amount: 40 }],
    ['createCapitalPayment', { actor: { id: 3, role: 'admin' }, loanId: 15, amount: 60 }],
    ['annulInstallment', { actor: { id: 3, role: 'agent' }, loanId: '15' }],
  ]);
});
