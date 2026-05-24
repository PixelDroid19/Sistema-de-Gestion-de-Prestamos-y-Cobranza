const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { loanValidation: runtimeLoanValidation } = require('@/middleware/validation');
const { createListLoans, createUpdateLoanStatus, createDeleteLoan } = require('@/modules/credits/application/useCases');
const { createCreditsRouter } = require('@/modules/credits/presentation/router');
const { createAuthMiddleware } = require('@/modules/shared/auth');
const { createLoanAccessPolicy } = require('@/modules/shared/loanAccessPolicy');
const { globalErrorHandler, NotFoundError } = require('@/utils/errorHandler');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const allowAuth = (user) => () => (req, res, next) => {
  req.user = user;
  next();
};

const noopLoanValidation = {
  create(req, res, next) {
    next();
  },
  simulate(req, res, next) {
    next();
  },
  updateStatus(req, res, next) {
    next();
  },
  payoffQuote(req, res, next) {
    next();
  },
  payoffExecute(req, res, next) {
    next();
  },
};

const unexpectedUseCase = (name) => async () => {
  throw new Error(`${name} should not be called`);
};

const createUseCases = (overrides) => ({
  listLoans: unexpectedUseCase('listLoans'),
  listLoansByCustomer: unexpectedUseCase('listLoansByCustomer'),
  listLoansByRecoveryAssignee: unexpectedUseCase('listLoansByRecoveryAssignee'),
  listRecoveryRoster: unexpectedUseCase('listRecoveryRoster'),
  createLoan: unexpectedUseCase('createLoan'),
  updateLoanStatus: unexpectedUseCase('updateLoanStatus'),
  assignRecoveryAssignee: unexpectedUseCase('assignRecoveryAssignee'),
  updateRecoveryStatus: unexpectedUseCase('updateRecoveryStatus'),
  updateLateFeeRate: unexpectedUseCase('updateLateFeeRate'),
  deleteLoan: unexpectedUseCase('deleteLoan'),
  getLoanById: unexpectedUseCase('getLoanById'),
  listLoanAttachments: unexpectedUseCase('listLoanAttachments'),
  createLoanAttachment: unexpectedUseCase('createLoanAttachment'),
  downloadLoanAttachment: unexpectedUseCase('downloadLoanAttachment'),
  listLoanAlerts: unexpectedUseCase('listLoanAlerts'),
  getPaymentCalendar: unexpectedUseCase('getPaymentCalendar'),
  getPaymentCalendarOverview: unexpectedUseCase('getPaymentCalendarOverview'),
  getPayoffQuote: unexpectedUseCase('getPayoffQuote'),
  executePayoff: unexpectedUseCase('executePayoff'),
  listPromisesToPay: unexpectedUseCase('listPromisesToPay'),
  createPromiseToPay: unexpectedUseCase('createPromiseToPay'),
  createLoanFollowUp: unexpectedUseCase('createLoanFollowUp'),
  updateLoanAlertStatus: unexpectedUseCase('updateLoanAlertStatus'),
  updatePromiseToPayStatus: unexpectedUseCase('updatePromiseToPayStatus'),
  ...overrides,
});

const createPaymentApplicationServiceStub = (overrides = {}) => ({
  async updatePaymentMethod() {
    throw new Error('updatePaymentMethod should not be called');
  },
  async annulInstallment() {
    throw new Error('annulInstallment should not be called');
  },
  ...overrides,
});

const noopAttachmentUpload = {
  single() {
    return (req, res, next) => next();
  },
};

const createRuntimeApp = ({ actor, useCases, validation = runtimeLoanValidation }) => {
  const app = express();
  const authMiddleware = createAuthMiddleware({
    tokenService: {
      verify() {
        return actor;
      },
    },
  });

  app.use(express.json());
  app.use(createCreditsRouter({ authMiddleware, attachmentUpload: noopAttachmentUpload, loanValidation: validation, useCases }));
  app.use(globalErrorHandler);

  return app;
};

