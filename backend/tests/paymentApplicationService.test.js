const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const models = require('@/models');
const { summarizeSchedule, buildAmortizationSchedule, roundCurrency } = require('@/modules/credits/application/creditFormulaHelpers');
const { createLoanViewService } = require('@/modules/credits/application/loanFinancials');
const { createGetInstallmentQuote } = require('@/modules/credits/application/useCases');
const moduleOwnedPaymentApplicationService = require('@/modules/credits/application/paymentApplicationService');
const { createPaymentApplicationService } = moduleOwnedPaymentApplicationService;
const { BusinessRuleViolationError, ValidationError } = require('@/utils/errorHandler');

afterEach(() => {
  mock.restoreAll();
});

const loanViewService = createLoanViewService();

beforeEach(() => {
  mock.method(models.IdempotencyKey, 'findOne', async () => null);
  mock.method(models.IdempotencyKey, 'create', async () => ({ id: 1 }));
  mock.method(models.IdempotencyKey, 'update', async () => [1]);
});

test('processPayment rejects malformed operational payment dates before mutation', async () => {
  const service = moduleOwnedPaymentApplicationService.createPaymentApplicationService({ loanViewService });

  await assert.rejects(() => service.processPayment({
    loanId: 1,
    paymentAmount: 100,
    paymentDate: '60620-02-02',
    actorId: 1,
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /fecha de pago.*operativa válida/i);
    return true;
  });
});

test('processPayment rejects partially numeric payment amounts before mutation', async () => {
  const service = moduleOwnedPaymentApplicationService.createPaymentApplicationService({ loanViewService });

  await assert.rejects(() => service.processPayment({
    loanId: 1,
    paymentAmount: '250abc',
    paymentDate: '2026-05-15T00:00:00.000Z',
    actorId: 1,
  }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.message, 'El monto del pago debe ser un número válido mayor que 0');
    return true;
  });
});

test('applyPayment allocates payoff amounts and closes a recovered loan', async () => {
  const schedule = buildAmortizationSchedule({
    amount: 1000,
    interestRate: 12,
    termMonths: 2,
    startDate: '2026-01-15T00:00:00.000Z',
  });
  const totalPayable = summarizeSchedule(schedule).totalPayable;
  let savedLoan;
  let savedPayment;

  const loan = {
    id: 10,
    status: 'approved',
    recoveryStatus: 'pending',
    amount: 1000,
    interestRate: 12,
    termMonths: 2,
    emiSchedule: schedule,
    async save() {
      savedLoan = this;
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (optionsOrHandler, maybeHandler) => {
    const handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler;
    return handler({ id: '' });
  });
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 501, ...payload };
  });

  const result = await createPaymentApplicationService({ loanViewService }).applyPayment({
    loanId: 10,
    amount: totalPayable + 5,
    paymentDate: '2026-02-15T00:00:00.000Z',
    actorId: 71,
  });

  assert.equal(result.loan.status, 'closed');
  assert.equal(result.loan.recoveryStatus, 'recovered');
  assert.equal(result.allocation.remainingBalance, 0);
  assert.equal(result.allocation.overpaymentAmount, 5);
  assert.equal(result.allocation.allocations.length, 2);
  assert.equal(savedLoan.financialSnapshot.outstandingBalance, 0);
  assert.equal(savedPayment.remainingBalanceAfterPayment, 0);
  assert.equal(savedPayment.overpaymentAmount, 5);
  assert.equal(savedPayment.createdByUserId, 71);
  assert.equal(savedPayment.principalApplied + savedPayment.interestApplied, totalPayable);
});

test('applyPayment prioritizes overdue debt before current installments and sends excess only to principal', async () => {
  let savedLoan;
  let savedPayment;

  const loan = {
    id: 22,
    status: 'active',
    recoveryStatus: 'pending',
    amount: 1000,
    interestRate: 12,
    termMonths: 3,
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
      {
        installmentNumber: 3,
        dueDate: '2026-05-01T00:00:00.000Z',
        remainingPrincipal: 130,
        remainingInterest: 8,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
    ],
    async save() {
      savedLoan = this;
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (optionsOrHandler, maybeHandler) => {
    const handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler;
    return handler({ id: '' });
  });
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 777, ...payload };
  });

  const result = await createPaymentApplicationService({
    loanViewService,
    clock: () => new Date('2026-03-15T00:00:00.000Z'),
  }).applyPayment({
    loanId: 22,
    amount: 170,
    paymentDate: '2026-03-15T00:00:00.000Z',
  });

  assert.equal(result.allocation.interestApplied, 32);
  assert.equal(result.allocation.principalApplied, 138);
  assert.equal(result.allocation.additionalPrincipalApplied, 0);
  assert.equal(result.allocation.overpaymentAmount, 0);
  assert.equal(result.allocation.unappliedOverpaymentAmount, 0);
  assert.deepEqual(result.allocation.allocations, [
    {
      installmentNumber: 1,
      interestApplied: 20,
      principalApplied: 100,
      lateFeeApplied: 0,
      remainingInstallmentBalance: 0,
      status: 'paid',
      bucket: 'overdue',
    },
    {
      installmentNumber: 2,
      interestApplied: 12,
      principalApplied: 38,
      lateFeeApplied: 0,
      remainingInstallmentBalance: 82,
      status: 'partial',
      bucket: 'scheduled',
    },
  ]);
  assert.equal(savedPayment.paymentMetadata.additionalPrincipalApplied, 0);
  assert.equal(savedPayment.paymentMetadata.unappliedOverpaymentAmount, 0);
  assert.equal(savedLoan.emiSchedule[0].status, 'paid');
  assert.equal(savedLoan.emiSchedule[1].remainingInterest, 0);
  assert.equal(savedLoan.emiSchedule[1].remainingPrincipal, 82);
  assert.equal(savedLoan.emiSchedule[2].remainingPrincipal, 130);
  assert.equal(savedLoan.financialSnapshot.outstandingBalance, 220);
});

test('applyPartialPayment allocates the submitted amount only once across open installments', async () => {
  let savedLoan;
  let savedPayment;

  const loan = {
    id: 2201,
    status: 'active',
    recoveryStatus: 'pending',
    amount: 1000,
    interestRate: 12,
    termMonths: 2,
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-06-15T00:00:00.000Z',
        remainingPrincipal: 100,
        remainingInterest: 20,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        scheduledPayment: 120,
        status: 'pending',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-07-15T00:00:00.000Z',
        remainingPrincipal: 120,
        remainingInterest: 12,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        scheduledPayment: 132,
        status: 'pending',
      },
    ],
    async save() {
      savedLoan = this;
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 778, ...payload };
  });

  const result = await createPaymentApplicationService({ loanViewService }).applyPartialPayment({
    loanId: 2201,
    amount: 50,
    paymentDate: '2026-05-17T00:00:00.000Z',
    paymentMethod: 'cash',
    actorId: 73,
  });

  assert.equal(result.allocation.interestApplied, 20);
  assert.equal(result.allocation.principalApplied, 30);
  assert.equal(savedPayment.amount, 50);
  assert.equal(savedPayment.interestApplied + savedPayment.principalApplied, 50);
  assert.equal(savedPayment.createdByUserId, 73);
  assert.equal(savedLoan.emiSchedule[0].paidTotal, 50);
  assert.equal(savedLoan.emiSchedule[1].paidTotal, 0);
});

