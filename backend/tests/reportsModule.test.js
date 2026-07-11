const test = require('node:test');
const { extractPdfText } = require('./helpers/pdfText');
const assert = require('node:assert/strict');

const { AuthorizationError } = require('@/utils/errorHandler');
const {
  createGetOutstandingLoans,
  createGetDashboardSummary,
  createGetCustomerHistory,
  createGetCustomerCreditProfile,
  createGetCustomerCreditHistory,
  createExportCustomerCreditHistory,
  createExportOutstandingReport,
  createGetPayoutsReport,
  createExportPayoutsExcel,
} = require('@/modules/reports/application/useCases');
const { createReportsModule } = require('@/modules/reports');

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

test('customer credit history exports preserve recorded values when they are not catalog values', async () => {
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
  const pdfText = extractPdfText(pdfFile.buffer);

  assert.match(csvText, /adjustment_fee/);
  assert.match(csvText, /manual_hold/);
  assert.match(pdfText, /manual_hold/);
  assert.match(pdfText, /motivo de cierre/i);
  assert.doesNotMatch(`${csvText}\n${pdfText}`, /Tipo de pago no clasificado|Estado no clasificado/);
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
          associateContributions: [{ id: 8, amount: 500, status: 'completed' }],
          associateCapitalReturns: [{ id: 9, amount: 100, basis: { type: 'capital-return' } }],
          associateObligations: [{ id: 10, amount: 45, status: 'pending', dueDate: '2024-01-05T00:00:00.000Z' }],
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

  assert.deepEqual(summary.data.position, {
    availableCash: '-1145.00',
    receivables: '1100.00',
    capitalPlaced: '1040.00',
    associateCapital: '400.00',
    associateLiabilities: '45.00',
  });
  assert.equal(summary.data.period.collections, '100.00');
  assert.equal(summary.data.period.disbursements, '1200.00');
  assert.equal(summary.data.period.operatingExpenses, '15.00');
  assert.equal(summary.data.period.associatePayments, '30.00');
  assert.equal(summary.data.period.netResult, '-1145.00');
  assert.equal(summary.data.risk.delinquentLoans, 1);
  assert.equal(summary.data.risk.capitalAtRisk, '1040.00');
  assert.equal(summary.data.risk.overdueAssociateObligations, 1);
  assert.equal(summary.data.risk.overdueAssociateAmount, '45.00');
  assert.equal(summary.data.risk.arrearsRate, '100.00');
  assert.equal(summary.data.context.totalCustomers, 3);
  assert.equal(summary.data.context.pendingLoanInstallments, 1);
  assert.equal(summary.data.context.overdueLoanInstallments, 1);
  assert.ok(summary.data.trend.length >= 12);
  assert.equal(summary.data.trend.some((entry) => entry.month === '2024-01'), true);
  assert.equal(summary.data.trend.some((entry) => entry.month === '2024-02'), true);

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
  assert.equal(degraded.data.position.availableCash, '0.00');
  assert.equal(degraded.data.risk.delinquentLoans, 0);
  assert.deepEqual(degraded.data.trend, []);
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

const buildOutstandingExportDeps = () => ({
  reportRepository: {
    async listOutstandingLoans() {
      return [{
        id: 11,
        status: 'active',
        recoveryStatus: 'pending',
        Customer: { name: 'Ana' },
        amount: 1000,
        totalPaid: 300,
      }];
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
        totalPaid: 300,
        totalPayable: 1000,
        outstandingBalance: 700,
        outstandingPrincipal: 650,
        installmentAmount: 100,
        nextInstallment: null,
      };
    },
  },
});

test('createExportOutstandingReport returns a XLSX attachment with operator-facing labels', async () => {
  const exportOutstandingReport = createExportOutstandingReport(buildOutstandingExportDeps());

  const exportFile = await exportOutstandingReport({ actor: { id: 1, role: 'admin' }, format: 'xlsx' });

  assert.equal(exportFile.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(exportFile.fileName, /^cartera-por-cobrar-\d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.equal(exportFile.buffer.subarray(0, 2).toString('utf8'), 'PK');
});

test('createExportOutstandingReport returns a readable PDF summary', async () => {
  const exportOutstandingReport = createExportOutstandingReport(buildOutstandingExportDeps());

  const exportFile = await exportOutstandingReport({ actor: { id: 1, role: 'admin' }, format: 'pdf' });

  assert.equal(exportFile.contentType, 'application/pdf');
  assert.equal(exportFile.buffer.subarray(0, 4).toString('utf8'), '%PDF');
  const pdfText = extractPdfText(exportFile.buffer);
  assert.match(pdfText, /Cartera por cobrar/);
  assert.match(pdfText, /Ana/);
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
