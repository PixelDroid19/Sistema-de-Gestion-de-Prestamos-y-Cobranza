const { NotFoundError } = require('@/utils/errorHandler');
const { buildWorkbookBuffer, STYLE_COLORS } = require('./workbookBuilder');
const {
  ensureAdmin,
  formatMoney,
  formatDisplayMoney,
  parseDateRange,
} = require('./reportHelpers');
const {
  buildPdfBuffer,
  buildCsv,
  formatIsoDate,
  moneyColumn,
  buildMonthlyPerformanceSeries,
  buildCustomerHistoryTimeline,
  buildProfitabilityLoanRows,
  buildProfitabilitySummary,
  buildCustomerProfitabilityRows,
  buildCustomerProfitabilityAnalytics,
  buildProfitabilitySummaryFromDataset,
  buildServicingNotes,
  buildLoansWithDetails,
  paginateCollection,
} = require('./reportInternals');
const { MONEY_FORMAT } = require('./excelExportFormats');
const { formatOperationalStatus, formatPaymentType } = require('./reportLabels');

const createGetRecoveredLoans = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, pagination }) => {
  ensureAdmin(actor);
  const recoveredLoans = pagination
    ? await reportRepository.listRecoveredLoansPage(pagination)
    : await reportRepository.listRecoveredLoans();
  const rawLoans = recoveredLoans.items || recoveredLoans;
  const loansWithDetails = await buildLoansWithDetails({ loans: rawLoans, paymentRepository, loanViewService });
  // Summary totals must span the whole dataset, not just the current page.
  const summaryLoans = recoveredLoans.pagination
    ? await buildLoansWithDetails({ loans: await reportRepository.listRecoveredLoans(), paymentRepository, loanViewService })
    : loansWithDetails;
  const totalRecoveredAmount = summaryLoans.reduce((sum, loan) => sum + parseFloat(loan.totalPaid), 0);
  const totalLoansCount = recoveredLoans.pagination?.totalItems ?? summaryLoans.length;
  const paged = paginateCollection(loansWithDetails, recoveredLoans.pagination);

  return {
    success: true,
    count: totalLoansCount,
    summary: {
      totalRecoveredAmount: totalRecoveredAmount.toFixed(2),
      totalLoansCount,
      averageRecoveryAmount: totalLoansCount > 0 ? (totalRecoveredAmount / totalLoansCount).toFixed(2) : '0.00',
    },
    data: { loans: paged.items, ...(paged.pagination ? { pagination: paged.pagination } : {}) },
  };
};

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

