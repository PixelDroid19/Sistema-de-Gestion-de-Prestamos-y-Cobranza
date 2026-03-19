const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthorizationError } = require('../src/utils/errorHandler');
const {
  createGetRecoveredLoans,
  createGetOutstandingLoans,
  createGetRecoveryReport,
  createGetDashboardSummary,
  createGetCustomerHistory,
  createGetCustomerCreditHistory,
  createExportRecoveryReport,
  createGetAssociateProfitabilityReport,
  createExportAssociateProfitabilityReport,
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

test('createGetCustomerCreditHistory returns canonical snapshot and payment history for an authorized actor', async () => {
  const getCustomerCreditHistory = createGetCustomerCreditHistory({
    reportRepository: {},
    paymentRepository: {
      async listByLoan() {
        return [
          { id: 1, amount: 120, paymentType: 'installment' },
          {
            id: 2,
            amount: 880,
            paymentType: 'payoff',
            paymentDate: '2026-03-15T00:00:00.000Z',
            status: 'completed',
            paymentMetadata: {
              payoff: {
                asOfDate: '2026-03-15',
                breakdown: { accruedInterest: 5.2 },
              },
            },
          },
        ];
      },
    },
    loanViewService: {
      getSnapshot() {
        return { outstandingBalance: 80, totalPaid: 120 };
      },
    },
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return { id: 22, customerId: 7, status: 'closed', closedAt: '2026-03-15T00:00:00.000Z', closureReason: 'payoff' };
      },
    },
  });

  const history = await getCustomerCreditHistory({ actor: { id: 7, role: 'customer' }, loanId: 22 });

  assert.equal(history.loan.id, 22);
  assert.equal(history.snapshot.totalPaid, 120);
  assert.equal(history.payments.length, 2);
  assert.equal(history.payoffHistory.length, 1);
  assert.equal(history.payoffHistory[0].payoff.asOfDate, '2026-03-15');
  assert.equal(history.closure.closureReason, 'payoff');
});

test('createGetCustomerCreditHistory does not surface quote-only activity when no payoff payment exists', async () => {
  const getCustomerCreditHistory = createGetCustomerCreditHistory({
    reportRepository: {},
    paymentRepository: {
      async listByLoan() {
        return [
          {
            id: 1,
            amount: 120,
            paymentType: 'installment',
            paymentDate: '2026-02-15T00:00:00.000Z',
            status: 'completed',
          },
        ];
      },
    },
    loanViewService: {
      getSnapshot() {
        return { outstandingBalance: 880, totalPaid: 120 };
      },
    },
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return { id: 22, customerId: 7, status: 'active', closedAt: null, closureReason: null };
      },
    },
  });

  const history = await getCustomerCreditHistory({ actor: { id: 7, role: 'customer' }, loanId: 22 });

  assert.equal(history.payments.length, 1);
  assert.equal(history.payoffHistory.length, 0);
  assert.equal(history.payments[0].paymentType, 'installment');
  assert.equal(history.closure.closureReason, null);
});

test('createGetDashboardSummary aggregates dashboard sections and degrades to empty sections on repository failure', async () => {
  const getDashboardSummary = createGetDashboardSummary({
    reportRepository: {
      async getDashboardSummary() {
        return {
          loans: [{ id: 1, status: 'active', amount: 1200, recoveryStatus: 'pending' }],
          payments: [{ id: 2, amount: 100 }],
          alerts: [{ id: 3, status: 'active' }],
          promises: [{ id: 4, status: 'pending' }],
          notifications: [{ id: 5, isRead: false }],
        };
      },
    },
    paymentRepository: {
      async listByLoan() {
        return [];
      },
    },
    loanViewService: {
      getSnapshot() {
        return { totalPaid: 100, totalPayable: 1200, outstandingBalance: 1100, installmentAmount: 100, nextInstallment: null };
      },
    },
  });

  const summary = await getDashboardSummary({ actor: { id: 1, role: 'admin' } });

  assert.equal(summary.data.summary.totalLoans, 1);
  assert.equal(summary.data.collections.overdueAlerts, 1);
  assert.equal(summary.data.collections.unreadNotifications, 1);

  const degradedGetDashboardSummary = createGetDashboardSummary({
    reportRepository: {
      async getDashboardSummary() {
        throw new Error('source unavailable');
      },
    },
    paymentRepository: { async listByLoan() { return []; } },
    loanViewService: { getSnapshot() { return { totalPaid: 0, totalPayable: 0, outstandingBalance: 0, installmentAmount: 0, nextInstallment: null }; } },
  });

  const degraded = await degradedGetDashboardSummary({ actor: { id: 1, role: 'admin' } });
  assert.equal(degraded.data.summary.totalLoans, 0);
  assert.deepEqual(degraded.data.recentActivity.loans, []);
});