test('applyPayment charges the same late fee quoted for the same operational day when dueDate keeps a timestamp', async () => {
  let savedPayment;

  const loan = {
    id: 2250,
    status: 'active',
    recoveryStatus: 'pending',
    amount: 1000,
    interestRate: 12,
    annualLateFeeRate: 3650,
    lateFeeMode: 'SIMPLE',
    termMonths: 1,
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-03-15T15:00:00.000Z',
        remainingPrincipal: 100,
        remainingInterest: 20,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        scheduledPayment: 120,
        status: 'pending',
      },
    ],
    async save() {
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 779, ...payload };
  });

  const getInstallmentQuote = createGetInstallmentQuote({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return loan;
      },
    },
    loanViewService,
  });

  const quote = await getInstallmentQuote({
    actor: { id: 1, role: 'admin' },
    loanId: 2250,
    installmentNumber: 1,
    asOfDate: '2026-03-16',
  });

  assert.equal(quote.daysOverdue, 1);
  assert.equal(quote.lateFeeDue, 2);

  const result = await createPaymentApplicationService({ loanViewService }).applyPayment({
    loanId: 2250,
    amount: 122,
    paymentDate: '2026-03-16',
    paymentMethod: 'cash',
    actorId: 72,
  });

  assert.equal(result.allocation.penaltyApplied, 2);
  assert.equal(savedPayment.penaltyApplied, 2);
});

test('applyCapitalPayment reduce_term rebuilds the open schedule without marking future installments as paid', async () => {
  let savedLoan;
  let savedPayment;

  const schedule = buildAmortizationSchedule({
    amount: 1000,
    interestRate: 12,
    termMonths: 4,
    startDate: '2026-05-01T00:00:00.000Z',
    calculationMethod: 'FRENCH',
  });
  schedule[0] = {
    ...schedule[0],
    paidPrincipal: schedule[0].principalComponent,
    paidInterest: schedule[0].interestComponent,
    paidTotal: schedule[0].scheduledPayment,
    remainingPrincipal: 0,
    remainingInterest: 0,
    status: 'paid',
  };
  const startingSnapshot = summarizeSchedule(schedule);

  const loan = {
    id: 33,
    status: 'active',
    recoveryStatus: 'pending',
    amount: 1000,
    interestRate: 12,
    termMonths: 4,
    calculationMethod: 'FRENCH',
    installmentAmount: schedule[1].scheduledPayment,
    principalOutstanding: startingSnapshot.outstandingPrincipal,
    financialSnapshot: startingSnapshot,
    emiSchedule: schedule,
    async save() {
      savedLoan = this;
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 888, ...payload };
  });

  const result = await createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 33,
    amount: 300,
    paymentDate: '2026-05-15T00:00:00.000Z',
    paymentMethod: 'cash',
    strategy: 'reduce_term',
  });

  const futureRows = savedLoan.emiSchedule.slice(1);
  assert.equal(result.allocation.principalApplied, 300);
  assert.equal(result.allocation.remainingPrincipalOutstanding, roundCurrency(startingSnapshot.outstandingPrincipal - 300));
  assert.equal(result.allocation.strategyApplied, 'reduce_term');
  assert.ok(result.allocation.newRemainingInstallments < result.allocation.previousRemainingInstallments);
  assert.ok(futureRows.every((row) => row.status === 'pending'));
  assert.ok(futureRows.every((row) => row.paidPrincipal === 0 && row.paidInterest === 0 && row.paidTotal === 0));
  assert.equal(savedLoan.financialSnapshot.totalPaidPrincipal, roundCurrency(schedule[0].principalComponent + 300));
  assert.equal(savedPayment.remainingBalanceAfterPayment, savedLoan.financialSnapshot.outstandingBalance);
  assert.equal(savedPayment.paymentMethod, 'cash');
  assert.equal(savedPayment.paymentMetadata.strategyApplied, 'reduce_term');
  assert.equal(savedPayment.paymentMetadata.before.outstandingPrincipal, startingSnapshot.outstandingPrincipal);
  assert.equal(savedPayment.paymentMetadata.after.outstandingPrincipal, savedLoan.financialSnapshot.outstandingPrincipal);
});

test('applyCapitalPayment reduce_term keeps the installment fixed, shortens the term, and preserves total principal', async () => {
  // Regression for the operator report: a capital prepayment with "reducción de
  // tiempo" must keep the scheduled installment unchanged while shrinking the term,
  // and the loan must keep its original principal in the financial snapshot so the
  // calendar reconciles (capital amortizado + capital vivo == original amount).
  let savedLoan;
  const schedule = buildAmortizationSchedule({
    amount: 2000000,
    interestRate: 60,
    termMonths: 12,
    startDate: '2026-06-10T00:00:00.000Z',
    calculationMethod: 'FRENCH',
  });
  const originalInstallment = schedule[0].scheduledPayment;
  schedule[0] = {
    ...schedule[0],
    paidPrincipal: schedule[0].principalComponent,
    paidInterest: schedule[0].interestComponent,
    paidTotal: schedule[0].scheduledPayment,
    remainingPrincipal: 0,
    remainingInterest: 0,
    status: 'paid',
  };
  const startingSnapshot = summarizeSchedule(schedule);
  const loan = {
    id: 3301,
    status: 'active',
    recoveryStatus: 'pending',
    amount: 2000000,
    interestRate: 60,
    termMonths: 12,
    calculationMethod: 'FRENCH',
    installmentAmount: originalInstallment,
    principalOutstanding: startingSnapshot.outstandingPrincipal,
    financialSnapshot: startingSnapshot,
    emiSchedule: schedule,
    async save() { savedLoan = this; return this; },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => ({ id: 890, ...payload }));

  const result = await createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 3301,
    amount: 500000,
    paymentDate: '2026-07-10T00:00:00.000Z',
    strategy: 'reduce_term',
  });

  const view = loanViewService.getCanonicalLoanView(savedLoan);
  const pendingRows = view.schedule.filter((row) => row.status !== 'paid');

  // Term shrinks
  assert.ok(result.allocation.newRemainingInstallments < result.allocation.previousRemainingInstallments);
  // Installment stays fixed for every pending row except the smaller final one
  pendingRows.slice(0, -1).forEach((row) => {
    assert.equal(row.scheduledPayment, originalInstallment);
  });
  assert.ok(pendingRows[pendingRows.length - 1].scheduledPayment <= originalInstallment + 0.01);
  // Schedule closes exactly to zero
  assert.equal(view.schedule[view.schedule.length - 1].remainingBalance, 0);
  // Original principal is preserved so the calendar reconciles
  assert.equal(view.snapshot.totalPrincipal, 2000000);
  assert.equal(savedLoan.amount, 2000000);
});

