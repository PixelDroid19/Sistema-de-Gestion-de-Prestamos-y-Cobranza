const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const models = require('../../src/models');
const { createLoanViewService } = require('../../src/modules/credits/application/loanFinancials');
const { createPaymentApplicationService } = require('../../src/modules/credits/application/paymentApplicationService');
const { getDagWorkbenchScopeDefinition } = require('../../src/modules/credits/application/dag/scopeRegistry');
const { ValidationError, NotFoundError } = require('../../src/utils/errorHandler');

const loanViewService = createLoanViewService();

afterEach(() => {
  mock.restoreAll();
});

test.skip('processPayment applies payment using DAG engine and returns breakdown', async () => {
  let savedLoan;
  let savedPayment;
  let publishedEvent;

  const graphNodes = [
    { id: 'principal_payment', type: 'source', outputVar: 'principal_payment', formula: 'paymentAmount * 0.85' },
    { id: 'interest_payment', type: 'source', outputVar: 'interest_payment', formula: 'paymentAmount * 0.15' },
  ];

  const loan = {
    id: 100,
    customerId: 1,
    amount: 10000,
    interestRate: 12,
    termMonths: 6,
    status: 'active',
    principalOutstanding: 8000,
    interestOutstanding: 200,
    totalPaid: 2000,
    lastPaymentDate: null,
    financialProductId: 'prod-100',
    async save() {
      savedLoan = { ...this };
      return this;
    },
  };

  const mockEventPublisher = {
    publishAmortizationCalculatedEvent: async (data) => {
      publishedEvent = data;
    },
  };

  mock.method(models.sequelize, 'transaction', async (options, handler) => {
    const txHandler = typeof options === 'function' ? options : handler;
    return txHandler({ id: 'tx-dag-payment' });
  });
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.GraphTopology, 'findOne', async () => ({
    id: 'topo-100',
    productId: 'prod-100',
    version: 1,
    nodes: graphNodes,
    edges: [],
  }));
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 200, ...payload };
  });
  mock.method(models.OutboxEvent, 'create', async () => ({ id: 'outbox-1' }));
  mock.method(models.IdempotencyKey, 'findOne', async () => null);
  mock.method(models.IdempotencyKey, 'create', async () => ({ id: 1 }));

  const result = await createPaymentApplicationService({
    loanViewService,
    eventPublisher: mockEventPublisher,
  }).processPayment({
    loanId: 100,
    paymentAmount: '1500',
    paymentDate: '2026-03-15T00:00:00.000Z',
  });

  assert.equal(result.status, 'APPLIED');
  assert.ok(result.newBalance !== undefined);
  assert.ok(result.breakdown !== undefined);
  assert.ok(savedPayment !== undefined);
  assert.equal(savedPayment.loanId, 100);
  assert.equal(savedPayment.amount, 1500);
  assert.equal(savedPayment.status, 'completed');
  assert.ok(savedLoan !== undefined);
  assert.ok(publishedEvent !== undefined);
  assert.equal(publishedEvent.loanId, 100);
  assert.equal(publishedEvent.transactionId, 'tx-dag-payment');
});

test.skip('processPayment returns cached result for idempotent request', async () => {
  const cachedResponse = {
    transactionId: 'tx-cached',
    status: 'APPLIED',
    newBalance: 6500,
    breakdown: { capital: 1200, interest: 200, penalty: 0 },
    paymentId: 150,
  };

  mock.method(models.IdempotencyKey, 'findOne', async () => ({
    id: 1,
    scope: 'payment',
    idempotencyKey: 'some-key',
    status: 'completed',
    responsePayload: cachedResponse,
  }));

  const result = await createPaymentApplicationService({ loanViewService }).processPayment({
    loanId: 100,
    paymentAmount: '1500',
    paymentDate: '2026-03-15T00:00:00.000Z',
  });

  assert.equal(result.status, 'APPLIED');
  assert.equal(result.transactionId, 'tx-cached');
  assert.equal(result.idempotent, true);
});

