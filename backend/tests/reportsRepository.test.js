const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Op } = require('sequelize');

const repositoriesModulePath = path.resolve(__dirname, '../src/modules/reports/infrastructure/repositories.js');
const { reportRepository, paymentRepository } = require(repositoriesModulePath);
const { Loan, Payment, AssociateInstallment, OperatingExpense, User } = require('@/models');

const TOTAL_PAYMENT_EARNINGS_LITERAL_VALUE = '"principalApplied" + "interestApplied" + "penaltyApplied"';

test('reportRepository financial aggregates quote mixed-case payment columns', async (t) => {
  const originalFindAll = Payment.findAll;
  const originalLoanFindAll = Loan.findAll;

  t.after(() => {
    Payment.findAll = originalFindAll;
    Loan.findAll = originalLoanFindAll;
  });

  const capturedPaymentQueries = [];
  Payment.findAll = async (query) => {
    capturedPaymentQueries.push(query);

    if (capturedPaymentQueries.length === 1) {
      return [{ month: '2026-01-01T00:00:00.000Z', totalEarnings: '438.81', paymentCount: '1' }];
    }

    if (capturedPaymentQueries.length === 2) {
      return [{ totalAmount: '438.81', count: '1' }];
    }

    return [{ totalInterest: '38.81', totalPenalties: '0.00' }];
  };

  Loan.findAll = async () => [{ totalLoans: '1', totalAmount: '2500.00' }];

  await reportRepository.getMonthlyEarnings(2026);
  await reportRepository.getPerformanceMetrics(2026);

  assert.equal(capturedPaymentQueries.length, 3);

  const [monthlyQuery, performanceQuery] = capturedPaymentQueries;

  assert.equal(monthlyQuery.attributes[1][0].fn, 'SUM');
  assert.equal(monthlyQuery.attributes[1][0].args[0].val, TOTAL_PAYMENT_EARNINGS_LITERAL_VALUE);

  assert.equal(performanceQuery.attributes[0][0].fn, 'SUM');
  assert.equal(performanceQuery.attributes[0][0].args[0].val, TOTAL_PAYMENT_EARNINGS_LITERAL_VALUE);
});

test('reportRepository listCashFlowDataset reads completed operating expenses and associate interest obligations for the requested range', async (t) => {
  assert.ok(OperatingExpense, 'OperatingExpense model must be registered');

  const originalLoanFindAll = Loan.findAll;
  const originalPaymentFindAll = Payment.findAll;
  const originalAssociateInstallmentFindAll = AssociateInstallment.findAll;
  const originalOperatingExpenseFindAll = OperatingExpense.findAll;

  t.after(() => {
    Loan.findAll = originalLoanFindAll;
    Payment.findAll = originalPaymentFindAll;
    AssociateInstallment.findAll = originalAssociateInstallmentFindAll;
    OperatingExpense.findAll = originalOperatingExpenseFindAll;
  });

  const fromDate = new Date('2026-03-01T00:00:00.000Z');
  const toDate = new Date('2026-03-31T23:59:59.999Z');
  const expenseRows = [{ id: 7, amount: 125000, status: 'completed', expenseDate: fromDate }];
  let capturedExpenseQuery = null;

  Loan.findAll = async () => [];
  Payment.findAll = async () => [];
  AssociateInstallment.findAll = async () => [];
  OperatingExpense.findAll = async (query) => {
    capturedExpenseQuery = query;
    return expenseRows;
  };
  let capturedAssociateInstallmentQuery = null;
  AssociateInstallment.findAll = async (query) => {
    capturedAssociateInstallmentQuery = query;
    return [];
  };

  const dataset = await reportRepository.listCashFlowDataset({ year: 2026, fromDate, toDate });

  assert.equal(dataset.operatingExpenses, expenseRows);
  assert.deepEqual(capturedAssociateInstallmentQuery.where.status[Op.in], ['paid', 'pending', 'overdue']);
  assert.deepEqual(capturedAssociateInstallmentQuery.where[Op.or], [
    { paidAt: { [Op.gte]: fromDate, [Op.lte]: toDate } },
    { dueDate: { [Op.gte]: fromDate, [Op.lte]: toDate } },
  ]);
  assert.equal(capturedExpenseQuery.where.status, 'completed');
  assert.equal(capturedExpenseQuery.where.expenseDate[Op.gte], fromDate);
  assert.equal(capturedExpenseQuery.where.expenseDate[Op.lte], toDate);
  assert.deepEqual(capturedExpenseQuery.order, [['expenseDate', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']]);
});

test('reportRepository listCreditHistoryDataset includes paid associate interest and operating expenses for cash reconciliation', async (t) => {
  assert.ok(OperatingExpense, 'OperatingExpense model must be registered');

  const originalLoanFindAll = Loan.findAll;
  const originalPaymentFindAll = Payment.findAll;
  const originalAssociateInstallmentFindAll = AssociateInstallment.findAll;
  const originalOperatingExpenseFindAll = OperatingExpense.findAll;

  t.after(() => {
    Loan.findAll = originalLoanFindAll;
    Payment.findAll = originalPaymentFindAll;
    AssociateInstallment.findAll = originalAssociateInstallmentFindAll;
    OperatingExpense.findAll = originalOperatingExpenseFindAll;
  });

  const startDate = new Date('2026-04-01T00:00:00.000Z');
  const endDate = new Date('2026-04-30T23:59:59.999Z');
  const associateInterestRows = [{ id: 9, amount: 200000, status: 'paid', paidAt: startDate }];
  const expenseRows = [{ id: 10, amount: 150000, status: 'completed', expenseDate: endDate }];
  let capturedAssociateInstallmentQuery = null;
  let capturedExpenseQuery = null;

  Loan.findAll = async () => [];
  Payment.findAll = async () => [];
  AssociateInstallment.findAll = async (query) => {
    capturedAssociateInstallmentQuery = query;
    return associateInterestRows;
  };
  OperatingExpense.findAll = async (query) => {
    capturedExpenseQuery = query;
    return expenseRows;
  };

  const dataset = await reportRepository.listCreditHistoryDataset({ startDate, endDate });

  assert.equal(dataset.associateInterestPayments, associateInterestRows);
  assert.equal(dataset.operatingExpenses, expenseRows);
  assert.equal(capturedAssociateInstallmentQuery.where.status, 'paid');
  assert.equal(capturedAssociateInstallmentQuery.where.paidAt[Op.gte], startDate);
  assert.equal(capturedAssociateInstallmentQuery.where.paidAt[Op.lte], endDate);
  assert.equal(capturedExpenseQuery.where.status, 'completed');
  assert.equal(capturedExpenseQuery.where.expenseDate[Op.gte], startDate);
  assert.equal(capturedExpenseQuery.where.expenseDate[Op.lte], endDate);
});

test('paymentRepository listByLoan includes the operator who registered each payment', async (t) => {
  const originalPaymentFindAll = Payment.findAll;

  t.after(() => {
    Payment.findAll = originalPaymentFindAll;
  });

  let capturedQuery = null;
  Payment.findAll = async (query) => {
    capturedQuery = query;
    return [];
  };

  await paymentRepository.listByLoan(44);

  assert.deepEqual(capturedQuery.where, { loanId: 44 });
  assert.deepEqual(capturedQuery.include, [{
    model: User,
    as: 'createdBy',
    attributes: ['id', 'name', 'email', 'role'],
  }]);
});