test('applyCapitalPayment stores the operator who registered the capital movement', async () => {
  let savedPayment;
  const schedule = buildAmortizationSchedule({
    amount: 1000,
    interestRate: 12,
    termMonths: 4,
    startDate: '2026-05-01T00:00:00.000Z',
    calculationMethod: 'FRENCH',
  });
  schedule[0] = {
    ...schedule[0],
    paidPrincipal: schedule[0].principalComponent,
    paidInterest: schedule[0].interestComponent,
    paidTotal: schedule[0].scheduledPayment,
    remainingPrincipal: 0,
    remainingInterest: 0,
    status: 'paid',
  };
  const startingSnapshot = summarizeSchedule(schedule);
  const loan = {
    id: 3401,
    status: 'active',
    recoveryStatus: 'pending',
    amount: 1000,
    interestRate: 12,
    termMonths: 4,
    calculationMethod: 'FRENCH',
    installmentAmount: schedule[1].scheduledPayment,
    principalOutstanding: startingSnapshot.outstandingPrincipal,
    financialSnapshot: startingSnapshot,
    emiSchedule: schedule,
    async save() {
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 891, ...payload };
  });

  await createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 3401,
    amount: 250,
    paymentDate: '2026-05-15T00:00:00.000Z',
    actorId: 72,
  });

  assert.equal(savedPayment.createdByUserId, 72);
});

test('loan view snapshot keeps completed capital payments in collected totals after later payments', async () => {
  let savedLoan;
  const schedule = buildAmortizationSchedule({
    amount: 1000,
    interestRate: 12,
    termMonths: 4,
    startDate: '2026-05-01T00:00:00.000Z',
    calculationMethod: 'FRENCH',
  });
  schedule[0] = {
    ...schedule[0],
    paidPrincipal: schedule[0].principalComponent,
    paidInterest: schedule[0].interestComponent,
    paidTotal: schedule[0].scheduledPayment,
    remainingPrincipal: 0,
    remainingInterest: 0,
    status: 'paid',
  };
  const startingSnapshot = summarizeSchedule(schedule);

  const loan = {
    id: 3301,
    status: 'active',
    recoveryStatus: 'pending',
    amount: 1000,
    interestRate: 12,
    termMonths: 4,
    calculationMethod: 'FRENCH',
    installmentAmount: schedule[1].scheduledPayment,
    principalOutstanding: startingSnapshot.outstandingPrincipal,
    financialSnapshot: startingSnapshot,
    emiSchedule: schedule,
    async save() {
      savedLoan = this;
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => ({ id: 890, ...payload }));

  const service = createPaymentApplicationService({ loanViewService });

  await service.applyCapitalPayment({
    loanId: 3301,
    amount: 300,
    paymentDate: '2026-05-15T00:00:00.000Z',
    strategy: 'reduce_term',
  });

  const { snapshot } = loanViewService.getCanonicalLoanView(savedLoan);
  assert.equal(snapshot.capitalAdjustmentsApplied, 300);
  assert.equal(snapshot.totalPrincipal, 1000);
  assert.equal(snapshot.totalPaidPrincipal, roundCurrency(schedule[0].principalComponent + 300));
  assert.equal(snapshot.totalPaid, roundCurrency(schedule[0].scheduledPayment + 300));

  const staleSnapshotLoan = {
    ...savedLoan,
    financialSnapshot: summarizeSchedule(savedLoan.emiSchedule),
  };
  const { snapshot: inferredSnapshot } = loanViewService.getCanonicalLoanView(staleSnapshotLoan);
  assert.equal(inferredSnapshot.capitalAdjustmentsApplied, 300);
  assert.equal(inferredSnapshot.totalPaid, roundCurrency(schedule[0].scheduledPayment + 300));

  const nextOpenInstallment = savedLoan.emiSchedule.find((row) => row.status === 'pending');
  await service.applyPayment({
    loanId: 3301,
    amount: nextOpenInstallment.scheduledPayment,
    paymentDate: '2026-06-15T00:00:00.000Z',
    paymentMethod: 'cash',
  });

  const { snapshot: snapshotAfterPayment } = loanViewService.getCanonicalLoanView(savedLoan);
  assert.equal(snapshotAfterPayment.capitalAdjustmentsApplied, 300);
  assert.equal(snapshotAfterPayment.totalPaid, roundCurrency(schedule[0].scheduledPayment + nextOpenInstallment.scheduledPayment + 300));

  const nextCancellableInstallment = savedLoan.emiSchedule.find((row) => row.status === 'pending');
  await service.annulInstallment({
    loanId: 3301,
    actor: { id: 1, role: 'admin' },
    installmentNumber: nextCancellableInstallment.installmentNumber,
    paymentDate: '2026-07-15T00:00:00.000Z',
  });

  const { snapshot: snapshotAfterAnnulment } = loanViewService.getCanonicalLoanView(savedLoan);
  assert.equal(snapshotAfterAnnulment.capitalAdjustmentsApplied, 300);
  assert.equal(
    snapshotAfterAnnulment.totalPaid,
    roundCurrency(schedule[0].scheduledPayment + nextOpenInstallment.scheduledPayment + 300),
  );
  assert.ok(snapshotAfterAnnulment.totalPrincipal <= loan.amount);
});

test('applyCapitalPayment reduce_payment rebuilds the remaining principal with the selected new term', async () => {
  let savedLoan;
  const schedule = buildAmortizationSchedule({
    amount: 1000,
    interestRate: 12,
    termMonths: 4,
    startDate: '2026-05-01T00:00:00.000Z',
    calculationMethod: 'FRENCH',
  });
  schedule[0] = {
    ...schedule[0],
    paidPrincipal: schedule[0].principalComponent,
    paidInterest: schedule[0].interestComponent,
    paidTotal: schedule[0].scheduledPayment,
    remainingPrincipal: 0,
    remainingInterest: 0,
    status: 'paid',
  };
  const startingSnapshot = summarizeSchedule(schedule);
  const loan = {
    id: 331,
    status: 'active',
    recoveryStatus: 'pending',
    amount: 1000,
    interestRate: 12,
    termMonths: 4,
    calculationMethod: 'FRENCH',
    installmentAmount: schedule[1].scheduledPayment,
    principalOutstanding: startingSnapshot.outstandingPrincipal,
    financialSnapshot: startingSnapshot,
    emiSchedule: schedule,
    async save() {
      savedLoan = this;
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => ({ id: 889, ...payload }));

  const result = await createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 331,
    amount: 300,
    paymentDate: '2026-05-15T00:00:00.000Z',
    strategy: 'reduce_payment',
    newTermMonths: 6,
  });

  const futureRows = savedLoan.emiSchedule.slice(1);
  const expectedSchedule = buildAmortizationSchedule({
    amount: roundCurrency(startingSnapshot.outstandingPrincipal - 300),
    interestRate: loan.interestRate,
    termMonths: 6,
    startDate: '2026-06-01T00:00:00.000Z',
    calculationMethod: loan.calculationMethod,
  });
  assert.equal(result.allocation.strategyApplied, 'reduce_payment');
  assert.equal(result.allocation.newTermMonths, 6);
  assert.equal(result.allocation.newRemainingInstallments, 6);
  assert.equal(futureRows.length, 6);
  assert.equal(result.allocation.newInstallmentAmount, expectedSchedule[0].scheduledPayment);
  assert.equal(futureRows[0].interestComponent, expectedSchedule[0].interestComponent);
  assert.equal(futureRows[0].principalComponent, expectedSchedule[0].principalComponent);
  assert.ok(result.allocation.newInstallmentAmount < result.allocation.previousInstallmentAmount);
  assert.ok(futureRows.every((row) => row.status === 'pending'));
  assert.ok(futureRows.every((row) => row.paidTotal === 0));
});

