const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

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
  createGetCustomerProfitabilityReport,
  createExportCustomerProfitabilityReport,
  createGetLoanProfitabilityReport,
  createGetPayoutsReport,
  createExportPayoutsExcel,
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
  assert.match(historyFile.buffer.toString('utf8'), /Historial del cliente #7/);
  assert.doesNotMatch(historyFile.buffer.toString('utf8'), /Customer History|Loans:|Payments:/);
  assert.equal(profileFile.fileName, 'customer-7-credit-profile.pdf');
  assert.equal(profileFile.contentType, 'application/pdf');
  assert.equal(profileFile.buffer.includes(Buffer.from('%PDF-1.4', 'utf8')), true);
  assert.match(profileFile.buffer.toString('utf8'), /Perfil crediticio del cliente #7/);
  assert.doesNotMatch(profileFile.buffer.toString('utf8'), /Customer Credit Profile|Total loans|Complete profile/);
  assert.equal(loanFile.fileName, 'loan-22-credit-history.pdf');
  assert.equal(loanFile.contentType, 'application/pdf');
  assert.equal(loanFile.buffer.includes(Buffer.from('%PDF-1.4', 'utf8')), true);
  assert.match(loanFile.buffer.toString('utf8'), /Historial del crédito #22/);
  assert.doesNotMatch(loanFile.buffer.toString('utf8'), /Loan Credit History|Customer ID|Outstanding balance/);
});

test('customer report CSV exports use Spanish operational headers', async () => {
  const reportRepository = {
    async getCustomerHistory() {
      return {
        customer: { id: 7, name: 'Ana Cliente' },
        loans: [{ id: 11, status: 'approved', createdAt: '2026-01-01T00:00:00.000Z' }],
        payments: [{ id: 12, status: 'completed', paymentDate: '2026-02-01T00:00:00.000Z', createdAt: '2026-02-01T00:00:00.000Z' }],
        documents: [],
        alerts: [],
        promises: [],
        notifications: [],
      };
    },
    async getCustomerCreditProfileDataset() {
      return {
        customer: { id: 7, name: 'Ana Cliente' },
        loans: [{ id: 11, customerId: 7, status: 'active' }],
        payments: [{ id: 12, loanId: 11, amount: 100, status: 'completed', paymentDate: '2026-02-01T00:00:00.000Z' }],
        documents: [{ id: 18 }],
        alerts: [],
        promises: [],
        notifications: [],
      };
    },
  };
  const exportCustomerHistory = createExportCustomerHistory({ reportRepository });
  const exportCustomerCreditProfile = createExportCustomerCreditProfile({ reportRepository });
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

  const [historyCsv, profileCsv, loanCsv] = await Promise.all([
    exportCustomerHistory({ actor: { id: 1, role: 'admin' }, customerId: 7, format: 'csv' }),
    exportCustomerCreditProfile({ actor: { id: 1, role: 'admin' }, customerId: 7, format: 'csv' }),
    exportCustomerCreditHistory({ actor: { id: 1, role: 'admin' }, loanId: 22, format: 'csv' }),
  ]);

  assert.match(historyCsv.buffer.toString('utf8'), /^Tipo de evento,Entidad,Fecha/);
  assert.match(profileCsv.buffer.toString('utf8'), /^ID Cliente,Cliente,Créditos Totales,Créditos Activos/);
  assert.match(loanCsv.buffer.toString('utf8'), /^ID Pago,Fecha de pago,Tipo de pago,Estado,Monto/);
  assert.doesNotMatch(
    `${historyCsv.buffer}\n${profileCsv.buffer}\n${loanCsv.buffer}`,
    /eventType|entityType|customerId|customerName|paymentId|paymentType|missingSections/,
  );
});

test('customer credit history exports use operational fallbacks instead of raw enum-like values', async () => {
  const exportCustomerCreditHistory = createExportCustomerCreditHistory({
    paymentRepository: {
      async listByLoan() {
        return [{
          id: 1,
          amount: 120,
          paymentType: 'adjustment_fee',
          status: 'manual_hold',
          paymentDate: '2026-02-15T00:00:00.000Z',
        }];
      },
    },
    loanViewService: {
      getSnapshot() {
        return { outstandingBalance: 80, totalPaid: 120 };
      },
    },
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return {
          id: 22,
          customerId: 7,
          status: 'manual_hold',
          closedAt: '2026-03-01T00:00:00.000Z',
          closureReason: 'written_off',
        };
      },
    },
  });

  const [csvFile, pdfFile] = await Promise.all([
    exportCustomerCreditHistory({ actor: { id: 1, role: 'admin' }, loanId: 22, format: 'csv' }),
    exportCustomerCreditHistory({ actor: { id: 1, role: 'admin' }, loanId: 22, format: 'pdf' }),
  ]);
  const csvText = csvFile.buffer.toString('utf8');
  const pdfText = pdfFile.buffer.toString('utf8');

  assert.match(csvText, /Tipo de pago no clasificado/);
  assert.match(csvText, /Estado no clasificado/);
  assert.match(pdfText, /Estado del crédito: Estado no clasificado/);
  assert.match(pdfText, /Motivo de cierre: Estado no clasificado/);
  assert.doesNotMatch(`${csvText}\n${pdfText}`, /manual_hold|adjustment_fee|written_off|manual hold|adjustment fee|written off/);
});