const createGetRecoveryReport = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, pagination }) => {
  ensureAdmin(actor);
  const allLoans = pagination
    ? await reportRepository.listRecoveryLoansPage(pagination)
    : await reportRepository.listRecoveryLoans();
  const rawLoans = allLoans.items || allLoans;
  const loansWithDetails = await buildLoansWithDetails({ loans: rawLoans, paymentRepository, loanViewService });
  const recoveredLoans = loansWithDetails.filter((loan) => loan.recoveryBucket === 'recovered');
  const outstandingLoans = loansWithDetails.filter((loan) => loan.recoveryBucket === 'outstanding');
  const totalRecoveredAmount = recoveredLoans.reduce((sum, loan) => sum + parseFloat(loan.totalPaid), 0);
  const totalOutstandingAmount = outstandingLoans.reduce((sum, loan) => sum + parseFloat(loan.outstandingAmount), 0);
  const totalLoansAmount = loansWithDetails.reduce((sum, loan) => sum + parseFloat(loan.totalDue), 0);
  // Distinct KPI from the dashboard's recoveryRate (recovered principal / originated
  // principal): this is the collection rate over the recovery cohort — total amount
  // collected on settled loans divided by the total amount due (principal + interest).
  const collectionRate = totalLoansAmount > 0 ? ((totalRecoveredAmount / totalLoansAmount) * 100).toFixed(2) : '0.00';

  return {
    success: true,
    summary: {
      totalLoans: loansWithDetails.length,
      recoveredLoans: recoveredLoans.length,
      outstandingLoans: outstandingLoans.length,
      totalRecoveredAmount: totalRecoveredAmount.toFixed(2),
      totalOutstandingAmount: totalOutstandingAmount.toFixed(2),
      totalLoansAmount: totalLoansAmount.toFixed(2),
      collectionRate: `${collectionRate}%`,
      recoveryRate: `${collectionRate}%`,
    },
    data: {
      recoveredLoans,
      outstandingLoans,
      ...(allLoans.pagination ? { pagination: allLoans.pagination } : {}),
    },
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

const REPORT_ENTITY_LABELS = {
  loan: 'Crédito',
  payment: 'Pago',
  document: 'Documento',
  alert: 'Alerta',
  promise: 'Promesa',
  notification: 'Notificación',
};

const REPORT_STATUS_LABELS = {
  approved: 'Aprobado',
  active: 'Activo',
  closed: 'Cerrado',
  completed: 'Completado',
  defaulted: 'En mora',
  pending: 'Pendiente',
  broken: 'Incumplida',
  uploaded: 'Cargado',
  payoff: 'Pago total',
  installment: 'Cuota',
  partial: 'Parcial',
  capital: 'Abono a capital',
};

const PROFILE_MISSING_SECTION_LABELS = {
  payment_history: 'Historial de pagos',
  supporting_documents: 'Documentos de soporte',
  servicing_notes: 'Notas de seguimiento',
};

/**
 * Converts internal report event identifiers into operator-facing Spanish labels.
 *
 * Exported documents are operational artifacts, so they must avoid raw enum keys
 * even though the API payload keeps those keys for frontend logic.
 */
const formatReportEventLabel = (entry = {}) => {
  const [entityKey, ...statusParts] = String(entry.eventType || '').split('_');
  const statusKey = statusParts.join('_');
  const entityLabel = REPORT_ENTITY_LABELS[entry.entityType] || REPORT_ENTITY_LABELS[entityKey] || 'Movimiento';
  const statusLabel = REPORT_STATUS_LABELS[statusKey] || (statusKey ? formatOperationalStatus(statusKey) : 'Registrado');
  return `${entityLabel} ${statusLabel}`.trim();
};

const formatReportEntityLabel = (entry = {}) => REPORT_ENTITY_LABELS[entry.entityType] || 'Movimiento';

const formatMissingSections = (sections = []) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    return 'Ninguna';
  }
  return sections.map((section) => PROFILE_MISSING_SECTION_LABELS[section] || section).join('; ');
};

const formatYesNo = (value) => (value ? 'Sí' : 'No');

const createExportCustomerHistory = ({ reportRepository }) => async ({ actor, customerId, format = 'pdf' }) => {
  const history = await createGetCustomerHistory({ reportRepository })({ actor, customerId });
  const data = history.data;
  const timelinePreview = (data.timeline || []).slice(0, 6);

  if (String(format).toLowerCase() === 'csv') {
    const csv = buildCsv({
      headers: ['Tipo de evento', 'Entidad', 'Fecha'],
      rows: timelinePreview.map((entry) => [
        formatReportEventLabel(entry),
        formatReportEntityLabel(entry),
        formatIsoDate(entry.occurredAt),
      ]),
    });

    return {
      fileName: `customer-${data.customer.id}-history.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csv, 'utf8'),
    };
  }

  return {
    fileName: `customer-${data.customer.id}-history.pdf`,
    contentType: 'application/pdf',
    buffer: buildPdfBuffer({
      title: `Historial del cliente #${data.customer.id}`,
      lines: [
        `Cliente: ${data.customer.name || `#${data.customer.id}`}`,
        `Créditos: ${data.segments.loans.length}`,
        `Pagos: ${data.segments.payments.length}`,
        `Documentos: ${data.segments.documents.length}`,
        `Alertas: ${data.segments.alerts.length}`,
        `Promesas: ${data.segments.promises.length}`,
        `Notificaciones: ${data.segments.notifications.length}`,
        'Actividad reciente:',
        ...timelinePreview.map((entry) => `${formatIsoDate(entry.occurredAt)} | ${formatReportEntityLabel(entry)} | ${formatReportEventLabel(entry)}`),
      ],
    }),
  };
};