test('createCreditsRouter serves create, list, and read contract responses', async () => {
  const calls = [];
  const listedLoans = [
    {
      id: 41,
      status: 'approved',
      customerSummary: { totalLoans: 2, activeLoans: 1, totalOutstandingBalance: 450, latestLoanId: 41, latestLoanStatus: 'approved' },
    },
    {
      id: 42,
      status: 'pending',
      customerSummary: { totalLoans: 1, activeLoans: 0, totalOutstandingBalance: 0, latestLoanId: 42, latestLoanStatus: 'pending' },
    },
  ];
  const createdLoan = {
    id: 43,
    status: 'pending',
    amount: 1500,
    financialSnapshot: {
      principal: 1500,
      totalAmount: 1800,
    },
  };
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 2, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: {
      async listLoans(input) {
        calls.push(['listLoans', input]);
        return listedLoans;
      },
      async listLoansByCustomer() {
        throw new Error('listLoansByCustomer should not be called');
      },
      async listLoansByRecoveryAssignee() {
        throw new Error('listLoansByRecoveryAssignee should not be called');
      },
      async listRecoveryRoster() {
        throw new Error('listRecoveryRoster should not be called');
      },
      async createLoan(input) {
        calls.push(['createLoan', input]);
        return createdLoan;
      },
      async updateLoanStatus() {
        throw new Error('updateLoanStatus should not be called');
      },
      async assignRecoveryAssignee() {
        throw new Error('assignRecoveryAssignee should not be called');
      },
      async updateRecoveryStatus() {
        throw new Error('updateRecoveryStatus should not be called');
      },
      async deleteLoan() {
        throw new Error('deleteLoan should not be called');
      },
      async getLoanById(input) {
        calls.push(['getLoanById', input]);
        return {
          id: Number(input.loanId),
          status: 'approved',
          customerSummary: {
            totalLoans: 2,
            activeLoans: 1,
            totalOutstandingBalance: 450,
            latestLoanId: 44,
            latestLoanStatus: 'approved',
          },
          paymentContext: {
            isPayable: true,
            allowedPaymentTypes: ['installment', 'payoff'],
            snapshot: { outstandingBalance: 1000 },
            payoffEligibility: { allowed: true, denialReasons: [] },
            capitalEligibility: { allowed: true, denialReasons: [] },
          },
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const createPayload = {
    customerId: 8,
    amount: 1500,
  };

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });
  const createResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/',
    headers: { authorization: 'Bearer valid-token', 'idempotency-key': 'loan-create-test-1' },
    body: createPayload,
  });
  const readResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/44',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.body, {
    success: true,
    count: 2,
    data: {
      loans: listedLoans,
    },
  });
  assert.equal(createResponse.statusCode, 201);
  assert.deepEqual(createResponse.body, {
    success: true,
    message: 'Solicitud de crédito registrada correctamente',
    data: {
      loan: createdLoan,
      financialSummary: createdLoan.financialSnapshot,
    },
  });
  assert.equal(readResponse.statusCode, 200);
  assert.deepEqual(readResponse.body, {
    success: true,
    data: {
      loan: {
        id: 44,
        status: 'approved',
        customerSummary: {
          totalLoans: 2,
          activeLoans: 1,
          totalOutstandingBalance: 450,
          latestLoanId: 44,
          latestLoanStatus: 'approved',
        },
        paymentContext: {
          isPayable: true,
          allowedPaymentTypes: ['installment', 'payoff'],
          snapshot: { outstandingBalance: 1000 },
          payoffEligibility: { allowed: true, denialReasons: [] },
          capitalEligibility: { allowed: true, denialReasons: [] },
        },
      },
    },
  });
  assert.deepEqual(calls, [
    ['listLoans', { actor: { id: 2, role: 'admin' }, pagination: { page: 1, pageSize: 25, limit: 25, offset: 0 } }],
    ['createLoan', { actor: { id: 2, role: 'admin' }, payload: createPayload, idempotencyKey: 'loan-create-test-1' }],
    ['getLoanById', { actor: { id: 2, role: 'admin' }, loanId: 44 }],
  ]);
});

test('createCreditsRouter rejects malformed route identifiers before executing credit operations', async () => {
  const calls = [];
  const useCases = createUseCases({
    async listLoansByCustomer(input) {
      calls.push(['listLoansByCustomer', input.customerId]);
      return { loans: [], pagination: { totalItems: 0 } };
    },
    async updateLoanStatus(input) {
      calls.push(['updateLoanStatus', input.loanId]);
      return { id: Number(input.loanId), status: input.status };
    },
    async updateRecoveryStatus(input) {
      calls.push(['updateRecoveryStatus', input.loanId]);
      return { id: Number(input.loanId), recoveryStatus: input.recoveryStatus };
    },
    async listLoanAttachments(input) {
      calls.push(['listLoanAttachments', input.loanId]);
      return [];
    },
    async createLoanAttachment(input) {
      calls.push(['createLoanAttachment', input.loanId]);
      return { id: 1 };
    },
    async listLoanAlerts(input) {
      calls.push(['listLoanAlerts', input.loanId]);
      return [];
    },
    async createLoanFollowUp(input) {
      calls.push(['createLoanFollowUp', input.loanId]);
      return { reminder: { id: 1 } };
    },
    async updateLoanAlertStatus(input) {
      calls.push(['updateLoanAlertStatus', input.loanId, input.alertId]);
      return { id: Number(input.alertId), status: input.payload.status };
    },
    async getPaymentCalendar(input) {
      calls.push(['getPaymentCalendar', input.loanId]);
      return { loanId: Number(input.loanId), entries: [] };
    },
    async getInstallmentQuote(input) {
      calls.push(['getInstallmentQuote', input.loanId, input.installmentNumber]);
      return { installmentNumber: Number(input.installmentNumber) };
    },
    async getPayoffQuote(input) {
      calls.push(['getPayoffQuote', input.loanId]);
      return { total: 0 };
    },
    async executePayoff(input) {
      calls.push(['executePayoff', input.loanId]);
      return {
        payment: { id: 1 },
        loan: { id: Number(input.loanId) },
        allocation: {},
      };
    },
    async listPromisesToPay(input) {
      calls.push(['listPromisesToPay', input.loanId]);
      return [];
    },
    async createPromiseToPay(input) {
      calls.push(['createPromiseToPay', input.loanId]);
      return { id: 1 };
    },
    async updatePromiseToPayStatus(input) {
      calls.push(['updatePromiseToPayStatus', input.loanId, input.promiseId]);
      return { id: Number(input.promiseId), status: input.payload.status };
    },
    async downloadPromiseToPay(input) {
      calls.push(['downloadPromiseToPay', input.loanId, input.promiseId]);
      return { fileName: 'promise.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') };
    },
    async deleteLoan(input) {
      calls.push(['deleteLoan', input.loanId]);
    },
    async getLoanById(input) {
      calls.push(['getLoanById', input.loanId]);
      return { id: Number(input.loanId) };
    },
    async updateLateFeeRate(input) {
      calls.push(['updateLateFeeRate', input.loanId]);
      return { id: Number(input.loanId), lateFeeRate: input.lateFeeRate };
    },
  });
  const paymentApplicationService = createPaymentApplicationServiceStub({
    async updatePaymentMethod(input) {
      calls.push(['updatePaymentMethod', input.loanId, input.paymentId]);
      return { id: Number(input.paymentId), loanId: Number(input.loanId), paymentMethod: input.paymentMethod };
    },
    async annulInstallment(input) {
      calls.push(['annulInstallment', input.loanId, input.installmentNumber]);
      return {
        payment: { id: 1 },
        annulment: { installmentNumber: Number(input.installmentNumber) },
        loan: { id: Number(input.loanId) },
      };
    },
  });
  const uploadMiddleware = {
    single() {
      return (req, _res, next) => {
        req.file = { path: '/tmp/test.pdf', originalname: 'test.pdf' };
        next();
      };
    },
  };
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: uploadMiddleware,
    loanValidation: noopLoanValidation,
    useCases,
    paymentApplicationService,
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
    { method: 'GET', path: '/customer/7abc', field: /customerId/i },
    { method: 'PATCH', path: '/1e2/status', field: /loanId/i, body: { status: 'approved' } },
    { method: 'PATCH', path: '/1.5/recovery-status', field: /loanId/i, body: { recoveryStatus: 'in_progress' } },
    { method: 'GET', path: '/abc/attachments', field: /loanId/i },
    { method: 'POST', path: '/abc/attachments', field: /loanId/i, body: {} },
    { method: 'GET', path: '/abc/alerts', field: /loanId/i },
    { method: 'POST', path: '/abc/follow-ups', field: /loanId/i, body: { note: 'Seguimiento' } },
    { method: 'PATCH', path: '/55/alerts/abc/status', field: /alertId/i, body: { status: 'resolved' } },
    { method: 'GET', path: '/abc/calendar', field: /loanId/i },
    { method: 'GET', path: '/55/installments/1e2/quote', field: /installmentNumber/i },
    { method: 'GET', path: '/abc/payoff-quote?asOfDate=2026-03-15', field: /loanId/i },
    {
      method: 'POST',
      path: '/abc/payoff-executions',
      field: /loanId/i,
      headers: { 'idempotency-key': 'payoff-invalid-route' },
      body: { asOfDate: '2026-03-15', quotedTotal: 10 },
    },
    { method: 'GET', path: '/abc/promises', field: /loanId/i },
    { method: 'POST', path: '/abc/promises', field: /loanId/i, body: { promisedDate: '2026-03-25', amount: 10 } },
    { method: 'PATCH', path: '/55/promises/abc/status', field: /promiseId/i, body: { status: 'kept' } },
    { method: 'GET', path: '/55/promises/abc/download', field: /promiseId/i },
    { method: 'DELETE', path: '/abc', field: /loanId/i },
    { method: 'GET', path: '/abc', field: /loanId/i },
    { method: 'PATCH', path: '/55/payments/abc', field: /paymentId/i, body: { paymentMethod: 'cash' } },
    {
      method: 'POST',
      path: '/55/installments/abc/annul',
      field: /installmentNumber/i,
      headers: { 'idempotency-key': 'annul-invalid-route' },
      body: { reason: 'Corrección' },
    },
    { method: 'PATCH', path: '/abc/late-fee-rate', field: /loanId/i, body: { lateFeeRate: 4.5 } },
  ];

  for (const routeCase of cases) {
    const response = await requestJson(activeServer, {
      method: routeCase.method,
      path: routeCase.path,
      headers: {
        authorization: 'Bearer valid-token',
        ...(routeCase.headers || {}),
      },
      body: routeCase.body,
    });
    assert.equal(response.statusCode, 400, routeCase.path);
    assert.match(response.body.error.message, routeCase.field);
  }
  assert.deepEqual(calls, []);
});

