const test = require('node:test');
const assert = require('node:assert/strict');

const { loanValidation, associateValidation } = require('@/middleware/validation');
const { ValidationError } = require('@/utils/errorHandler');
const { buildPayoffQuote, getCanonicalLoanView } = require('@/modules/credits/application/loanFinancials');
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
      message: 'Selecciona una política de mora válida.',
    },
  ]);
});

test('loanValidation.updateStatus rejects invalid states without exposing raw status values', async () => {
  const error = await captureMiddlewareError(loanValidation.updateStatus, {
    body: {
      status: 'archived_internal',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Estado del crédito inválido');
  assert.deepEqual(error.errors, [
    {
      field: 'status',
      message: 'Selecciona un estado de crédito válido.',
    },
  ]);
  assert.doesNotMatch(error.errors[0].message, /pending|approved|archived_internal/i);
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
      interestType: 'monthly',
      interestRate: '2.5000',
      interestPaymentDay: 5,
      investmentTermMonths: 12,
    },
  }));
});

test('associateValidation.update rejects removed associate contract fields', async () => {
  await assert.rejects(() => runMiddleware(associateValidation.update, {
    user: { role: 'admin' },
    body: {
      participationPercentage: '25.12345',
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.errors[0].field, 'participationPercentage');
    return true;
  });
});

test('associateValidation.create rejects removed associate contract fields', async () => {
  await assert.rejects(() => runMiddleware(associateValidation.create, {
    user: { role: 'admin' },
    body: {
      name: 'Ana Associate',
      email: 'ana@example.com',
      phone: '+573001112233',
      status: 'active',
      investmentTermMonths: 12,
      participationPercentage: '-0.0001',
    },
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.errors[0].field, 'participationPercentage');
    return true;
  });
});

test('buildPayoffQuote uses actual/360 only after an unpaid installment is past due', () => {
  const quote = buildPayoffQuote({
    loan: {
      status: 'active',
      startDate: '2026-01-01T00:00:00.000Z',
      interestRate: 12,
    },
    schedule: [
      { installmentNumber: 1, dueDate: '2026-01-01T00:00:00.000Z', remainingPrincipal: 100, remainingInterest: 10 },
      { installmentNumber: 2, dueDate: '2026-03-01T00:00:00.000Z', remainingPrincipal: 100, remainingInterest: 8 },
    ],
    snapshot: {
      outstandingPrincipal: 200,
      outstandingBalance: 218,
    },
    asOfDate: '2026-01-15',
  });

  assert.equal(quote.breakdown.overduePrincipal, 100);
  assert.equal(quote.breakdown.overdueInterest, 10);
  assert.equal(quote.breakdown.futurePrincipal, 100);
  assert.equal(quote.accruedDays, 14);
  assert.equal(quote.accrualMethod, 'actual/360');
  assert.equal(quote.breakdown.accruedInterest, 0.47);
  assert.equal(quote.total, 210.47);
});

test('buildPayoffQuote does not add daily interest to a current legacy loan', () => {
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
  assert.equal(quote.accruedDays, 0);
  assert.equal(quote.breakdown.accruedInterest, 0);
  assert.equal(quote.total, 100);
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

test('buildPayoffQuote does not charge future installments when settling the reported principal on cutoff', () => {
  const outstandingPrincipal = 1753591.77;
  const quote = buildPayoffQuote({
    loan: {
      status: 'active',
      startDate: '2026-05-26T00:00:00.000Z',
      interestRate: 70,
    },
    schedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-06-26T00:00:00.000Z',
        remainingPrincipal: 0,
        remainingInterest: 0,
        status: 'paid',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-07-26T00:00:00.000Z',
        remainingPrincipal: 0,
        remainingInterest: 0,
        status: 'paid',
      },
      {
        installmentNumber: 3,
        dueDate: '2026-08-26T00:00:00.000Z',
        remainingPrincipal: outstandingPrincipal,
        remainingInterest: 102292.85,
        status: 'pending',
      },
    ],
    snapshot: {
      outstandingPrincipal,
      outstandingInterest: 102292.85,
      outstandingBalance: 1855884.62,
    },
    asOfDate: '2026-07-26',
  });

  assert.equal(quote.breakdown.futurePrincipal, outstandingPrincipal);
  assert.equal(quote.breakdown.accruedInterest, 0);
  assert.equal(quote.breakdown.overdueInterest, 0);
  assert.equal(quote.total, outstandingPrincipal);
});

test('buildPayoffQuote does not accrue daily interest for a customer current between installments', () => {
  const quote = buildPayoffQuote({
    loan: {
      status: 'active',
      startDate: '2026-06-10T00:00:00.000Z',
      interestRate: 60,
    },
    schedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-07-10T00:00:00.000Z',
        remainingPrincipal: 0,
        remainingInterest: 0,
        status: 'paid',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-08-10T00:00:00.000Z',
        remainingPrincipal: 1000000,
        remainingInterest: 50000,
        status: 'pending',
      },
    ],
    snapshot: {
      outstandingPrincipal: 1000000,
      outstandingBalance: 1050000,
    },
    asOfDate: '2026-07-13',
  });

  assert.equal(quote.breakdown.overduePrincipal, 0);
  assert.equal(quote.breakdown.overdueInterest, 0);
  assert.equal(quote.breakdown.lateFee, 0);
  assert.equal(quote.breakdown.accruedInterest, 0);
  assert.equal(quote.total, 1000000);
});