test('processPayment throws ValidationError for missing loanId', async () => {
  await assert.rejects(
    createPaymentApplicationService({ loanViewService }).processPayment({
      paymentAmount: '1500',
      paymentDate: '2026-03-15T00:00:00.000Z',
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.match(error.message, /loanId/i);
      return true;
    }
  );
});

test('processPayment throws ValidationError for invalid paymentAmount', async () => {
  await assert.rejects(
    createPaymentApplicationService({ loanViewService }).processPayment({
      loanId: 100,
      paymentAmount: '-100',
      paymentDate: '2026-03-15T00:00:00.000Z',
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.match(error.message, /paymentAmount/i);
      return true;
    }
  );
});

test('processPayment throws ValidationError for zero paymentAmount', async () => {
  await assert.rejects(
    createPaymentApplicationService({ loanViewService }).processPayment({
      loanId: 100,
      paymentAmount: '0',
      paymentDate: '2026-03-15T00:00:00.000Z',
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.match(error.message, /paymentAmount/i);
      return true;
    }
  );
});

test('processPayment throws ValidationError for missing paymentDate', async () => {
  await assert.rejects(
    createPaymentApplicationService({ loanViewService }).processPayment({
      loanId: 100,
      paymentAmount: '1500',
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.match(error.message, /paymentDate/i);
      return true;
    }
  );
});

test('processPayment throws ValidationError for invalid paymentDate', async () => {
  await assert.rejects(
    createPaymentApplicationService({ loanViewService }).processPayment({
      loanId: 100,
      paymentAmount: '1500',
      paymentDate: 'not-a-date',
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.match(error.message, /paymentDate/i);
      return true;
    }
  );
});

test('processPayment returns cached payload when idempotency key was already completed', async () => {
  const cachedResponse = {
    transactionId: 'tx-cached',
    status: 'APPLIED',
    newBalance: 6500,
    breakdown: { capital: 1200, interest: 200, penalty: 0 },
    paymentId: 150,
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => {
    const txHandler = typeof _options === 'function' ? _options : handler;
    return txHandler({ id: 'tx-cached' });
  });
  mock.method(models.IdempotencyKey, 'findOne', async () => ({
    id: 1,
    scope: 'payment',
    idempotencyKey: 'some-key',
    status: 'completed',
    responsePayload: cachedResponse,
  }));

  const result = await createPaymentApplicationService({ loanViewService }).processPayment({
    loanId: 100,
    paymentAmount: '1500',
    paymentDate: '2026-03-15T00:00:00.000Z',
    idempotencyKey: 'some-key',
  });

  assert.equal(result.status, 'APPLIED');
  assert.equal(result.transactionId, 'tx-cached');
  assert.equal(result.idempotent, true);
});

test('processPayment uses canonical payment waterfall and publishes the resulting breakdown', async () => {
  let publishedEvent;
  let idempotencyUpdatePayload;
  const loan = {
    id: 100,
    customerId: 1,
    amount: 1000,
    interestRate: 12,
    termMonths: 2,
    status: 'active',
    principalOutstanding: 1000,
    interestOutstanding: 30,
    totalPaid: 0,
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-02-01T00:00:00.000Z',
        remainingPrincipal: 100,
        remainingInterest: 20,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-04-01T00:00:00.000Z',
        remainingPrincipal: 120,
        remainingInterest: 12,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
    ],
    async save() {
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => {
    const txHandler = typeof _options === 'function' ? _options : handler;
    return txHandler({ id: 'tx-process' });
  });
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => ({
    id: 200,
    ...payload,
    async update() {
      return this;
    },
  }));
  mock.method(models.IdempotencyKey, 'findOne', async () => null);
  mock.method(models.IdempotencyKey, 'create', async () => ({ id: 1 }));
  mock.method(models.IdempotencyKey, 'update', async (payload) => {
    idempotencyUpdatePayload = payload;
    return [1];
  });

  const result = await createPaymentApplicationService({
    loanViewService,
    clock: () => new Date('2026-03-15T00:00:00.000Z'),
    eventPublisher: {
      publishAmortizationCalculatedEvent: async (data) => {
        publishedEvent = data;
      },
    },
  }).processPayment({
    loanId: 100,
    paymentAmount: '170',
    paymentDate: '2026-03-15T00:00:00.000Z',
    actorId: 5,
    idempotencyKey: 'canonical-key',
  });

  assert.equal(result.status, 'APPLIED');
  assert.equal(result.breakdown.capital, 138);
  assert.equal(result.breakdown.interest, 32);
  assert.equal(result.breakdown.penalty, 0);
  assert.equal(result.newBalance, 82);
  assert.equal(publishedEvent.loanId, 100);
  assert.equal(publishedEvent.transactionId, 'tx-process');
  assert.equal(idempotencyUpdatePayload.status, 'completed');
  assert.equal(idempotencyUpdatePayload.responsePayload.paymentId, 200);
});

test.skip('processPayment throws NotFoundError when loan does not exist', async () => {
  mock.method(models.sequelize, 'transaction', async (options, handler) => {
    const txHandler = typeof options === 'function' ? options : handler;
    return txHandler({ id: 'tx-not-found' });
  });
  mock.method(models.Loan, 'findByPk', async () => null);
  mock.method(models.IdempotencyKey, 'findOne', async () => null);

  await assert.rejects(
    createPaymentApplicationService({ loanViewService }).processPayment({
      loanId: 999,
      paymentAmount: '1500',
      paymentDate: '2026-03-15T00:00:00.000Z',
    }),
    (error) => {
      assert.ok(error instanceof NotFoundError);
      assert.match(error.message, /loan/i);
      return true;
    }
  );
});

test.skip('processPayment uses DAG graph when available for calculation', async () => {
  let savedPayment;
  let _graphUsed = false;

  const graphNodes = [
    { id: 'capital', type: 'source', outputVar: 'capital', formula: 'paymentAmount * 0.8' },
    { id: 'interest', type: 'source', outputVar: 'interest', formula: 'paymentAmount * 0.2' },
  ];
  const graphEdges = [];

  const loan = {
    id: 200,
    customerId: 1,
    amount: 10000,
    interestRate: 12,
    termMonths: 6,
    status: 'active',
    principalOutstanding: 8000,
    interestOutstanding: 200,
    totalPaid: 2000,
    lastPaymentDate: null,
    financialProductId: 'prod-123',
    async save() {
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (options, handler) => {
    const txHandler = typeof options === 'function' ? options : handler;
    return txHandler({ id: 'tx-graph-payment' });
  });
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.GraphTopology, 'findOne', async () => ({
    id: 'topo-1',
    productId: 'prod-123',
    version: 1,
    nodes: graphNodes,
    edges: graphEdges,
  }));
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 201, ...payload };
  });
  mock.method(models.OutboxEvent, 'create', async () => ({ id: 'outbox-2' }));
  mock.method(models.IdempotencyKey, 'findOne', async () => null);
  mock.method(models.IdempotencyKey, 'create', async () => ({ id: 2 }));

  const result = await createPaymentApplicationService({ loanViewService }).processPayment({
    loanId: 200,
    paymentAmount: '1000',
    paymentDate: '2026-03-15T00:00:00.000Z',
  });

  assert.equal(result.status, 'APPLIED');
  assert.ok(savedPayment !== undefined);
  assert.ok(savedPayment.paymentMetadata.calculationResult !== undefined);
});

test.skip('processPayment executes seeded amortization graph without legacy fallback inputs', async () => {
  let savedPayment;
  const initialOutstanding = 904.46;

  const loan = {
    id: 210,
    customerId: 1,
    amount: 1200,
    interestRate: 12,
    termMonths: 12,
    status: 'active',
    principalOutstanding: initialOutstanding,
    interestOutstanding: 18.14,
    totalPaid: 307.54,
    lastPaymentDate: null,
    financialProductId: 'prod-seeded',
    async save() {
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (options, handler) => {
    const txHandler = typeof options === 'function' ? options : handler;
    return txHandler({ id: 'tx-seeded-graph-payment' });
  });
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.GraphTopology, 'findOne', async () => ({
    id: 'topo-seeded',
    productId: 'prod-seeded',
    version: 1,
    ...getDagWorkbenchScopeDefinition('credit-simulation').defaultGraph,
  }));
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 210, ...payload };
  });
  mock.method(models.IdempotencyKey, 'findOne', async () => null);
  mock.method(models.IdempotencyKey, 'create', async () => ({ id: 210 }));

  const result = await createPaymentApplicationService({ loanViewService }).processPayment({
    loanId: 210,
    paymentAmount: '50',
    paymentDate: '2026-03-21T00:00:00.000Z',
  });

  assert.equal(result.status, 'APPLIED');
  assert.ok(result.newBalance < initialOutstanding);
  assert.ok(savedPayment.interestApplied > 0);
  assert.ok(savedPayment.principalApplied > 0);
});

