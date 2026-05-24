const test = require('node:test');
const assert = require('node:assert/strict');

const { loanValidation, associateValidation } = require('@/middleware/validation');
const { ValidationError, BusinessRuleViolationError } = require('@/utils/errorHandler');
const { buildPayoffQuote } = require('@/modules/credits/application/loanFinancials');
const {
  evaluateCapitalPaymentEligibility,
  evaluatePayoffEligibility,
  normalizeFinancialBlock,
} = require('@/modules/credits/application/paymentEligibility');
const { runMiddleware, captureMiddlewareError } = require('./helpers/middleware');

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
  assert.equal(error.message, 'Corrige los errores indicados');
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
      amount: 12000,
      interestRate: 12,
      rateSource: 'policy',
      lateFeeSource: 'policy',
      termMonths: 12,
      lateFeeMode: 'none',
    },
  }));
});

test('loanValidation.create rejects manual interest rate source for real credit creation', async () => {
  const error = await captureMiddlewareError(loanValidation.create, {
    body: {
      customerId: 1,
      amount: 12000,
      interestRate: 12,
      rateSource: 'manual',
      lateFeeSource: 'policy',
      termMonths: 12,
      lateFeeMode: 'none',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.deepEqual(error.errors, [
    {
      field: 'rateSource',
      message: 'La creación de créditos debe usar una política de tasa configurada',
    },
  ]);
});

test('loanValidation.create allows policy-driven rate without a manual interestRate', async () => {
  await assert.doesNotReject(() => runMiddleware(loanValidation.create, {
    body: {
      customerId: 1,
      amount: 12000,
      rateSource: 'policy',
      termMonths: 12,
      lateFeeSource: 'policy',
    },
  }));
});

test('loanValidation.create rejects manual late-fee source for real credit creation', async () => {
  const error = await captureMiddlewareError(loanValidation.create, {
    body: {
      customerId: 1,
      amount: 12000,
      rateSource: 'policy',
      lateFeeSource: 'manual',
      termMonths: 12,
      lateFeeMode: 'none',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.deepEqual(error.errors, [
    {
      field: 'lateFeeSource',
      message: 'La creación de créditos debe usar una política de mora configurada',
    },
  ]);
});

test('loanValidation.create requires a late-fee policy source for real credit creation', async () => {
  const error = await captureMiddlewareError(loanValidation.create, {
    body: {
      customerId: 1,
      amount: 12000,
      rateSource: 'policy',
      termMonths: 12,
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.deepEqual(error.errors, [
    {
      field: 'lateFeeSource',
      message: 'La creación de créditos debe usar una política de mora configurada',
    },
  ]);
});

test('loanValidation.create rejects associate assignment for new credits', async () => {
  const error = await captureMiddlewareError(loanValidation.create, {
    body: {
      customerId: 1,
      associateId: 2,
      amount: 12000,
      rateSource: 'policy',
      termMonths: 12,
      lateFeeSource: 'policy',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.deepEqual(error.errors, [
    {
      field: 'associateId',
      message: 'Los socios se gestionan como inversionistas y no se asignan a créditos nuevos',
    },
  ]);
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
  assert.equal(error.message, 'Corrige los errores indicados');
  assert.deepEqual(error.errors, [
    {
      field: 'participationPercentage',
      message: 'El porcentaje de participación debe estar entre 0 y 100 con máximo 4 decimales',
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
  assert.equal(error.message, 'Corrige los errores indicados');
  assert.deepEqual(error.errors, [
    {
      field: 'participationPercentage',
      message: 'El porcentaje de participación debe estar entre 0 y 100 con máximo 4 decimales',
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
  assert.equal(error.message, 'Corrige los errores indicados');
  assert.deepEqual(error.errors, [
    {
      field: 'participationPercentage',
      message: 'El porcentaje de participación debe estar entre 0 y 100 con máximo 4 decimales',
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
  assert.equal(error.message, 'Corrige los errores indicados');
  assert.deepEqual(error.errors, [
    {
      field: 'participationPercentage',
      message: 'Solo los administradores pueden definir el porcentaje de participación',
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
  assert.equal(error.message, 'Corrige los errores indicados');
  assert.deepEqual(error.errors, [
    {
      field: 'amount',
      message: 'El monto debe ser un número positivo con máximo 2 decimales',
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

test('buildPayoffQuote supports legacy loans without startDate by using createdAt', () => {
  const quote = buildPayoffQuote({
    loan: {
      status: 'active',
      createdAt: '2026-01-01T10:30:00.000Z',
      interestRate: 12,
    },
    schedule: [
      { installmentNumber: 1, dueDate: '2026-02-01T00:00:00.000Z', remainingPrincipal: 100, remainingInterest: 10 },
    ],
    snapshot: {
      outstandingPrincipal: 100,
      outstandingBalance: 110,
    },
    asOfDate: '2026-01-15',
  });

  assert.equal(quote.accrualAnchor.date, '2026-01-01');
  assert.equal(quote.accruedDays, 14);
  assert.equal(quote.total, 100.46);
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

test('evaluatePayoffEligibility denies payoff before the loan start date', () => {
  const eligibility = evaluatePayoffEligibility({
    loan: {
      status: 'active',
      startDate: '2026-05-31T00:00:00.000Z',
    },
    schedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-05-31T00:00:00.000Z',
        remainingPrincipal: 100,
        remainingInterest: 10,
        status: 'pending',
      },
    ],
    snapshot: {
      outstandingPrincipal: 100,
      outstandingInterest: 10,
      outstandingBalance: 110,
    },
    asOfDate: '2026-04-30',
  });

  assert.equal(eligibility.allowed, false);
  assert.deepEqual(eligibility.denialReasons, [
    {
      code: 'PAYOFF_BEFORE_LOAN_START',
      message: 'La fecha efectiva del pago total debe ser igual o posterior al inicio del crédito',
    },
  ]);
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
      message: 'El crédito tiene cuotas vencidas pendientes',
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
      message: 'El crédito no tiene saldo pendiente para abono a capital',
    },
    {
      code: 'OVERDUE_UNPAID_INSTALLMENTS',
      message: 'El crédito tiene cuotas vencidas pendientes',
    },
    {
      code: 'FINANCIAL_BLOCK',
      message: 'Legal hold active',
      blockCode: 'LEGAL_HOLD',
      blockReason: 'judicial_process',
    },
  ]);
});

test('evaluateCapitalPaymentEligibility denies capital payment until the first installment is paid', () => {
  const eligibility = evaluateCapitalPaymentEligibility({
    loan: {
      status: 'active',
      principalOutstanding: 900,
    },
    schedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-06-01T00:00:00.000Z',
        remainingPrincipal: 300,
        remainingInterest: 20,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-07-01T00:00:00.000Z',
        remainingPrincipal: 300,
        remainingInterest: 15,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
    ],
    snapshot: {
      outstandingPrincipal: 900,
      outstandingBalance: 935,
    },
    asOfDate: new Date('2026-05-15T00:00:00.000Z'),
  });

  assert.equal(eligibility.allowed, false);
  assert.deepEqual(eligibility.denialReasons, [{
    code: 'FIRST_INSTALLMENT_PAYMENT_REQUIRED',
    message: 'Debe existir al menos la primera cuota pagada antes de abonar a capital',
  }]);
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
  assert.equal(error.message, 'Corrige los errores indicados');
  assert.deepEqual(error.errors, [
    {
      field: 'quotedTotal',
      message: 'El total cotizado debe ser un número positivo',
    },
  ]);
});

test('loanValidation.payoffExecute rejects exponent notation quote totals', async () => {
  const error = await captureMiddlewareError(loanValidation.payoffExecute, {
    params: { id: '12' },
    body: { asOfDate: '2026-03-15', quotedTotal: '1e2' },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Corrige los errores indicados');
  assert.deepEqual(error.errors, [
    {
      field: 'quotedTotal',
      message: 'El total cotizado debe ser un número positivo',
    },
  ]);
});
