const { NotFoundError } = require('@/utils/errorHandler');
const { buildReportPdf } = require('@/modules/shared/pdfReport');
const { buildWorkbookBuffer, STYLE_COLORS } = require('./workbookBuilder');
const {
  ensureAdmin,
  formatMoney,
  formatDisplayMoney,
} = require('./reportHelpers');
const {
  buildCsv,
  formatIsoDate,
  buildMonthlyPerformanceSeries,
  buildCustomerHistoryTimeline,
  buildProfitabilityLoanRows,
  buildCustomerProfitabilityRows,
  buildServicingNotes,
  buildLoansWithDetails,
  deriveLoanOverdueSnapshot,
  paginateCollection,
} = require('./reportInternals');
const { MONEY_FORMAT } = require('./excelExportFormats');
const { formatOperationalStatus, formatPaymentType } = require('./reportLabels');

const createGetOutstandingLoans = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, pagination }) => {
  ensureAdmin(actor);
  const outstandingLoans = pagination
    ? await reportRepository.listOutstandingLoansPage(pagination)
    : await reportRepository.listOutstandingLoans();
  const rawLoans = outstandingLoans.items || outstandingLoans;
  const loansWithDetails = await buildLoansWithDetails({ loans: rawLoans, paymentRepository, loanViewService });
  const outstandingLoansFiltered = loansWithDetails.filter((loan) => loan.recoveryBucket === 'outstanding');
  // Summary totals/counts must span the whole dataset (and the outstanding bucket),
  // not just the current page, so they don't disagree with the row data.
  const summaryLoans = outstandingLoans.pagination
    ? (await buildLoansWithDetails({ loans: await reportRepository.listOutstandingLoans(), paymentRepository, loanViewService }))
        .filter((loan) => loan.recoveryBucket === 'outstanding')
    : outstandingLoansFiltered;
  const totalOutstandingAmount = summaryLoans.reduce((sum, loan) => sum + parseFloat(loan.outstandingAmount), 0);
  const totalLoansCount = summaryLoans.length;
  const pendingCount = summaryLoans.filter((loan) => loan.recoveryStatus === 'pending').length;
  const inProgressCount = summaryLoans.filter((loan) => loan.recoveryStatus === 'in_progress').length;
  const paged = paginateCollection(outstandingLoansFiltered, outstandingLoans.pagination);

  return {
    success: true,
    count: totalLoansCount,
    summary: {
      totalOutstandingAmount: totalOutstandingAmount.toFixed(2),
      totalLoansCount,
      pendingCount,
      inProgressCount,
      averageOutstandingAmount: totalLoansCount > 0 ? (totalOutstandingAmount / totalLoansCount).toFixed(2) : '0.00',
    },
    data: { loans: paged.items, ...(paged.pagination ? { pagination: paged.pagination } : {}) },
  };
};

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getLoanSnapshot = (loan = {}) => (
  loan.financialSnapshot && typeof loan.financialSnapshot === 'object'
    ? loan.financialSnapshot
    : {}
);

const getLoanSchedule = (loan = {}) => {
  const snapshot = getLoanSnapshot(loan);
  if (Array.isArray(snapshot.schedule)) return snapshot.schedule;
  if (Array.isArray(snapshot.emiSchedule)) return snapshot.emiSchedule;
  if (Array.isArray(loan.emiSchedule)) return loan.emiSchedule;
  return [];
};

const getInstallmentOutstanding = (row = {}) => toFiniteNumber(
  row.remainingBalance
    ?? row.outstandingAmount
    ?? ((toFiniteNumber(row.remainingPrincipal) + toFiniteNumber(row.remainingInterest))),
);

const isInstallmentPaid = (row = {}) => (
  row.status === 'paid'
  || row.status === 'completed'
  || (toFiniteNumber(row.paidTotal) > 0 && getInstallmentOutstanding(row) <= 0.01)
);

const isInstallmentOverdue = (row = {}, now = new Date()) => {
  if (isInstallmentPaid(row)) return false;
  if (row.status === 'overdue') return true;
  if (!row.dueDate) return false;

  const dueDate = new Date(row.dueDate);
  return Number.isFinite(dueDate.getTime()) && dueDate < now;
};