test.skip('processPayment throws error when no graph topology exists', async () => {
  const loan = {
    id: 300,
    customerId: 1,
    amount: 12000,
    interestRate: 12,
    termMonths: 12,
    status: 'active',
    principalOutstanding: 12000,
    interestOutstanding: 0,
    totalPaid: 0,
    lastPaymentDate: null,
    financialProductId: null,
    async save() {
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (options, handler) => {
    const txHandler = typeof options === 'function' ? options : handler;
    return txHandler({ id: 'tx-no-graph' });
  });
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.GraphTopology, 'findOne', async () => null);

  await assert.rejects(
    async () => createPaymentApplicationService({ loanViewService }).processPayment({
      loanId: 300,
      paymentAmount: '1500',
      paymentDate: '2026-03-15T00:00:00.000Z',
    }),
    { message: 'No graph topology found for product' }
  );
});

test.skip('processPayment stores idempotency key after successful processing', async () => {
  let idempotencyKeyCreated = null;

  const graphNodes = [
    { id: 'principal_payment', type: 'source', outputVar: 'principal_payment', formula: 'paymentAmount * 0.8' },
    { id: 'interest_payment', type: 'source', outputVar: 'interest_payment', formula: 'paymentAmount * 0.2' },
  ];

  const loan = {
    id: 400,
    customerId: 1,
    amount: 10000,
    interestRate: 12,
    termMonths: 6,
    status: 'active',
    principalOutstanding: 8000,
    interestOutstanding: 200,
    totalPaid: 2000,
    lastPaymentDate: null,
    financialProductId: 'prod-400',
    async save() {
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (options, handler) => {
    const txHandler = typeof options === 'function' ? options : handler;
    return txHandler({ id: 'tx-idempotency' });
  });
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.GraphTopology, 'findOne', async () => ({
    id: 'topo-400',
    productId: 'prod-400',
    version: 1,
    nodes: graphNodes,
    edges: [],
  }));
  mock.method(models.Payment, 'create', async (payload) => {
    return { id: 400, ...payload };
  });
  mock.method(models.OutboxEvent, 'create', async () => ({ id: 'outbox-4' }));
  mock.method(models.IdempotencyKey, 'findOne', async () => null);
  mock.method(models.IdempotencyKey, 'create', async (payload) => {
    idempotencyKeyCreated = payload;
    return { id: 4, ...payload };
  });

  await createPaymentApplicationService({ loanViewService }).processPayment({
    loanId: 400,
    paymentAmount: '1500',
    paymentDate: '2026-03-15T00:00:00.000Z',
    actorId: 5,
  });

  assert.ok(idempotencyKeyCreated !== null);
  assert.equal(idempotencyKeyCreated.scope, 'payment');
  assert.equal(idempotencyKeyCreated.status, 'completed');
  assert.equal(idempotencyKeyCreated.createdByUserId, 5);
});

