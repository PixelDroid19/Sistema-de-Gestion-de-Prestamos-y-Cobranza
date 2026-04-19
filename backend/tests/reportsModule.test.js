const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthorizationError } = require('@/utils/errorHandler');
const {
  createGetRecoveredLoans,
  createGetOutstandingLoans,
  createGetRecoveryReport,
  createGetDashboardSummary,
  createGetCustomerHistory,
  createGetCustomerCreditProfile,
  createGetCustomerCreditHistory,
  createExportCustomerHistory,
  createExportCustomerCreditProfile,
  createExportCustomerCreditHistory,
  createExportRecoveryReport,
  createGetAssociateProfitabilityReport,
  createExportAssociateProfitabilityReport,
  createGetCustomerProfitabilityReport,
  createGetLoanProfitabilityReport,
} = require('@/modules/reports/application/useCases');
const { createReportsModule } = require('@/modules/reports');

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

  await assert.rejects(() => getOutstandingLoans({ actor: { id: 2, role: 'customer' } }), (error) => {
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

test('customer report export use-cases return downloadable files', async () => {
  const exportCustomerHistory = createExportCustomerHistory({
    reportRepository: {
      async getCustomerHistory() {
        return {
          customer: { id: 7, name: 'Ana Customer' },
          loans: [{ id: 11, status: 'approved', createdAt: '2026-01-01T00:00:00.000Z' }],
          payments: [{ id: 12, status: 'completed', paymentDate: '2026-02-01T00:00:00.000Z', createdAt: '2026-02-01T00:00:00.000Z' }],
          documents: [],
          alerts: [],
          promises: [],
          notifications: [],
        };
      },
    },
  });
  const exportCustomerCreditProfile = createExportCustomerCreditProfile({
    reportRepository: {
      async getCustomerCreditProfileDataset() {
        return {
          customer: { id: 7, name: 'Ana Customer' },
          loans: [{ id: 11, customerId: 7, status: 'active' }],
          payments: [{ id: 12, loanId: 11, amount: 100, status: 'completed', paymentDate: '2026-02-01T00:00:00.000Z' }],
          documents: [{ id: 18 }],
          alerts: [],
          promises: [],
          notifications: [],
        };
      },
    },
  });
  const exportCustomerCreditHistory = createExportCustomerCreditHistory({
    paymentRepository: {
      async listByLoan() {
        return [{ id: 1, amount: 120, paymentType: 'installment', status: 'completed', paymentDate: '2026-02-15T00:00:00.000Z' }];
      },
    },
    loanViewService: {
      getSnapshot() {
        return { outstandingBalance: 80, totalPaid: 120 };
      },
    },
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return { id: 22, customerId: 7, status: 'active', closedAt: null, closureReason: null };
      },
    },
  });

  const [historyFile, profileFile, loanFile] = await Promise.all([
    exportCustomerHistory({ actor: { id: 1, role: 'admin' }, customerId: 7, format: 'pdf' }),
    exportCustomerCreditProfile({ actor: { id: 1, role: 'admin' }, customerId: 7, format: 'pdf' }),
    exportCustomerCreditHistory({ actor: { id: 7, role: 'customer' }, loanId: 22, format: 'pdf' }),
  ]);

  assert.equal(historyFile.fileName, 'customer-7-history.pdf');
  assert.equal(historyFile.contentType, 'application/pdf');
  assert.equal(historyFile.buffer.includes(Buffer.from('%PDF-1.4', 'utf8')), true);
  assert.equal(profileFile.fileName, 'customer-7-credit-profile.pdf');
  assert.equal(profileFile.contentType, 'application/pdf');
  assert.equal(profileFile.buffer.includes(Buffer.from('%PDF-1.4', 'utf8')), true);
  assert.equal(loanFile.fileName, 'loan-22-credit-history.pdf');
  assert.equal(loanFile.contentType, 'application/pdf');
  assert.equal(loanFile.buffer.includes(Buffer.from('%PDF-1.4', 'utf8')), true);
});