test('applyCapitalPayment reduce_payment requires an explicit new term', async () => {
  const schedule = buildAmortizationSchedule({
    amount: 1000,
    interestRate: 12,
    termMonths: 4,
    startDate: '2026-05-01T00:00:00.000Z',
    calculationMethod: 'FRENCH',
  });
  schedule[0] = {
    ...schedule[0],
    paidPrincipal: schedule[0].principalComponent,
    paidInterest: schedule[0].interestComponent,
    paidTotal: schedule[0].scheduledPayment,
    remainingPrincipal: 0,
    remainingInterest: 0,
    status: 'paid',
  };
  const startingSnapshot = summarizeSchedule(schedule);
  const loan = {
    id: 3312,
    status: 'active',
    recoveryStatus: 'pending',
    amount: 1000,
    interestRate: 12,
    termMonths: 4,
    calculationMethod: 'FRENCH',
    installmentAmount: schedule[1].scheduledPayment,
    principalOutstanding: startingSnapshot.outstandingPrincipal,
    financialSnapshot: startingSnapshot,
    emiSchedule: schedule,
    async save() {
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 3312,
    amount: 300,
    paymentDate: '2026-05-15T00:00:00.000Z',
    strategy: 'reduce_payment',
  }), /Para reducir la cuota debes indicar un plazo nuevo entre 1 y 360 meses\./);
});

test('applyCapitalPayment rejects amounts greater than the live principal before mutation', async () => {
  const loan = {
    id: 3314,
    status: 'active',
    recoveryStatus: 'pending',
    principalOutstanding: 300,
    financialSnapshot: {
      outstandingPrincipal: 300,
      outstandingInterest: 30,
      outstandingBalance: 330,
    },
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-04-01T00:00:00.000Z',
        remainingPrincipal: 0,
        remainingInterest: 0,
        paidPrincipal: 100,
        paidInterest: 10,
        paidTotal: 110,
        status: 'paid',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-06-01T00:00:00.000Z',
        remainingPrincipal: 200,
        remainingInterest: 20,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
      {
        installmentNumber: 3,
        dueDate: '2026-07-01T00:00:00.000Z',
        remainingPrincipal: 100,
        remainingInterest: 10,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
    ],
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async () => {
    throw new Error('Payment.create should not be called');
  });

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 3314,
    amount: 350,
    paymentDate: '2026-05-15T00:00:00.000Z',
    strategy: 'reduce_term',
  }), (error) => {
    assert.ok(error instanceof BusinessRuleViolationError);
    assert.equal(error.code, 'CAPITAL_PAYMENT_NOT_ALLOWED');
    assert.deepEqual(error.denialReasons, [{
      code: 'CAPITAL_PAYMENT_EXCEEDS_PRINCIPAL',
      message: 'El abono a capital no puede exceder el capital vivo del crédito',
      outstandingPrincipal: 300,
      requestedAmount: 350,
    }]);
    return true;
  });
});

test('applyCapitalPayment reduce_payment rejects exponent-like new term strings', async () => {
  const schedule = buildAmortizationSchedule({
    amount: 1000,
    interestRate: 12,
    termMonths: 4,
    startDate: '2026-05-01T00:00:00.000Z',
    calculationMethod: 'FRENCH',
  });
  schedule[0] = {
    ...schedule[0],
    paidPrincipal: schedule[0].principalComponent,
    paidInterest: schedule[0].interestComponent,
    paidTotal: schedule[0].scheduledPayment,
    remainingPrincipal: 0,
    remainingInterest: 0,
    status: 'paid',
  };
  const startingSnapshot = summarizeSchedule(schedule);
  const loan = {
    id: 3313,
    status: 'active',
    recoveryStatus: 'pending',
    amount: 1000,
    interestRate: 12,
    termMonths: 4,
    calculationMethod: 'FRENCH',
    installmentAmount: schedule[1].scheduledPayment,
    principalOutstanding: startingSnapshot.outstandingPrincipal,
    financialSnapshot: startingSnapshot,
    emiSchedule: schedule,
    async save() {
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => ({ id: 891, ...payload }));

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 3313,
    amount: 300,
    paymentDate: '2026-05-15T00:00:00.000Z',
    strategy: 'reduce_payment',
    newTermMonths: '1e2',
  }), /Para reducir la cuota debes indicar un plazo nuevo entre 1 y 360 meses\./);
});

test('applyCapitalPayment rejects loans before the first installment is paid', async () => {
  const loan = {
    id: 332,
    status: 'active',
    recoveryStatus: 'pending',
    principalOutstanding: 1000,
    financialSnapshot: {
      outstandingPrincipal: 1000,
      outstandingInterest: 40,
      outstandingBalance: 1040,
    },
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-06-01T00:00:00.000Z',
        remainingPrincipal: 250,
        remainingInterest: 10,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-07-01T00:00:00.000Z',
        remainingPrincipal: 250,
        remainingInterest: 10,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
    ],
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async () => {
    throw new Error('Payment.create should not be called');
  });

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 332,
    amount: 100,
    paymentDate: '2026-05-15T00:00:00.000Z',
  }), (error) => {
    assert.ok(error instanceof BusinessRuleViolationError);
    assert.equal(error.code, 'CAPITAL_PAYMENT_NOT_ALLOWED');
    assert.deepEqual(error.denialReasons, [{
      code: 'FIRST_INSTALLMENT_PAYMENT_REQUIRED',
      message: 'Debe existir al menos la primera cuota pagada antes de abonar a capital',
    }]);
    return true;
  });
});