test('createGetCustomerHistory returns normalized chronological history segments', async () => {
  const getCustomerHistory = createGetCustomerHistory({
    reportRepository: {
      async getCustomerHistory() {
        return {
          customer: { id: 7, name: 'Ana Customer' },
          loans: [{ id: 11, status: 'approved', createdAt: '2026-01-01T00:00:00.000Z' }],
          payments: [{ id: 12, status: 'completed', paymentDate: '2026-02-01T00:00:00.000Z', createdAt: '2026-02-01T00:00:00.000Z' }],
          documents: [{ id: 13, createdAt: '2026-03-01T00:00:00.000Z' }],
          alerts: [{ id: 14, status: 'active', createdAt: '2026-03-02T00:00:00.000Z' }],
          promises: [{ id: 15, status: 'pending', lastStatusChangedAt: '2026-03-03T00:00:00.000Z', createdAt: '2026-03-03T00:00:00.000Z' }],
          notifications: [{ id: 16, type: 'loan_assignment', createdAt: '2026-03-04T00:00:00.000Z' }],
        };
      },
    },
  });

  const history = await getCustomerHistory({ actor: { id: 1, role: 'admin' }, customerId: 7 });

  assert.equal(history.data.customer.id, 7);
  assert.equal(history.data.timeline[0].entityType, 'notification');
  assert.equal(history.data.segments.loans.length, 1);
});

test('createGetCustomerHistory rejects unknown customers', async () => {
  const getCustomerHistory = createGetCustomerHistory({
    reportRepository: {
      async getCustomerHistory() {
        return { customer: null, loans: [], payments: [], documents: [], alerts: [], promises: [], notifications: [] };
      },
    },
  });

  await assert.rejects(() => getCustomerHistory({ actor: { id: 1, role: 'admin' }, customerId: 99 }));
});

test('createGetCustomerHistory succeeds when some history segments are empty', async () => {
  const getCustomerHistory = createGetCustomerHistory({
    reportRepository: {
      async getCustomerHistory() {
        return {
          customer: { id: 7, name: 'Ana Customer' },
          loans: [{ id: 11, status: 'approved', createdAt: '2026-01-01T00:00:00.000Z' }],
          payments: [],
          documents: [],
          alerts: [],
          promises: [{ id: 15, status: 'pending', createdAt: '2026-03-03T00:00:00.000Z' }],
          notifications: [],
        };
      },
    },
  });

  const history = await getCustomerHistory({ actor: { id: 1, role: 'admin' }, customerId: 7 });

  assert.equal(history.success, true);
  assert.equal(history.data.customer.id, 7);
  assert.equal(history.data.timeline.length, 2);
  assert.deepEqual(history.data.segments.payments, []);
  assert.deepEqual(history.data.segments.documents, []);
  assert.deepEqual(history.data.segments.alerts, []);
  assert.deepEqual(history.data.segments.notifications, []);
});

test('createExportRecoveryReport returns a CSV attachment contract', async () => {
  const exportRecoveryReport = createExportRecoveryReport({
    reportRepository: {
      async listRecoveryLoans() {
        return [{ id: 7, status: 'closed', recoveryStatus: 'recovered', Customer: { name: 'Ana' }, Agent: { name: 'Rafa' }, amount: 500, totalPaid: 500 }];
      },
    },
    paymentRepository: {
      async listByLoan() {
        return [];
      },
    },
    loanViewService: {
      getSnapshot() {
        return { totalPaid: 500, totalPayable: 500, outstandingBalance: 0, installmentAmount: 100, nextInstallment: null };
      },
    },
  });

  const exportFile = await exportRecoveryReport({ actor: { id: 1, role: 'admin' }, format: 'csv' });

  assert.equal(exportFile.contentType, 'text/csv; charset=utf-8');
  assert.match(exportFile.buffer.toString('utf8'), /recovered,7,Ana,Rafa/);
});