test('createGetDashboardSummary aggregates dashboard sections and degrades to empty sections on repository failure', async () => {
  const getDashboardSummary = createGetDashboardSummary({
    reportRepository: {
      async getDashboardSummary() {
        return {
          loans: [{ id: 1, status: 'active', amount: 1200, recoveryStatus: 'pending', disbursedAt: '2024-01-15T00:00:00.000Z' }],
          payments: [{ id: 2, amount: 100, status: 'completed', paymentDate: '2024-02-10T00:00:00.000Z' }],
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
  assert.ok(summary.data.monthlyPerformance.length >= 12);
  assert.equal(summary.data.monthlyPerformance.some((entry) => entry.month === '2024-01'), true);
  assert.equal(summary.data.monthlyPerformance.some((entry) => entry.month === '2024-02'), true);

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

test('createGetCustomerCreditProfile returns completeness flags and servicing notes', async () => {
  const getCustomerCreditProfile = createGetCustomerCreditProfile({
    reportRepository: {
      async getCustomerCreditProfileDataset() {
        return {
          customer: { id: 7, name: 'Ana Customer' },
          loans: [{ id: 11, customerId: 7, status: 'active' }],
          payments: [{ id: 12, loanId: 11, amount: 100, status: 'completed', paymentDate: '2026-02-01T00:00:00.000Z' }],
          documents: [],
          alerts: [{ id: 14, status: 'active', notes: 'Called customer', updatedAt: '2026-03-02T00:00:00.000Z' }],
          promises: [{ id: 15, status: 'pending', notes: 'Pay on Friday', createdAt: '2026-03-03T00:00:00.000Z', statusHistory: [] }],
          notifications: [],
        };
      },
    },
  });

  const profile = await getCustomerCreditProfile({ actor: { id: 1, role: 'admin' }, customerId: 7 });

  assert.equal(profile.data.customer.id, 7);
  assert.equal(profile.data.profile.summary.activeLoans, 1);
  assert.equal(profile.data.profile.completeness.isComplete, false);
  assert.match(profile.data.profile.completeness.missingSections.join(','), /supporting_documents/);
  assert.equal(profile.data.profile.servicingNotes.length, 2);
});

test('profitability reports reconcile customer and loan totals from shared calculations', async () => {
  const reportRepository = {
    async listProfitabilityDataset() {
      return {
        loans: [
          { id: 1, customerId: 7, amount: 1000, status: 'active', Customer: { name: 'Ana' }, financialSnapshot: { outstandingBalance: 250 } },
          { id: 2, customerId: 7, amount: 500, status: 'closed', Customer: { name: 'Ana' }, financialSnapshot: { outstandingBalance: 0 } },
        ],
        payments: [
          { id: 1, loanId: 1, amount: 300, status: 'completed', principalApplied: 250, interestApplied: 40, penaltyApplied: 10, paymentDate: '2026-03-01T00:00:00.000Z' },
          { id: 2, loanId: 2, amount: 550, status: 'completed', principalApplied: 500, interestApplied: 50, penaltyApplied: 0, paymentDate: '2026-03-02T00:00:00.000Z' },
        ],
      };
    },
  };

  const customerReport = await createGetCustomerProfitabilityReport({ reportRepository })({ actor: { id: 1, role: 'admin' } });
  const loanReport = await createGetLoanProfitabilityReport({ reportRepository })({ actor: { id: 1, role: 'admin' } });

  assert.equal(customerReport.data.customers.length, 1);
  assert.equal(customerReport.summary.totalProfit, '100.00');
  assert.equal(loanReport.summary.totalProfit, '100.00');
  assert.equal(customerReport.data.customers[0].totalCollected, '850.00');
  assert.equal(loanReport.data.loans[0].customerName, 'Ana');
});

test('profitability reports return empty summaries when the dataset has no loans or posted payments', async () => {
  const reportRepository = {
    async listProfitabilityDataset() {
      return {
        loans: [],
        payments: [],
      };
    },
  };

  const customerReport = await createGetCustomerProfitabilityReport({ reportRepository })({ actor: { id: 1, role: 'admin' } });
  const loanReport = await createGetLoanProfitabilityReport({ reportRepository })({ actor: { id: 1, role: 'admin' } });

  assert.equal(customerReport.count, 0);
  assert.deepEqual(customerReport.data.customers, []);
  assert.equal(customerReport.summary.totalCollected, '0.00');
  assert.equal(customerReport.summary.totalProfit, '0.00');
  assert.equal(loanReport.count, 0);
  assert.deepEqual(loanReport.data.loans, []);
  assert.equal(loanReport.summary.totalCollected, '0.00');
  assert.equal(loanReport.summary.totalProfit, '0.00');
});

test('profitability reports keep zero-activity loans and customers non-profitable', async () => {
  const reportRepository = {
    async listProfitabilityDataset() {
      return {
        loans: [
          {
            id: 31,
            customerId: 7,
            amount: 1200,
            status: 'approved',
            Customer: { name: 'Ana' },
            financialSnapshot: { outstandingBalance: 1200 },
          },
        ],
        payments: [
          {
            id: 91,
            loanId: 31,
            amount: 100,
            status: 'pending',
            principalApplied: 0,
            interestApplied: 0,
            penaltyApplied: 0,
            paymentDate: '2026-03-01T00:00:00.000Z',
          },
        ],
      };
    },
  };

  const customerReport = await createGetCustomerProfitabilityReport({ reportRepository })({ actor: { id: 1, role: 'admin' } });
  const loanReport = await createGetLoanProfitabilityReport({ reportRepository })({ actor: { id: 1, role: 'admin' } });

  assert.equal(customerReport.count, 1);
  assert.equal(customerReport.data.customers[0].totalCollected, '0.00');
  assert.equal(customerReport.data.customers[0].totalProfit, '0.00');
  assert.equal(customerReport.data.customers[0].profitableLoanCount, 0);
  assert.equal(loanReport.count, 1);
  assert.equal(loanReport.data.loans[0].paymentCount, 0);
  assert.equal(loanReport.data.loans[0].totalCollected, '0.00');
  assert.equal(loanReport.data.loans[0].totalProfit, '0.00');
  assert.equal(loanReport.data.loans[0].profitable, false);
});

test('profitability reports use repository-level paged queries when pagination is requested', async () => {
  const calls = [];
  const reportRepository = {
    async listProfitabilityDataset() {
      calls.push('listProfitabilityDataset');
      return {
        loans: [
          { id: 1, customerId: 7, amount: 1000, status: 'active', Customer: { name: 'Ana' }, financialSnapshot: { outstandingBalance: 250 } },
          { id: 2, customerId: 8, amount: 500, status: 'closed', Customer: { name: 'Luis' }, financialSnapshot: { outstandingBalance: 0 } },
        ],
        payments: [
          { id: 1, loanId: 1, amount: 300, status: 'completed', principalApplied: 250, interestApplied: 40, penaltyApplied: 10, paymentDate: '2026-03-01T00:00:00.000Z' },
          { id: 2, loanId: 2, amount: 550, status: 'completed', principalApplied: 500, interestApplied: 50, penaltyApplied: 0, paymentDate: '2026-03-02T00:00:00.000Z' },
        ],
      };
    },
    async listCustomerProfitabilityPage({ page, pageSize }) {
      calls.push(['listCustomerProfitabilityPage', page, pageSize]);
      return {
        items: {
          customers: [{ id: 7, name: 'Ana' }],
          loans: [{ id: 1, customerId: 7, amount: 1000, status: 'active', Customer: { name: 'Ana' }, financialSnapshot: { outstandingBalance: 250 } }],
          payments: [{ id: 1, loanId: 1, amount: 300, status: 'completed', principalApplied: 250, interestApplied: 40, penaltyApplied: 10, paymentDate: '2026-03-01T00:00:00.000Z' }],
        },
        pagination: { page: 2, pageSize: 1, totalItems: 2, totalPages: 2 },
      };
    },
    async listLoanProfitabilityPage({ page, pageSize }) {
      calls.push(['listLoanProfitabilityPage', page, pageSize]);
      return {
        items: {
          loans: [{ id: 1, customerId: 7, amount: 1000, status: 'active', Customer: { name: 'Ana' }, financialSnapshot: { outstandingBalance: 250 } }],
          payments: [{ id: 1, loanId: 1, amount: 300, status: 'completed', principalApplied: 250, interestApplied: 40, penaltyApplied: 10, paymentDate: '2026-03-01T00:00:00.000Z' }],
        },
        pagination: { page: 2, pageSize: 1, totalItems: 2, totalPages: 2 },
      };
    },
  };

  const customerReport = await createGetCustomerProfitabilityReport({ reportRepository })({
    actor: { id: 1, role: 'admin' },
    pagination: { page: 2, pageSize: 1, limit: 1, offset: 1 },
  });
  const loanReport = await createGetLoanProfitabilityReport({ reportRepository })({
    actor: { id: 1, role: 'admin' },
    pagination: { page: 2, pageSize: 1, limit: 1, offset: 1 },
  });

  assert.deepEqual(calls, [
    'listProfitabilityDataset',
    ['listCustomerProfitabilityPage', 2, 1],
    'listProfitabilityDataset',
    ['listLoanProfitabilityPage', 2, 1],
  ]);
  assert.equal(customerReport.data.customers.length, 1);
  assert.deepEqual(customerReport.data.pagination, { page: 2, pageSize: 1, totalItems: 2, totalPages: 2 });
  assert.equal(loanReport.data.loans.length, 1);
  assert.deepEqual(loanReport.data.pagination, { page: 2, pageSize: 1, totalItems: 2, totalPages: 2 });
});

test('createExportRecoveryReport returns a CSV attachment contract', async () => {
  const exportRecoveryReport = createExportRecoveryReport({
    reportRepository: {
      async listRecoveryLoans() {
        return [{ id: 7, status: 'closed', recoveryStatus: 'recovered', Customer: { name: 'Ana' }, amount: 500, totalPaid: 500 }];
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
  assert.match(exportFile.buffer.toString('utf8'), /recovered,7,Ana/);
});

test('createExportRecoveryReport returns a valid PDF attachment contract', async () => {
  const exportRecoveryReport = createExportRecoveryReport({
    reportRepository: {
      async listRecoveryLoans() {
        return [{ id: 7, status: 'closed', recoveryStatus: 'recovered', Customer: { name: 'Ana' }, amount: 500, totalPaid: 500 }];
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
  assert.match(exportFile.buffer.toString('utf8'), /CrediCobranza Recovery Report/);
});

test('createExportRecoveryReport returns a valid XLSX attachment contract', async () => {
  const exportRecoveryReport = createExportRecoveryReport({
    reportRepository: {
      async listRecoveryLoans() {
        return [{ id: 7, status: 'closed', recoveryStatus: 'recovered', Customer: { name: 'Ana' }, amount: 500, totalPaid: 500 }];
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

test('createReportsModule consumes shared auth and credits ports from runtime', () => {
  let requestedModuleName;

  const moduleRegistration = createReportsModule({
    sharedRuntime: {
      authContext: {
        tokenService: { sign() {}, verify() {} },
        authMiddleware() {
          return (req, res, next) => next();
        },
      },
      getModulePorts(name) {
        requestedModuleName = name;
        if (name === 'credits') {
          return {
            loanViewService: { getSnapshot() { return { outstandingBalance: 0 }; } },
            loanAccessPolicy: { findAuthorizedLoan() {} },
          };
        }
        return null;
      },
    },
  });

  assert.equal(requestedModuleName, 'credits');
  assert.equal(moduleRegistration.basePath, '/api/reports');
});