test('createCreditsRouter delegates payment method edits and installment annulments through paymentApplicationService', async () => {
  const calls = [];
  const paymentApplicationService = createPaymentApplicationServiceStub({
    async updatePaymentMethod(input) {
      calls.push(['updatePaymentMethod', input]);
      return { id: 91, paymentMethod: input.paymentMethod, loanId: Number(input.loanId) };
    },
    async annulInstallment(input) {
      calls.push(['annulInstallment', input]);
      return {
        payment: { id: 77 },
        annulment: { installmentNumber: Number(input.installmentNumber), reason: input.reason || null },
        loan: { id: Number(input.loanId), status: 'active' },
      };
    },
  });
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 2, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({}),
    paymentApplicationService,
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const updateResponse = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/41/payments/91',
    headers: { authorization: 'Bearer valid-token' },
    body: { paymentMethod: 'transfer' },
  });

  const annulResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/41/installments/3/annul',
    headers: { authorization: 'Bearer valid-token', 'idempotency-key': 'annul-41-3' },
    body: { reason: 'Cliente reestructurado' },
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.deepEqual(updateResponse.body, {
    success: true,
    message: 'Método de pago actualizado correctamente',
    data: {
      payment: { id: 91, paymentMethod: 'transfer', loanId: 41 },
    },
  });

  assert.equal(annulResponse.statusCode, 201);
  assert.deepEqual(annulResponse.body, {
    success: true,
    message: 'Cuota anulada correctamente',
    data: {
      payment: { id: 77 },
      annulment: { installmentNumber: 3, reason: 'Cliente reestructurado' },
      loan: { id: 41, status: 'active' },
    },
  });

  assert.deepEqual(calls, [
    ['updatePaymentMethod', {
      loanId: 41,
      paymentId: 91,
      paymentMethod: 'transfer',
      actor: { id: 2, role: 'admin' },
    }],
    ['annulInstallment', {
      loanId: 41,
      installmentNumber: 3,
      actor: { id: 2, role: 'admin' },
      reason: 'Cliente reestructurado',
      idempotencyKey: 'annul-41-3',
    }],
  ]);
});