test('getCanonicalLoanView does not restore future interest after payoff on a due date', () => {
  const loan = {
    status: 'closed',
    closureReason: 'payoff',
    amount: 1000,
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-02-01T00:00:00.000Z',
        scheduledPayment: 500,
        principalComponent: 400,
        interestComponent: 100,
        paidPrincipal: 400,
        paidInterest: 100,
        paidTotal: 500,
        remainingPrincipal: 0,
        remainingInterest: 0,
        status: 'paid',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-03-01T00:00:00.000Z',
        scheduledPayment: 660,
        principalComponent: 600,
        interestComponent: 60,
        paidPrincipal: 600,
        paidInterest: 0,
        paidTotal: 600,
        remainingPrincipal: 0,
        remainingInterest: 0,
        status: 'paid',
      },
    ],
    financialSnapshot: {
      totalPrincipal: 1000,
      totalInterest: 100,
      totalPaidPrincipal: 1000,
      totalPaidInterest: 100,
      totalPaid: 1100,
      totalPayable: 1100,
      outstandingPrincipal: 0,
      outstandingInterest: 0,
      outstandingBalance: 0,
    },
  };

  const { snapshot } = getCanonicalLoanView(loan);

  assert.equal(snapshot.totalPaidPrincipal, 1000);
  assert.equal(snapshot.totalPaidInterest, 100);
  assert.equal(snapshot.totalPaid, 1100);
  assert.equal(snapshot.totalPayable, 1100);
  assert.equal(snapshot.outstandingBalance, 0);
});

test('buildPayoffQuote rejects zero-balance loans with an operator-facing message', () => {
  assert.throws(() => buildPayoffQuote({
    loan: {
      status: 'active',
      startDate: '2026-01-01T00:00:00.000Z',
      interestRate: 12,
    },
    schedule: [],
    snapshot: {
      outstandingPrincipal: 0,
      outstandingBalance: 5,
    },
    asOfDate: '2026-01-15',
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'El crédito no tiene saldo pendiente para pago total.');
    return true;
  });
});

