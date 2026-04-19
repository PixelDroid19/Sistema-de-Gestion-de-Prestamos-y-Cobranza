const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const models = require('@/models');
const { summarizeSchedule, buildAmortizationSchedule } = require('@/modules/credits/application/creditFormulaHelpers');
const { createLoanViewService } = require('@/modules/credits/application/loanFinancials');
const moduleOwnedPaymentApplicationService = require('@/modules/credits/application/paymentApplicationService');
const { createPaymentApplicationService } = require('@/services/paymentApplicationService');
const { BusinessRuleViolationError } = require('@/utils/errorHandler');

afterEach(() => {
  mock.restoreAll();
});

const loanViewService = createLoanViewService();

test('root paymentApplicationService stays a thin compatibility adapter to the credits module implementation', () => {
  assert.equal(createPaymentApplicationService, moduleOwnedPaymentApplicationService.createPaymentApplicationService);
  assert.equal(require('@/services/paymentApplicationService').isInstallmentOverdue, moduleOwnedPaymentApplicationService.isInstallmentOverdue);
  assert.equal(require('@/services/paymentApplicationService').CANCELLABLE_STATUSES, moduleOwnedPaymentApplicationService.CANCELLABLE_STATUSES);
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-1' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 501, ...payload };
  });

  const result = await createPaymentApplicationService({ loanViewService }).applyPayment({
    loanId: 10,
    amount: totalPayable + 5,
    paymentDate: '2026-02-15T00:00:00.000Z',
  });

  assert.equal(result.loan.status, 'closed');
  assert.equal(result.loan.recoveryStatus, 'recovered');
  assert.equal(result.allocation.remainingBalance, 0);
  assert.equal(result.allocation.overpaymentAmount, 5);
  assert.equal(result.allocation.allocations.length, 2);
  assert.equal(savedLoan.financialSnapshot.outstandingBalance, 0);
  assert.equal(savedPayment.remainingBalanceAfterPayment, 0);
  assert.equal(savedPayment.overpaymentAmount, 5);
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-waterfall' }));
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

test('applyCapitalPayment updates schedule balances and payment remaining balance from snapshot', async () => {
  let savedLoan;
  let savedPayment;

  const loan = {
    id: 33,
    status: 'active',
    recoveryStatus: 'pending',
    principalOutstanding: 300,
    emiSchedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-04-01T00:00:00.000Z',
        remainingPrincipal: 100,
        remainingInterest: 10,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
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
      savedLoan = this;
      return this;
    },
  };

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-capital' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 888, ...payload };
  });

  const result = await createPaymentApplicationService({ loanViewService }).applyCapitalPayment({
    loanId: 33,
    amount: 150,
    paymentDate: '2026-03-10T00:00:00.000Z',
  });

  assert.equal(result.allocation.principalApplied, 150);
  assert.equal(result.allocation.remainingPrincipalOutstanding, 150);
  assert.equal(savedLoan.emiSchedule[0].remainingPrincipal, 0);
  assert.equal(savedLoan.emiSchedule[1].remainingPrincipal, 150);
  assert.equal(savedPayment.remainingBalanceAfterPayment, 180);
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
        remainingPrincipal: 100,
        remainingInterest: 10,
        paidPrincipal: 0,
        paidInterest: 0,
        paidTotal: 0,
        status: 'pending',
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-capital-overdue' }));
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
      message: 'Loan has overdue unpaid installments',
    }]);
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-capital-block' }));
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-capital-no-balance' }));
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
      message: 'Loan has no outstanding balance for capital payment',
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-invalid-amount' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async () => {
    throw new Error('Payment.create should not be called');
  });

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyPayment({
    loanId: 10,
    amount: 0,
  }), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.match(error.message, /greater than 0/i);
    return true;
  });
});

test('applyPayment rejects pending loans before persistence', async () => {
  const loan = {
    id: 10,
    status: 'pending',
    recoveryStatus: null,
    amount: 1000,
    interestRate: 12,
    termMonths: 2,
    emiSchedule: [],
    async save() {
      throw new Error('loan.save should not be called');
    },
  };

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-pending' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async () => {
    throw new Error('Payment.create should not be called');
  });

  await assert.rejects(() => createPaymentApplicationService({ loanViewService }).applyPayment({
    loanId: 10,
    amount: 50,
  }), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.match(error.message, /approved, active, overdue, or defaulted/i);
    return true;
  });
});

test('createPaymentApplicationService requires an injected loan view service seam', () => {
  assert.throws(() => createPaymentApplicationService(), /loanViewService/i);
});

test('applyPayoff closes the loan, stores payoff metadata, and leaves no future scheduled interest charged', async () => {
  let savedLoan;
  let savedPayment;

  const loan = {
    id: 10,
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-payoff' }));
  mock.method(models.Loan, 'findByPk', async () => loan);
  mock.method(models.Payment, 'create', async (payload) => {
    savedPayment = payload;
    return { id: 900, ...payload };
  });

  const result = await createPaymentApplicationService({ loanViewService }).applyPayoff({
    loanId: 10,
    asOfDate: '2026-03-15',
    quotedTotal: 1024,
    paymentDate: '2026-03-15T16:00:00.000Z',
  });

  assert.equal(result.loan.status, 'closed');
  assert.equal(result.loan.closureReason, 'payoff');
  assert.equal(result.loan.closedAt.toISOString(), '2026-03-15T00:00:00.000Z');
  assert.equal(result.allocation.remainingBalance, 0);
  assert.equal(result.allocation.payoff.total, 1024);
  assert.equal(savedLoan.financialSnapshot.outstandingBalance, 0);
  assert.equal(savedPayment.paymentType, 'payoff');
  assert.equal(savedPayment.paymentMetadata.payoff.asOfDate, '2026-03-15');
  assert.equal(savedPayment.paymentMetadata.payoff.breakdown.overduePrincipal, 0);
  assert.equal(savedPayment.paymentMetadata.payoff.breakdown.overdueInterest, 0);
  assert.equal(savedPayment.paymentMetadata.payoff.breakdown.accruedInterest, 24);
  assert.equal(savedPayment.paymentMetadata.payoff.breakdown.futurePrincipal, 1000);
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-stale-payoff' }));
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
    assert.match(error.message, /stale or insufficient/i);
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-payoff-overdue' }));
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
      message: 'Loan has overdue unpaid installments',
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-payoff-block' }));
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-payoff-no-balance' }));
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
      message: 'Loan is already fully paid',
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-closed-payoff' }));
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
      message: 'Loan is already fully paid',
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-annulled' }));
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-annul-selected' }));
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-annul-invalid-selected' }));
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
    assert.match(error.message, /only the nearest pending or overdue installment/i);
    assert.match(error.message, /#1/i);
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

  mock.method(models.sequelize, 'transaction', async (handler) => handler({ id: 'tx-update-method' }));
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
    assert.match(error.message, /reconciled/i);
    return true;
  });
});
