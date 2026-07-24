const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Op } = require('sequelize');

const repositoriesModulePath = path.resolve(__dirname, '../src/modules/reports/infrastructure/repositories.js');
const { reportRepository, paymentRepository } = require(repositoriesModulePath);
const {
  Loan,
  Customer,
  Payment,
  OperatingExpense,
  AssociateContribution,
  AssociateInstallment,
  ProfitDistribution,
  LoanAlert,
  PromiseToPay,
  Notification,
  User,
} = require('@/models');

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
      return [{
        month: '2026-01-01T00:00:00.000Z',
        totalEarnings: '438.81',
        totalInterest: '38.81',
        totalPenalties: '12.50',
        paymentCount: '1',
      }];
    }

    if (capturedPaymentQueries.length === 2) {
      return [{ totalAmount: '438.81', count: '1' }];
    }

    return [{ totalInterest: '38.81', totalPenalties: '0.00' }];
  };

  Loan.findAll = async () => [{ totalLoans: '1', totalAmount: '2500.00' }];

  const monthlyRows = await reportRepository.getMonthlyEarnings(2026);
  await reportRepository.getPerformanceMetrics(2026);

  assert.equal(capturedPaymentQueries.length, 3);
  assert.deepEqual(monthlyRows, [{
    month: '2026-01',
    totalEarnings: 438.81,
    totalInterest: 38.81,
    totalPenalties: 12.5,
    paymentCount: 1,
  }]);

  const [monthlyQuery, performanceQuery] = capturedPaymentQueries;

  assert.equal(monthlyQuery.attributes[1][0].fn, 'SUM');
  assert.equal(monthlyQuery.attributes[1][0].args[0].val, TOTAL_PAYMENT_EARNINGS_LITERAL_VALUE);
  assert.equal(monthlyQuery.attributes[2][1], 'totalInterest');
  assert.equal(monthlyQuery.attributes[3][1], 'totalPenalties');

  assert.equal(performanceQuery.attributes[0][0].fn, 'SUM');
  assert.equal(performanceQuery.attributes[0][0].args[0].val, TOTAL_PAYMENT_EARNINGS_LITERAL_VALUE);
});