const countInstallmentsByStatus = ({ loans = [], activeAlerts = [], now = new Date() }) => {
  let pendingInstallments = 0;
  let overdueInstallments = 0;
  let hasScheduleEvidence = false;

  loans.forEach((loan) => {
    const schedule = getLoanSchedule(loan);
    if (schedule.length === 0) return;
    hasScheduleEvidence = true;

    schedule.forEach((row) => {
      if (isInstallmentPaid(row)) return;
      if (isInstallmentOverdue(row, now)) {
        overdueInstallments += 1;
        return;
      }
      pendingInstallments += 1;
    });
  });

  if (!hasScheduleEvidence) {
    overdueInstallments = activeAlerts.filter((alert) => alert?.status === 'active').length;
    pendingInstallments = loans.reduce((sum, loan) => (
      sum + toFiniteNumber(getLoanSnapshot(loan).outstandingInstallments)
    ), 0);
  }

  return { pendingInstallments, overdueInstallments };
};

const createGetDashboardSummary = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor }) => {
  ensureAdmin(actor);

  const emptyResponse = {
    success: true,
      data: {
        summary: {
          totalLoans: 0,
          activeLoans: 0,
          delinquentLoans: 0,
          defaultedLoans: 0,
          recoveredLoans: 0,
          totalCustomers: 0,
          finalizedLoans: 0,
          overdueLoans: 0,
          pendingInstallments: 0,
          overdueInstallments: 0,
        totalPortfolioAmount: '0.00',
        totalRecoveredAmount: '0.00',
        totalOutstandingAmount: '0.00',
        totalOutstandingPrincipal: '0.00',
        totalInterestGenerated: '0.00',
        totalInterestPaid: '0.00',
        totalInterestPending: '0.00',
        recoveryRate: '0.00%',
        arrearsRate: '0.00%',
        totalAssociatePayments: '0.00',
        availableCash: '0.00',
        periodProfit: '0.00',
        periodLoss: '0.00',
      },
      collections: {
        overdueAlerts: 0,
        pendingPromises: 0,
        unreadNotifications: 0,
      },
      recentActivity: {
        loans: [],
        payments: [],
        alerts: [],
        promises: [],
        notifications: [],
      },
    },
  };

  try {
    const dashboard = await reportRepository.getDashboardSummary();
    const monthlyPerformance = buildMonthlyPerformanceSeries({
      loans: dashboard.loans || [],
      payments: dashboard.payments || [],
    });
    const loansWithDetails = await buildLoansWithDetails({
      loans: dashboard.loans || [],
      paymentRepository,
      loanViewService,
    });

    const totalPortfolioAmount = loansWithDetails.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
    const totalOutstandingAmount = loansWithDetails.reduce((sum, loan) => sum + Number(loan.outstandingAmount || 0), 0);
    const totalOutstandingPrincipal = loansWithDetails.reduce((sum, loan) => sum + Number(loan.outstandingPrincipalAmount || 0), 0);
    const totalInterestGenerated = loansWithDetails.reduce((sum, loan) => sum + Number(loan.totalInterestGenerated || 0), 0);
    const totalInterestPaid = loansWithDetails.reduce((sum, loan) => sum + Number(loan.totalInterestPaid || 0), 0);
    const completedPayments = (dashboard.payments || []).filter((payment) => !payment?.status || payment.status === 'completed');
    const totalPaymentInflow = completedPayments.reduce((sum, payment) => sum + toFiniteNumber(payment.amount), 0);
    const totalPrincipalRecovered = Math.max(
      completedPayments.reduce((sum, payment) => sum + toFiniteNumber(payment.principalApplied), 0),
      loansWithDetails.reduce((sum, loan) => sum + Number(loan.totalPrincipalRecovered || 0), 0),
    );
    const totalPenaltyPaid = completedPayments.reduce((sum, payment) => sum + toFiniteNumber(payment.penaltyApplied), 0);
    const totalOperatingExpenses = (dashboard.operatingExpenses || []).reduce((sum, expense) => sum + toFiniteNumber(expense.amount), 0);
    const totalAssociatePayments = (dashboard.associatePayments || []).reduce((sum, payment) => sum + toFiniteNumber(payment.amount), 0);
    // Delinquency is derived live from the canonical schedule (consistent with the
    // credits list/calendar and profitability), not from stale active-alert rows.
    const delinquentLoanCount = loansWithDetails.filter((loan) => loan.isOverdue).length;
    const installmentStatus = countInstallmentsByStatus({
      loans: loansWithDetails,
      activeAlerts: dashboard.alerts || [],
    });
    const totalOpenPortfolioLoans = loansWithDetails.filter((loan) => (
      !['closed', 'paid'].includes(loan.status) && loan.recoveryBucket !== 'recovered'
    )).length;
    const finalizedLoans = loansWithDetails.filter((loan) => (
      loan.status === 'closed' || loan.status === 'paid' || loan.recoveryBucket === 'recovered'
    )).length;
    const recoveryRate = totalPortfolioAmount > 0
      ? (totalPrincipalRecovered / totalPortfolioAmount) * 100
      : 0;
    const arrearsRate = totalOpenPortfolioLoans > 0
      ? (delinquentLoanCount / totalOpenPortfolioLoans) * 100
      : 0;
    const periodProfit = totalInterestPaid + totalPenaltyPaid - totalAssociatePayments - totalOperatingExpenses;
    const periodLoss = loansWithDetails
      .filter((loan) => loan.status === 'defaulted')
      .reduce((sum, loan) => sum + Number(loan.outstandingAmount || 0), 0);

    return {
      success: true,
      data: {
        summary: {
          totalLoans: loansWithDetails.length,
          activeLoans: loansWithDetails.filter((loan) => ['approved', 'active'].includes(loan.status)).length,
          delinquentLoans: delinquentLoanCount,
          overdueLoans: delinquentLoanCount,
          defaultedLoans: loansWithDetails.filter((loan) => loan.status === 'defaulted').length,
          recoveredLoans: loansWithDetails.filter((loan) => loan.recoveryBucket === 'recovered').length,
          finalizedLoans,
          totalCustomers: Number(dashboard.totalCustomers || 0),
          pendingInstallments: installmentStatus.pendingInstallments,
          overdueInstallments: installmentStatus.overdueInstallments,
          totalPortfolioAmount: totalPortfolioAmount.toFixed(2),
          totalRecoveredAmount: totalPrincipalRecovered.toFixed(2),
          totalOutstandingAmount: totalOutstandingAmount.toFixed(2),
          totalOutstandingPrincipal: totalOutstandingPrincipal.toFixed(2),
          totalInterestGenerated: totalInterestGenerated.toFixed(2),
          totalInterestPaid: totalInterestPaid.toFixed(2),
          totalInterestPending: Math.max(0, totalInterestGenerated - totalInterestPaid).toFixed(2),
          recoveryRate: `${recoveryRate.toFixed(2)}%`,
          arrearsRate: `${arrearsRate.toFixed(2)}%`,
          totalAssociatePayments: totalAssociatePayments.toFixed(2),
          availableCash: (totalPaymentInflow - totalPortfolioAmount - totalAssociatePayments - totalOperatingExpenses).toFixed(2),
          periodProfit: periodProfit.toFixed(2),
          periodLoss: periodLoss.toFixed(2),
        },
        monthlyPerformance,
        collections: {
          overdueAlerts: (dashboard.alerts || []).length,
          pendingPromises: (dashboard.promises || []).filter((promise) => promise.status === 'pending').length,
          unreadNotifications: (dashboard.notifications || []).filter((notification) => !notification.isRead).length,
        },
        recentActivity: {
          loans: loansWithDetails.slice(0, 5),
          payments: (dashboard.payments || []).slice(0, 5),
          alerts: (dashboard.alerts || []).slice(0, 5),
          promises: (dashboard.promises || []).slice(0, 5),
          notifications: (dashboard.notifications || []).slice(0, 5),
        },
      },
    };
  } catch (error) {
    const { logger } = require('@/utils/logger');
    logger.error('Failed to build dashboard summary; returning empty payload', { error: error?.message, stack: error?.stack });
    return emptyResponse;
  }
};