const createExportCustomerCreditProfile = ({ reportRepository }) => async ({ actor, customerId, format = 'pdf' }) => {
  const profile = await createGetCustomerCreditProfile({ reportRepository })({ actor, customerId });
  const data = profile.data;
  const summary = data.profile?.summary || {};
  const completeness = data.profile?.completeness || {};
  const profitability = data.profile?.profitability || null;
  const missingSections = Array.isArray(completeness.missingSections) && completeness.missingSections.length > 0
    ? formatMissingSections(completeness.missingSections)
    : 'Ninguna';

  if (String(format).toLowerCase() === 'csv') {
    const csv = buildCsv({
      headers: ['ID Cliente', 'Cliente', 'Créditos Totales', 'Créditos Activos', 'Pagos Completados', 'Alertas de Mora', 'Promesas Incumplidas', 'Total Pagado', 'Perfil Completo', 'Secciones Pendientes', 'Rentabilidad'],
      rows: [[
        data.customer.id,
        data.customer.name || '',
        summary.totalLoans || 0,
        summary.activeLoans || 0,
        summary.completedPayments || 0,
        summary.delinquentAlerts || 0,
        summary.brokenPromises || 0,
        summary.totalPaid || '0.00',
        formatYesNo(completeness.isComplete),
        missingSections,
        profitability?.totalProfit || '',
      ]],
    });

    return {
      fileName: `customer-${data.customer.id}-credit-profile.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csv, 'utf8'),
    };
  }

  return {
    fileName: `customer-${data.customer.id}-credit-profile.pdf`,
    contentType: 'application/pdf',
    buffer: buildPdfBuffer({
      title: `Perfil crediticio del cliente #${data.customer.id}`,
      lines: [
        `Cliente: ${data.customer.name || `#${data.customer.id}`}`,
        `Créditos totales: ${summary.totalLoans || 0}`,
        `Créditos activos: ${summary.activeLoans || 0}`,
        `Créditos cerrados: ${summary.closedLoans || 0}`,
        `Pagos completados: ${summary.completedPayments || 0}`,
        `Alertas de mora: ${summary.delinquentAlerts || 0}`,
        `Promesas incumplidas: ${summary.brokenPromises || 0}`,
        `Total pagado: ${formatDisplayMoney(summary.totalPaid || 0)}`,
        `Perfil completo: ${formatYesNo(completeness.isComplete)}`,
        `Secciones pendientes: ${missingSections}`,
        `Rentabilidad total: ${profitability ? formatDisplayMoney(profitability.totalProfit || 0) : 'N/A'}`,
      ],
    }),
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
    buffer: buildPdfBuffer({
      title: `Historial del crédito #${history.loan.id}`,
      lines: [
        `ID cliente: ${history.loan.customerId || 'N/A'}`,
        `Estado del crédito: ${formatOperationalStatus(history.loan.status)}`,
        `Saldo pendiente: ${formatDisplayMoney(history.snapshot?.outstandingBalance || 0)}`,
        `Total pagado: ${formatDisplayMoney(history.snapshot?.totalPaid || 0)}`,
        `Pagos registrados: ${history.payments?.length || 0}`,
        `Pagos totales registrados: ${history.payoffHistory?.length || 0}`,
        `Motivo de cierre: ${formatOperationalStatus(history.closure?.closureReason)}`,
        `Fecha de cierre: ${formatIsoDate(history.closure?.closedAt)}`,
      ],
    }),
  };
};