test('reportRepository listCashFlowDataset reads paid associate movements and completed operating expenses for the requested range', async (t) => {
  assert.ok(OperatingExpense, 'OperatingExpense model must be registered');
  assert.ok(AssociateInstallment, 'AssociateInstallment model must be registered');
  assert.ok(ProfitDistribution, 'ProfitDistribution model must be registered');

  const originalLoanFindAll = Loan.findAll;
  const originalPaymentFindAll = Payment.findAll;
  const originalOperatingExpenseFindAll = OperatingExpense.findAll;
  const originalAssociateInstallmentFindAll = AssociateInstallment.findAll;
  const originalAssociateContributionFindAll = AssociateContribution.findAll;
  const originalProfitDistributionFindAll = ProfitDistribution.findAll;

  t.after(() => {
    Loan.findAll = originalLoanFindAll;
    Payment.findAll = originalPaymentFindAll;
    OperatingExpense.findAll = originalOperatingExpenseFindAll;
    AssociateInstallment.findAll = originalAssociateInstallmentFindAll;
    AssociateContribution.findAll = originalAssociateContributionFindAll;
    ProfitDistribution.findAll = originalProfitDistributionFindAll;
  });

  const fromDate = new Date('2026-03-01T00:00:00.000Z');
  const toDate = new Date('2026-03-31T23:59:59.999Z');
  const expenseRows = [{ id: 7, amount: 125000, status: 'completed', expenseDate: fromDate }];
  const paidInstallmentRows = [{ id: 11, amount: 75000, status: 'paid', paidAt: fromDate }];
  const contributionRows = [{ id: 12, amount: 200000, status: 'completed', contributionDate: fromDate }];
  const distributionRows = [
    { id: 20, amount: 50000, distributionDate: fromDate, basis: { type: 'manual' } },
    { id: 21, amount: 15000, distributionDate: fromDate, basis: { type: 'reinvestment' } },
    { id: 22, amount: 30000, distributionDate: fromDate, basis: { type: 'capital-return' } },
  ];
  let capturedExpenseQuery = null;
  let capturedInstallmentQuery = null;
  let capturedDistributionQuery = null;
  let capturedLoanQuery = null;

  Loan.findAll = async (query) => {
    capturedLoanQuery = query;
    return [];
  };
  Payment.findAll = async () => [];
  AssociateInstallment.findAll = async (query) => {
    capturedInstallmentQuery = query;
    return paidInstallmentRows;
  };
  AssociateContribution.findAll = async () => contributionRows;
  ProfitDistribution.findAll = async (query) => {
    capturedDistributionQuery = query;
    return distributionRows;
  };
  OperatingExpense.findAll = async (query) => {
    capturedExpenseQuery = query;
    return expenseRows;
  };

  const dataset = await reportRepository.listCashFlowDataset({ year: 2026, fromDate, toDate });

  assert.equal(dataset.operatingExpenses, expenseRows);
  assert.deepEqual(dataset.associatePayments, [paidInstallmentRows[0], distributionRows[0]]);
  assert.equal(dataset.associateContributions, contributionRows);
  assert.deepEqual(dataset.associateReinvestments, [distributionRows[1]]);
  assert.deepEqual(dataset.associateCapitalReturns, [distributionRows[2]]);
  const loanDateConditions = capturedLoanQuery.where[Op.and][1][Op.or];
  assert.equal(loanDateConditions[0].startDate[Op.gte], fromDate);
  assert.equal(loanDateConditions[0].startDate[Op.lte], toDate);
  assert.equal(loanDateConditions[1][Op.and][0].startDate, null);
  assert.equal(loanDateConditions[1][Op.and][1].createdAt[Op.gte], fromDate);
  assert.equal(loanDateConditions[1][Op.and][1].createdAt[Op.lte], toDate);
  assert.equal(capturedInstallmentQuery.where.status, 'paid');
  assert.equal(capturedInstallmentQuery.where.paidAt[Op.gte], fromDate);
  assert.equal(capturedInstallmentQuery.where.paidAt[Op.lte], toDate);
  assert.equal(capturedDistributionQuery.where.distributionDate[Op.gte], fromDate);
  assert.equal(capturedDistributionQuery.where.distributionDate[Op.lte], toDate);
  assert.equal(capturedExpenseQuery.where.status, 'completed');
  assert.equal(capturedExpenseQuery.where.expenseDate[Op.gte], fromDate);
  assert.equal(capturedExpenseQuery.where.expenseDate[Op.lte], toDate);
  assert.deepEqual(capturedExpenseQuery.order, [['expenseDate', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']]);
});

test('reportRepository getDashboardSummary includes paid associate movements and excludes reinvestments', async (t) => {
  assert.ok(AssociateInstallment, 'AssociateInstallment model must be registered');
  assert.ok(ProfitDistribution, 'ProfitDistribution model must be registered');

  const originalLoanFindAll = Loan.findAll;
  const originalPaymentFindAll = Payment.findAll;
  const originalLoanAlertFindAll = LoanAlert.findAll;
  const originalPromiseFindAll = PromiseToPay.findAll;
  const originalNotificationFindAll = Notification.findAll;
  const originalCustomerCount = Customer.count;
  const originalOperatingExpenseFindAll = OperatingExpense.findAll;
  const originalAssociateInstallmentFindAll = AssociateInstallment.findAll;
  const originalProfitDistributionFindAll = ProfitDistribution.findAll;

  t.after(() => {
    Loan.findAll = originalLoanFindAll;
    Payment.findAll = originalPaymentFindAll;
    LoanAlert.findAll = originalLoanAlertFindAll;
    PromiseToPay.findAll = originalPromiseFindAll;
    Notification.findAll = originalNotificationFindAll;
    Customer.count = originalCustomerCount;
    OperatingExpense.findAll = originalOperatingExpenseFindAll;
    AssociateInstallment.findAll = originalAssociateInstallmentFindAll;
    ProfitDistribution.findAll = originalProfitDistributionFindAll;
  });

  const paidInstallmentRows = [{ id: 12, amount: 90000, status: 'paid' }];
  const distributionRows = [
    { id: 31, amount: 70000, basis: { type: 'manual' } },
    { id: 32, amount: 50000, basis: { type: 'reinvestment' } },
    { id: 33, amount: 30000, basis: { type: 'capital-return' } },
  ];
  let capturedInstallmentQuery = null;
  let capturedDistributionQuery = null;

  Loan.findAll = async () => [];
  Payment.findAll = async () => [];
  LoanAlert.findAll = async () => [];
  PromiseToPay.findAll = async () => [];
  Notification.findAll = async () => [];
  Customer.count = async () => 0;
  OperatingExpense.findAll = async () => [];
  AssociateContribution.findAll = async () => [];
  AssociateInstallment.findAll = async (query) => {
    capturedInstallmentQuery = query;
    return paidInstallmentRows;
  };
  ProfitDistribution.findAll = async (query) => {
    capturedDistributionQuery = query;
    return distributionRows;
  };

  const dataset = await reportRepository.getDashboardSummary();

  assert.deepEqual(dataset.associatePayments, [paidInstallmentRows[0], distributionRows[0]]);
  assert.deepEqual(dataset.associateReinvestments, [distributionRows[1]]);
  assert.deepEqual(dataset.associateCapitalReturns, [distributionRows[2]]);
  assert.equal(capturedInstallmentQuery.where, undefined);
  assert.equal(capturedInstallmentQuery.limit, 5000);
  assert.equal(capturedDistributionQuery.limit, 5000);
});

test('reportRepository listCreditHistoryDataset includes operating expenses for cash reconciliation', async (t) => {
  assert.ok(OperatingExpense, 'OperatingExpense model must be registered');

  const originalLoanFindAll = Loan.findAll;
  const originalPaymentFindAll = Payment.findAll;
  const originalOperatingExpenseFindAll = OperatingExpense.findAll;

  t.after(() => {
    Loan.findAll = originalLoanFindAll;
    Payment.findAll = originalPaymentFindAll;
    OperatingExpense.findAll = originalOperatingExpenseFindAll;
  });

  const startDate = new Date('2026-04-01T00:00:00.000Z');
  const endDate = new Date('2026-04-30T23:59:59.999Z');
  const expenseRows = [{ id: 10, amount: 150000, status: 'completed', expenseDate: endDate }];
  let capturedExpenseQuery = null;
  let capturedLoanQuery = null;
  let capturedPaymentQuery = null;

  Loan.findAll = async (query) => {
    capturedLoanQuery = query;
    return [];
  };
  Payment.findAll = async (query) => {
    capturedPaymentQuery = query;
    return [];
  };
  OperatingExpense.findAll = async (query) => {
    capturedExpenseQuery = query;
    return expenseRows;
  };

  const dataset = await reportRepository.listCreditHistoryDataset({
    startDate,
    endDate,
    financialProductId: '11111111-1111-4111-8111-111111111111',
  });

  assert.equal(dataset.operatingExpenses, expenseRows);
  assert.equal(capturedLoanQuery.where.financialProductId, '11111111-1111-4111-8111-111111111111');
  assert.equal(capturedPaymentQuery.include[0].where.financialProductId, '11111111-1111-4111-8111-111111111111');
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