test('createCreditsRouter lets admins process payments without customer ownership branches', async () => {
  const calls = [];
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 7, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({}),
    loanAccessPolicy: {
      async findAuthorizedLoan(input) {
        calls.push(['findAuthorizedLoan', input]);
        return { id: Number(input.loanId), customerId: 7 };
      },
    },
    paymentApplicationService: createPaymentApplicationServiceStub({
      async processPayment(input) {
        calls.push(['processPayment', input]);
        return {
          transactionId: 9,
          status: 'APPLIED',
          newBalance: 750,
          breakdown: { capital: 200, interest: 50, penalty: 0 },
          paymentId: 15,
        };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/payments/process',
    headers: { authorization: 'Bearer valid-token', 'idempotency-key': 'process-55-2' },
    body: {
      loanId: 55,
      paymentAmount: 250,
      paymentDate: '2026-03-15T00:00:00.000Z',
      installmentNumber: 2,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    message: 'Pago procesado correctamente',
    data: {
      transactionId: 9,
      status: 'APPLIED',
      newBalance: 750,
      breakdown: { capital: 200, interest: 50, penalty: 0 },
      paymentId: 15,
      idempotent: false,
    },
  });
  assert.deepEqual(calls, [
    ['processPayment', {
      loanId: 55,
      paymentAmount: 250,
      paymentDate: '2026-03-15T00:00:00.000Z',
      paymentMethod: undefined,
      installmentNumber: 2,
      actorId: 7,
      idempotencyKey: 'process-55-2',
    }],
  ]);
});

test('createCreditsRouter rejects malformed installment numbers before processing payments', async () => {
  const calls = [];
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 7, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({}),
    paymentApplicationService: createPaymentApplicationServiceStub({
      async processPayment(input) {
        calls.push(['processPayment', input]);
        throw new Error('processPayment should not be called');
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/payments/process',
    headers: { authorization: 'Bearer valid-token', 'idempotency-key': 'process-55-2' },
    body: {
      loanId: 55,
      paymentAmount: 250,
      paymentDate: '2026-03-15T00:00:00.000Z',
      installmentNumber: '2e2',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'El número de cuota debe ser un entero positivo');
  assert.deepEqual(calls, []);
});

test('createCreditsRouter requires idempotency key before processing financial mutations', async () => {
  const calls = [];
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 7, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({}),
    loanAccessPolicy: {
      async findAuthorizedLoan(input) {
        calls.push(['findAuthorizedLoan', input]);
        return { id: Number(input.loanId), customerId: 7 };
      },
    },
    paymentApplicationService: createPaymentApplicationServiceStub({
      async processPayment() {
        calls.push(['processPayment']);
        throw new Error('processPayment should not be called');
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/payments/process',
    headers: { authorization: 'Bearer valid-token' },
    body: {
      loanId: 55,
      paymentAmount: 250,
      paymentDate: '2026-03-15T00:00:00.000Z',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error.message, /El encabezado Idempotency-Key es obligatorio/);
  assert.deepEqual(calls, []);
});

test('createCreditsRouter rejects partially numeric payment amounts before processing', async () => {
  const calls = [];
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 7, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({}),
    loanAccessPolicy: {
      async findAuthorizedLoan(input) {
        calls.push(['findAuthorizedLoan', input]);
        return { id: Number(input.loanId), customerId: 7 };
      },
    },
    paymentApplicationService: createPaymentApplicationServiceStub({
      async processPayment() {
        calls.push(['processPayment']);
        throw new Error('processPayment should not be called');
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/payments/process',
    headers: { authorization: 'Bearer valid-token', 'idempotency-key': 'process-55-malformed' },
    body: {
      loanId: 55,
      paymentAmount: '250abc',
      paymentDate: '2026-03-15T00:00:00.000Z',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error.message, /El monto del pago debe ser un número mayor que 0/);
  assert.deepEqual(calls, []);
});

test('createCreditsRouter rejects customer payment processing at the administrative auth boundary', async () => {
  const app = createRuntimeApp({
    actor: { id: 7, role: 'customer' },
    useCases: createUseCases({}),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/payments/process',
    headers: { authorization: 'Bearer valid-token', 'idempotency-key': 'process-55-blocked' },
    body: {
      loanId: 55,
      paymentAmount: 250,
      paymentDate: '2026-03-15T00:00:00.000Z',
    },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.message, 'This account cannot access the administrative platform');
});

test('createCreditsRouter keeps static routes above /:id to avoid shadowing', async () => {
  const calls = [];

  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 2, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async getLoanStatistics() {
        calls.push('getLoanStatistics');
        return { totalLoans: 3 };
      },
      async getDuePayments({ date }) {
        calls.push(['getDuePayments', date.toISOString().slice(0, 10)]);
        return [{ loanId: 99, dueDate: date.toISOString().slice(0, 10) }];
      },
      async searchLoans(input) {
        calls.push(['searchLoans', input]);
        return [];
      },
      async getLoanById() {
        throw new Error('getLoanById should not be called for static routes');
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const statisticsResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/statistics',
    headers: { authorization: 'Bearer valid-token' },
  });

  const duePaymentsResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/due-payments?date=2026-04-10',
    headers: { authorization: 'Bearer valid-token' },
  });

  const searchResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/search?search=ana&status=approved&minAmount=100&maxAmount=900',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(statisticsResponse.statusCode, 200);
  assert.equal(statisticsResponse.body.data.statistics.totalLoans, 3);
  assert.equal(duePaymentsResponse.statusCode, 200);
  assert.equal(duePaymentsResponse.body.count, 1);
  assert.equal(searchResponse.statusCode, 200);
  assert.deepEqual(calls, [
    'getLoanStatistics',
    ['getDuePayments', '2026-04-10'],
    ['searchLoans', {
      actor: { id: 2, role: 'admin' },
      filters: {
        search: 'ana',
        status: 'approved',
        minAmount: 100,
        maxAmount: 900,
        startDate: undefined,
        endDate: undefined,
      },
      pagination: { page: 1, pageSize: 25, limit: 25, offset: 0 },
    }],
  ]);
});

test('createCreditsRouter rejects malformed search amount filters before listing credits', async () => {
  const calls = [];
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 2, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async searchLoans(input) {
        calls.push(input);
        throw new Error('searchLoans should not be called for invalid filters');
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/search?minAmount=1e2&maxAmount=900',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error.message, /minAmount/i);
  assert.deepEqual(calls, []);
});

test('createCreditsRouter protects admin-only portfolio analytics routes', async () => {
  const app = createRuntimeApp({
    actor: { id: 7, role: 'customer' },
    useCases: {
      getLoanStatistics: unexpectedUseCase('getLoanStatistics'),
      getDuePayments: unexpectedUseCase('getDuePayments'),
    },
  });

  activeServer = await listen(app);

  const statisticsResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/statistics',
    headers: { authorization: 'Bearer valid-token' },
  });

  const duePaymentsResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/due-payments?date=2026-04-10',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(statisticsResponse.statusCode, 401);
  assert.equal(duePaymentsResponse.statusCode, 401);
});

test('createCreditsRouter POST /calculations returns canonical credit calculation data', async () => {
  const calls = [];
  const calculation = {
    calculationVersionId: 15,
    calculationProfileVersionId: 15,
    method: 'COMPOUND',
    lateFeeMode: 'NONE',
    summary: {
      installmentAmount: 100,
      totalPayable: 200,
      outstandingBalance: 200,
    },
    schedule: [{
      installmentNumber: 1,
      scheduledPayment: 100,
      principalComponent: 90,
      interestComponent: 10,
      remainingBalance: 100,
      remainingPrincipal: 90,
      remainingInterest: 10,
    }],
    policySnapshot: {
      ratePolicyId: 91,
      lateFeePolicyId: 92,
      appliedInterestRate: 36,
      appliedLateFeeMode: 'NONE',
    },
  };

  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 2, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: {
      ...createUseCases({
        async createCreditCalculation(input) {
          calls.push(['createCreditCalculation', input]);
          return calculation;
        },
      }),
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const payload = {
    amount: 1500,
    interestRate: 12,
    termMonths: 12,
    lateFeeMode: 'none',
  };

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/calculations',
    headers: { authorization: 'Bearer valid-token' },
    body: payload,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    message: 'Cálculo de crédito generado correctamente',
    data: {
      calculation: {
        lateFeeMode: 'NONE',
        summary: calculation.summary,
        schedule: calculation.schedule,
        calculationVersionId: 15,
        calculationProfileVersionId: 15,
        method: 'COMPOUND',
        policySnapshot: calculation.policySnapshot,
        explanation: null,
      },
    },
  });
  assert.deepEqual(calls, [['createCreditCalculation', payload]]);
});

test('createCreditsRouter does not expose legacy /simulations endpoint', async () => {
  const calls = [];
  const app = createRuntimeApp({
    actor: { id: 2, role: 'admin' },
    useCases: createUseCases({
      async createCreditCalculation(input) {
        calls.push(['createCreditCalculation', input]);
        return {};
      },
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/simulations',
    headers: { authorization: 'Bearer valid-token' },
    body: {
      amount: 1500,
      interestRate: 12,
      termMonths: 12,
    },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(calls.length, 0);
});

test('createCreditsRouter GET / rejects customer tokens at the administrative auth boundary', async () => {
  const loanRepository = {
    async list() {
      return [
        { id: 41, customerId: 7, status: 'approved' },
        { id: 42, customerId: 99, status: 'pending' },
        { id: 43, customerId: 7, status: 'defaulted' },
      ];
    },
    async findById() {
      return null;
    },
  };
  const loanAccessPolicy = createLoanAccessPolicy({ loanRepository });
  const app = createRuntimeApp({
    actor: { id: 7, role: 'customer' },
    useCases: createUseCases({
      listLoans: createListLoans({ loanRepository, loanAccessPolicy }),
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.message, 'This account cannot access the administrative platform');
});

test('createCreditsRouter GET / returns all loans to admins at runtime', async () => {
  const loanRepository = {
    async listPage() {
      return {
        items: [
          { id: 51, customerId: 7, status: 'approved' },
          { id: 52, customerId: 99, status: 'pending' },
          { id: 53, customerId: 18, status: 'defaulted' },
        ],
        pagination: { page: 1, pageSize: 25, totalItems: 3, totalPages: 1 },
      };
    },
    async list() {
      return [
        { id: 51, customerId: 7, status: 'approved' },
        { id: 52, customerId: 99, status: 'pending' },
        { id: 53, customerId: 18, status: 'defaulted' },
      ];
    },
    async findById() {
      return null;
    },
  };
  const loanAccessPolicy = createLoanAccessPolicy({ loanRepository });
  const app = createRuntimeApp({
    actor: { id: 1, role: 'admin' },
    useCases: createUseCases({
      listLoans: createListLoans({ loanRepository, loanAccessPolicy }),
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    count: 3,
    data: {
      loans: [
        { id: 51, customerId: 7, status: 'approved' },
        { id: 52, customerId: 99, status: 'pending' },
        { id: 53, customerId: 18, status: 'defaulted' },
      ],
      pagination: { page: 1, pageSize: 25, totalItems: 3, totalPages: 1 },
    },
  });
});

test('createCreditsRouter PATCH /:id/status lets an admin mutate loan status at runtime', async () => {
  const loanRepository = {
    async list() {
      throw new Error('list should not be called');
    },
    async findById(loanId) {
      return {
        id: Number(loanId),
        customerId: 4,
        status: 'approved',
        recoveryStatus: null,
        termMonths: 12,
      };
    },
    async save(loan) {
      return loan;
    },
  };
  const loanAccessPolicy = createLoanAccessPolicy({ loanRepository });
  const app = createRuntimeApp({
    actor: { id: 9, role: 'admin' },
    useCases: createUseCases({
      updateLoanStatus: createUpdateLoanStatus({ loanRepository, loanAccessPolicy }),
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/32/status',
    headers: { authorization: 'Bearer valid-token' },
    body: { status: 'defaulted' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    message: 'Estado del crédito actualizado correctamente',
    data: {
      loan: {
        id: 32,
        customerId: 4,
        status: 'defaulted',
        recoveryStatus: 'pending',
        termMonths: 12,
      },
    },
  });
});

test('createCreditsRouter returns Spanish messages for recovery and late-fee updates', async () => {
  const calls = [];
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 9, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async updateRecoveryStatus(input) {
        calls.push(['updateRecoveryStatus', input]);
        return { id: Number(input.loanId), recoveryStatus: input.recoveryStatus };
      },
      async updateLateFeeRate(input) {
        calls.push(['updateLateFeeRate', input]);
        return { id: Number(input.loanId), lateFeeRate: input.lateFeeRate };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const recoveryResponse = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/32/recovery-status',
    headers: { authorization: 'Bearer valid-token' },
    body: { recoveryStatus: 'in_progress' },
  });
  const lateFeeResponse = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/32/late-fee-rate',
    headers: { authorization: 'Bearer valid-token' },
    body: { lateFeeRate: 4.5 },
  });

  assert.equal(recoveryResponse.statusCode, 200);
  assert.equal(recoveryResponse.body.message, 'Estado de recuperación actualizado correctamente');
  assert.equal(lateFeeResponse.statusCode, 200);
  assert.equal(lateFeeResponse.body.message, 'Tasa de mora actualizada correctamente');
  assert.deepEqual(calls, [
    ['updateRecoveryStatus', { actor: { id: 9, role: 'admin' }, loanId: 32, recoveryStatus: 'in_progress' }],
    ['updateLateFeeRate', { actor: { id: 9, role: 'admin' }, loanId: 32, lateFeeRate: 4.5 }],
  ]);
});

test('createCreditsRouter DELETE /:id lets admins delete rejected loans regardless of previous assignment', async () => {
  let destroyCalled = false;
  const loanRepository = {
    async findById(loanId) {
      return {
        id: Number(loanId),
        customerId: 4,
        status: 'rejected',
      };
    },
    async destroy() {
      destroyCalled = true;
    },
  };
  const loanAccessPolicy = createLoanAccessPolicy({ loanRepository });
  const app = createRuntimeApp({
    actor: { id: 9, role: 'admin' },
    useCases: createUseCases({
      deleteLoan: createDeleteLoan({ loanRepository, loanAccessPolicy }),
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/77',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    message: 'Crédito eliminado correctamente',
  });
  assert.equal(destroyCalled, true);
});

test('createCreditsRouter DELETE /:id blocks customer deletion attempts at runtime', async () => {
  let destroyCalled = false;
  const loanRepository = {
    async findById(loanId) {
      return {
        id: Number(loanId),
        customerId: 7,
        status: 'rejected',
      };
    },
    async destroy() {
      destroyCalled = true;
    },
  };
  const loanAccessPolicy = createLoanAccessPolicy({ loanRepository });
  const app = createRuntimeApp({
    actor: { id: 7, role: 'customer' },
    useCases: createUseCases({
      deleteLoan: createDeleteLoan({ loanRepository, loanAccessPolicy }),
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/81',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.success, false);
  assert.equal(destroyCalled, false);
});

test('createCreditsRouter serves attachment list and upload contract responses', async () => {
  const calls = [];
  const uploadMiddleware = {
    single(fieldName) {
      return (req, res, next) => {
        assert.equal(fieldName, 'file');
        req.file = {
          path: '/tmp/attachment.pdf',
          filename: 'attachment.pdf',
          originalname: 'Attachment.pdf',
          mimetype: 'application/pdf',
          size: 512,
        };
        req.body = {
          customerVisible: 'true',
          category: 'contract',
        };
        next();
      };
    },
  };
  const listedAttachments = [
    { id: 8, originalName: 'welcome.pdf', customerVisible: true },
  ];
  const createdAttachment = { id: 9, originalName: 'Attachment.pdf', customerVisible: true };
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: uploadMiddleware,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async listLoanAttachments(input) {
        calls.push(['listLoanAttachments', input]);
        return listedAttachments;
      },
      async createLoanAttachment(input) {
        calls.push(['createLoanAttachment', input]);
        return createdAttachment;
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/55/attachments',
    headers: { authorization: 'Bearer valid-token' },
  });
  const createResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/55/attachments',
    headers: { authorization: 'Bearer valid-token' },
    body: {},
  });

  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.body, {
    success: true,
    count: 1,
    data: {
      attachments: listedAttachments,
    },
  });
  assert.equal(createResponse.statusCode, 201);
  assert.deepEqual(createResponse.body, {
    success: true,
    message: 'Documento del crédito cargado correctamente',
    data: {
      attachment: createdAttachment,
    },
  });
  assert.deepEqual(calls, [
    ['listLoanAttachments', { actor: { id: 1, role: 'admin' }, loanId: 55 }],
    ['createLoanAttachment', {
      actor: { id: 1, role: 'admin' },
      loanId: 55,
      file: {
        path: '/tmp/attachment.pdf',
        filename: 'attachment.pdf',
        originalname: 'Attachment.pdf',
        mimetype: 'application/pdf',
        size: 512,
      },
      metadata: {
        customerVisible: 'true',
        category: 'contract',
      },
    }],
  ]);
});

test('createCreditsRouter downloads loan attachments through the use-case contract', async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lendflow-attachment-'));
  const filePath = path.join(temporaryDirectory, 'statement.txt');
  await fs.writeFile(filePath, 'loan attachment');

  try {
    const router = createCreditsRouter({
      authMiddleware: allowAuth({ id: 1, role: 'admin' }),
      attachmentUpload: noopAttachmentUpload,
      loanValidation: noopLoanValidation,
      useCases: createUseCases({
        async downloadLoanAttachment(input) {
          assert.deepEqual(input, {
            actor: { id: 1, role: 'admin' },
            loanId: 91,
            attachmentId: 12,
          });
          return {
            attachment: { originalName: 'statement.txt' },
            absolutePath: filePath,
          };
        },
      }),
    });

    const app = express();
    app.use(express.json());
    app.use(router);

    activeServer = await listen(app);

    const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/91/attachments/12/download`, {
      headers: { authorization: 'Bearer valid-token' },
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'loan attachment');
    assert.match(response.headers.get('content-disposition'), /statement.txt/);
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('createCreditsRouter returns 404 when the backing attachment file is missing', async () => {
  const app = createRuntimeApp({
    actor: { id: 1, role: 'admin' },
    useCases: createUseCases({
      async downloadLoanAttachment() {
        throw new NotFoundError('Attachment file');
      },
    }),
  });

  activeServer = await listen(app);

  const response = await fetch(`http://127.0.0.1:${activeServer.address().port}/16/attachments/1/download`, {
    headers: { authorization: 'Bearer valid-token' },
  });

  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.error.message, 'Attachment file not found');
  assert.equal(body.error.statusCode, 404);

  // Development diagnostics are only present when NODE_ENV=development
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment) {
    assert.equal(body.error.path, '/16/attachments/1/download');
    assert.equal(body.error.method, 'GET');
    assert.ok(typeof body.error.timestamp === 'string');
  }
});

test('createCreditsRouter serves alert, calendar, and promise contracts', async () => {
  const calls = [];
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async listLoanAlerts(input) {
        calls.push(['listLoanAlerts', input]);
        return [{ id: 1, status: 'active' }];
      },
      async getPaymentCalendar(input) {
        calls.push(['getPaymentCalendar', input]);
        return { loanId: 55, entries: [{ installmentNumber: 1, status: 'overdue' }], alerts: [] };
      },
      async listPromisesToPay(input) {
        calls.push(['listPromisesToPay', input]);
        return [{ id: 2, status: 'pending' }];
      },
      async createPromiseToPay(input) {
        calls.push(['createPromiseToPay', input]);
        return { id: 3, status: 'pending' };
      },
      async createLoanFollowUp(input) {
        calls.push(['createLoanFollowUp', input]);
        return { reminder: { id: 4, status: 'active' }, notificationSent: true };
      },
      async updateLoanAlertStatus(input) {
        calls.push(['updateLoanAlertStatus', input]);
        return { id: Number(input.alertId), status: input.payload.status };
      },
      async updatePromiseToPayStatus(input) {
        calls.push(['updatePromiseToPayStatus', input]);
        return { id: Number(input.promiseId), status: input.payload.status };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const alertsResponse = await requestJson(activeServer, { method: 'GET', path: '/55/alerts', headers: { authorization: 'Bearer valid-token' } });
  const calendarResponse = await requestJson(activeServer, { method: 'GET', path: '/55/calendar', headers: { authorization: 'Bearer valid-token' } });
  const listPromisesResponse = await requestJson(activeServer, { method: 'GET', path: '/55/promises', headers: { authorization: 'Bearer valid-token' } });
  const createPromiseResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/55/promises',
    headers: { authorization: 'Bearer valid-token' },
    body: { promisedDate: '2026-03-25', amount: 300 },
  });
  const followUpResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/55/follow-ups',
    headers: { authorization: 'Bearer valid-token' },
    body: { installmentNumber: 3, dueDate: '2026-03-25', outstandingAmount: 300 },
  });
  const resolveAlertResponse = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/55/alerts/1/status',
    headers: { authorization: 'Bearer valid-token' },
    body: { status: 'resolved' },
  });
  const updatePromiseResponse = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/55/promises/2/status',
    headers: { authorization: 'Bearer valid-token' },
    body: { status: 'kept' },
  });

  assert.equal(alertsResponse.statusCode, 200);
  assert.equal(alertsResponse.body.count, 1);
  assert.equal(calendarResponse.statusCode, 200);
  assert.equal(calendarResponse.body.data.calendar.loanId, 55);
  assert.equal(Array.isArray(calendarResponse.body.data.calendar.alerts), true);
  assert.equal(listPromisesResponse.statusCode, 200);
  assert.equal(createPromiseResponse.statusCode, 201);
  assert.equal(createPromiseResponse.body.message, 'Promesa de pago creada correctamente');
  assert.equal(createPromiseResponse.body.data.promise.id, 3);
  assert.equal(followUpResponse.statusCode, 201);
  assert.equal(followUpResponse.body.message, 'Recordatorio de seguimiento creado correctamente');
  assert.equal(resolveAlertResponse.statusCode, 200);
  assert.equal(resolveAlertResponse.body.message, 'Alerta del crédito actualizada correctamente');
  assert.equal(updatePromiseResponse.statusCode, 200);
  assert.equal(updatePromiseResponse.body.message, 'Promesa de pago actualizada correctamente');
});

test('createCreditsRouter serves aggregated calendar overview contracts', async () => {
  const calls = [];
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async getPaymentCalendarOverview(input) {
        calls.push(['getPaymentCalendarOverview', input]);
        return {
          summary: {
            totalLoans: 2,
            overdueCount: 1,
            dueTodayCount: 1,
          },
          agenda: [{ loanId: 55, customerName: 'Cliente Uno', installmentNumber: 1 }],
          entries: [{ loanId: 55, installmentNumber: 1, status: 'overdue' }],
        };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/calendar/overview?loanIds=55,56&asOfDate=2026-04-24&search=Cliente&status=overdue&startDate=2026-04-01&endDate=2026-04-30',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.calendar.summary.totalLoans, 2);
  assert.equal(response.body.data.calendar.agenda[0].loanId, 55);
  assert.deepEqual(calls, [[
    'getPaymentCalendarOverview',
    {
      actor: { id: 1, role: 'admin' },
      loanIds: [55, 56],
      asOfDate: '2026-04-24',
      filters: {
        search: 'Cliente',
        status: 'overdue',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        limit: undefined,
      },
    },
  ]]);
});

test('createCreditsRouter rejects malformed calendar overview loan IDs before querying agenda', async () => {
  const calls = [];
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async getPaymentCalendarOverview(input) {
        calls.push(input);
        throw new Error('getPaymentCalendarOverview should not be called for invalid loanIds');
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/calendar/overview?loanIds=55,1e2',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error.message, /loanIds/i);
  assert.deepEqual(calls, []);
});

test('createCreditsRouter serves payoff quote and payoff execution contracts', async () => {
  const calls = [];
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 7, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async getPayoffQuote(input) {
        calls.push(['getPayoffQuote', input]);
        return {
          asOfDate: input.asOfDate,
          accrualMethod: 'actual/365',
          breakdown: {
            overduePrincipal: 0,
            overdueInterest: 0,
            accruedInterest: 5.12,
            futurePrincipal: 950,
          },
          total: 955.12,
        };
      },
      async executePayoff(input) {
        calls.push(['executePayoff', input]);
        return {
          payment: { id: 90, amount: input.quotedTotal, paymentType: 'payoff' },
          loan: { id: Number(input.loanId), status: 'closed', closureReason: 'payoff' },
          allocation: { payoff: { total: input.quotedTotal } },
        };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const quoteResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/55/payoff-quote?asOfDate=2026-03-15',
    headers: { authorization: 'Bearer valid-token' },
  });
  const executeResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/55/payoff-executions',
    headers: { authorization: 'Bearer valid-token', 'idempotency-key': 'payoff-55-2026-03-15' },
    body: { asOfDate: '2026-03-15', quotedTotal: 955.12 },
  });

  assert.equal(quoteResponse.statusCode, 200);
  assert.deepEqual(quoteResponse.body, {
    success: true,
    data: {
      payoffQuote: {
        asOfDate: '2026-03-15',
        accrualMethod: 'actual/365',
        breakdown: {
          overduePrincipal: 0,
          overdueInterest: 0,
          accruedInterest: 5.12,
          futurePrincipal: 950,
        },
        total: 955.12,
      },
    },
  });
  assert.equal(executeResponse.statusCode, 201);
  assert.deepEqual(executeResponse.body, {
    success: true,
    message: 'Pago total registrado correctamente',
    data: {
      payment: { id: 90, amount: 955.12, paymentType: 'payoff' },
      loan: { id: 55, status: 'closed', closureReason: 'payoff' },
      allocation: { payoff: { total: 955.12 } },
    },
  });
  assert.deepEqual(calls, [
    ['getPayoffQuote', { actor: { id: 7, role: 'admin' }, loanId: 55, asOfDate: '2026-03-15' }],
    ['executePayoff', { actor: { id: 7, role: 'admin' }, loanId: 55, asOfDate: '2026-03-15', quotedTotal: 955.12, idempotencyKey: 'payoff-55-2026-03-15' }],
  ]);
});

test('createCreditsRouter rejects invalid payoff payloads through runtime validation', async () => {
  const app = createRuntimeApp({
    actor: { id: 7, role: 'employee' },
    useCases: createUseCases({}),
  });

  activeServer = await listen(app);

  const quoteResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/55/payoff-quote?asOfDate=bad-date',
    headers: { authorization: 'Bearer valid-token' },
  });
  const executeResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/55/payoff-executions',
    headers: { authorization: 'Bearer valid-token' },
    body: { asOfDate: '2026-03-15', quotedTotal: 0 },
  });

  assert.equal(quoteResponse.statusCode, 400);
  assert.equal(quoteResponse.body.success, false);
  assert.equal(executeResponse.statusCode, 400);
  assert.equal(executeResponse.body.error.validationErrors[0].field, 'quotedTotal');
});

test('createCreditsRouter returns structured denial reasons for payoff denials', async () => {
  const app = createRuntimeApp({
    actor: { id: 7, role: 'employee' },
    useCases: createUseCases({
      async getPayoffQuote() {
        const error = new Error('El pago total no está permitido para este crédito');
        error.name = 'BusinessRuleViolationError';
        error.statusCode = 400;
        error.code = 'PAYOFF_NOT_ALLOWED';
        error.denialReasons = [{
          code: 'OVERDUE_UNPAID_INSTALLMENTS',
          message: 'El crédito tiene cuotas vencidas pendientes',
        }];
        throw error;
      },
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/55/payoff-quote?asOfDate=2026-03-15',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, 'PAYOFF_NOT_ALLOWED');
  assert.deepEqual(response.body.error.denialReasons, [{
    code: 'OVERDUE_UNPAID_INSTALLMENTS',
    message: 'El crédito tiene cuotas vencidas pendientes',
  }]);
});

test('createCreditsRouter returns structured denial reasons for payoff execution no-outstanding-balance denials', async () => {
  const app = createRuntimeApp({
    actor: { id: 7, role: 'employee' },
    useCases: createUseCases({
      async executePayoff() {
        const error = new Error('El pago total no está permitido para este crédito');
        error.name = 'BusinessRuleViolationError';
        error.statusCode = 400;
        error.code = 'PAYOFF_NOT_ALLOWED';
        error.denialReasons = [{
          code: 'LOAN_ALREADY_PAID',
          message: 'El crédito ya está pagado en su totalidad',
        }];
        throw error;
      },
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/55/payoff-executions',
    headers: { authorization: 'Bearer valid-token', 'idempotency-key': 'payoff-denied-55' },
    body: { asOfDate: '2026-03-15', quotedTotal: 955.12 },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, 'PAYOFF_NOT_ALLOWED');
  assert.deepEqual(response.body.error.denialReasons, [{
    code: 'LOAN_ALREADY_PAID',
    message: 'El crédito ya está pagado en su totalidad',
  }]);
});

test('createCreditsRouter blocks payoff execution for unsupported actors at the auth boundary', async () => {
  const app = createRuntimeApp({
    actor: { id: 1, role: 'socio' },
    useCases: createUseCases({}),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/55/payoff-executions',
    headers: { authorization: 'Bearer valid-token' },
    body: { asOfDate: '2026-03-15', quotedTotal: 955.12 },
  });

  assert.equal(response.statusCode, 401);
});
