const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const models = require('@/models');
const { createLoanViewService } = require('@/modules/credits/application/loanFinancials');
const { createPaymentApplicationService } = require('@/modules/credits/application/paymentApplicationService');
const { ValidationError } = require('@/utils/errorHandler');

const loanViewService = createLoanViewService();

afterEach(() => {
  mock.restoreAll();
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

test('processPayment returns completed idempotent payload after concurrent key creation', async () => {
  const cachedResponse = {
    transactionId: 'tx-concurrent',
    status: 'APPLIED',
    newBalance: 6100,
    breakdown: { capital: 1000, interest: 100, penalty: 0 },
    paymentId: 151,
  };
  const uniqueError = new Error('duplicate key value violates unique constraint');
  uniqueError.name = 'SequelizeUniqueConstraintError';

  mock.method(models.sequelize, 'transaction', async (_options, handler) => {
    const txHandler = typeof _options === 'function' ? _options : handler;
    return txHandler({ id: 'tx-concurrent-loser' });
  });
  mock.method(models.IdempotencyKey, 'findOne', async (options = {}) => {
    if (options.transaction) {
      return null;
    }

    return {
      id: 1,
      scope: 'payment',
      idempotencyKey: 'concurrent-key',
      status: 'completed',
      responsePayload: cachedResponse,
    };
  });
  mock.method(models.IdempotencyKey, 'create', async () => {
    throw uniqueError;
  });

  const result = await createPaymentApplicationService({ loanViewService }).processPayment({
    loanId: 100,
    paymentAmount: '1500',
    paymentDate: '2026-03-15T00:00:00.000Z',
    idempotencyKey: 'concurrent-key',
  });

  assert.equal(result.status, 'APPLIED');
  assert.equal(result.transactionId, 'tx-concurrent');
  assert.equal(result.idempotent, true);
});

test('processPayment uses canonical payment waterfall and publishes the resulting breakdown', async () => {
  let publishedEvent;
  let idempotencyUpdatePayload;
  const notifications = [];
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
    notificationPort: {
      sendPaymentRegistered: async (userId, payload) => {
        notifications.push({ userId, payload });
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
  assert.deepEqual(notifications.map((entry) => entry.userId).sort(), [1, 5]);
  assert.equal(notifications[0].payload.paymentId, 200);
});

test('applyCapitalPayment accepts configured payment method keys and caches idempotent result', async () => {
  let createdPaymentPayload;
  let idempotencyUpdatePayload;
  const loan = {
    id: 301,
    customerId: 11,
    amount: 1000,
    status: 'active',
    principalOutstanding: 1000,
    interestOutstanding: 0,
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-12-01T00:00:00.000Z',
        remainingPrincipal: 1000,
        remainingInterest: 0,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
    ],
    async save() {
      return this;
    },
    toJSON() {
      return { id: this.id, status: this.status, principalOutstanding: this.principalOutstanding };
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => {
    const txHandler = typeof _options === 'function' ? _options : handler;
    return txHandler({ id: 'tx-capital' });
  });
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.IdempotencyKey, 'findOne', async () => null);
  mock.method(models.IdempotencyKey, 'create', async () => ({ id: 1 }));
  mock.method(models.IdempotencyKey, 'update', async (payload) => {
    idempotencyUpdatePayload = payload;
    return [1];
  });
  mock.method(models.Payment, 'create', async (payload) => {
    createdPaymentPayload = payload;
    return {
      id: 88,
      ...payload,
      toJSON() {
        return { id: this.id, paymentMethod: this.paymentMethod, amount: this.amount };
      },
    };
  });

  const result = await createPaymentApplicationService({
    loanViewService,
    clock: () => new Date('2026-03-15T00:00:00.000Z'),
  }).applyCapitalPayment({
    loanId: 301,
    amount: 125,
    paymentMethod: 'wallet_mobile',
    actorId: 5,
    idempotencyKey: 'capital-key',
  });

  assert.equal(result.payment.id, 88);
  assert.equal(createdPaymentPayload.paymentMethod, 'wallet_mobile');
  assert.equal(idempotencyUpdatePayload.status, 'completed');
  assert.equal(idempotencyUpdatePayload.responsePayload.payment.paymentMethod, 'wallet_mobile');
});

test('applyCapitalPayment rejects unsafe payment method keys', async () => {
  await assert.rejects(
    createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
      loanId: 301,
      amount: 125,
      paymentMethod: '../cash',
    }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.match(error.message, /Payment method/i);
      return true;
    },
  );
});