test.skip('processPayment updates loan outstanding balance after payment', async () => {
  let savedLoan;

  const graphNodes = [
    { id: 'principal_payment', type: 'source', outputVar: 'principal_payment', formula: 'paymentAmount * 0.9' },
    { id: 'interest_payment', type: 'source', outputVar: 'interest_payment', formula: 'paymentAmount * 0.1' },
  ];

  const loan = {
    id: 500,
    customerId: 1,
    amount: 10000,
    interestRate: 12,
    termMonths: 6,
    status: 'active',
    principalOutstanding: 10000,
    interestOutstanding: 100,
    totalPaid: 0,
    lastPaymentDate: null,
    financialProductId: 'prod-500',
    async save() {
      savedLoan = { ...this };
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (options, handler) => {
    const txHandler = typeof options === 'function' ? options : handler;
    return txHandler({ id: 'tx-balance-update' });
  });
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.GraphTopology, 'findOne', async () => ({
    id: 'topo-500',
    productId: 'prod-500',
    version: 1,
    nodes: graphNodes,
    edges: [],
  }));
  mock.method(models.Payment, 'create', async (payload) => {
    return { id: 500, ...payload };
  });
  mock.method(models.OutboxEvent, 'create', async () => ({ id: 'outbox-5' }));
  mock.method(models.IdempotencyKey, 'findOne', async () => null);
  mock.method(models.IdempotencyKey, 'create', async () => ({ id: 5 }));

  const result = await createPaymentApplicationService({ loanViewService }).processPayment({
    loanId: 500,
    paymentAmount: '1000',
    paymentDate: '2026-03-15T00:00:00.000Z',
  });

  assert.ok(savedLoan !== undefined);
  assert.ok(savedLoan.principalOutstanding !== undefined);
  assert.ok(savedLoan.interestOutstanding !== undefined);
  assert.ok(savedLoan.lastPaymentDate !== null);
  assert.ok(savedLoan.totalPaid > 0);
  assert.ok(result.newBalance !== undefined);
});
