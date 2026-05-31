const { AuthorizationError, NotFoundError } = require('@/utils/errorHandler');
const { normalizeDistributionRecord } = require('@/modules/associates/application/useCases');
const { buildWorkbookBuffer, STYLE_COLORS } = require('./workbookBuilder');
const {
  ensureAdmin,
  formatMoney,
  parseDateRange,
} = require('./reportHelpers');
const {
  buildPdfBuffer,
  buildCsv,
  formatIsoDate,
  moneyColumn,
  dateColumn,
  buildMonthlyPerformanceSeries,
  buildCustomerHistoryTimeline,
  buildProfitabilityLoanRows,
  buildProfitabilitySummary,
  buildCustomerProfitabilityRows,
  buildProfitabilitySummaryFromDataset,
  buildServicingNotes,
  buildLoansWithDetails,
  paginateCollection,
  normalizeParticipationPercentage,
  normalizeAssociateRecord,
} = require('./reportInternals');
const { formatOperationalStatus, formatPaymentType } = require('./reportLabels');

const ASSOCIATE_PROFITABILITY_ACCESS_REQUIRED_MESSAGE = 'El acceso a la rentabilidad del socio no está configurado para este usuario.';

const createGetRecoveredLoans = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor, pagination }) => {
  ensureAdmin(actor);
  const recoveredLoans = pagination
    ? await reportRepository.listRecoveredLoansPage(pagination)
    : await reportRepository.listRecoveredLoans();
  const rawLoans = recoveredLoans.items || recoveredLoans;
  const loansWithDetails = await buildLoansWithDetails({ loans: rawLoans, paymentRepository, loanViewService });
  const totalRecoveredAmount = loansWithDetails.reduce((sum, loan) => sum + parseFloat(loan.totalPaid), 0);
  const totalLoansCount = recoveredLoans.pagination?.totalItems ?? loansWithDetails.length;
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
  const totalOutstandingAmount = outstandingLoansFiltered.reduce((sum, loan) => sum + parseFloat(loan.outstandingAmount), 0);
  const totalLoansCount = outstandingLoans.pagination?.totalItems ?? outstandingLoansFiltered.length;
  const pendingCount = outstandingLoansFiltered.filter((loan) => loan.recoveryStatus === 'pending').length;
  const inProgressCount = outstandingLoansFiltered.filter((loan) => loan.recoveryStatus === 'in_progress').length;
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
  const recoveryRate = totalLoansAmount > 0 ? ((totalRecoveredAmount / totalLoansAmount) * 100).toFixed(2) : '0.00';

  return {
    success: true,
    summary: {
      totalLoans: loansWithDetails.length,
      recoveredLoans: recoveredLoans.length,
      outstandingLoans: outstandingLoans.length,
      totalRecoveredAmount: totalRecoveredAmount.toFixed(2),
      totalOutstandingAmount: totalOutstandingAmount.toFixed(2),
      totalLoansAmount: totalLoansAmount.toFixed(2),
      recoveryRate: `${recoveryRate}%`,
    },
    data: {
      recoveredLoans,
      outstandingLoans,
      ...(allLoans.pagination ? { pagination: allLoans.pagination } : {}),
    },
  };
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
        totalPortfolioAmount: '0.00',
        totalRecoveredAmount: '0.00',
        totalOutstandingAmount: '0.00',
        totalInterestGenerated: '0.00',
        totalInterestPaid: '0.00',
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
    const totalRecoveredAmount = loansWithDetails.reduce((sum, loan) => sum + Number(loan.totalPaid || 0), 0);
    const totalOutstandingAmount = loansWithDetails.reduce((sum, loan) => sum + Number(loan.outstandingAmount || 0), 0);
    const totalInterestGenerated = loansWithDetails.reduce((sum, loan) => sum + Number(loan.totalInterestGenerated || 0), 0);
    const totalInterestPaid = loansWithDetails.reduce((sum, loan) => sum + Number(loan.totalInterestPaid || 0), 0);
    const delinquentLoanIds = new Set(
      (dashboard.alerts || [])
        .filter((alert) => alert?.status === 'active')
        .map((alert) => Number(alert?.loanId))
        .filter((loanId) => Number.isFinite(loanId) && loanId > 0),
    );

    return {
      success: true,
      data: {
        summary: {
          totalLoans: loansWithDetails.length,
          activeLoans: loansWithDetails.filter((loan) => ['approved', 'active'].includes(loan.status)).length,
          delinquentLoans: delinquentLoanIds.size,
          defaultedLoans: loansWithDetails.filter((loan) => loan.status === 'defaulted').length,
          recoveredLoans: loansWithDetails.filter((loan) => loan.recoveryBucket === 'recovered').length,
          totalPortfolioAmount: totalPortfolioAmount.toFixed(2),
          totalRecoveredAmount: totalRecoveredAmount.toFixed(2),
          totalOutstandingAmount: totalOutstandingAmount.toFixed(2),
          totalInterestGenerated: totalInterestGenerated.toFixed(2),
          totalInterestPaid: totalInterestPaid.toFixed(2),
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
  } catch (_error) {
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

const ASSOCIATE_DISTRIBUTION_TYPE_LABELS = {
  proportional: 'Proporcional',
  fixed: 'Fija',
  manual: 'Manual',
};

/**
 * Formats associate distribution type values for operator-facing reports.
 *
 * @param {string} value Normalized associate distribution type.
 * @returns {string} Spanish label for CSV/PDF/XLSX report artifacts.
 */
const formatAssociateDistributionType = (value) => (
  ASSOCIATE_DISTRIBUTION_TYPE_LABELS[String(value || '').trim().toLowerCase()] || (value ? 'Tipo de distribución no clasificado' : '')
);

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
        `Total pagado: ${summary.totalPaid || '0.00'}`,
        `Perfil completo: ${formatYesNo(completeness.isComplete)}`,
        `Secciones pendientes: ${missingSections}`,
        `Rentabilidad total: ${profitability?.totalProfit || 'N/A'}`,
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
        `Saldo pendiente: ${formatMoney(history.snapshot?.outstandingBalance || 0)}`,
        `Total pagado: ${formatMoney(history.snapshot?.totalPaid || 0)}`,
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
  { header: 'Monto Préstamo', key: 'amount', width: 18, numFmt: '"$"#,##0.00' },
  { header: 'Total Pagado', key: 'paid', width: 18, numFmt: '"$"#,##0.00' },
  { header: 'Saldo Pendiente', key: 'outstanding', width: 18, numFmt: '"$"#,##0.00' },
  { header: 'Estado de Recuperación', key: 'recoveryStatus', width: 24 },
];

const ASSOCIATE_PROFITABILITY_SUMMARY_COLUMNS = [
  { header: 'Indicador', key: 'indicator', width: 34 },
  { header: 'Valor', key: 'value', width: 22 },
  { header: 'Unidad', key: 'unit', width: 15 },
];

const ASSOCIATE_CONTRIBUTION_COLUMNS = [
  { header: 'ID Aporte', key: 'contributionId', width: 14 },
  moneyColumn('Monto', 'amount'),
  dateColumn('Fecha Aporte', 'contributionDate', 18),
  { header: 'Notas', key: 'notes', width: 34 },
];

const ASSOCIATE_DISTRIBUTION_COLUMNS = [
  { header: 'ID Distribución', key: 'distributionId', width: 16 },
  { header: 'Referencia', key: 'creditId', width: 18 },
  moneyColumn('Monto', 'amount'),
  dateColumn('Fecha Distribución', 'distributionDate', 20),
  { header: 'Tipo Distribución', key: 'distributionType', width: 20 },
  { header: 'Participación %', key: 'participationPercentage', width: 18 },
  moneyColumn('Total Proporcional', 'declaredProportionalTotal', 20),
  moneyColumn('Monto Asignado', 'allocatedAmount', 20),
  { header: 'Notas', key: 'notes', width: 34 },
];

const CUSTOMER_PROFITABILITY_COLUMNS = [
  { header: 'ID Cliente', key: 'customerId', width: 12 },
  { header: 'Cliente', key: 'customerName', width: 28 },
  { header: 'Créditos Totales', key: 'loanCount', width: 16 },
  { header: 'Créditos Rentables', key: 'profitableLoanCount', width: 18 },
  moneyColumn('Capital Prestado', 'originatedAmount', 20),
  moneyColumn('Total Recaudado', 'totalCollected', 20),
  moneyColumn('Capital Recuperado', 'principalCollected', 20),
  moneyColumn('Interés Cobrado', 'interestCollected', 20),
  moneyColumn('Mora Cobrada', 'penaltyCollected', 18),
  moneyColumn('Rentabilidad Total', 'totalProfit', 20),
  moneyColumn('Saldo en Cartera', 'outstandingBalance', 20),
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
          `Monto total recuperado: ${report.summary.totalRecoveredAmount}`,
          `Saldo total pendiente: ${report.summary.totalOutstandingAmount}`,
          `Tasa de recuperación: ${report.summary.recoveryRate}`,
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

const createGetAssociateProfitabilityReport = ({ associateRepository }) => async ({ actor, associateId = null }) => {
  ensureAdmin(actor, 'Solo usuarios administrativos autorizados pueden acceder a reportes de rentabilidad.');

  const resolveAssociate = async () => {
    return associateRepository.findById(associateId);
  };

  const associate = await resolveAssociate();
  if (!associate) {
    throw new AuthorizationError(ASSOCIATE_PROFITABILITY_ACCESS_REQUIRED_MESSAGE);
  }

  const [contributions, distributions] = await Promise.all([
    associateRepository.listContributionsByAssociate(associate.id),
    associateRepository.listProfitDistributionsByAssociate(associate.id),
  ]);

  const totalContributed = contributions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalDistributed = distributions.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    associate: normalizeAssociateRecord(associate),
    summary: {
      totalContributed: totalContributed.toFixed(2),
      totalDistributed: totalDistributed.toFixed(2),
      netProfit: totalDistributed.toFixed(2),
      contributionCount: contributions.length,
      distributionCount: distributions.length,
      participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
    },
    data: {
      contributions,
      distributions: distributions.map(normalizeDistributionRecord),
    },
  };
};

const createExportAssociateProfitabilityReport = ({ reportRepository, associateRepository }) => async ({ actor, associateId, format = 'xlsx' }) => {
  const report = await createGetAssociateProfitabilityReport({ associateRepository })({ actor, associateId });
  const dataset = await reportRepository.getAssociateExportDataset(report.associate.id);

  const contributionRows = (dataset.contributions || []).map((entry) => ({
    contributionId: entry.id,
    amount: entry.amount,
    contributionDate: entry.contributionDate,
    notes: entry.notes || '',
  }));
  const distributionRows = (dataset.distributions || []).map((entry) => {
    const normalizedEntry = normalizeDistributionRecord(entry);

    return {
      distributionId: entry.id,
      creditId: entry.loanId,
      amount: entry.amount,
      distributionDate: entry.distributionDate,
      distributionType: formatAssociateDistributionType(normalizedEntry.distributionType),
      participationPercentage: normalizedEntry.participationPercentage || normalizeParticipationPercentage(dataset.associate?.participationPercentage),
      declaredProportionalTotal: normalizedEntry.declaredProportionalTotal,
      allocatedAmount: normalizedEntry.allocatedAmount,
      notes: entry.notes || '',
    };
  });
  if (format === 'csv') {
    const csv = buildCsv({
      headers: ['Sección', 'ID', 'Referencia', 'Monto', 'Fecha', 'Estado', 'Participación %', 'Tipo Distribución', 'Total Proporcional', 'Monto Asignado', 'Notas'],
      rows: [
        ...contributionRows.map((row) => ['Aporte', row.contributionId, '', row.amount, row.contributionDate, '', normalizeParticipationPercentage(dataset.associate?.participationPercentage), '', '', '', row.notes]),
        ...distributionRows.map((row) => [
          'Distribución',
          row.distributionId,
          row.creditId || '',
          row.amount,
          row.distributionDate,
          '',
          row.participationPercentage || '',
          row.distributionType,
          row.declaredProportionalTotal || '',
          row.allocatedAmount || '',
          row.notes,
        ]),
      ],
    });

    return {
      fileName: `associate-${report.associate.id}-profitability.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csv, 'utf8'),
    };
  }

  return {
    fileName: `associate-${report.associate.id}-profitability.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await buildWorkbookBuffer([
      {
        name: 'Resumen General',
        title: `RENTABILIDAD DEL SOCIO - ${report.associate.name}`,
        tabColor: STYLE_COLORS.blue,
        headerFill: STYLE_COLORS.green,
        columns: ASSOCIATE_PROFITABILITY_SUMMARY_COLUMNS,
        rows: [
          { indicator: 'Socio', value: report.associate.name, unit: '' },
          { indicator: 'ID Socio', value: report.associate.id, unit: '' },
          { indicator: 'Aportes Totales', value: Number(report.summary.totalContributed || 0), unit: '$' },
          { indicator: 'Distribuciones Totales', value: Number(report.summary.totalDistributed || 0), unit: '$' },
          { indicator: 'Ganancia Neta', value: Number(report.summary.netProfit || 0), unit: '$' },
          { indicator: 'Cantidad de Aportes', value: report.summary.contributionCount || 0, unit: 'movimientos' },
          { indicator: 'Cantidad de Distribuciones', value: report.summary.distributionCount || 0, unit: 'movimientos' },
          { indicator: 'Participación', value: report.summary.participationPercentage || '0.0000', unit: '%' },
        ],
        autoFilter: false,
      },
      {
        name: 'Aportes',
        title: 'APORTES DEL SOCIO',
        tabColor: STYLE_COLORS.green,
        headerFill: STYLE_COLORS.headerBlue,
        columns: ASSOCIATE_CONTRIBUTION_COLUMNS,
        rows: contributionRows,
      },
      {
        name: 'Distribuciones',
        title: 'DISTRIBUCIONES DEL SOCIO',
        tabColor: STYLE_COLORS.yellow,
        headerFill: STYLE_COLORS.headerBlue,
        columns: ASSOCIATE_DISTRIBUTION_COLUMNS,
        rows: distributionRows,
      },
    ]),
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

    return {
      success: true,
      count: pagedResult.pagination.totalItems,
      summary: buildProfitabilitySummaryFromDataset(summaryDataset),
      data: {
        customers: buildCustomerProfitabilityRows(
          buildProfitabilityLoanRows({
            loans: pagedResult.items.loans,
            payments: pagedResult.items.payments,
          }),
        ),
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
    summary: buildProfitabilitySummary(customerRows),
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

const createExportCustomerProfitabilityReport = ({ reportRepository }) => async ({ actor, filters = {} }) => {
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
  }));

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
  createGetAssociateProfitabilityReport,
  createExportAssociateProfitabilityReport,
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
  // Excel export use cases
  createExportCreditsExcel: require('./useCases/createExportCreditsExcel').createExportCreditsExcel,
  createExportCreditsPdf: require('./useCases/createExportCreditsExcel').createExportCreditsPdf,
  createGetCreditsSummary: require('./useCases/createGetCreditsSummary').createGetCreditsSummary,
  createExportAssociatesExcel: require('./useCases/createExportAssociatesExcel').createExportAssociatesExcel,
  createExportAssociatesPdf: require('./useCases/createExportAssociatesExcel').createExportAssociatesPdf,
  createExportPayoutsExcel: require('./useCases/createExportPayoutsExcel').createExportPayoutsExcel,
  createExportPayoutsPdf: require('./useCases/createExportPayoutsExcel').createExportPayoutsPdf,
  // Enhanced reports use cases
  createGetPayoutsReport: require('./useCases/createGetPayoutsReport').createGetPayoutsReport,
  createGetPaymentSchedule: require('./useCases/createGetPaymentSchedule').createGetPaymentSchedule,
  createGetMonthlyCashFlow: require('./useCases/createMonthlyCashFlowReport').createGetMonthlyCashFlow,
  createGetDailyCashFlow: require('./useCases/createMonthlyCashFlowReport').createGetDailyCashFlow,
  createExportMonthlyCashFlowExcel: require('./useCases/createMonthlyCashFlowReport').createExportMonthlyCashFlowExcel,
  createExportMonthlyCashFlowPdf: require('./useCases/createMonthlyCashFlowReport').createExportMonthlyCashFlowPdf,
  createExportOperatingExpensesReport: require('./useCases/createExportOperatingExpensesReport').createExportOperatingExpensesReport,
  createGetCreditHistoryAuditReport: require('./useCases/createCreditHistoryAuditReport').createGetCreditHistoryAuditReport,
  createExportCreditHistoryAuditExcel: require('./useCases/createCreditHistoryAuditReport').createExportCreditHistoryAuditExcel,
  createExportCreditHistoryAuditPdf: require('./useCases/createCreditHistoryAuditReport').createExportCreditHistoryAuditPdf,
};
