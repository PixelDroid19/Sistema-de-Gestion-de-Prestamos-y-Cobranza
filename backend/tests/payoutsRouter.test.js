const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createPayoutsRouter } = require('@/modules/payouts/presentation/router');
const { globalErrorHandler, BusinessRuleViolationError } = require('@/utils/errorHandler');
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

const enforceAuth = (options = []) => (req, res, next) => {
  const role = req.headers['x-test-role'] || 'admin';
  const allowedRoles = Array.isArray(options)
    ? options
    : (options?.permissions ? ['admin', 'employee'] : []);
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    res.status(403).json({
      success: false,
      error: { message: 'No tienes acceso a esta acción.', statusCode: 403 },
    });
    return;
  }

  req.user = { id: 3, role };
  next();
};

const paymentValidation = {
  create(req, res, next) {
    next();
  },
};

const noopAttachmentUpload = {
  single() {
    return (req, res, next) => {
      req.file = {
        path: '/tmp/payment-proof.pdf',
        filename: 'payment-proof.pdf',
        originalname: 'Payment Proof.pdf',
        mimetype: 'application/pdf',
        size: 512,
      };
      req.body = { customerVisible: 'true' };
      next();
    };
  },
};

const unexpectedUseCase = (name) => async () => {
  throw new Error(`${name} should not be called`);
};

const createRuntimeApp = ({ useCases }) => {
  const app = express();
  app.use(express.json());
  app.use(createPayoutsRouter({ authMiddleware: allowAuth, attachmentUpload: noopAttachmentUpload, paymentValidation, useCases }));
  app.use(globalErrorHandler);
  return app;
};

test('createPayoutsRouter serves list and create contract responses', async () => {
  const calls = [];
  const payments = [
    { id: 71, loanId: 8, amount: 250 },
    { id: 72, loanId: 8, amount: 125 },
  ];
  const router = createPayoutsRouter({
    authMiddleware: enforceAuth,
    attachmentUpload: noopAttachmentUpload,
    paymentValidation,
    useCases: {
      async listPayments(input) {
        calls.push(['listPayments', input]);
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
    paymentDate: '2026-03-21',
  };

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/?search=ana&status=completed&page=2&pageSize=10',
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
      'x-test-role': 'admin',
      'idempotency-key': 'payment-8-200',
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
    message: 'Pago registrado correctamente',
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
    ['listPayments', {
      actor: { id: 3, role: 'admin' },
      pagination: { page: 2, pageSize: 10, limit: 10, offset: 10 },
      filters: { search: 'ana', status: 'completed' },
    }],
    ['createPayment', { actor: { id: 3, role: 'admin' }, ...createPayload, idempotencyKey: 'payment-8-200' }],
  ]);
});

test('createPayoutsRouter requires idempotency key for financial mutations', async () => {
  const calls = [];
  const app = createRuntimeApp({
    useCases: {
      listPayments: unexpectedUseCase('listPayments'),
      async createPayment() {
        calls.push(['createPayment']);
        throw new Error('createPayment should not be called');
      },
      listPaymentsByLoan: unexpectedUseCase('listPaymentsByLoan'),
    },
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'admin',
    },
    body: { loanId: 8, amount: 200, paymentDate: '2026-03-21' },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error.message, /El encabezado Idempotency-Key es obligatorio/);
  assert.deepEqual(calls, []);
});

test('createPayoutsRouter rejects customer records before administrative payment use cases', async () => {
  const router = createPayoutsRouter({
    authMiddleware: enforceAuth,
    attachmentUpload: noopAttachmentUpload,
    paymentValidation,
    useCases: {
      listPayments: unexpectedUseCase('listPayments'),
      createPayment: unexpectedUseCase('createPayment'),
      listPaymentsByLoan: unexpectedUseCase('listPaymentsByLoan'),
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'customer',
    },
  });
  const createResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'customer',
      'idempotency-key': 'payment-8-200',
    },
    body: { loanId: 8, amount: 200, paymentDate: '2026-03-21' },
  });
  const loanLookupResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/loan/22',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'customer',
    },
  });

  assert.equal(listResponse.statusCode, 403);
  assert.equal(createResponse.statusCode, 403);
  assert.equal(loanLookupResponse.statusCode, 403);
});