test('buildPayoffQuote includes overdue installments and late fees in total payoff', () => {
  const quote = buildPayoffQuote({
    loan: {
      status: 'defaulted',
      startDate: '2026-01-01T00:00:00.000Z',
      interestRate: 12,
      annualLateFeeRate: 12,
      lateFeeMode: 'SIMPLE',
    },
    schedule: [
      { installmentNumber: 1, dueDate: '2026-02-01T00:00:00.000Z', remainingPrincipal: 300000, remainingInterest: 30000 },
      { installmentNumber: 2, dueDate: '2026-04-01T00:00:00.000Z', remainingPrincipal: 200000, remainingInterest: 10000 },
    ],
    snapshot: {
      outstandingPrincipal: 500000,
      outstandingBalance: 540000,
    },
    asOfDate: '2026-03-15',
  });

  assert.equal(quote.breakdown.lateFee, 414.25);
  assert.equal(quote.breakdown.overduePrincipal, 300000);
  assert.equal(quote.breakdown.overdueInterest, 30000);
  assert.equal(quote.breakdown.accruedInterest, 2800);
  assert.equal(quote.breakdown.futurePrincipal, 200000);
  assert.equal(quote.total, 533214.25);
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

test('evaluatePayoffEligibility allows overdue installments while capital eligibility still denies them', () => {
  const input = {
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
  };

  assert.deepEqual(evaluatePayoffEligibility(input), {
    allowed: true,
    denialReasons: [],
  });
  assert.deepEqual(evaluateCapitalPaymentEligibility(input).denialReasons.map((reason) => reason.code), [
    'FIRST_INSTALLMENT_PAYMENT_REQUIRED',
    'OVERDUE_UNPAID_INSTALLMENTS',
  ]);
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

test('evaluateCapitalPaymentEligibility requires the installment due on the capital-payment date', () => {
  const eligibility = evaluateCapitalPaymentEligibility({
    loan: {
      status: 'active',
      principalOutstanding: 600,
    },
    schedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-06-17T00:00:00.000Z',
        remainingPrincipal: 0,
        remainingInterest: 0,
        paidTotal: 320,
        status: 'paid',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-07-17T00:00:00.000Z',
        remainingPrincipal: 300,
        remainingInterest: 15,
        paidTotal: 0,
        status: 'pending',
      },
    ],
    snapshot: {
      outstandingPrincipal: 600,
      outstandingBalance: 615,
    },
    asOfDate: new Date('2026-07-17T18:30:00.000Z'),
  });

  assert.deepEqual(eligibility, {
    allowed: false,
    denialReasons: [{
      code: 'CURRENT_INSTALLMENT_PAYMENT_REQUIRED',
      message: 'Primero paga completamente la cuota vigente #2 antes de abonar a capital',
      installmentNumber: 2,
    }],
  });
});

test('evaluateCapitalPaymentEligibility requires the new cycle installment from the day after the previous cutoff', () => {
  const eligibility = evaluateCapitalPaymentEligibility({
    loan: {
      status: 'active',
      principalOutstanding: 600,
    },
    schedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-07-24T00:00:00.000Z',
        remainingPrincipal: 0,
        remainingInterest: 0,
        paidTotal: 320,
        status: 'paid',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-08-24T00:00:00.000Z',
        remainingPrincipal: 300,
        remainingInterest: 15,
        paidTotal: 0,
        status: 'pending',
      },
    ],
    snapshot: {
      outstandingPrincipal: 600,
      outstandingBalance: 615,
    },
    asOfDate: new Date('2026-07-25T00:00:00.000Z'),
  });

  assert.deepEqual(eligibility, {
    allowed: false,
    denialReasons: [{
      code: 'CURRENT_INSTALLMENT_PAYMENT_REQUIRED',
      message: 'Primero paga completamente la cuota vigente #2 antes de abonar a capital',
      installmentNumber: 2,
    }],
  });
});

test('evaluateCapitalPaymentEligibility allows capital payment on the cutoff after that installment is paid', () => {
  const eligibility = evaluateCapitalPaymentEligibility({
    loan: {
      status: 'active',
      principalOutstanding: 600,
    },
    schedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-07-24T00:00:00.000Z',
        remainingPrincipal: 0,
        remainingInterest: 0,
        paidTotal: 320,
        status: 'paid',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-08-24T00:00:00.000Z',
        remainingPrincipal: 300,
        remainingInterest: 15,
        paidTotal: 0,
        status: 'pending',
      },
    ],
    snapshot: {
      outstandingPrincipal: 600,
      outstandingBalance: 615,
    },
    asOfDate: new Date('2026-07-24T18:30:00.000Z'),
  });

  assert.deepEqual(eligibility, {
    allowed: true,
    denialReasons: [],
  });
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