const buildRecoveryExportRows = (report) => ([
  ...report.data.recoveredLoans.map((loan) => ({
    section: 'Recuperados',
    creditId: loan.id,
    customer: loan.Customer?.name || '',
    amount: loan.amount,
    paid: loan.totalPaid,
    outstanding: loan.outstandingAmount,
    recoveryStatus: loan.recoveryStatus,
  })),
  ...report.data.outstandingLoans.map((loan) => ({
    section: 'Pendientes',
    creditId: loan.id,
    customer: loan.Customer?.name || '',
    amount: loan.amount,
    paid: loan.totalPaid,
    outstanding: loan.outstandingAmount,
    recoveryStatus: loan.recoveryStatus,
  })),
]);

const RECOVERY_EXPORT_COLUMNS = [
  { header: 'Sección', key: 'section', width: 16 },
  { header: 'ID Crédito', key: 'creditId', width: 12 },
  { header: 'Cliente', key: 'customer', width: 28 },
  { header: 'Monto Préstamo', key: 'amount', width: 18, numFmt: MONEY_FORMAT },
  { header: 'Total Pagado', key: 'paid', width: 18, numFmt: MONEY_FORMAT },
  { header: 'Saldo Pendiente', key: 'outstanding', width: 18, numFmt: MONEY_FORMAT },
  { header: 'Estado de Recuperación', key: 'recoveryStatus', width: 24 },
];

const CUSTOMER_PROFITABILITY_COLUMNS = [
  { header: 'ID Cliente', key: 'customerId', width: 12 },
  { header: 'Cliente', key: 'customerName', width: 28 },
  { header: 'Créditos Totales', key: 'loanCount', width: 16 },
  { header: 'Créditos Rentables', key: 'profitableLoanCount', width: 18 },
  { header: 'Créditos Activos', key: 'activeLoanCount', width: 16 },
  { header: 'Créditos Finalizados', key: 'closedLoanCount', width: 20 },
  { header: 'Créditos en Mora', key: 'overdueLoanCount', width: 18 },
  { header: 'Pagos Registrados', key: 'paymentCount', width: 18 },
  moneyColumn('Capital Prestado', 'originatedAmount', 20),
  moneyColumn('Total Recaudado', 'totalCollected', 20),
  moneyColumn('Capital Recuperado', 'principalCollected', 20),
  moneyColumn('Interés Cobrado', 'interestCollected', 20),
  moneyColumn('Mora Cobrada', 'penaltyCollected', 18),
  moneyColumn('Rentabilidad Total', 'totalProfit', 20),
  moneyColumn('Saldo en Cartera', 'outstandingBalance', 20),
  { header: 'Comportamiento de Pago', key: 'paymentBehavior', width: 24 },
  { header: 'Nivel de Riesgo', key: 'riskLevel', width: 18 },
];

const createExportRecoveryReport = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, format = 'csv' }) => {
  ensureAdmin(actor);
  const report = await createGetRecoveryReport({ reportRepository, paymentRepository, loanViewService })({ actor });
  const rows = buildRecoveryExportRows(report);

  if (format === 'pdf') {
    return {
      fileName: 'recovery-report.pdf',
      contentType: 'application/pdf',
      buffer: buildPdfBuffer({
        title: 'Reporte de recuperación CrediCobranza',
        lines: [
          `Créditos totales: ${report.summary.totalLoans}`,
          `Créditos recuperados: ${report.summary.recoveredLoans}`,
          `Créditos pendientes: ${report.summary.outstandingLoans}`,
          `Monto total recuperado: ${formatDisplayMoney(report.summary.totalRecoveredAmount || 0)}`,
          `Saldo total pendiente: ${formatDisplayMoney(report.summary.totalOutstandingAmount || 0)}`,
          `Tasa de cobro: ${report.summary.collectionRate}`,
        ],
      }),
    };
  }

  if (format === 'xlsx') {
    return {
      fileName: 'recovery-report.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await buildWorkbookBuffer([{
        name: 'Recuperación',
        title: 'REPORTE DE RECUPERACIÓN',
        tabColor: STYLE_COLORS.blue,
        headerFill: STYLE_COLORS.green,
        columns: RECOVERY_EXPORT_COLUMNS,
        rows,
      }]),
    };
  }

  const csv = buildCsv({
    headers: ['Sección', 'ID Crédito', 'Cliente', 'Monto Préstamo', 'Total Pagado', 'Saldo Pendiente', 'Estado de Recuperación'],
    rows: rows.map((row) => [row.section, row.creditId, row.customer, row.amount, row.paid, row.outstanding, row.recoveryStatus]),
  });

  return {
    fileName: 'recovery-report.csv',
    contentType: 'text/csv; charset=utf-8',
    buffer: Buffer.from(csv, 'utf8'),
  };
};