test('createPayoutsRouter serves loan payment lookup contract responses', async () => {
  const calls = [];
  const payments = [
    { id: 81, loanId: 22, amount: 90 },
    { id: 82, loanId: 22, amount: 110 },
  ];
  const loan = { id: 22, status: 'approved', paymentContext: { isPayable: true } };
  const router = createPayoutsRouter({
    authMiddleware: enforceAuth,
    attachmentUpload: noopAttachmentUpload,
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
        return { payments, loan };
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
      'x-test-role': 'admin',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    count: 2,
    data: {
      payments,
      loan,
    },
  });
  assert.deepEqual(calls, [
    ['listPaymentsByLoan', { actor: { id: 3, role: 'admin' }, loanId: 22, pagination: { page: 1, pageSize: 25, limit: 25, offset: 0 } }],
  ]);
});

test('createPayoutsRouter routes loanId query lookups through loan-scoped payment access', async () => {
  const calls = [];
  const payments = [
    { id: 81, loanId: 22, amount: 90 },
    { id: 82, loanId: 22, amount: 110 },
  ];
  const loan = { id: 22, status: 'approved', paymentContext: { isPayable: true } };
  const router = createPayoutsRouter({
    authMiddleware: enforceAuth,
    attachmentUpload: noopAttachmentUpload,
    paymentValidation,
    useCases: {
      async listPayments(input) {
        calls.push(['listPayments', input]);
        return [];
      },
      async createPayment() {
        throw new Error('createPayment should not be called');
      },
      async listPaymentsByLoan(input) {
        calls.push(['listPaymentsByLoan', input]);
        return { payments, loan };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/?loanId=22&page=2&pageSize=10',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'admin',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    count: 2,
    data: {
      payments,
      loan,
    },
  });
  assert.deepEqual(calls, [
    ['listPaymentsByLoan', { actor: { id: 3, role: 'admin' }, loanId: 22, pagination: { page: 2, pageSize: 10, limit: 10, offset: 10 } }],
  ]);
});

test('createPayoutsRouter rejects malformed loanId query before executing payout use cases', async () => {
  const calls = [];
  const router = createPayoutsRouter({
    authMiddleware: enforceAuth,
    attachmentUpload: noopAttachmentUpload,
    paymentValidation,
    useCases: {
      async listPayments(input) {
        calls.push(['listPayments', input]);
        return [];
      },
      async listPaymentsByLoan(input) {
        calls.push(['listPaymentsByLoan', input]);
        return { payments: [], loan: { id: input.loanId } };
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
    path: '/?loanId=1e2',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'admin',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error.message, /número del crédito/i);
  assert.deepEqual(calls, []);
});

test('createPayoutsRouter rejects malformed route identifiers before executing payout use cases', async () => {
  const calls = [];
  const router = createPayoutsRouter({
    authMiddleware: enforceAuth,
    attachmentUpload: noopAttachmentUpload,
    paymentValidation,
    useCases: {
      async listPaymentsByLoan(input) {
        calls.push(['listPaymentsByLoan', input.loanId]);
        return { payments: [], loan: { id: Number(input.loanId) } };
      },
      async annulInstallment(input) {
        calls.push(['annulInstallment', input.loanId]);
        return { payment: { id: 1 }, annulment: {}, loan: { id: Number(input.loanId) } };
      },
      async updatePaymentMetadata(input) {
        calls.push(['updatePaymentMetadata', input.paymentId]);
        return { id: Number(input.paymentId) };
      },
      async listPaymentDocuments(input) {
        calls.push(['listPaymentDocuments', input.paymentId]);
        return [];
      },
      async downloadPaymentDocument(input) {
        calls.push(['downloadPaymentDocument', input.paymentId, input.documentId]);
        return { document: { originalName: 'proof.pdf' }, absolutePath: __filename };
      },
      async getPaymentVoucher(input) {
        calls.push(['getPaymentVoucher', input.paymentId]);
        return { filename: 'voucher.pdf', buffer: Buffer.from('%PDF-1.4 test') };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const responses = await Promise.all([
    requestJson(activeServer, {
      method: 'GET',
      path: '/loan/22abc',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
    requestJson(activeServer, {
      method: 'POST',
      path: '/annul/1e2',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin', 'idempotency-key': 'annul-invalid-id' },
      body: { installmentNumber: 1 },
    }),
    requestJson(activeServer, {
      method: 'PATCH',
      path: '/55.5/metadata',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
      body: { paymentMethod: 'transfer' },
    }),
    requestJson(activeServer, {
      method: 'GET',
      path: '/77abc/documents',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
    requestJson(activeServer, {
      method: 'GET',
      path: '/88/documents/doc-1/download',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
    requestJson(activeServer, {
      method: 'GET',
      path: '/99xyz/voucher/pdf',
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    }),
  ]);

  for (const response of responses) {
    assert.equal(response.statusCode, 400);
    assert.match(response.body.error.message, /(número del crédito|número del pago|número del documento)/i);
  }
  assert.deepEqual(calls, []);
});

test('createPayoutsRouter serves paginated loan payment lookup contract responses with loan context', async () => {
  const loan = { id: 22, status: 'approved', paymentContext: { isPayable: true } };
  const router = createPayoutsRouter({
    authMiddleware: allowAuth,
    attachmentUpload: noopAttachmentUpload,
    paymentValidation,
    useCases: {
      listPayments: unexpectedUseCase('listPayments'),
      createPayment: unexpectedUseCase('createPayment'),
      async listPaymentsByLoan() {
        return {
          items: [{ id: 91, loanId: 22, amount: 100 }],
          pagination: { page: 2, pageSize: 1, totalItems: 2, totalPages: 2 },
          loan,
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
    path: '/loan/22?page=2&pageSize=1',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'admin',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    count: 2,
    data: {
      payments: [{ id: 91, loanId: 22, amount: 100 }],
      loan,
      pagination: { page: 2, pageSize: 1, totalItems: 2, totalPages: 2 },
    },
  });
});

test('createPayoutsRouter serves partial, capital, and annulment contract responses', async () => {
  const calls = [];
  const router = createPayoutsRouter({
    authMiddleware: allowAuth,
    attachmentUpload: noopAttachmentUpload,
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
          allocation: { principalApplied: payload.amount, strategyRequested: payload.strategy, strategyApplied: 'reduce_payment' },
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
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin', 'idempotency-key': 'partial-15-40' },
    body: { loanId: 15, amount: 40, paymentDate: '2026-03-22' },
  });
  const capitalResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/capital',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin', 'idempotency-key': 'capital-15-60' },
    body: { loanId: 15, amount: 60, paymentDate: '2026-03-23', paymentMethod: 'transfer', strategy: 'REDUCE_QUOTA', newTermMonths: 10 },
  });
  const annulResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/annul/15',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin', 'idempotency-key': 'annul-15-2' },
    body: { installmentNumber: 2 },
  });

  assert.equal(partialResponse.statusCode, 201);
  assert.equal(capitalResponse.statusCode, 201);
  assert.equal(annulResponse.statusCode, 201);
  assert.equal(partialResponse.body.message, 'Abono parcial registrado correctamente');
  assert.equal(capitalResponse.body.message, 'Abono a capital registrado correctamente');
  assert.equal(annulResponse.body.message, 'Cuota anulada correctamente');
  assert.deepEqual(calls, [
    ['createPartialPayment', { actor: { id: 3, role: 'admin' }, loanId: 15, amount: 40, paymentDate: '2026-03-22', idempotencyKey: 'partial-15-40' }],
    ['createCapitalPayment', { actor: { id: 3, role: 'admin' }, loanId: 15, amount: 60, paymentDate: '2026-03-23', paymentMethod: 'transfer', strategy: 'REDUCE_QUOTA', newTermMonths: 10, idempotencyKey: 'capital-15-60' }],
    ['annulInstallment', { actor: { id: 3, role: 'admin' }, loanId: 15, installmentNumber: 2, reason: undefined, idempotencyKey: 'annul-15-2' }],
  ]);
  assert.equal(capitalResponse.body.data.strategy, 'REDUCE_QUOTA');
  assert.equal(capitalResponse.body.data.strategyApplied, 'reduce_payment');
});

test('createPayoutsRouter serves calculate-total-debt and pay-total-debt compatibility routes', async () => {
  const calls = [];
  const router = createPayoutsRouter({
    authMiddleware: allowAuth,
    attachmentUpload: noopAttachmentUpload,
    paymentValidation,
    useCases: {
      listPayments: unexpectedUseCase('listPayments'),
      createPayment: unexpectedUseCase('createPayment'),
      createPartialPayment: unexpectedUseCase('createPartialPayment'),
      createCapitalPayment: unexpectedUseCase('createCapitalPayment'),
      annulInstallment: unexpectedUseCase('annulInstallment'),
      listPaymentsByLoan: unexpectedUseCase('listPaymentsByLoan'),
      async calculateTotalDebt(payload) {
        calls.push(['calculateTotalDebt', payload]);
        return {
          loanId: 44,
          asOfDate: payload.asOfDate,
          totalDebt: 955.12,
          payoffQuote: { total: 955.12 },
        };
      },
      async payTotalDebt(payload) {
        calls.push(['payTotalDebt', payload]);
        return {
          payment: { id: 300, amount: payload.quotedTotal || 955.12, paymentType: 'payoff' },
          loan: { id: Number(payload.loanId), status: 'closed' },
          allocation: { payoff: { total: payload.quotedTotal || 955.12 } },
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const calculateResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/calculate-total-debt',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { loanId: 44, asOfDate: '2026-04-01' },
  });

  const payResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/pay-total-debt',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin', 'idempotency-key': 'pay-total-44' },
    body: { loanId: 44, asOfDate: '2026-04-01', quotedTotal: 955.12 },
  });

  assert.equal(calculateResponse.statusCode, 200);
  assert.equal(payResponse.statusCode, 201);
  assert.equal(payResponse.body.message, 'Pago total registrado correctamente');
  assert.deepEqual(calls, [
    ['calculateTotalDebt', { actor: { id: 3, role: 'admin' }, loanId: 44, asOfDate: '2026-04-01' }],
    ['payTotalDebt', { actor: { id: 3, role: 'admin' }, loanId: 44, asOfDate: '2026-04-01', quotedTotal: 955.12, idempotencyKey: 'pay-total-44' }],
  ]);
});

test('createPayoutsRouter blocks customer access to free partial payments', async () => {
  const router = createPayoutsRouter({
    authMiddleware: allowAuth,
    attachmentUpload: noopAttachmentUpload,
    paymentValidation,
    useCases: {
      listPayments: unexpectedUseCase('listPayments'),
      createPayment: unexpectedUseCase('createPayment'),
      createPartialPayment: unexpectedUseCase('createPartialPayment'),
      createCapitalPayment: unexpectedUseCase('createCapitalPayment'),
      annulInstallment: unexpectedUseCase('annulInstallment'),
      listPaymentsByLoan: unexpectedUseCase('listPaymentsByLoan'),
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/partial',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'customer' },
    body: { loanId: 15, amount: 40 },
  });
  const capitalResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/capital',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'customer', 'idempotency-key': 'capital-customer' },
    body: { loanId: 15, amount: 40 },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.message, 'Solo usuarios administrativos autorizados pueden crear pagos parciales.');
  assert.equal(capitalResponse.statusCode, 403);
  assert.equal(capitalResponse.body.error.message, 'Solo usuarios administrativos autorizados pueden registrar abonos a capital.');
});

test('createPayoutsRouter returns structured denial reasons for capital payment denials', async () => {
  const app = createRuntimeApp({
    useCases: {
      listPayments: unexpectedUseCase('listPayments'),
      createPayment: unexpectedUseCase('createPayment'),
      createPartialPayment: unexpectedUseCase('createPartialPayment'),
      async createCapitalPayment() {
        throw new BusinessRuleViolationError('El abono a capital no está permitido para este crédito', {
          code: 'CAPITAL_PAYMENT_NOT_ALLOWED',
          denialReasons: [{
            code: 'FINANCIAL_BLOCK',
            message: 'Manual review block active',
            blockCode: 'MANUAL_REVIEW',
          }],
        });
      },
      annulInstallment: unexpectedUseCase('annulInstallment'),
      listPaymentsByLoan: unexpectedUseCase('listPaymentsByLoan'),
    },
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/capital',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin', 'idempotency-key': 'capital-denied-15' },
    body: { loanId: 15, amount: 60 },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, 'CAPITAL_PAYMENT_NOT_ALLOWED');
  assert.deepEqual(response.body.error.denialReasons, [{
    code: 'FINANCIAL_BLOCK',
    message: 'Manual review block active',
    blockCode: 'MANUAL_REVIEW',
  }]);
});

test('createPayoutsRouter returns structured denial reasons for capital payment no-outstanding-balance denials', async () => {
  const app = createRuntimeApp({
    useCases: {
      listPayments: unexpectedUseCase('listPayments'),
      createPayment: unexpectedUseCase('createPayment'),
      createPartialPayment: unexpectedUseCase('createPartialPayment'),
      async createCapitalPayment() {
        throw new BusinessRuleViolationError('El abono a capital no está permitido para este crédito', {
          code: 'CAPITAL_PAYMENT_NOT_ALLOWED',
          denialReasons: [{
            code: 'NO_OUTSTANDING_BALANCE',
            message: 'El crédito no tiene saldo pendiente para abono a capital',
          }],
        });
      },
      annulInstallment: unexpectedUseCase('annulInstallment'),
      listPaymentsByLoan: unexpectedUseCase('listPaymentsByLoan'),
    },
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/capital',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin', 'idempotency-key': 'capital-no-balance-15' },
    body: { loanId: 15, amount: 60 },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, 'CAPITAL_PAYMENT_NOT_ALLOWED');
  assert.deepEqual(response.body.error.denialReasons, [{
    code: 'NO_OUTSTANDING_BALANCE',
    message: 'El crédito no tiene saldo pendiente para abono a capital',
  }]);
});

test('createPayoutsRouter forwards payment metadata updates with the admin actor context', async () => {
  const calls = [];
  const router = createPayoutsRouter({
    authMiddleware: allowAuth,
    attachmentUpload: noopAttachmentUpload,
    paymentValidation,
    useCases: {
      listPayments: unexpectedUseCase('listPayments'),
      createPayment: unexpectedUseCase('createPayment'),
      createPartialPayment: unexpectedUseCase('createPartialPayment'),
      createCapitalPayment: unexpectedUseCase('createCapitalPayment'),
      annulInstallment: unexpectedUseCase('annulInstallment'),
      listPaymentsByLoan: unexpectedUseCase('listPaymentsByLoan'),
      async updatePaymentMetadata(input) {
        calls.push(['updatePaymentMetadata', input]);
        return {
          id: Number(input.paymentId),
          paymentMethod: input.payload.paymentMethod,
          paymentMetadata: input.payload.paymentMetadata,
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/55/metadata',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: {
      paymentMethod: 'transfer',
      paymentMetadata: {
        reference: 'REF-123',
      },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.message, 'Datos del pago actualizados correctamente');
  assert.deepEqual(calls, [[
    'updatePaymentMetadata',
    {
      actor: { id: 3, role: 'admin' },
      paymentId: 55,
      payload: {
        paymentMethod: 'transfer',
        paymentMetadata: {
          reference: 'REF-123',
        },
      },
    },
  ]]);
});

test('createPayoutsRouter serves payment document list and upload contracts', async () => {
  const calls = [];
  const router = createPayoutsRouter({
    authMiddleware: allowAuth,
    attachmentUpload: noopAttachmentUpload,
    paymentValidation,
    useCases: {
      listPayments: unexpectedUseCase('listPayments'),
      createPayment: unexpectedUseCase('createPayment'),
      createPartialPayment: unexpectedUseCase('createPartialPayment'),
      createCapitalPayment: unexpectedUseCase('createCapitalPayment'),
      annulInstallment: unexpectedUseCase('annulInstallment'),
      listPaymentsByLoan: unexpectedUseCase('listPaymentsByLoan'),
      async listPaymentDocuments(input) {
        calls.push(['listPaymentDocuments', input]);
        return [{ id: 1, originalName: 'proof.pdf', customerVisible: true }];
      },
      async uploadPaymentDocument(input) {
        calls.push(['uploadPaymentDocument', input]);
        return { id: 2, originalName: 'Payment Proof.pdf', customerVisible: true };
      },
      async downloadPaymentDocument() {
        return { document: { originalName: 'proof.pdf' }, absolutePath: __filename };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/91/documents',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const createResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/91/documents',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: {},
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.body.message, 'Documento de pago cargado correctamente');
  assert.deepEqual(calls[0][1], { actor: { id: 3, role: 'admin' }, paymentId: 91 });
});
