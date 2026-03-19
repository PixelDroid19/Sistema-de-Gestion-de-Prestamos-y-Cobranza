const test = require('node:test');
const assert = require('node:assert/strict');

const { simulateCredit } = require('../src/services/creditSimulationService');
const { loanValidation, associateValidation } = require('../src/middleware/validation');
const { ValidationError } = require('../src/utils/errorHandler');
const { buildPayoffQuote } = require('../src/modules/credits/application/loanFinancials');
const { runMiddleware, captureMiddlewareError } = require('./helpers/middleware');

test('simulateCredit returns canonical backend preview data', () => {
  const simulation = simulateCredit({
    amount: 12000,
    interestRate: 12,
    termMonths: 12,
  });

  assert.equal(simulation.lateFeeMode, 'NONE');
  assert.equal(simulation.schedule.length, 12);
  assert.equal(simulation.summary.installmentAmount, 1066.19);
  assert.equal(simulation.summary.totalPayable, 12794.23);
  assert.equal(simulation.summary.outstandingBalance, 12794.23);
});

test('loanValidation.simulate rejects unsupported late-fee modes', async () => {
  const error = await captureMiddlewareError(loanValidation.simulate, {
    body: {
      amount: 12000,
      interestRate: 12,
      termMonths: 12,
      lateFeeMode: 'LINEAR',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Please correct the following errors');
  assert.deepEqual(error.errors, [
    {
      field: 'lateFeeMode',
      message: 'Late fee mode must not be one of: LINEAR, EFFECTIVE, SMART HYBRID',
    },
  ]);
});

test('loanValidation.create accepts a canonical loan payload', async () => {
  await assert.doesNotReject(() => runMiddleware(loanValidation.create, {
    body: {
      customerId: 1,
      associateId: 2,
      amount: 12000,
      interestRate: 12,
      termMonths: 12,
      lateFeeMode: 'none',
    },
  }));
});

test('associateValidation.create accepts a valid associate payload', async () => {
  await assert.doesNotReject(() => runMiddleware(associateValidation.create, {
    body: {
      name: 'Ana Associate',
      email: 'ana@example.com',
      phone: '+573001112233',
      status: 'active',
    },
  }));
});

test('buildPayoffQuote returns principal plus mid-cycle actual/365 accrual without future interest', () => {
  const quote = buildPayoffQuote({
    loan: {
      status: 'active',
      startDate: '2026-01-01T00:00:00.000Z',
      interestRate: 12,
    },
    schedule: [
      { installmentNumber: 1, dueDate: '2026-02-01T00:00:00.000Z', remainingPrincipal: 100, remainingInterest: 10 },
      { installmentNumber: 2, dueDate: '2026-03-01T00:00:00.000Z', remainingPrincipal: 100, remainingInterest: 8 },
    ],
    snapshot: {
      outstandingPrincipal: 200,
      outstandingBalance: 218,
    },
    asOfDate: '2026-02-15',
  });

  assert.equal(quote.breakdown.overduePrincipal, 100);
  assert.equal(quote.breakdown.overdueInterest, 10);
  assert.equal(quote.breakdown.futurePrincipal, 100);
  assert.equal(quote.accruedDays, 14);
  assert.equal(quote.breakdown.accruedInterest, 0.92);
  assert.equal(quote.total, 210.92);
});

test('buildPayoffQuote keeps accrued daily interest at zero on a due date boundary', () => {
  const quote = buildPayoffQuote({
    loan: {
      status: 'active',
      startDate: '2026-01-01T00:00:00.000Z',
      interestRate: 18,
    },
    schedule: [
      { installmentNumber: 1, dueDate: '2026-02-01T00:00:00.000Z', remainingPrincipal: 300, remainingInterest: 15 },
      { installmentNumber: 2, dueDate: '2026-03-01T00:00:00.000Z', remainingPrincipal: 300, remainingInterest: 12 },
    ],
    snapshot: {
      outstandingPrincipal: 600,
      outstandingBalance: 627,
    },
    asOfDate: '2026-03-01',
  });

  assert.equal(quote.accruedDays, 0);
  assert.equal(quote.breakdown.accruedInterest, 0);
  assert.equal(quote.total, 627);
});

test('buildPayoffQuote includes overdue earned buckets and excludes future scheduled interest', () => {
  const quote = buildPayoffQuote({
    loan: {
      status: 'defaulted',
      startDate: '2026-01-01T00:00:00.000Z',
      interestRate: 24,
    },
    schedule: [
      { installmentNumber: 1, dueDate: '2026-02-01T00:00:00.000Z', remainingPrincipal: 200, remainingInterest: 20 },
      { installmentNumber: 2, dueDate: '2026-03-01T00:00:00.000Z', remainingPrincipal: 180, remainingInterest: 18 },
      { installmentNumber: 3, dueDate: '2026-04-01T00:00:00.000Z', remainingPrincipal: 160, remainingInterest: 16 },
    ],
    snapshot: {
      outstandingPrincipal: 540,
      outstandingBalance: 594,
    },
    asOfDate: '2026-03-15',
  });

  assert.equal(quote.breakdown.overduePrincipal, 380);
  assert.equal(quote.breakdown.overdueInterest, 38);
  assert.equal(quote.breakdown.futurePrincipal, 160);
  assert.equal(quote.breakdown.accruedInterest, 4.97);
  assert.equal(quote.total, 582.97);
});

test('buildPayoffQuote rejects invalid payoff dates outside payable life', async () => {
  await assert.throws(() => buildPayoffQuote({
    loan: {
      status: 'active',
      startDate: '2026-04-10T00:00:00.000Z',
      interestRate: 12,
    },
    schedule: [],
    snapshot: {
      outstandingPrincipal: 500,
      outstandingBalance: 500,
    },
    asOfDate: '2026-04-01',
  }), ValidationError);
});

test('loanValidation.payoffQuote accepts a valid payoff quote payload', async () => {
  await assert.doesNotReject(() => runMiddleware(loanValidation.payoffQuote, {
    params: { id: '12' },
    query: { asOfDate: '2026-03-15' },
  }));
});

test('loanValidation.payoffExecute rejects invalid quote totals', async () => {
  const error = await captureMiddlewareError(loanValidation.payoffExecute, {
    params: { id: '12' },
    body: { asOfDate: '2026-03-15', quotedTotal: 0 },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Please correct the following errors');
  assert.deepEqual(error.errors, [
    {
      field: 'quotedTotal',
      message: 'quotedTotal must be a positive number',
    },
  ]);
});