const createGetCustomerProfitabilityReport = ({ reportRepository }) => async ({ actor, filters = {}, pagination }) => {
  ensureAdmin(actor);

  const dateRange = parseDateRange(filters);

  if (pagination) {
    const [summaryDataset, pagedResult] = await Promise.all([
      reportRepository.listProfitabilityDataset(dateRange),
      reportRepository.listCustomerProfitabilityPage({
        ...dateRange,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    ]);

    const pagedCustomers = buildCustomerProfitabilityRows(
      buildProfitabilityLoanRows({
        loans: pagedResult.items.loans,
        payments: pagedResult.items.payments,
      }),
    );

    return {
      success: true,
      count: pagedResult.pagination.totalItems,
      summary: buildProfitabilitySummaryFromDataset(summaryDataset),
      data: {
        customers: pagedCustomers,
        pagination: pagedResult.pagination,
      },
    };
  }

  const { loans, payments } = await reportRepository.listProfitabilityDataset(dateRange);
  const loanRows = buildProfitabilityLoanRows({ loans, payments });
  const customerRows = buildCustomerProfitabilityRows(loanRows);

  return {
    success: true,
    count: customerRows.length,
    summary: {
      ...buildProfitabilitySummary(customerRows),
      customerAnalytics: buildCustomerProfitabilityAnalytics(customerRows),
    },
    data: {
      customers: customerRows,
    },
  };
};

const toMoneyNumber = (value) => {
  const normalized = String(value ?? '0').replace(/[^0-9.-]/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
};

const formatCustomerPaymentBehaviorForExport = (value) => {
  if (value === 'critical') return 'Crítico';
  if (value === 'delinquent') return 'Con mora';
  if (value === 'without_payments') return 'Sin pagos registrados';
  return 'Al día';
};

const formatCustomerRiskForExport = (value) => {
  if (value === 'high') return 'Alto';
  if (value === 'medium') return 'Medio';
  return 'Bajo';
};

const buildCustomerProfitabilityPdfLines = ({ report, rows }) => {
  const summary = report.summary || {};
  const analyticsSummary = summary.customerAnalytics?.summary || {};
  const topOutstanding = [...rows]
    .sort((left, right) => Number(right.outstandingBalance || 0) - Number(left.outstandingBalance || 0))
    .slice(0, 5);
  const delinquentRows = rows.filter((row) => Number(row.overdueLoanCount || 0) > 0 || Number(row.defaultedLoanCount || 0) > 0).slice(0, 5);

  return [
    `Clientes analizados: ${analyticsSummary.customerCount ?? rows.length}`,
    `Clientes morosos: ${analyticsSummary.delinquentCustomerCount ?? delinquentRows.length}`,
    `Clientes riesgo alto: ${analyticsSummary.highRiskCustomerCount ?? 0}`,
    `Rentabilidad total: ${formatDisplayMoney(summary.totalProfit || 0)}`,
    `Interés y mora cobrados: ${formatDisplayMoney(summary.totalCollected || 0)}`,
    `Saldo pendiente en cartera: ${formatDisplayMoney(summary.totalOutstandingBalance || 0)}`,
    'Clientes con mayor saldo pendiente:',
    ...(topOutstanding.length > 0
      ? topOutstanding.map((row) => `${row.customerName} | Saldo: ${formatDisplayMoney(row.outstandingBalance)} | Créditos: ${row.loanCount} | Riesgo: ${row.riskLevel}`)
      : ['Sin clientes con saldo pendiente.']),
    'Clientes morosos:',
    ...(delinquentRows.length > 0
      ? delinquentRows.map((row) => `${row.customerName} | Mora: ${row.overdueLoanCount} créditos | Comportamiento: ${row.paymentBehavior}`)
      : ['Sin clientes morosos en el rango.']),
  ];
};

const createExportCustomerProfitabilityReport = ({ reportRepository }) => async ({ actor, filters = {}, format = 'xlsx' }) => {
  const report = await createGetCustomerProfitabilityReport({ reportRepository })({ actor, filters });
  const rows = (report.data.customers || []).map((row) => ({
    customerId: row.customerId,
    customerName: row.customerName || `Cliente #${row.customerId || 'N/A'}`,
    loanCount: row.loanCount || 0,
    profitableLoanCount: row.profitableLoanCount || 0,
    originatedAmount: toMoneyNumber(row.originatedAmount),
    totalCollected: toMoneyNumber(row.totalCollected),
    principalCollected: toMoneyNumber(row.principalCollected),
    interestCollected: toMoneyNumber(row.interestCollected),
    penaltyCollected: toMoneyNumber(row.penaltyCollected),
    totalProfit: toMoneyNumber(row.totalProfit),
    outstandingBalance: toMoneyNumber(row.outstandingBalance),
    activeLoanCount: row.activeLoanCount || 0,
    closedLoanCount: row.closedLoanCount || 0,
    overdueLoanCount: row.overdueLoanCount || 0,
    defaultedLoanCount: row.defaultedLoanCount || 0,
    paymentCount: row.paymentCount || 0,
    paymentBehavior: formatCustomerPaymentBehaviorForExport(row.paymentBehavior),
    riskLevel: formatCustomerRiskForExport(row.riskLevel),
  }));

  if (String(format).toLowerCase() === 'pdf') {
    return {
      fileName: 'rentabilidad-clientes.pdf',
      contentType: 'application/pdf',
      buffer: buildPdfBuffer({
        title: 'Rentabilidad y riesgo por cliente',
        lines: buildCustomerProfitabilityPdfLines({ report, rows }),
      }),
    };
  }

  return {
    fileName: 'rentabilidad-clientes.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await buildWorkbookBuffer([{
      name: 'Rentabilidad Clientes',
      title: 'RENTABILIDAD POR CLIENTE',
      tabColor: STYLE_COLORS.teal,
      headerFill: STYLE_COLORS.teal,
      columns: CUSTOMER_PROFITABILITY_COLUMNS,
      rows,
    }]),
  };
};