test('applyCapitalPayment rejects loans with overdue unpaid installments and exposes denial reasons', async () => {
  const loan = {
    id: 34,
    status: 'active',
    recoveryStatus: 'pending',
    principalOutstanding: 300,
    financialSnapshot: {
      outstandingPrincipal: 300,
      outstandingInterest: 30,
      outstandingBalance: 330,
    },
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-03-01T00:00:00.000Z',
        remainingPrincipal: 0,
        remainingInterest: 0,
        paidPrincipal: 100,
        paidInterest: 10,
        paidTotal: 110,
        status: 'paid',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-03-10T00:00:00.000Z',
        remainingPrincipal: 200,
        remainingInterest: 20,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
    ],
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async () => {
    throw new Error('Payment.create should not be called');
  });

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 34,
    amount: 50,
    paymentDate: '2026-03-15T00:00:00.000Z',
  }), (error) => {
    assert.ok(error instanceof BusinessRuleViolationError);
    assert.equal(error.code, 'CAPITAL_PAYMENT_NOT_ALLOWED');
    assert.deepEqual(error.denialReasons, [{
      code: 'OVERDUE_UNPAID_INSTALLMENTS',
      message: 'El crédito tiene cuotas vencidas pendientes',
    }]);
    return true;
  });
});

test('applyCapitalPayment rejects loans with a partial operative installment before recalculation', async () => {
  const loan = {
    id: 334,
    status: 'active',
    recoveryStatus: 'pending',
    principalOutstanding: 300,
    financialSnapshot: {
      outstandingPrincipal: 300,
      outstandingInterest: 30,
      outstandingBalance: 330,
    },
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-04-01T00:00:00.000Z',
        remainingPrincipal: 0,
        remainingInterest: 0,
        paidPrincipal: 100,
        paidInterest: 10,
        paidTotal: 110,
        status: 'paid',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-06-01T00:00:00.000Z',
        remainingPrincipal: 200,
        remainingInterest: 20,
        paidPrincipal: 10,
        paidInterest: 0,
        paidTotal: 10,
        status: 'partial',
      },
    ],
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async () => {
    throw new Error('Payment.create should not be called');
  });

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 334,
    amount: 50,
    paymentDate: '2026-04-15T00:00:00.000Z',
  }), (error) => {
    assert.ok(error instanceof BusinessRuleViolationError);
    assert.equal(error.code, 'CAPITAL_PAYMENT_NOT_ALLOWED');
    assert.equal(error.denialReasons[0].code, 'PARTIAL_INSTALLMENT_PENDING');
    return true;
  });
});

test('applyCapitalPayment rejects loans with a financial block and exposes denial reasons', async () => {
  const loan = {
    id: 35,
    status: 'active',
    recoveryStatus: 'pending',
    principalOutstanding: 300,
    financialBlock: {
      isBlocked: true,
      code: 'MANUAL_REVIEW',
      message: 'Manual review block active',
      reason: 'collections_hold',
    },
    financialSnapshot: {
      outstandingPrincipal: 300,
      outstandingInterest: 30,
      outstandingBalance: 330,
    },
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-04-01T00:00:00.000Z',
        remainingPrincipal: 0,
        remainingInterest: 0,
        paidPrincipal: 100,
        paidInterest: 10,
        paidTotal: 110,
        status: 'paid',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-05-01T00:00:00.000Z',
        remainingPrincipal: 200,
        remainingInterest: 20,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
    ],
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 35,
    amount: 50,
    paymentDate: '2026-03-15T00:00:00.000Z',
  }), (error) => {
    assert.ok(error instanceof BusinessRuleViolationError);
    assert.equal(error.code, 'CAPITAL_PAYMENT_NOT_ALLOWED');
    assert.deepEqual(error.denialReasons, [{
      code: 'FINANCIAL_BLOCK',
      message: 'Manual review block active',
      blockCode: 'MANUAL_REVIEW',
      blockReason: 'collections_hold',
    }]);
    return true;
  });
});

test('applyCapitalPayment rejects loans with no outstanding balance and exposes denial reasons', async () => {
  const loan = {
    id: 36,
    status: 'active',
    recoveryStatus: 'pending',
    principalOutstanding: 0,
    financialSnapshot: {
      outstandingPrincipal: 0,
      outstandingInterest: 0,
      outstandingBalance: 0,
    },
    emiSchedule: [],
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 36,
    amount: 50,
    paymentDate: '2026-03-15T00:00:00.000Z',
  }), (error) => {
    assert.ok(error instanceof BusinessRuleViolationError);
    assert.equal(error.code, 'CAPITAL_PAYMENT_NOT_ALLOWED');
    assert.deepEqual(error.denialReasons, [{
      code: 'NO_OUTSTANDING_BALANCE',
      message: 'El crédito no tiene saldo pendiente para abono a capital',
    }]);
    return true;
  });
});

test('applyPayment rejects invalid amounts before persistence', async () => {
  const loan = {
    id: 10,
    status: 'approved',
    recoveryStatus: 'pending',
    amount: 1000,
    interestRate: 12,
    termMonths: 2,
    emiSchedule: [],
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async () => {
    throw new Error('Payment.create should not be called');
  });

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyPayment({
    loanId: 10,
    amount: 0,
  }), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.equal(error.message, 'El monto del pago debe ser mayor que 0.');
    return true;
  });
});

test('applyPayment rejects malformed payment method keys before persistence', async () => {
  const service = createPaymentApplicationService({ loanViewService });

  await assert.rejects(() => service.applyPayment({
    loanId: 10,
    amount: 100,
    paymentDate: '2026-05-15T00:00:00.000Z',
    paymentMethod: 'tarjeta credito',
  }), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.equal(error.message, 'Selecciona un método de pago configurado.');
    return true;
  });
});

test('applyPartialPayment rejects loans that are not payable with an operator message', async () => {
  const loan = {
    id: 12,
    status: 'closed',
    recoveryStatus: 'recovered',
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async () => {
    throw new Error('Payment.create should not be called');
  });

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyPartialPayment({
    loanId: 12,
    amount: 100,
    paymentDate: '2026-05-15T00:00:00.000Z',
  }), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.equal(error.message, 'Solo se pueden registrar pagos en créditos pendientes, aprobados, activos, vencidos o en incumplimiento.');
    return true;
  });
});

test('applyPayment rejects conflicting idempotency payment requests with an operator message', async () => {
  mock.restoreAll();
  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.IdempotencyKey, 'findOne', async () => ({ requestHash: 'different-request' }));

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyPayment({
    loanId: 12,
    amount: 100,
    paymentDate: '2026-05-15T00:00:00.000Z',
    idempotencyKey: 'payment-conflict-key',
  }), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.equal(error.message, 'Esta operación de pago ya fue enviada con otros datos. Revisa el resultado antes de intentar nuevamente.');
    return true;
  });
});

test('applyPayment rejects pending idempotency payment requests with an operator message', async () => {
  mock.restoreAll();
  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.IdempotencyKey, 'findOne', async () => ({ status: 'pending' }));

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyPayment({
    loanId: 12,
    amount: 100,
    paymentDate: '2026-05-15T00:00:00.000Z',
    idempotencyKey: 'payment-pending-key',
  }), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.equal(error.message, 'Esta operación de pago ya se está procesando. Espera el resultado antes de intentar nuevamente.');
    return true;
  });
});

