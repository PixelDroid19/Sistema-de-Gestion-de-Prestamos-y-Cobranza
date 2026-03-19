const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const models = require('../src/models');
const { summarizeSchedule, buildAmortizationSchedule } = require('../src/services/creditFormulaHelpers');
const { createLoanViewService } = require('../src/modules/credits/application/loanFinancials');
const { createPaymentApplicationService } = require('../src/services/paymentApplicationService');

afterEach(() => {
  mock.restoreAll();
});

const loanViewService = createLoanViewService();

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
    assert.match(error.message, /approved, active, or defaulted/i);
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
      { installmentNumber: 1, dueDate: '2026-02-01T00:00:00.000Z', remainingPrincipal: 300, remainingInterest: 30, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
      { installmentNumber: 2, dueDate: '2026-03-01T00:00:00.000Z', remainingPrincipal: 350, remainingInterest: 20, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
      { installmentNumber: 3, dueDate: '2026-04-01T00:00:00.000Z', remainingPrincipal: 350, remainingInterest: 10, paidPrincipal: 0, paidInterest: 0, paidTotal: 0, status: 'pending' },
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
    quotedTotal: 1054.6,
    paymentDate: '2026-03-15T16:00:00.000Z',
  });

  assert.equal(result.loan.status, 'closed');
  assert.equal(result.loan.closureReason, 'payoff');
  assert.equal(result.loan.closedAt.toISOString(), '2026-03-15T00:00:00.000Z');
  assert.equal(result.allocation.remainingBalance, 0);
  assert.equal(result.allocation.payoff.total, 1054.6);
  assert.equal(savedLoan.financialSnapshot.outstandingBalance, 0);
  assert.equal(savedPayment.paymentType, 'payoff');
  assert.equal(savedPayment.paymentMetadata.payoff.asOfDate, '2026-03-15');
  assert.equal(savedPayment.paymentMetadata.payoff.breakdown.overduePrincipal, 650);
  assert.equal(savedPayment.paymentMetadata.payoff.breakdown.overdueInterest, 50);
  assert.equal(savedPayment.paymentMetadata.payoff.breakdown.accruedInterest, 4.6);
  assert.equal(savedPayment.paymentMetadata.payoff.breakdown.futurePrincipal, 350);
});

test('applyPayoff rejects stale payoff quotes before persistence', async () => {
  const loan = {
    id: 10,
    status: 'active',
    amount: 1000,
    interestRate: 12,
    termMonths: 3,
    startDate: '2026-01-01T00:00:00.000Z',
    emiSchedule: [],
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

test('applyPayoff rejects already closed loans', async () => {
  const loan = {
    id: 10,
    status: 'closed',
    amount: 1000,
    interestRate: 12,
    termMonths: 3,
    startDate: '2026-01-01T00:00:00.000Z',
    emiSchedule: [],
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
    assert.equal(error.name, 'ValidationError');
    assert.match(error.message, /approved, active, or defaulted/i);
    return true;
  });
});