const createGetLoanProfitabilityReport = ({ reportRepository }) => async ({ actor, filters = {}, pagination }) => {
  ensureAdmin(actor);

  const dateRange = parseDateRange(filters);

  if (pagination) {
    const [summaryDataset, pagedResult] = await Promise.all([
      reportRepository.listProfitabilityDataset(dateRange),
      reportRepository.listLoanProfitabilityPage({
        ...dateRange,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    ]);

    return {
      success: true,
      count: pagedResult.pagination.totalItems,
      summary: buildProfitabilitySummaryFromDataset(summaryDataset),
      data: {
        loans: buildProfitabilityLoanRows({
          loans: pagedResult.items.loans,
          payments: pagedResult.items.payments,
        }),
        pagination: pagedResult.pagination,
      },
    };
  }

  const { loans, payments } = await reportRepository.listProfitabilityDataset(dateRange);
  const loanRows = buildProfitabilityLoanRows({ loans, payments });

  return {
    success: true,
    count: loanRows.length,
    summary: buildProfitabilitySummary(loanRows),
    data: {
      loans: loanRows,
    },
  };
};

module.exports = {
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
  // New financial analytics use cases
  createGetCreditEarnings: require('./useCases/createGetCreditEarnings').createGetCreditEarnings,
  createGetInterestEarnings: require('./useCases/createGetInterestEarnings').createGetInterestEarnings,
  createGetMonthlyEarnings: require('./useCases/createGetMonthlyEarnings').createGetMonthlyEarnings,
  createGetMonthlyInterest: require('./useCases/createGetMonthlyInterest').createGetMonthlyInterest,
  createGetPerformanceAnalysis: require('./useCases/createGetPerformanceAnalysis').createGetPerformanceAnalysis,
  createGetExecutiveDashboard: require('./useCases/createGetExecutiveDashboard').createGetExecutiveDashboard,
  createGetComprehensiveAnalytics: require('./useCases/createGetComprehensiveAnalytics').createGetComprehensiveAnalytics,
  createGetComparativeAnalysis: require('./useCases/createGetComparativeAnalysis').createGetComparativeAnalysis,
  createGetForecastAnalysis: require('./useCases/createGetForecastAnalysis').createGetForecastAnalysis,
  createGetNextMonthProjection: require('./useCases/createGetNextMonthProjection').createGetNextMonthProjection,
  createGetFinancialAnalytics: require('./useCases/createGetFinancialAnalytics').createGetFinancialAnalytics,
  createExportFinancialAnalyticsReport: require('./useCases/createExportFinancialAnalyticsReport').createExportFinancialAnalyticsReport,
  // Excel export use cases
  createExportCreditsExcel: require('./useCases/createExportCreditsExcel').createExportCreditsExcel,
  createExportCreditsPdf: require('./useCases/createExportCreditsExcel').createExportCreditsPdf,
  createExportPayoutsExcel: require('./useCases/createExportPayoutsExcel').createExportPayoutsExcel,
  createExportPayoutsPdf: require('./useCases/createExportPayoutsExcel').createExportPayoutsPdf,
  // Enhanced reports use cases
  createGetPayoutsReport: require('./useCases/createGetPayoutsReport').createGetPayoutsReport,
  createGetPaymentSchedule: require('./useCases/createGetPaymentSchedule').createGetPaymentSchedule,
  createGetMonthlyCashFlow: require('./useCases/createMonthlyCashFlowReport').createGetMonthlyCashFlow,
  createGetDailyCashFlow: require('./useCases/createMonthlyCashFlowReport').createGetDailyCashFlow,
  createGetAnnualCashFlow: require('./useCases/createMonthlyCashFlowReport').createGetAnnualCashFlow,
  createExportMonthlyCashFlowExcel: require('./useCases/createMonthlyCashFlowReport').createExportMonthlyCashFlowExcel,
  createExportMonthlyCashFlowPdf: require('./useCases/createMonthlyCashFlowReport').createExportMonthlyCashFlowPdf,
  createExportOperatingExpensesReport: require('./useCases/createExportOperatingExpensesReport').createExportOperatingExpensesReport,
  createGetCreditHistoryAuditReport: require('./useCases/createCreditHistoryAuditReport').createGetCreditHistoryAuditReport,
  createListCreditHistoryFinancialProducts: require('./useCases/createCreditHistoryAuditReport').createListCreditHistoryFinancialProducts,
  createExportCreditHistoryAuditExcel: require('./useCases/createCreditHistoryAuditReport').createExportCreditHistoryAuditExcel,
  createExportCreditHistoryAuditPdf: require('./useCases/createCreditHistoryAuditReport').createExportCreditHistoryAuditPdf,
};