test('createExportRecoveryReport returns a valid PDF attachment contract', async () => {
  const exportRecoveryReport = createExportRecoveryReport({
    reportRepository: {
      async listRecoveryLoans() {
        return [{ id: 7, status: 'closed', recoveryStatus: 'recovered', Customer: { name: 'Ana' }, Agent: { name: 'Rafa' }, amount: 500, totalPaid: 500 }];
      },
    },
    paymentRepository: {
      async listByLoan() {
        return [];
      },
    },
    loanViewService: {
      getSnapshot() {
        return { totalPaid: 500, totalPayable: 500, outstandingBalance: 0, installmentAmount: 100, nextInstallment: null };
      },
    },
  });

  const exportFile = await exportRecoveryReport({ actor: { id: 1, role: 'admin' }, format: 'pdf' });

  assert.equal(exportFile.contentType, 'application/pdf');
  assert.equal(exportFile.buffer.subarray(0, 4).toString('utf8'), '%PDF');
  assert.match(exportFile.buffer.toString('utf8'), /LendFlow Recovery Report/);
});

test('createExportRecoveryReport returns a valid XLSX attachment contract', async () => {
  const exportRecoveryReport = createExportRecoveryReport({
    reportRepository: {
      async listRecoveryLoans() {
        return [{ id: 7, status: 'closed', recoveryStatus: 'recovered', Customer: { name: 'Ana' }, Agent: { name: 'Rafa' }, amount: 500, totalPaid: 500 }];
      },
    },
    paymentRepository: {
      async listByLoan() {
        return [];
      },
    },
    loanViewService: {
      getSnapshot() {
        return { totalPaid: 500, totalPayable: 500, outstandingBalance: 0, installmentAmount: 100, nextInstallment: null };
      },
    },
  });

  const exportFile = await exportRecoveryReport({ actor: { id: 1, role: 'admin' }, format: 'xlsx' });

  assert.equal(exportFile.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(exportFile.buffer.subarray(0, 2).toString('utf8'), 'PK');
});

test('createGetAssociateProfitabilityReport scopes socio requests to their linked associate', async () => {
  const getAssociateProfitabilityReport = createGetAssociateProfitabilityReport({
    associateRepository: {
      async findById(id) {
        return { id, name: 'Partner One', participationPercentage: '25.0000' };
      },
      async findByLinkedUser() {
        return { id: 12, name: 'Partner One', participationPercentage: '25.0000' };
      },
      async listContributionsByAssociate() {
        return [{ id: 1, amount: 1000 }];
      },
      async listProfitDistributionsByAssociate() {
        return [{ id: 2, amount: 150, basis: { type: 'proportional-participation', sourceAmount: '600.00', allocatedAmount: '150.00', participationPercentage: '25.0000' } }];
      },
      async listLoansByAssociate() {
        return [{ id: 5, amount: 4000 }];
      },
    },
  });

  const report = await getAssociateProfitabilityReport({ actor: { id: 9, role: 'socio', associateId: 12 } });

  assert.equal(report.associate.id, 12);
  assert.equal(report.associate.participationPercentage, '25.0000');
  assert.equal(report.summary.totalContributed, '1000.00');
  assert.equal(report.summary.totalDistributed, '150.00');
  assert.equal(report.summary.participationPercentage, '25.0000');
  assert.equal(report.data.distributions[0].distributionType, 'proportional');
  assert.equal(report.data.distributions[0].declaredProportionalTotal, '600.00');
});

test('createGetAssociateProfitabilityReport rejects socio access to another associate by id', async () => {
  const getAssociateProfitabilityReport = createGetAssociateProfitabilityReport({
    associateRepository: {
      async findById(id) {
        return { id, name: 'Other Partner', participationPercentage: '75.0000' };
      },
      async findByLinkedUser() {
        return { id: 12, name: 'Partner One', participationPercentage: '25.0000' };
      },
      async listContributionsByAssociate() {
        throw new Error('listContributionsByAssociate should not be called');
      },
      async listProfitDistributionsByAssociate() {
        throw new Error('listProfitDistributionsByAssociate should not be called');
      },
      async listLoansByAssociate() {
        throw new Error('listLoansByAssociate should not be called');
      },
    },
  });

  await assert.rejects(() => getAssociateProfitabilityReport({
    actor: { id: 9, role: 'socio', associateId: 12 },
    associateId: 99,
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Socio users can only access their own profitability data');
    return true;
  });
});

test('createExportAssociateProfitabilityReport returns xlsx workbook for associate datasets', async () => {
  const exportAssociateProfitabilityReport = createExportAssociateProfitabilityReport({
    reportRepository: {
      async getAssociateExportDataset() {
        return {
          associate: { id: 12, participationPercentage: '25.0000' },
          contributions: [{ id: 1, amount: 1000, contributionDate: '2026-01-01' }],
          distributions: [{ id: 2, amount: 150, distributionDate: '2026-02-01', loanId: 5, basis: { type: 'proportional-participation', sourceAmount: '600.00', allocatedAmount: '150.00', participationPercentage: '25.0000' } }],
          loans: [{ id: 5, amount: 4000, status: 'active', Customer: { name: 'Ana' } }],
        };
      },
    },
    associateRepository: {
      async findById(id) {
        return { id, name: 'Partner One', participationPercentage: '25.0000' };
      },
      async findByLinkedUser() {
        return { id: 12, name: 'Partner One', participationPercentage: '25.0000' };
      },
      async listContributionsByAssociate() {
        return [{ id: 1, amount: 1000 }];
      },
      async listProfitDistributionsByAssociate() {
        return [{ id: 2, amount: 150 }];
      },
      async listLoansByAssociate() {
        return [{ id: 5, amount: 4000 }];
      },
    },
  });

  const exportFile = await exportAssociateProfitabilityReport({ actor: { id: 1, role: 'admin' }, associateId: 12, format: 'xlsx' });

  assert.equal(exportFile.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(exportFile.buffer.subarray(0, 2).toString('utf8'), 'PK');
});

test('createExportAssociateProfitabilityReport rejects socio export requests for another associate id', async () => {
  const exportAssociateProfitabilityReport = createExportAssociateProfitabilityReport({
    reportRepository: {
      async getAssociateExportDataset() {
        throw new Error('getAssociateExportDataset should not be called');
      },
    },
    associateRepository: {
      async findById(id) {
        return { id, name: 'Other Partner', participationPercentage: '75.0000' };
      },
      async findByLinkedUser() {
        return { id: 12, name: 'Partner One', participationPercentage: '25.0000' };
      },
      async listContributionsByAssociate() {
        throw new Error('listContributionsByAssociate should not be called');
      },
      async listProfitDistributionsByAssociate() {
        throw new Error('listProfitDistributionsByAssociate should not be called');
      },
      async listLoansByAssociate() {
        throw new Error('listLoansByAssociate should not be called');
      },
    },
  });

  await assert.rejects(() => exportAssociateProfitabilityReport({
    actor: { id: 9, role: 'socio', associateId: 12 },
    associateId: 99,
    format: 'xlsx',
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'Socio users can only access their own profitability data');
    return true;
  });
});

test('createExportAssociateProfitabilityReport includes proportional audit columns in csv exports', async () => {
  const exportAssociateProfitabilityReport = createExportAssociateProfitabilityReport({
    reportRepository: {
      async getAssociateExportDataset() {
        return {
          associate: { id: 12, participationPercentage: '25.0000' },
          contributions: [],
          distributions: [{ id: 2, amount: 150, distributionDate: '2026-02-01', loanId: 5, basis: { type: 'proportional-participation', sourceAmount: '600.00', allocatedAmount: '150.00', participationPercentage: '25.0000' } }],
          loans: [],
        };
      },
    },
    associateRepository: {
      async findById(id) {
        return { id, name: 'Partner One', participationPercentage: '25.0000' };
      },
      async listContributionsByAssociate() {
        return [];
      },
      async listProfitDistributionsByAssociate() {
        return [{ id: 2, amount: 150, basis: { type: 'proportional-participation', sourceAmount: '600.00', allocatedAmount: '150.00', participationPercentage: '25.0000' } }];
      },
      async listLoansByAssociate() {
        return [];
      },
    },
  });

  const exportFile = await exportAssociateProfitabilityReport({ actor: { id: 1, role: 'admin' }, associateId: 12, format: 'csv' });

  assert.equal(exportFile.contentType, 'text/csv; charset=utf-8');
  assert.match(exportFile.buffer.toString('utf8'), /participationPercentage,distributionType,declaredProportionalTotal,allocatedAmount/);
  assert.match(exportFile.buffer.toString('utf8'), /25.0000,proportional,600.00,150.00/);
});