test('applyPayment activates pending loans with a real schedule and stores payment method', async () => {
  const schedule = buildAmortizationSchedule({
    amount: 1000,
    interestRate: 12,
    termMonths: 2,
    startDate: '2026-01-15T00:00:00.000Z',
  });
  let savedLoan;
  let savedPayment;

  const loan = {
    id: 10,
    status: 'pending',
    recoveryStatus: null,
    amount: 1000,
    interestRate: 12,
    termMonths: 2,
    emiSchedule: schedule,
    async save() {
      savedLoan = this;
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 710, ...payload };
  });

  const result = await createPaymentApplicationService({ loanViewService }).applyPayment({
    loanId: 10,
    amount: 50,
    paymentDate: '2026-02-15T00:00:00.000Z',
    paymentMethod: 'cash',
  });

  assert.equal(result.loan.status, 'active');
  assert.equal(savedLoan.status, 'active');
  assert.equal(savedPayment.paymentMethod, 'cash');
  assert.equal(savedPayment.installmentNumber, 1);
});

test('createPaymentApplicationService requires an injected loan view service seam', () => {
  assert.throws(() => createPaymentApplicationService(), /loanViewService/i);
});

test('applyPayoff closes the loan, stores payoff metadata, and leaves no future scheduled interest charged', async () => {
  let savedLoan;
  let savedPayment;
  const notifications = [];

  const loan = {
    id: 10,
    customerId: 44,
    status: 'active',
    recoveryStatus: 'in_progress',
    amount: 1000,
    interestRate: 12,
    termMonths: 3,
    startDate: '2026-01-01T00:00:00.000Z',
    emiSchedule: [
      { installmentNumber: 1, dueDate: '2026-04-01T00:00:00.000Z', remainingPrincipal: 300, remainingInterest: 30, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
      { installmentNumber: 2, dueDate: '2026-05-01T00:00:00.000Z', remainingPrincipal: 350, remainingInterest: 20, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
      { installmentNumber: 3, dueDate: '2026-06-01T00:00:00.000Z', remainingPrincipal: 350, remainingInterest: 10, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
    ],
    financialSnapshot: {
      outstandingPrincipal: 1000,
      outstandingInterest: 60,
      outstandingBalance: 1060,
    },
    async save() {
      savedLoan = this;
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 900, ...payload };
  });

  const result = await createPaymentApplicationService({
    loanViewService,
    notificationPort: {
      async sendPaymentRegistered(userId, payload) {
        notifications.push({ userId, payload });
      },
    },
  }).applyPayoff({
    loanId: 10,
    asOfDate: '2026-03-15',
    quotedTotal: 1024,
    paymentDate: '2026-03-15T16:00:00.000Z',
    actor: { id: 55, role: 'customer' },
  });

  assert.equal(result.loan.status, 'closed');
  assert.equal(result.loan.closureReason, 'payoff');
  assert.equal(result.loan.closedAt.toISOString(), '2026-03-15T00:00:00.000Z');
  assert.equal(result.allocation.remainingBalance, 0);
  assert.equal(result.allocation.payoff.total, 1024);
  assert.equal(savedLoan.financialSnapshot.outstandingBalance, 0);
  assert.equal(savedPayment.paymentType, 'payoff');
  assert.equal(savedPayment.createdByUserId, 55);
  assert.equal(savedPayment.paymentMetadata.payoff.asOfDate, '2026-03-15');
  assert.equal(savedPayment.paymentMetadata.payoff.breakdown.overduePrincipal, 0);
  assert.equal(savedPayment.paymentMetadata.payoff.breakdown.overdueInterest, 0);
  assert.equal(savedPayment.paymentMetadata.payoff.breakdown.accruedInterest, 24);
  assert.equal(savedPayment.paymentMetadata.payoff.breakdown.futurePrincipal, 1000);
  assert.deepEqual(notifications.map((notification) => notification.userId), [44, 55]);
  assert.equal(notifications[0].payload.loanId, 10);
  assert.equal(notifications[0].payload.paymentId, 900);
  assert.equal(notifications[0].payload.paymentType, 'payoff');
  assert.equal(notifications[0].payload.newBalance, 0);
});

test('applyPayoff rejects stale payoff quotes before persistence', async () => {
  const loan = {
    id: 10,
    status: 'active',
    amount: 1000,
    interestRate: 12,
    termMonths: 3,
    startDate: '2026-01-01T00:00:00.000Z',
    emiSchedule: [
      { installmentNumber: 1, dueDate: '2026-04-01T00:00:00.000Z', remainingPrincipal: 300, remainingInterest: 30, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
      { installmentNumber: 2, dueDate: '2026-05-01T00:00:00.000Z', remainingPrincipal: 350, remainingInterest: 20, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
      { installmentNumber: 3, dueDate: '2026-06-01T00:00:00.000Z', remainingPrincipal: 350, remainingInterest: 10, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
    ],
    financialSnapshot: {
      outstandingPrincipal: 1000,
      outstandingInterest: 60,
      outstandingBalance: 1060,
    },
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async () => {
    throw new Error('Payment.create should not be called');
  });

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyPayoff({
    loanId: 10,
    asOfDate: '2026-03-15',
    quotedTotal: 1000,
  }), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.equal(error.message, 'La cotización de pago total ya no está vigente o no cubre el saldo. Solicita una nueva cotización.');
    return true;
  });
});

test('applyPayoff rejects overdue unpaid installments and exposes denial reasons', async () => {
  const loan = {
    id: 11,
    status: 'active',
    amount: 1000,
    interestRate: 12,
    termMonths: 3,
    startDate: '2026-01-01T00:00:00.000Z',
    emiSchedule: [
      { installmentNumber: 1, dueDate: '2026-02-01T00:00:00.000Z', remainingPrincipal: 300, remainingInterest: 30, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
      { installmentNumber: 2, dueDate: '2026-04-01T00:00:00.000Z', remainingPrincipal: 700, remainingInterest: 20, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
    ],
    financialSnapshot: {
      outstandingPrincipal: 1000,
      outstandingInterest: 50,
      outstandingBalance: 1050,
    },
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyPayoff({
    loanId: 11,
    asOfDate: '2026-03-15',
    quotedTotal: 1000,
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

test('applyPayoff rejects financially blocked loans and exposes denial reasons', async () => {
  const loan = {
    id: 12,
    status: 'active',
    amount: 1000,
    interestRate: 12,
    termMonths: 3,
    startDate: '2026-01-01T00:00:00.000Z',
    financialBlock: {
      active: true,
      code: 'COMPLIANCE_HOLD',
      message: 'Compliance block active',
      reason: 'kyc_review',
    },
    emiSchedule: [
      { installmentNumber: 1, dueDate: '2026-04-01T00:00:00.000Z', remainingPrincipal: 1000, remainingInterest: 30, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
    ],
    financialSnapshot: {
      outstandingPrincipal: 1000,
      outstandingInterest: 30,
      outstandingBalance: 1030,
    },
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyPayoff({
    loanId: 12,
    asOfDate: '2026-03-15',
    quotedTotal: 1000,
  }), (error) => {
    assert.ok(error instanceof BusinessRuleViolationError);
    assert.equal(error.code, 'PAYOFF_NOT_ALLOWED');
    assert.deepEqual(error.denialReasons, [{
      code: 'FINANCIAL_BLOCK',
      message: 'Compliance block active',
      blockCode: 'COMPLIANCE_HOLD',
      blockReason: 'kyc_review',
    }]);
    return true;
  });
});

test('applyPayoff rejects loans with no outstanding balance and exposes denial reasons', async () => {
  const loan = {
    id: 13,
    status: 'active',
    amount: 1000,
    interestRate: 12,
    termMonths: 3,
    startDate: '2026-01-01T00:00:00.000Z',
    emiSchedule: [
      { installmentNumber: 1, dueDate: '2026-04-01T00:00:00.000Z', remainingPrincipal: 0, remainingInterest: 0, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'paid' },
    ],
    financialSnapshot: {
      outstandingPrincipal: 0,
      outstandingInterest: 0,
      outstandingBalance: 0,
    },
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyPayoff({
    loanId: 13,
    asOfDate: '2026-03-15',
    quotedTotal: 12,
  }), (error) => {
    assert.ok(error instanceof BusinessRuleViolationError);
    assert.equal(error.code, 'PAYOFF_NOT_ALLOWED');
    assert.deepEqual(error.denialReasons, [{
      code: 'LOAN_ALREADY_PAID',
      message: 'El crédito ya está pagado en su totalidad',
    }]);
    return true;
  });
});

test('applyPayoff rejects already closed loans', async () => {
  const loan = {
    id: 10,
    status: 'closed',
    amount: 1000,
    interestRate: 12,
    termMonths: 3,
    startDate: '2026-01-01T00:00:00.000Z',
    emiSchedule: [
      { installmentNumber: 1, dueDate: '2026-04-01T00:00:00.000Z', remainingPrincipal: 0, remainingInterest: 0, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'paid' },
    ],
    financialSnapshot: {
      outstandingPrincipal: 0,
      outstandingInterest: 0,
      outstandingBalance: 0,
    },
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyPayoff({
    loanId: 10,
    asOfDate: '2026-03-15',
    quotedTotal: 12,
  }), (error) => {
    assert.ok(error instanceof BusinessRuleViolationError);
    assert.equal(error.code, 'PAYOFF_NOT_ALLOWED');
    assert.deepEqual(error.denialReasons, [{
      code: 'LOAN_ALREADY_PAID',
      message: 'El crédito ya está pagado en su totalidad',
    }]);
    return true;
  });
});

test('annulInstallment excludes annulled installments from outstanding snapshot totals', async () => {
  let savedLoan;
  let savedPayment;

  const loan = {
    id: 44,
    status: 'defaulted',
    recoveryStatus: 'assigned',
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2025-12-15T00:00:00.000Z',
        remainingPrincipal: 100,
        remainingInterest: 10,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        scheduledPayment: 110,
        status: 'pending',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-01-15T00:00:00.000Z',
        remainingPrincipal: 90,
        remainingInterest: 9,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        scheduledPayment: 99,
        status: 'pending',
      },
    ],
    async save() {
      savedLoan = this;
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 991, ...payload };
  });

  const result = await createPaymentApplicationService({ loanViewService }).annulInstallment({
    loanId: 44,
    actor: { id: 1, role: 'admin' },
    paymentDate: '2026-03-20T00:00:00.000Z',
  });

  assert.equal(result.annulment.installmentNumber, 1);
  assert.equal(savedLoan.emiSchedule[0].status, 'annulled');
  assert.equal(savedLoan.financialSnapshot.outstandingBalance, 99);
  assert.equal(savedLoan.financialSnapshot.outstandingInstallments, 1);
  assert.equal(savedLoan.financialSnapshot.nextInstallment.installmentNumber, 2);
  assert.equal(savedPayment.allocationBreakdown[0].previousStatus, 'overdue');
});

test('Payment model allows zero-amount records only for annulled payments', async () => {
  const annulledPayment = models.Payment.build({
    loanId: 44,
    amount: 0,
    paymentDate: '2026-03-20T00:00:00.000Z',
    status: 'annulled',
    paymentType: 'installment',
    principalApplied: 0,
    interestApplied: 0,
    penaltyApplied: 0,
    overpaymentAmount: 0,
    remainingBalanceAfterPayment: 0,
    allocationBreakdown: [],
    paymentMetadata: {},
  });

  await assert.doesNotReject(() => annulledPayment.validate());

  const regularPayment = models.Payment.build({
    loanId: 44,
    amount: 0,
    paymentDate: '2026-03-20T00:00:00.000Z',
    status: 'completed',
    paymentType: 'installment',
    principalApplied: 0,
    interestApplied: 0,
    penaltyApplied: 0,
    overpaymentAmount: 0,
    remainingBalanceAfterPayment: 0,
    allocationBreakdown: [],
    paymentMetadata: {},
  });

  await assert.rejects(
    () => regularPayment.validate(),
    /El monto del pago debe ser mayor a cero salvo que el pago esté anulado/,
  );
});

test('annulInstallment respects requested installment number when it matches nearest cancellable installment', async () => {
  let savedPayment;

  const loan = {
    id: 45,
    status: 'active',
    recoveryStatus: 'assigned',
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-01-15T00:00:00.000Z',
        remainingPrincipal: 100,
        remainingInterest: 10,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        scheduledPayment: 110,
        status: 'pending',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-02-15T00:00:00.000Z',
        remainingPrincipal: 90,
        remainingInterest: 9,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        scheduledPayment: 99,
        status: 'pending',
      },
    ],
    async save() {
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 992, ...payload };
  });

  const result = await createPaymentApplicationService({ loanViewService }).annulInstallment({
    loanId: 45,
    actor: { id: 99, role: 'admin' },
    installmentNumber: 1,
    reason: 'Ajuste operativo',
    paymentDate: '2026-01-20T00:00:00.000Z',
  });

  assert.equal(result.annulment.installmentNumber, 1);
  assert.equal(savedPayment.installmentNumber, 1);
  assert.equal(savedPayment.paymentMetadata.annulment.installmentNumber, 1);
  assert.equal(savedPayment.paymentMetadata.annulment.reason, 'Ajuste operativo');
});

test('annulInstallment blocks requested installment when it is not the nearest cancellable one', async () => {
  const loan = {
    id: 46,
    status: 'active',
    recoveryStatus: 'assigned',
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-01-15T00:00:00.000Z',
        remainingPrincipal: 100,
        remainingInterest: 10,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
      {
        installmentNumber: 2,
        dueDate: '2026-02-15T00:00:00.000Z',
        remainingPrincipal: 90,
        remainingInterest: 9,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
      },
    ],
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async () => {
    throw new Error('Payment.create should not be called');
  });

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).annulInstallment({
    loanId: 46,
    actor: { id: 99, role: 'admin' },
    installmentNumber: 2,
    paymentDate: '2026-01-20T00:00:00.000Z',
  }), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.equal(error.message, 'Solo puedes anular la cuota pendiente o vencida más cercana. La cuota disponible es la número 1.');
    return true;
  });
});

test('annulInstallment rejects invalid annulment states with Spanish operator messages', async () => {
  let currentLoan;
  const service = createPaymentApplicationService({ loanViewService });

  mock.method(models.sequelize, 'transaction', async (_options, handler) => handler({ id: '' }));
  mock.method(models.Loan, 'findByPk', async () => currentLoan);
  mock.method(models.Payment, 'create', async () => {
    throw new Error('Payment.create should not be called');
  });

  const assertAnnulmentMessage = async ({ loan, installmentNumber = null, expectedMessage }) => {
    currentLoan = {
      id: 47,
      recoveryStatus: 'assigned',
      async save() {
        throw new Error('loan.save should not be called');
      },
      ...loan,
    };

    await assert.rejects(() => service.annulInstallment({
      loanId: 47,
      actor: { id: 99, role: 'admin' },
      installmentNumber,
      paymentDate: '2026-01-20T00:00:00.000Z',
    }), (error) => {
      assert.equal(error.name, 'ValidationError');
      assert.equal(error.message, expectedMessage);
      return true;
    });
  };

  await assertAnnulmentMessage({
    loan: { status: 'closed', emiSchedule: [] },
    expectedMessage: 'No se pueden anular cuotas de un crédito que no está pendiente, activo, vencido o en incumplimiento.',
  });

  await assertAnnulmentMessage({
    loan: {
      status: 'active',
      emiSchedule: [
        { installmentNumber: 1, dueDate: '2026-01-15T00:00:00.000Z', remainingPrincipal: 0, remainingInterest: 0, paidPrincipal: 100, paidInterest: 10, paidTotal: 110, status: 'paid' },
        { installmentNumber: 2, dueDate: '2026-02-15T00:00:00.000Z', remainingPrincipal: 0, remainingInterest: 0, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'annulled' },
      ],
    },
    expectedMessage: 'No hay cuotas pendientes o vencidas disponibles para anular.',
  });

  await assertAnnulmentMessage({
    loan: {
      status: 'active',
      emiSchedule: [
        { installmentNumber: 1, dueDate: '2026-01-15T00:00:00.000Z', remainingPrincipal: 100, remainingInterest: 10, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
      ],
    },
    installmentNumber: 9,
    expectedMessage: 'La cuota número 9 no existe en este crédito.',
  });

  await assertAnnulmentMessage({
    loan: {
      status: 'active',
      emiSchedule: [
        { installmentNumber: 1, dueDate: '2026-01-15T00:00:00.000Z', remainingPrincipal: 100, remainingInterest: 10, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
        { installmentNumber: 2, dueDate: '2026-02-15T00:00:00.000Z', remainingPrincipal: 50, remainingInterest: 5, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'annulled' },
      ],
    },
    installmentNumber: 2,
    expectedMessage: 'La cuota número 2 ya está anulada.',
  });

  await assertAnnulmentMessage({
    loan: {
      status: 'active',
      emiSchedule: [
        { installmentNumber: 1, dueDate: '2026-01-15T00:00:00.000Z', remainingPrincipal: 100, remainingInterest: 10, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
        { installmentNumber: 2, dueDate: '2026-02-15T00:00:00.000Z', remainingPrincipal: 0, remainingInterest: 0, paidPrincipal: 50, paidInterest: 5, paidTotal: 55, status: 'paid' },
      ],
    },
    installmentNumber: 2,
    expectedMessage: 'La cuota número 2 ya está pagada y no se puede anular.',
  });

  await assertAnnulmentMessage({
    loan: {
      status: 'active',
      emiSchedule: [
        { installmentNumber: 1, dueDate: '2026-01-15T00:00:00.000Z', remainingPrincipal: 100, remainingInterest: 10, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
        { installmentNumber: 2, dueDate: '2026-02-15T00:00:00.000Z', remainingPrincipal: 20, remainingInterest: 2, paidPrincipal: 80, paidInterest: 8, paidTotal: 88, status: 'partial' },
      ],
    },
    installmentNumber: 2,
    expectedMessage: 'La cuota número 2 no se puede anular porque no está pendiente ni vencida.',
  });

  await assertAnnulmentMessage({
    loan: {
      status: 'active',
      emiSchedule: [
        { installmentNumber: 1, dueDate: '2026-01-15T00:00:00.000Z', remainingPrincipal: 20, remainingInterest: 2, paidPrincipal: 80, paidInterest: 8, paidTotal: 88, status: 'partial' },
        { installmentNumber: 2, dueDate: '2026-02-15T00:00:00.000Z', remainingPrincipal: 100, remainingInterest: 10, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
      ],
    },
    installmentNumber: 2,
    expectedMessage: 'Solo puedes anular la cuota pendiente o vencida más cercana. La cuota disponible es la número 1.',
  });
});

test('annulInstallment rejects non-admin actors with a Spanish operator message', async () => {
  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).annulInstallment({
    loanId: 48,
    actor: { id: 7, role: 'employee' },
    paymentDate: '2026-01-20T00:00:00.000Z',
  }), (error) => {
    assert.equal(error.name, 'AuthorizationError');
    assert.equal(error.message, 'Solo un administrador puede anular cuotas.');
    return true;
  });
});

test('updatePaymentMethod updates method for non-reconciled payments and preserves guard for reconciled ones', async () => {
  const service = createPaymentApplicationService({ loanViewService });

  const editablePayment = {
    id: 700,
    loanId: 50,
    status: 'completed',
    paymentMethod: 'cash',
    async save() {
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (optionsOrHandler, maybeHandler) => {
    const handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler;
    return handler({ id: '' });
  });
  mock.method(models.Payment, 'findOne', async ({ where }) => {
    if (where.id === 701) {
      return { id: 701, loanId: 50, status: 'reconciled' };
    }
    return editablePayment;
  });

  const updated = await service.updatePaymentMethod({
    loanId: 50,
    paymentId: 700,
    paymentMethod: 'transfer',
    actor: { id: 1, role: 'admin' },
  });

  assert.equal(updated.paymentMethod, 'transfer');

  await assert.rejects(() => service.updatePaymentMethod({
    loanId: 50,
    paymentId: 701,
    paymentMethod: 'cash',
    actor: { id: 1, role: 'admin' },
  }), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.equal(error.message, 'No se puede cambiar el método de pago de un pago conciliado.');
    return true;
  });
});

test('updatePaymentMethod rejects non-admin actors with a Spanish operator message', async () => {
  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).updatePaymentMethod({
    loanId: 50,
    paymentId: 700,
    paymentMethod: 'cash',
    actor: { id: 7, role: 'employee' },
  }), (error) => {
    assert.equal(error.name, 'AuthorizationError');
    assert.equal(error.message, 'Solo un administrador puede cambiar métodos de pago.');
    return true;
  });
});