const createGetCustomerHistory = ({ reportRepository }) => async ({ actor, customerId }) => {
  ensureAdmin(actor);

  const history = await reportRepository.getCustomerHistory(customerId);
  if (!history.customer) {
    throw new NotFoundError('Customer');
  }

  return {
    success: true,
    data: {
      customer: history.customer,
      timeline: buildCustomerHistoryTimeline(history),
      segments: {
        loans: history.loans || [],
        payments: history.payments || [],
        documents: history.documents || [],
        alerts: history.alerts || [],
        promises: history.promises || [],
        notifications: history.notifications || [],
      },
    },
  };
};

const createGetCustomerCreditProfile = ({ reportRepository }) => async ({ actor, customerId }) => {
  ensureAdmin(actor);

  const history = await reportRepository.getCustomerCreditProfileDataset(customerId);
  if (!history.customer) {
    throw new NotFoundError('Customer');
  }

  const loans = history.loans || [];
  const payments = history.payments || [];
  const alerts = history.alerts || [];
  const promises = history.promises || [];
  const documents = history.documents || [];
  const activeLoans = loans.filter((loan) => ['approved', 'active', 'defaulted'].includes(loan.status));
  const closedLoans = loans.filter((loan) => loan.status === 'closed');
  const completedPayments = payments.filter((payment) => payment.status === 'completed');
  const activeAlerts = alerts.filter((alert) => alert.status === 'active');
  const brokenPromises = promises.filter((promise) => promise.status === 'broken');
  const missingSections = [
    completedPayments.length === 0 ? 'payment_history' : null,
    documents.length === 0 ? 'supporting_documents' : null,
    buildServicingNotes({ alerts, promises }).length === 0 ? 'servicing_notes' : null,
  ].filter(Boolean);

  const profitabilityRows = buildProfitabilityLoanRows({ loans, payments: completedPayments });
  const customerProfitability = buildCustomerProfitabilityRows(profitabilityRows)
    .find((row) => Number(row.customerId) === Number(customerId)) || null;

  return {
    success: true,
    data: {
      customer: history.customer,
      profile: {
        summary: {
          totalLoans: loans.length,
          activeLoans: activeLoans.length,
          closedLoans: closedLoans.length,
          completedPayments: completedPayments.length,
          delinquentAlerts: activeAlerts.length,
          brokenPromises: brokenPromises.length,
          totalPaid: formatMoney(completedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
        },
        completeness: {
          isComplete: missingSections.length === 0,
          missingSections,
          sections: {
            loanHistory: { status: loans.length > 0 ? 'complete' : 'missing', count: loans.length },
            paymentHistory: { status: completedPayments.length > 0 ? 'complete' : 'missing', count: completedPayments.length },
            supportingDocuments: { status: documents.length > 0 ? 'complete' : 'missing', count: documents.length },
            servicingNotes: { status: buildServicingNotes({ alerts, promises }).length > 0 ? 'complete' : 'missing', count: buildServicingNotes({ alerts, promises }).length },
          },
        },
        delinquency: {
          activeAlerts,
          brokenPromises,
          pendingPromises: promises.filter((promise) => promise.status === 'pending'),
        },
        servicingNotes: buildServicingNotes({ alerts, promises }),
        profitability: customerProfitability,
      },
      timeline: buildCustomerHistoryTimeline(history),
      segments: {
        loans,
        payments,
        alerts,
        promises,
        documents,
        notifications: history.notifications || [],
      },
    },
  };
};

const createGetCustomerCreditHistory = ({ paymentRepository, loanViewService, loanAccessPolicy, alertRepository, promiseRepository }) => async ({ actor, loanId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const [payments, alerts, promises] = await Promise.all([
    paymentRepository.listByLoan(loan.id),
    alertRepository?.listByLoan ? alertRepository.listByLoan(loan.id) : [],
    promiseRepository?.listByLoan ? promiseRepository.listByLoan(loan.id) : [],
  ]);
  const snapshot = loanViewService.getSnapshot(loan);
  const normalizedLoan = typeof loan.toJSON === 'function' ? loan.toJSON() : loan;
  const payoffPayments = payments.filter((payment) => payment.paymentType === 'payoff');

  return {
    loan: normalizedLoan,
    snapshot,
    payments,
    alerts,
    promises,
    payoffHistory: payoffPayments.map((payment) => ({
      id: payment.id,
      paymentDate: payment.paymentDate,
      paymentType: payment.paymentType,
      status: payment.status,
      payoff: payment.paymentMetadata?.payoff || null,
    })),
    closure: {
      status: normalizedLoan.status,
      closedAt: normalizedLoan.closedAt || null,
      closureReason: normalizedLoan.closureReason || null,
    },
  };
};

const createExportCustomerCreditHistory = ({ paymentRepository, loanViewService, loanAccessPolicy, alertRepository, promiseRepository }) => async ({ actor, loanId, format = 'pdf' }) => {
  const history = await createGetCustomerCreditHistory({ paymentRepository, loanViewService, loanAccessPolicy, alertRepository, promiseRepository })({ actor, loanId });

  if (String(format).toLowerCase() === 'csv') {
    const csv = buildCsv({
      headers: ['ID Pago', 'Fecha de pago', 'Tipo de pago', 'Estado', 'Monto'],
      rows: (history.payments || []).map((payment) => [
        payment.id,
        formatIsoDate(payment.paymentDate),
        formatPaymentType(payment.paymentType),
        formatOperationalStatus(payment.status),
        payment.amount || 0,
      ]),
    });

    return {
      fileName: `loan-${history.loan.id}-credit-history.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csv, 'utf8'),
    };
  }

  return {
    fileName: `loan-${history.loan.id}-credit-history.pdf`,
    contentType: 'application/pdf',
    buffer: await buildReportPdf({
      title: `Historial del crédito #${history.loan.id}`,
      subtitle: `Cliente #${history.loan.customerId || 'N/A'} · Estado: ${formatOperationalStatus(history.loan.status)}`,
      summary: [
        { label: 'Saldo pendiente', value: formatDisplayMoney(history.snapshot?.outstandingBalance || 0) },
        { label: 'Total pagado', value: formatDisplayMoney(history.snapshot?.totalPaid || 0) },
        { label: 'Motivo de cierre', value: formatOperationalStatus(history.closure?.closureReason) },
        { label: 'Fecha de cierre', value: formatIsoDate(history.closure?.closedAt) },
      ],
      sections: [{
        heading: 'Pagos registrados',
        table: {
          columns: [
            { header: 'Fecha', key: 'date', width: 90 },
            { header: 'Tipo de pago', key: 'type' },
            { header: 'Estado', key: 'status', width: 90 },
            { header: 'Monto', key: 'amount', width: 110, align: 'right', bold: true },
          ],
          rows: (history.payments || []).map((payment) => ({
            date: formatIsoDate(payment.paymentDate),
            type: formatPaymentType(payment.paymentType),
            status: formatOperationalStatus(payment.status),
            amount: formatDisplayMoney(payment.amount || 0),
          })),
        },
      }],
    }),
  };
};

const OUTSTANDING_EXPORT_COLUMNS = [
  { header: 'ID Crédito', key: 'creditId', width: 12 },
  { header: 'Cliente', key: 'customer', width: 28 },
  { header: 'Días de Atraso', key: 'daysOverdue', width: 14 },
  { header: 'Monto en Mora', key: 'overdueAmount', width: 18, numFmt: MONEY_FORMAT },
  { header: 'Saldo Pendiente', key: 'outstanding', width: 18, numFmt: MONEY_FORMAT },
  { header: 'Capital Restante', key: 'remainingCapital', width: 18, numFmt: MONEY_FORMAT },
  { header: 'Estado', key: 'status', width: 18 },
];

const buildOutstandingExportRows = (loans) => loans.map((loan) => {
  const overdue = deriveLoanOverdueSnapshot(loan);
  return {
    creditId: loan.id,
    customer: loan.Customer?.name || '',
    daysOverdue: overdue.daysOverdue,
    overdueAmount: Number(overdue.overdueAmount || 0),
    outstanding: Number(loan.outstandingAmount || 0),
    remainingCapital: Number(loan.outstandingPrincipalAmount || 0),
    status: formatOperationalStatus(loan.status),
  };
});

const createExportOutstandingReport = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, format = 'xlsx' }) => {
  ensureAdmin(actor);
  const report = await createGetOutstandingLoans({ reportRepository, paymentRepository, loanViewService })({ actor });
  const loans = report.data.loans || [];
  const rows = buildOutstandingExportRows(loans);
  const stamp = new Date().toISOString().slice(0, 10);

  if (String(format).toLowerCase() === 'pdf') {
    return {
      fileName: `cartera-por-cobrar-${stamp}.pdf`,
      contentType: 'application/pdf',
      buffer: await buildReportPdf({
        title: 'Cartera por cobrar',
        subtitle: 'Créditos con saldo pendiente por cobrar a la fecha.',
        summary: [
          { label: 'Créditos con saldo', value: report.summary.totalLoansCount },
          { label: 'Saldo total pendiente', value: formatDisplayMoney(report.summary.totalOutstandingAmount || 0) },
          { label: 'Saldo promedio por crédito', value: formatDisplayMoney(report.summary.averageOutstandingAmount || 0) },
        ],
        sections: [{
          heading: 'Detalle por crédito',
          table: {
            columns: [
              { header: 'Crédito', key: 'creditId', width: 55 },
              { header: 'Cliente', key: 'customer' },
              { header: 'Atraso', key: 'delay', width: 80 },
              { header: 'Saldo pendiente', key: 'outstanding', width: 95, align: 'right', bold: true },
              { header: 'Capital pendiente', key: 'remainingCapital', width: 95, align: 'right' },
            ],
            rows: rows.map((row) => ({
              creditId: `#${row.creditId}`,
              customer: row.customer || 'Sin cliente',
              delay: row.daysOverdue > 0 ? `${row.daysOverdue} días` : 'Al día',
              outstanding: formatDisplayMoney(row.outstanding),
              remainingCapital: formatDisplayMoney(row.remainingCapital),
            })),
          },
        }],
      }),
    };
  }

  return {
    fileName: `cartera-por-cobrar-${stamp}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await buildWorkbookBuffer([{
      name: 'Cartera',
      title: 'CARTERA POR COBRAR',
      tabColor: STYLE_COLORS.blue,
      headerFill: STYLE_COLORS.green,
      columns: OUTSTANDING_EXPORT_COLUMNS,
      rows,
    }]),
  };
};

module.exports = {
  createGetOutstandingLoans,
  createExportOutstandingReport,
  createGetDashboardSummary,
  createGetCustomerHistory,
  createGetCustomerCreditProfile,
  createGetCustomerCreditHistory,
  createExportCustomerCreditHistory,
  // Excel export use cases
  createExportCreditsExcel: require('./useCases/createExportCreditsExcel').createExportCreditsExcel,
  createExportPayoutsExcel: require('./useCases/createExportPayoutsExcel').createExportPayoutsExcel,
  createExportPayoutsPdf: require('./useCases/createExportPayoutsExcel').createExportPayoutsPdf,
  // Enhanced reports use cases
  createGetPayoutsReport: require('./useCases/createGetPayoutsReport').createGetPayoutsReport,
  createGetPaymentSchedule: require('./useCases/createGetPaymentSchedule').createGetPaymentSchedule,
  createGetMonthlyCashFlow: require('./useCases/createMonthlyCashFlowReport').createGetMonthlyCashFlow,
  createExportMonthlyCashFlowExcel: require('./useCases/createMonthlyCashFlowReport').createExportMonthlyCashFlowExcel,
  createExportMonthlyCashFlowPdf: require('./useCases/createMonthlyCashFlowReport').createExportMonthlyCashFlowPdf,
  createExportOperatingExpensesReport: require('./useCases/createExportOperatingExpensesReport').createExportOperatingExpensesReport,
  createGetCreditHistoryAuditReport: require('./useCases/createCreditHistoryAuditReport').createGetCreditHistoryAuditReport,
  createExportCreditHistoryAuditExcel: require('./useCases/createCreditHistoryAuditReport').createExportCreditHistoryAuditExcel,
  createExportCreditHistoryAuditPdf: require('./useCases/createCreditHistoryAuditReport').createExportCreditHistoryAuditPdf,
};
