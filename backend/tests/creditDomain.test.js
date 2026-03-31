const test = require('node:test');
const assert = require('node:assert/strict');

const { simulateCredit } = require('../src/modules/credits/application/creditSimulationService');
const { loanValidation, associateValidation } = require('../src/middleware/validation');
const { ValidationError, BusinessRuleViolationError } = require('../src/utils/errorHandler');
const { buildPayoffQuote } = require('../src/modules/credits/application/loanFinancials');
const {
  evaluateCapitalPaymentEligibility,
  normalizeFinancialBlock,
} = require('../src/modules/credits/application/paymentEligibility');
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
      lateFeeMode: 'SIMPLE_DAILY',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Please correct the following errors');
  assert.deepEqual(error.errors, [
    {
      field: 'lateFeeMode',
      message: 'Late fee mode must not be one of: SIMPLE_DAILY, COMPOUND_DAILY, FIXED_FEE',
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
    user: { role: 'admin' },
    body: {
      name: 'Ana Associate',
      email: 'ana@example.com',
      phone: '+573001112233',
      status: 'active',
      participationPercentage: '25.1250',
    },
  }));
});

test('associateValidation.update rejects invalid participation percentage precision', async () => {
  const error = await captureMiddlewareError(associateValidation.update, {
    user: { role: 'admin' },
    body: {
      participationPercentage: '25.12345',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Please correct the following errors');
  assert.deepEqual(error.errors, [
    {
      field: 'participationPercentage',
      message: 'participationPercentage must be between 0 and 100 with up to 4 decimal places',
    },
  ]);
});

test('associateValidation.create rejects negative participation percentage values', async () => {
  const error = await captureMiddlewareError(associateValidation.create, {
    user: { role: 'admin' },
    body: {
      name: 'Ana Associate',
      email: 'ana@example.com',
      phone: '+573001112233',
      status: 'active',
      participationPercentage: '-0.0001',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Please correct the following errors');
  assert.deepEqual(error.errors, [
    {
      field: 'participationPercentage',
      message: 'participationPercentage must be between 0 and 100 with up to 4 decimal places',
    },
  ]);
});

test('associateValidation.update rejects participation percentage values above one hundred', async () => {
  const error = await captureMiddlewareError(associateValidation.update, {
    user: { role: 'admin' },
    body: {
      participationPercentage: '100.0001',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Please correct the following errors');
  assert.deepEqual(error.errors, [
    {
      field: 'participationPercentage',
      message: 'participationPercentage must be between 0 and 100 with up to 4 decimal places',
    },
  ]);
});

test('associateValidation.update rejects socio participation percentage mutations', async () => {
  const error = await captureMiddlewareError(associateValidation.update, {
    user: { role: 'socio' },
    body: {
      participationPercentage: '25.0000',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Please correct the following errors');
  assert.deepEqual(error.errors, [
    {
      field: 'participationPercentage',
      message: 'Only admins can set participationPercentage',
    },
  ]);
});

test('associateValidation.proportionalDistribution rejects invalid declared amount precision', async () => {
  const error = await captureMiddlewareError(associateValidation.proportionalDistribution, {
    body: {
      amount: '10.999',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Please correct the following errors');
  assert.deepEqual(error.errors, [
    {
      field: 'amount',
      message: 'Amount must be a positive number with up to 2 decimal places',
    },
  ]);
});

test('buildPayoffQuote returns principal plus mid-cycle actual/365 accrual without future interest before any installment is overdue', () => {
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
    asOfDate: '2026-01-15',
  });

  assert.equal(quote.breakdown.overduePrincipal, 0);
  assert.equal(quote.breakdown.overdueInterest, 0);
  assert.equal(quote.breakdown.futurePrincipal, 200);
  assert.equal(quote.accruedDays, 14);
  assert.equal(quote.breakdown.accruedInterest, 0.92);
  assert.equal(quote.total, 200.92);
});

test('buildPayoffQuote keeps accrued daily interest at zero on a due date boundary', () => {
  const quote = buildPayoffQuote({
    loan: {
      status: 'active',
      startDate: '2026-01-01T00:00:00.000Z',
      interestRate: 18,
    },
    schedule: [
      { installmentNumber: 1, dueDate: '2026-03-01T00:00:00.000Z', remainingPrincipal: 300, remainingInterest: 15 },
      { installmentNumber: 2, dueDate: '2026-04-01T00:00:00.000Z', remainingPrincipal: 300, remainingInterest: 12 },
    ],
    snapshot: {
      outstandingPrincipal: 600,
      outstandingBalance: 627,
    },
    asOfDate: '2026-03-01',
  });

  assert.equal(quote.accruedDays, 0);
  assert.equal(quote.breakdown.accruedInterest, 0);
  assert.equal(quote.total, 615);
});

test('buildPayoffQuote rejects overdue earned buckets because overdue unpaid installments block payoff', () => {
  assert.throws(() => buildPayoffQuote({
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
  }), BusinessRuleViolationError);
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

test('buildPayoffQuote rejects overdue unpaid installments with structured denial reasons', () => {
  assert.throws(() => buildPayoffQuote({
    loan: {
      status: 'active',
      startDate: '2026-01-01T00:00:00.000Z',
      interestRate: 12,
    },
    schedule: [
      { installmentNumber: 1, dueDate: '2026-02-01T00:00:00.000Z', remainingPrincipal: 300, remainingInterest: 30, status: 'pending' },
      { installmentNumber: 2, dueDate: '2026-04-01T00:00:00.000Z', remainingPrincipal: 200, remainingInterest: 10, status: 'pending' },
    ],
    snapshot: {
      outstandingPrincipal: 500,
      outstandingBalance: 540,
    },
    asOfDate: '2026-03-15',
  }), (error) => {
    assert.ok(error instanceof BusinessRuleViolationError);
    assert.equal(error.code, 'PAYOFF_NOT_ALLOWED');
    assert.deepEqual(error.denialReasons, [{
      code: 'OVERDUE_UNPAID_INSTALLMENTS',
      message: 'Loan has overdue unpaid installments',
    }]);
    return true;
  });
});

test('evaluateCapitalPaymentEligibility denies no-outstanding-balance, overdue, and financial block reasons together', () => {
  const eligibility = evaluateCapitalPaymentEligibility({
    loan: {
      status: 'active',
      principalOutstanding: 0,
      financialBlock: {
        isBlocked: true,
        code: 'LEGAL_HOLD',
        message: 'Legal hold active',
        reason: 'judicial_process',
      },
    },
    schedule: [
      { installmentNumber: 1, dueDate: '2026-03-01T00:00:00.000Z', remainingPrincipal: 10, remainingInterest: 2, status: 'pending' },
    ],
    snapshot: {
      outstandingPrincipal: 0,
      outstandingBalance: 0,
    },
    asOfDate: new Date('2026-03-15T00:00:00.000Z'),
  });

  assert.equal(eligibility.allowed, false);
  assert.deepEqual(eligibility.denialReasons, [
    {
      code: 'NO_OUTSTANDING_BALANCE',
      message: 'Loan has no outstanding balance for capital payment',
    },
    {
      code: 'OVERDUE_UNPAID_INSTALLMENTS',
      message: 'Loan has overdue unpaid installments',
    },
    {
      code: 'FINANCIAL_BLOCK',
      message: 'Legal hold active',
      blockCode: 'LEGAL_HOLD',
      blockReason: 'judicial_process',
    },
  ]);
});

test('normalizeFinancialBlock reads fallback block details from financialSnapshot', () => {
  assert.deepEqual(normalizeFinancialBlock({
    financialSnapshot: {
      financialBlock: {
        active: true,
        code: 'SNAPSHOT_BLOCK',
        message: 'Snapshot block active',
        reason: 'snapshot_reason',
      },
    },
  }), {
    isBlocked: true,
    code: 'SNAPSHOT_BLOCK',
    message: 'Snapshot block active',
    reason: 'snapshot_reason',
  });
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
