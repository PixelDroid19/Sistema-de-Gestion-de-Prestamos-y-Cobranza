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
