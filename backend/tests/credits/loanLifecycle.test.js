const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const models = require('../../src/models');
const { getCanonicalLoanView } = require('../../src/modules/credits/application/loanFinancials');
const {
  createLoanFromCanonicalData,
  createLoanFromCanonicalDataFactory,
} = require('../../src/modules/credits/infrastructure/loanCreation');

afterEach(() => {
  mock.restoreAll();
});

test('createLoanFromCanonicalData persists the canonical schedule and summary', async () => {
  let persistedPayload;

  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Test' }));
  mock.method(models.Associate, 'findByPk', async (id) => ({ id, name: 'Associate Test' }));
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Personal Loan 12%' }));
  mock.method(models.Loan, 'create', async (payload) => {
    persistedPayload = payload;
    return { id: 77, ...payload };
  });

  const createdLoan = await createLoanFromCanonicalData({
    customerId: 1,
    associateId: 3,
    amount: 12000,
    interestRate: 12,
    termMonths: 12,
    lateFeeMode: 'none',
  });

  assert.equal(createdLoan.id, 77);
  assert.equal(persistedPayload.customerId, 1);
  assert.equal(persistedPayload.associateId, 3);
  assert.equal(persistedPayload.financialProductId, 'prod-default');
  assert.equal(persistedPayload.status, 'pending');
  assert.equal(persistedPayload.lateFeeMode, 'NONE');
  assert.equal(persistedPayload.emiSchedule.length, 12);
  assert.equal(persistedPayload.installmentAmount, 1066.19);
  assert.equal(persistedPayload.totalPayable, 12794.23);
  assert.equal(persistedPayload.financialSnapshot.outstandingBalance, 12794.23);
  assert.equal(persistedPayload.financialSnapshot.outstandingInstallments, 12);
});

test('createLoanFromCanonicalDataFactory persists DAG-selected results when primary parity succeeds', async () => {
  let persistedPayload;

  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Test' }));
  mock.method(models.Associate, 'findByPk', async () => null);
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Personal Loan 12%' }));
  mock.method(models.Loan, 'create', async (payload) => {
    persistedPayload = payload;
    return { id: 88, ...payload };
  });

  const createLoan = createLoanFromCanonicalDataFactory({
    calculationService: {
      calculate(input) {
        return {
          mode: 'primary',
          selectedSource: 'dag',
          result: {
            lateFeeMode: 'NONE',
            schedule: [{ installmentNumber: 1, scheduledPayment: 90 }],
            summary: {
              installmentAmount: 90,
              totalPayable: 90,
              totalPaid: 0,
              outstandingPrincipal: 80,
              outstandingInterest: 10,
              outstandingBalance: 90,
              outstandingInstallments: 1,
            },
          },
        };
      },
    },
  });

  const createdLoan = await createLoan({
    customerId: 1,
    amount: 90,
    interestRate: 12,
    termMonths: 1,
  });

  assert.equal(createdLoan.id, 88);
  assert.equal(persistedPayload.installmentAmount, 90);
  assert.equal(persistedPayload.totalPayable, 90);
  assert.equal(persistedPayload.financialSnapshot.outstandingBalance, 90);
  assert.equal(persistedPayload.emiSchedule[0].scheduledPayment, 90);
});

test('createLoanFromCanonicalDataFactory keeps canonical persistence on legacy fallback', async () => {
  let persistedPayload;

  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Test' }));
  mock.method(models.Associate, 'findByPk', async () => null);
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Personal Loan 12%' }));
  mock.method(models.Loan, 'create', async (payload) => {
    persistedPayload = payload;
    return { id: 89, ...payload };
  });

  const createLoan = createLoanFromCanonicalDataFactory({
    calculationService: {
      calculate() {
        return {
          mode: 'primary',
          selectedSource: 'legacy',
          fallbackReason: 'parity_mismatch',
          result: {
            lateFeeMode: 'NONE',
            schedule: [{ installmentNumber: 1, scheduledPayment: 100 }],
            summary: {
              installmentAmount: 100,
              totalPayable: 100,
              totalPaid: 0,
              outstandingPrincipal: 90,
              outstandingInterest: 10,
              outstandingBalance: 100,
              outstandingInstallments: 1,
            },
          },
        };
      },
    },
  });

  await createLoan({
    customerId: 1,
    amount: 100,
    interestRate: 12,
    termMonths: 1,
  });

  assert.equal(persistedPayload.financialSnapshot.outstandingBalance, 100);
  assert.equal(persistedPayload.installmentAmount, 100);
});

test('getCanonicalLoanView rebuilds legacy schedules without leaking through root services', () => {
  const loanView = getCanonicalLoanView({
    amount: 5000,
    interestRate: 10,
    termMonths: 5,
    startDate: '2026-01-01T00:00:00.000Z',
    emiSchedule: [],
    financialSnapshot: {},
  });

  assert.equal(loanView.schedule.length, 5);
  assert.equal(loanView.snapshot.outstandingInstallments, 5);
  assert.ok(loanView.snapshot.totalPayable > 5000);
});
