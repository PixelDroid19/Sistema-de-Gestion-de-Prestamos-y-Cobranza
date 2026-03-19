const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthorizationError } = require('../src/utils/errorHandler');
const {
  createGetRecoveredLoans,
  createGetOutstandingLoans,
  createGetRecoveryReport,
} = require('../src/modules/reports/application/useCases');

test('createGetRecoveredLoans builds report records and summary totals', async () => {
  const getRecoveredLoans = createGetRecoveredLoans({
    reportRepository: {
      async listRecoveredLoans() {
        return [{ id: 4, status: 'closed', recoveryStatus: 'pending', totalPaid: 1200 }];
      },
    },
    paymentRepository: {
      async listByLoan() {
        return [{ id: 1, paymentDate: '2026-01-12' }];
      },
    },
    loanViewService: {
      getSnapshot() {
        return {
          totalPaid: 1200,
          totalPayable: 1500,
          outstandingBalance: 0,
          installmentAmount: 125,
          nextInstallment: null,
        };
      },
    },
  });

  const report = await getRecoveredLoans({ actor: { id: 1, role: 'admin' } });

  assert.equal(report.count, 1);
  assert.equal(report.summary.totalRecoveredAmount, '1200.00');
  assert.equal(report.data.loans[0].paymentCount, 1);
});

test('createGetOutstandingLoans rejects non-admin users', async () => {
  const getOutstandingLoans = createGetOutstandingLoans({
    reportRepository: {
      async listOutstandingLoans() {
        throw new Error('listOutstandingLoans should not be called');
      },
    },
    paymentRepository: {
      async listByLoan() {
        throw new Error('listByLoan should not be called');
      },
    },
    loanViewService: {
      getSnapshot() {
        throw new Error('getSnapshot should not be called');
      },
    },
  });

  await assert.rejects(() => getOutstandingLoans({ actor: { id: 2, role: 'agent' } }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    return true;
  });
});

test('createGetRecoveryReport preserves recovered and outstanding splits', async () => {
  const getRecoveryReport = createGetRecoveryReport({
    reportRepository: {
      async listRecoveryLoans() {
        return [
          { id: 7, status: 'closed', recoveryStatus: 'pending', totalPaid: 500 },
          { id: 8, status: 'defaulted', recoveryStatus: 'recovered', totalPaid: 100 },
        ];
      },
    },
    paymentRepository: {
      async listByLoan() {
        return [];
      },
    },
    loanViewService: {
      getSnapshot(loan) {
        return {
          totalPaid: loan.totalPaid,
          totalPayable: loan.id === 7 ? 500 : 800,
          outstandingBalance: loan.id === 7 ? 0 : 700,
          installmentAmount: 100,
          nextInstallment: null,
        };
      },
    },
  });

  const report = await getRecoveryReport({ actor: { id: 1, role: 'admin' } });

  assert.equal(report.summary.totalLoans, 2);
  assert.equal(report.summary.recoveredLoans, 1);
  assert.equal(report.summary.outstandingLoans, 1);
  assert.equal(report.summary.recoveryRate, '38.46%');
});

test('createGetOutstandingLoans classifies outstanding loans from canonical state instead of recoveryStatus flags', async () => {
  const getOutstandingLoans = createGetOutstandingLoans({
    reportRepository: {
      async listOutstandingLoans() {
        return [
          { id: 10, status: 'closed', recoveryStatus: 'pending', totalPaid: 900 },
          { id: 11, status: 'defaulted', recoveryStatus: 'recovered', totalPaid: 100 },
        ];
      },
    },
    paymentRepository: {
      async listByLoan() {
        return [];
      },
    },
    loanViewService: {
      getSnapshot(loan) {
        return {
          totalPaid: loan.totalPaid,
          totalPayable: loan.id === 10 ? 900 : 800,
          outstandingBalance: loan.id === 10 ? 0 : 700,
          installmentAmount: 100,
          nextInstallment: null,
        };
      },
    },
  });

  const report = await getOutstandingLoans({ actor: { id: 1, role: 'admin' } });

  assert.equal(report.count, 1);
  assert.equal(report.summary.totalOutstandingAmount, '700.00');
  assert.equal(report.summary.totalLoansCount, 1);
  assert.equal(report.data.loans[0].id, 11);
});