test('createGetDashboardSummary aggregates dashboard sections and degrades to empty sections on repository failure', async () => {
  const getDashboardSummary = createGetDashboardSummary({
    reportRepository: {
      async getDashboardSummary() {
        return {
          totalCustomers: 3,
          loans: [{
            id: 1,
            status: 'active',
            amount: 1200,
            recoveryStatus: 'pending',
            disbursedAt: '2024-01-15T00:00:00.000Z',
            emiSchedule: [
              { installmentNumber: 1, dueDate: '2024-01-10T00:00:00.000Z', remainingPrincipal: 80, remainingInterest: 20 },
              { installmentNumber: 2, dueDate: '2099-02-10T00:00:00.000Z', remainingPrincipal: 80, remainingInterest: 20 },
              { installmentNumber: 3, dueDate: '2099-03-10T00:00:00.000Z', remainingPrincipal: 0, remainingInterest: 0, status: 'paid' },
            ],
          }],
          payments: [{
            id: 2,
            amount: 100,
            status: 'completed',
            paymentDate: '2024-02-10T00:00:00.000Z',
            principalApplied: 60,
            interestApplied: 35,
            penaltyApplied: 5,
          }],
          alerts: [{ id: 3, loanId: 1, status: 'active' }],
          promises: [{ id: 4, status: 'pending' }],
          notifications: [{ id: 5, isRead: false }],
          operatingExpenses: [{ id: 6, amount: 15, status: 'completed' }],
          associatePayments: [{ id: 7, amount: 30, status: 'paid' }],
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
        return {
          totalPaid: 100,
          totalPaidPrincipal: 60,
          totalPayable: 1200,
          totalInterest: 180,
          totalPaidInterest: 35,
          outstandingPrincipal: 1040,
          outstandingBalance: 1100,
          installmentAmount: 100,
          nextInstallment: null,
        };
      },
    },
  });

  const summary = await getDashboardSummary({ actor: { id: 1, role: 'admin' } });

  assert.equal(summary.data.summary.totalLoans, 1);
  assert.equal(summary.data.summary.delinquentLoans, 1);
  assert.equal(summary.data.summary.defaultedLoans, 0);
  assert.equal(summary.data.summary.totalCustomers, 3);
  assert.equal(summary.data.summary.finalizedLoans, 0);
  assert.equal(summary.data.summary.pendingInstallments, 1);
  assert.equal(summary.data.summary.overdueInstallments, 1);
  assert.equal(summary.data.summary.totalRecoveredAmount, '60.00');
  assert.equal(summary.data.summary.totalOutstandingPrincipal, '1040.00');
  assert.equal(summary.data.summary.totalInterestGenerated, '180.00');
  assert.equal(summary.data.summary.totalInterestPaid, '35.00');
  assert.equal(summary.data.summary.totalInterestPending, '145.00');
  assert.equal(summary.data.summary.recoveryRate, '5.00%');
  assert.equal(summary.data.summary.arrearsRate, '100.00%');
  assert.equal(summary.data.summary.totalAssociatePayments, '30.00');
  assert.equal(summary.data.summary.availableCash, '-1145.00');
  assert.equal(summary.data.summary.periodProfit, '-5.00');
  assert.equal(summary.data.summary.periodLoss, '0.00');
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
    loanViewService: {
      getSnapshot() {
        return {
          totalPaid: 0,
          totalPayable: 0,
          totalInterest: 0,
          totalPaidInterest: 0,
          outstandingBalance: 0,
          installmentAmount: 0,
          nextInstallment: null,
        };
      },
    },
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
  assert.equal(customerReport.data.customers[0].activeLoanCount, 1);
  assert.equal(customerReport.data.customers[0].closedLoanCount, 1);
  assert.equal(customerReport.data.customers[0].paymentCount, 2);
  assert.equal(customerReport.data.customers[0].paymentBehavior, 'current');
  assert.equal(customerReport.data.customers[0].riskLevel, 'low');
  assert.equal(customerReport.summary.customerAnalytics.summary.customerCount, 1);
  assert.equal(loanReport.data.loans[0].customerName, 'Ana');
});

test('customer profitability report flags delinquent customers and risk from loan state', async () => {
  const reportRepository = {
    async listProfitabilityDataset() {
      return {
        loans: [
          { id: 1, customerId: 7, amount: 1000, status: 'overdue', Customer: { name: 'Ana' }, financialSnapshot: { outstandingBalance: 800 } },
          { id: 2, customerId: 7, amount: 500, status: 'defaulted', Customer: { name: 'Ana' }, financialSnapshot: { outstandingBalance: 400 } },
          { id: 3, customerId: 8, amount: 200, status: 'active', Customer: { name: 'Luis' }, financialSnapshot: { outstandingBalance: 200 } },
        ],
        payments: [
          { id: 1, loanId: 1, amount: 100, status: 'completed', principalApplied: 80, interestApplied: 20, penaltyApplied: 0, paymentDate: '2026-03-01T00:00:00.000Z' },
        ],
      };
    },
  };

  const report = await createGetCustomerProfitabilityReport({ reportRepository })({ actor: { id: 1, role: 'admin' } });
  const ana = report.data.customers.find((customer) => customer.customerName === 'Ana');
  const luis = report.data.customers.find((customer) => customer.customerName === 'Luis');

  assert.equal(ana.overdueLoanCount, 2);
  assert.equal(ana.defaultedLoanCount, 1);
  assert.equal(ana.isDelinquent, true);
  assert.equal(ana.paymentBehavior, 'critical');
  assert.equal(ana.riskLevel, 'high');
  assert.equal(luis.paymentBehavior, 'without_payments');
  assert.equal(luis.riskLevel, 'medium');
  assert.equal(report.summary.customerAnalytics.summary.delinquentCustomerCount, 1);
  assert.equal(report.summary.customerAnalytics.summary.highRiskCustomerCount, 1);
});

test('customer profitability Excel export uses the same values shown in profitability report', async () => {
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

  const exportFile = await createExportCustomerProfitabilityReport({ reportRepository })({
    actor: { id: 1, role: 'admin' },
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exportFile.buffer);
  const sheet = workbook.getWorksheet('Rentabilidad Clientes');

  assert.equal(exportFile.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.ok(sheet);
  assert.equal(sheet.getRow(2).values.includes('Interés Cobrado'), true);
  assert.equal(sheet.getRow(2).values.includes('Mora Cobrada'), true);
  assert.equal(sheet.getRow(2).values.includes('Rentabilidad Total'), true);
  assert.equal(sheet.getRow(3).getCell(2).value, 'Ana');
  assert.equal(sheet.getRow(3).getCell(12).value, '$ 90,00');
  assert.equal(sheet.getRow(3).getCell(13).value, '$ 10,00');
  assert.equal(sheet.getRow(3).getCell(14).value, '$ 100,00');
  assert.equal(sheet.getRow(3).getCell(16).value, 'Al día');
  assert.equal(sheet.getRow(3).getCell(17).value, 'Bajo');
});

test('customer profitability PDF export summarizes risk and balances', async () => {
  const reportRepository = {
    async listProfitabilityDataset() {
      return {
        loans: [
          { id: 1, customerId: 7, amount: 1000, status: 'defaulted', Customer: { name: 'Ana' }, financialSnapshot: { outstandingBalance: 250 } },
        ],
        payments: [
          { id: 1, loanId: 1, amount: 300, status: 'completed', principalApplied: 250, interestApplied: 40, penaltyApplied: 10, paymentDate: '2026-03-01T00:00:00.000Z' },
        ],
      };
    },
  };

  const exportFile = await createExportCustomerProfitabilityReport({ reportRepository })({
    actor: { id: 1, role: 'admin' },
    format: 'pdf',
  });

  assert.equal(exportFile.contentType, 'application/pdf');
  assert.equal(exportFile.fileName, 'rentabilidad-clientes.pdf');
  const pdfText = exportFile.buffer.toString('utf8');
  assert.match(pdfText, /Rentabilidad y riesgo por cliente/);
  assert.match(pdfText, /Clientes morosos: 1/);
  assert.match(pdfText, /Ana/);
});

test('customer profitability export rejects inverted date ranges before reading report data', async () => {
  let repositoryCalled = false;
  const exportCustomerProfitabilityReport = createExportCustomerProfitabilityReport({
    reportRepository: {
      async listProfitabilityDataset() {
        repositoryCalled = true;
        return { loans: [], payments: [] };
      },
    },
  });

  await assert.rejects(() => exportCustomerProfitabilityReport({
    actor: { id: 1, role: 'admin' },
    filters: { fromDate: '2026-05-31', toDate: '2026-05-01' },
  }), /fecha inicial debe ser anterior o igual a la fecha final/i);
  assert.equal(repositoryCalled, false);
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
  assert.equal(customerReport.data.customers[0].paymentBehavior, 'without_payments');
  assert.equal(customerReport.data.customers[0].riskLevel, 'medium');
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
  assert.match(exportFile.buffer.toString('utf8'), /Sección,ID Crédito,Cliente/);
  assert.match(exportFile.buffer.toString('utf8'), /Recuperados,7,Ana/);
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
  assert.match(exportFile.buffer.toString('utf8'), /Reporte de recuperación CrediCobranza/);
  assert.doesNotMatch(exportFile.buffer.toString('utf8'), /Recovery Report|Total loans|Recovered loans|Outstanding loans/);
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

test('createExportPayoutsExcel formats payout methods and states as operational report labels', async () => {
  const exportPayoutsExcel = createExportPayoutsExcel({
    paymentRepository: {
      async listPayoutsReport() {
        return {
          items: [{
            id: 7,
            loanId: 4,
            paymentDate: '2026-03-01T00:00:00.000Z',
            amount: 300,
            principalApplied: 250,
            interestApplied: 40,
            penaltyApplied: 10,
            remainingBalanceAfterPayment: 700,
            paymentType: 'installment',
            paymentMethod: 'cash',
            status: 'completed',
            Loan: {
              customerId: 10,
              Customer: {
                id: 10,
                name: 'Ana',
                email: 'ana@test.local',
              },
            },
            paymentMetadata: {
              reference: 'REC-7',
            },
            createdAt: '2026-03-01T10:00:00.000Z',
          }],
        };
      },
    },
  });

  const exportFile = await exportPayoutsExcel({ actor: { id: 1, role: 'admin' } });
  const [row] = exportFile.data.rows;

  assert.equal(row.paymentType, 'Cuota');
  assert.equal(row.paymentMethod, 'Efectivo');
  assert.equal(row.status, 'Completado');
  assert.notEqual(row.paymentMethod, 'cash');
});

test('payout reports normalize legacy reversed status to annulled payment records', async () => {
  const calls = [];
  const getPayoutsReport = createGetPayoutsReport({
    paymentRepository: {
      async listPayoutsReport(query) {
        calls.push(query);
        return {
          items: [{
            id: 9,
            amount: 0,
            principalApplied: 0,
            interestApplied: 0,
            penaltyApplied: 0,
            status: 'annulled',
          }],
          pagination: { totalItems: 1 },
        };
      },
    },
  });
  const exportPayoutsExcel = createExportPayoutsExcel({
    paymentRepository: {
      async listPayoutsReport(query) {
        calls.push(query);
        return {
          items: [],
        };
      },
    },
  });

  await getPayoutsReport({
    actor: { id: 1, role: 'admin' },
    filters: { status: 'reversed', employeeId: '7' },
  });
  await exportPayoutsExcel({
    actor: { id: 1, role: 'admin' },
    filters: { status: 'reversed', employeeId: '7' },
  });

  assert.equal(calls[0].status, 'annulled');
  assert.equal(calls[0].createdByUserId, 7);
  assert.equal(calls[1].status, 'annulled');
  assert.equal(calls[1].createdByUserId, 7);
  assert.equal(calls[2].status, 'annulled');
  assert.equal(calls[2].createdByUserId, 7);
});

test('payout report totals and installment collection periods use all filtered rows, not only the visible page', async () => {
  const getPayoutsReport = createGetPayoutsReport({
    paymentRepository: {
      async listPayoutsReport(query) {
        const filteredRows = [
          {
            id: 1,
            amount: 100,
            principalApplied: 70,
            interestApplied: 30,
            penaltyApplied: 0,
            status: 'completed',
            paymentType: 'installment',
            paymentDate: '2026-06-01T12:00:00.000Z',
          },
          {
            id: 2,
            amount: 200,
            principalApplied: 150,
            interestApplied: 50,
            penaltyApplied: 0,
            status: 'completed',
            paymentType: 'installment',
            paymentDate: '2026-06-03T12:00:00.000Z',
          },
          {
            id: 3,
            amount: 500,
            principalApplied: 500,
            interestApplied: 0,
            penaltyApplied: 0,
            status: 'completed',
            paymentType: 'capital',
            paymentDate: '2026-06-04T12:00:00.000Z',
          },
        ];

        if (query.pagination) {
          return {
            items: [filteredRows[0]],
            pagination: {
              page: query.pagination.page,
              pageSize: query.pagination.pageSize,
              totalItems: filteredRows.length,
              totalPages: 3,
            },
          };
        }

        return { items: filteredRows };
      },
    },
  });

  const report = await getPayoutsReport({
    actor: { id: 1, role: 'admin' },
    pagination: { page: 1, pageSize: 1 },
    filters: { status: 'completed' },
  });

  assert.equal(report.data.payouts.length, 1);
  assert.equal(report.summary.totalPayouts, 3);
  assert.equal(report.summary.totalAmount, '800.00');
  assert.equal(report.summary.totalInterest, '80.00');
  assert.deepEqual(report.summary.collectionBreakdown.daily.map((row) => [row.key, row.installmentCount, row.totalAmount]), [
    ['2026-06-03', 1, '200.00'],
    ['2026-06-01', 1, '100.00'],
  ]);
  assert.deepEqual(report.summary.collectionBreakdown.weekly.map((row) => [row.key, row.installmentCount, row.totalAmount]), [
    ['2026-06-01', 2, '300.00'],
  ]);
  assert.deepEqual(report.summary.collectionBreakdown.monthly.map((row) => [row.key, row.installmentCount, row.totalAmount]), [
    ['2026-06', 2, '300.00'],
  ]);
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
