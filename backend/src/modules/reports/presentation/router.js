const express = require('express');
const { asyncHandler } = require('@/utils/errorHandler');
const { attachPagination } = require('@/middleware/validation');
const { sendBufferDownload } = require('@/modules/shared/http');
const { buildWorkbookBuffer, STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');

const moneyColumn = (header, key, width = 18) => ({ header, key, width, numFmt: '"$"#,##0.00' });
const dateColumn = (header, key, width = 16) => ({ header, key, width, numFmt: 'dd/mm/yyyy' });

const PAYOUT_COLUMNS = [
  { header: 'ID Pago', key: 'paymentId', width: 12 },
  { header: 'ID Crédito', key: 'loanId', width: 12 },
  { header: 'ID Cliente', key: 'customerId', width: 12 },
  { header: 'Cliente', key: 'customerName', width: 28 },
  dateColumn('Fecha de Pago', 'paymentDate', 18),
  moneyColumn('Monto', 'amount'),
  moneyColumn('Capital Aplicado', 'principalApplied', 20),
  moneyColumn('Interés Aplicado', 'interestApplied', 20),
  moneyColumn('Mora Aplicada', 'penaltyApplied', 18),
  moneyColumn('Saldo Después del Pago', 'remainingBalanceAfterPayment', 22),
  { header: 'Tipo Pago', key: 'paymentType', width: 16 },
  { header: 'Método', key: 'paymentMethod', width: 18 },
  { header: 'Estado', key: 'status', width: 14 },
  { header: 'Referencia', key: 'reference', width: 22 },
  { header: 'Observación', key: 'observation', width: 30 },
  { header: 'Comprobante', key: 'voucherNumber', width: 18 },
  dateColumn('Fecha Registro', 'createdAt', 18),
];

const DASHBOARD_EVOLUTION_COLUMNS = [
  { header: 'Periodo', key: 'period', width: 16 },
  moneyColumn('Desembolsado', 'disbursed'),
  moneyColumn('Recuperado', 'recovered'),
];

const DASHBOARD_LOAN_COLUMNS = [
  { header: 'ID Crédito', key: 'creditId', width: 12 },
  { header: 'Cliente', key: 'customerName', width: 28 },
  moneyColumn('Monto', 'amount'),
  { header: 'Estado', key: 'status', width: 16 },
  dateColumn('Fecha', 'date', 18),
];

const DASHBOARD_PAYMENT_COLUMNS = [
  { header: 'ID Pago', key: 'paymentId', width: 12 },
  { header: 'ID Crédito', key: 'creditId', width: 12 },
  { header: 'Cliente', key: 'customerName', width: 28 },
  moneyColumn('Monto', 'amount'),
  { header: 'Tipo Pago', key: 'paymentType', width: 16 },
  { header: 'Estado', key: 'status', width: 16 },
  dateColumn('Fecha', 'date', 18),
];

const DASHBOARD_ALERT_COLUMNS = [
  { header: 'ID Alerta', key: 'alertId', width: 12 },
  { header: 'ID Crédito', key: 'creditId', width: 12 },
  { header: 'Cliente', key: 'customerName', width: 28 },
  { header: 'Tipo', key: 'type', width: 18 },
  { header: 'Estado', key: 'status', width: 16 },
  dateColumn('Fecha', 'date', 18),
  { header: 'Descripción', key: 'description', width: 38 },
];

const DASHBOARD_PROMISE_COLUMNS = [
  { header: 'ID Compromiso', key: 'promiseId', width: 16 },
  { header: 'ID Crédito', key: 'creditId', width: 12 },
  { header: 'Cliente', key: 'customerName', width: 28 },
  moneyColumn('Monto Prometido', 'amount', 20),
  { header: 'Estado', key: 'status', width: 16 },
  dateColumn('Fecha Compromiso', 'date', 20),
];

const DASHBOARD_NOTIFICATION_COLUMNS = [
  { header: 'ID Notificación', key: 'notificationId', width: 16 },
  { header: 'Título', key: 'title', width: 28 },
  { header: 'Tipo', key: 'type', width: 18 },
  { header: 'Estado Lectura', key: 'readStatus', width: 16 },
  dateColumn('Fecha', 'date', 18),
  { header: 'Descripción', key: 'description', width: 38 },
];

const ASSOCIATES_COLUMNS = [
  { header: 'ID Socio', key: 'associateId', width: 12 },
  { header: 'Socio', key: 'associateName', width: 28 },
  { header: 'Tipo de Interés', key: 'interestType', width: 18 },
  { header: 'Tasa Pactada %', key: 'interestRate', width: 18 },
  moneyColumn('Deuda con Socio', 'interestDebt', 20),
  moneyColumn('Interés Pagado', 'totalInterestPaid', 20),
  dateColumn('Próximo Pago', 'nextInterestPaymentDate', 18),
  { header: 'Sección', key: 'section', width: 16 },
  { header: 'ID Movimiento', key: 'entryId', width: 16 },
  { header: 'Referencia', key: 'reference', width: 24 },
  moneyColumn('Monto', 'amount'),
  dateColumn('Fecha', 'date', 18),
  { header: 'Estado', key: 'status', width: 14 },
  { header: 'Participación %', key: 'participationPercentage', width: 18 },
  { header: 'Tipo Distribución', key: 'distributionType', width: 20 },
  moneyColumn('Total Declarado', 'declaredProportionalTotal', 20),
  moneyColumn('Monto Asignado', 'allocatedAmount', 20),
  { header: 'Notas', key: 'notes', width: 34 },
];

const formatExcelDate = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
};

const pickCustomerName = (record = {}) => (
  record.customerName
  || record.Customer?.name
  || record.customer?.name
  || record.loan?.Customer?.name
  || record.Loan?.Customer?.name
  || ''
);

const normalizeDashboardLoanRow = (loan = {}) => ({
  creditId: loan.loanId || loan.creditId || loan.id || '',
  customerName: pickCustomerName(loan),
  amount: Number(loan.amount || loan.loanAmount || 0),
  status: loan.status || loan.recoveryStatus || '',
  date: formatExcelDate(loan.createdAt || loan.startDate || loan.disbursementDate),
});

const normalizeDashboardPaymentRow = (payment = {}) => ({
  paymentId: payment.paymentId || payment.id || '',
  creditId: payment.loanId || payment.creditId || payment.Loan?.id || payment.loan?.id || '',
  customerName: pickCustomerName(payment),
  amount: Number(payment.amount || 0),
  paymentType: payment.paymentType || payment.type || '',
  status: payment.status || '',
  date: formatExcelDate(payment.paymentDate || payment.createdAt),
});

const normalizeDashboardAlertRow = (alert = {}) => ({
  alertId: alert.alertId || alert.id || '',
  creditId: alert.loanId || alert.creditId || alert.Loan?.id || '',
  customerName: pickCustomerName(alert),
  type: alert.type || alert.alertType || '',
  status: alert.status || '',
  date: formatExcelDate(alert.dueDate || alert.createdAt),
  description: alert.description || alert.message || alert.title || '',
});

const normalizeDashboardPromiseRow = (promise = {}) => ({
  promiseId: promise.promiseId || promise.id || '',
  creditId: promise.loanId || promise.creditId || promise.Loan?.id || '',
  customerName: pickCustomerName(promise),
  amount: Number(promise.amount || promise.promisedAmount || 0),
  status: promise.status || '',
  date: formatExcelDate(promise.promiseDate || promise.dueDate || promise.createdAt),
});

const normalizeDashboardNotificationRow = (notification = {}) => ({
  notificationId: notification.notificationId || notification.id || '',
  title: notification.title || '',
  type: notification.type || '',
  readStatus: notification.readAt || notification.isRead ? 'Leída' : 'No leída',
  date: formatExcelDate(notification.createdAt),
  description: notification.message || notification.description || '',
});

const createReportsRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();
  const requirePermission = (permission) => authMiddleware({ permissions: [permission] });
  const buildCreditExportFilters = (query = {}) => ({
    customerId: query.customerId,
    loanId: query.loanId,
    creditId: query.creditId,
    startDate: query.startDate || query.fromDate,
    endDate: query.endDate || query.toDate,
    status: query.status,
  });
  const buildCreditHistoryAuditFilters = (query = {}) => ({
    month: query.month,
    startDate: query.startDate || query.fromDate,
    endDate: query.endDate || query.toDate,
    status: query.status,
  });
  const buildPayoutExportFilters = (query = {}) => ({
    customerId: query.customerId,
    loanId: query.loanId,
    creditId: query.creditId,
    startDate: query.startDate || query.fromDate,
    endDate: query.endDate || query.toDate,
    status: query.status,
    paymentType: query.paymentType,
  });
  const buildExportSuffix = (query = {}) => {
    const date = new Date().toISOString().slice(0, 10);
    if (query.loanId || query.creditId) {
      return `credito-${query.loanId || query.creditId}-${date}`;
    }
    if (query.customerId) {
      return `cliente-${query.customerId}-${date}`;
    }
    return `general-${date}`;
  };
  /**
   * Builds a compact operator-friendly workbook for dashboard exports.
   * Keeps the summary sheet first and adds activity sheets only when data exists.
   */
  const buildDashboardWorkbookBuffer = (dashboardPayload = {}) => {
    const summary = dashboardPayload?.summary || {};
    const collections = dashboardPayload?.collections || {};
    const monthlyPerformance = Array.isArray(dashboardPayload?.monthlyPerformance)
      ? dashboardPayload.monthlyPerformance
      : [];
    const recentActivity = dashboardPayload?.recentActivity || {};

    const summaryRows = [
      { indicador: 'Créditos totales', valor: summary.totalLoans ?? 0 },
      { indicador: 'Créditos activos', valor: summary.activeLoans ?? 0 },
      { indicador: 'Créditos en mora', valor: summary.defaultedLoans ?? 0 },
      { indicador: 'Créditos recuperados', valor: summary.recoveredLoans ?? 0 },
      { indicador: 'Capital colocado', valor: summary.totalPortfolioAmount ?? '0.00' },
      { indicador: 'Interés generado', valor: summary.totalInterestGenerated ?? '0.00' },
      { indicador: 'Interés pagado', valor: summary.totalInterestPaid ?? '0.00' },
      { indicador: 'Capital recuperado', valor: summary.totalRecoveredAmount ?? '0.00' },
      { indicador: 'Saldo pendiente', valor: summary.totalOutstandingAmount ?? '0.00' },
      { indicador: 'Alertas vencidas', valor: collections.overdueAlerts ?? 0 },
      { indicador: 'Compromisos pendientes', valor: collections.pendingPromises ?? 0 },
      { indicador: 'Notificaciones no leídas', valor: collections.unreadNotifications ?? 0 },
    ];

    const sheets = [{
      name: 'Resumen General',
      title: 'REPORTE GENERAL DEL DASHBOARD',
      tabColor: STYLE_COLORS.blue,
      headerFill: STYLE_COLORS.green,
      columns: [
        { header: 'Indicador', key: 'indicador', width: 34 },
        { header: 'Valor', key: 'valor', width: 22 },
      ],
      rows: summaryRows,
      autoFilter: false,
    }];

    if (monthlyPerformance.length > 0) {
      sheets.push({
        name: 'Evolución',
        title: 'EVOLUCIÓN DE DESEMBOLSOS Y RECUPERACIONES',
        tabColor: STYLE_COLORS.green,
        headerFill: STYLE_COLORS.headerBlue,
        columns: DASHBOARD_EVOLUTION_COLUMNS,
        rows: monthlyPerformance.map((row) => ({
          period: row.period || row.month || row.date || '',
          disbursed: Number(row.disbursed || row.totalDisbursed || 0),
          recovered: Number(row.recovered || row.totalRecovered || 0),
        })),
      });
    }

    const activitySheets = [
      ['Préstamos recientes', Array.isArray(recentActivity.loans) ? recentActivity.loans.map(normalizeDashboardLoanRow) : [], DASHBOARD_LOAN_COLUMNS],
      ['Pagos recientes', Array.isArray(recentActivity.payments) ? recentActivity.payments.map(normalizeDashboardPaymentRow) : [], DASHBOARD_PAYMENT_COLUMNS],
      ['Alertas', Array.isArray(recentActivity.alerts) ? recentActivity.alerts.map(normalizeDashboardAlertRow) : [], DASHBOARD_ALERT_COLUMNS],
      ['Compromisos', Array.isArray(recentActivity.promises) ? recentActivity.promises.map(normalizeDashboardPromiseRow) : [], DASHBOARD_PROMISE_COLUMNS],
      ['Notificaciones', Array.isArray(recentActivity.notifications) ? recentActivity.notifications.map(normalizeDashboardNotificationRow) : [], DASHBOARD_NOTIFICATION_COLUMNS],
    ];

    activitySheets.forEach(([sheetName, rows, columns]) => {
      if (rows.length > 0) {
        sheets.push({
          name: sheetName,
          title: sheetName.toUpperCase(),
          tabColor: STYLE_COLORS.teal,
          headerFill: STYLE_COLORS.headerBlue,
          columns,
          rows,
        });
      }
    });

    return buildWorkbookBuffer(sheets);
  };

  router.get('/recovered', requirePermission('REPORTS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    res.json(await useCases.getRecoveredLoans({ actor: req.user, pagination: req.pagination }));
  }));

  router.get('/outstanding', requirePermission('REPORTS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    res.json(await useCases.getOutstandingLoans({ actor: req.user, pagination: req.pagination }));
  }));

  router.get('/recovery', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getRecoveryReport({ actor: req.user }));
  }));

  router.get('/dashboard', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getDashboardSummary({ actor: req.user }));
  }));

  router.get('/dashboard/excel', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const dashboardSummary = await useCases.getDashboardSummary({ actor: req.user });
    const buffer = await buildDashboardWorkbookBuffer(dashboardSummary?.data);

    sendBufferDownload(res, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `dashboard-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
      buffer,
    });
  }));

  router.get('/cash-flow/monthly', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
    res.json(await useCases.getMonthlyCashFlow({ actor: req.user, year }));
  }));

  router.get('/cash-flow/monthly/excel', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
    const exportFile = await useCases.exportMonthlyCashFlowExcel({ actor: req.user, year });
    const buffer = await buildWorkbookBuffer(exportFile.sheets);
    sendBufferDownload(res, {
      contentType: exportFile.contentType,
      fileName: exportFile.fileName,
      buffer,
    });
  }));

  router.get('/cash-flow/monthly/pdf', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
    const exportFile = await useCases.exportMonthlyCashFlowPdf({ actor: req.user, year });
    sendBufferDownload(res, exportFile);
  }));

  router.get('/customer-history/:customerId', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getCustomerHistory({ actor: req.user, customerId: req.params.customerId }));
  }));

  router.get('/customer-history/:customerId/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'pdf').toLowerCase();
    const exportFile = await useCases.exportCustomerHistory({ actor: req.user, customerId: req.params.customerId, format });
    sendBufferDownload(res, exportFile);
  }));

  router.get('/customer-credit-profile/:customerId', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getCustomerCreditProfile({ actor: req.user, customerId: req.params.customerId }));
  }));

  router.get('/customer-credit-profile/:customerId/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'pdf').toLowerCase();
    const exportFile = await useCases.exportCustomerCreditProfile({ actor: req.user, customerId: req.params.customerId, format });
    sendBufferDownload(res, exportFile);
  }));

  router.get('/profitability/customers', requirePermission('REPORTS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    res.json(await useCases.getCustomerProfitabilityReport({
      actor: req.user,
      pagination: req.pagination,
      filters: { fromDate: req.query.fromDate, toDate: req.query.toDate },
    }));
  }));

  router.get('/profitability/customers/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const exportFile = await useCases.exportCustomerProfitabilityReport({
      actor: req.user,
      filters: { fromDate: req.query.fromDate, toDate: req.query.toDate },
    });
    sendBufferDownload(res, exportFile);
  }));

  router.get('/profitability/loans', requirePermission('REPORTS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    res.json(await useCases.getLoanProfitabilityReport({
      actor: req.user,
      pagination: req.pagination,
      filters: { fromDate: req.query.fromDate, toDate: req.query.toDate },
    }));
  }));

  router.get('/recovery/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'csv').toLowerCase();
    const exportFile = await useCases.exportRecoveryReport({ actor: req.user, format });
    sendBufferDownload(res, exportFile);
  }));

  router.get('/credit-history/loan/:loanId', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const history = await useCases.getCustomerCreditHistory({ actor: req.user, loanId: req.params.loanId });
    res.json({ success: true, data: { history } });
  }));

  router.get('/credit-history/loan/:loanId/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'pdf').toLowerCase();
    const exportFile = await useCases.exportCustomerCreditHistory({ actor: req.user, loanId: req.params.loanId, format });
    sendBufferDownload(res, exportFile);
  }));

  router.get('/credit-history/monthly', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const report = await useCases.getCreditHistoryAuditReport({
      actor: req.user,
      filters: buildCreditHistoryAuditFilters(req.query),
    });
    res.json(report);
  }));

  router.get('/credit-history/monthly/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const filters = buildCreditHistoryAuditFilters(req.query);

    if (format === 'pdf') {
      const exportFile = await useCases.exportCreditHistoryAuditPdf({ actor: req.user, filters });
      sendBufferDownload(res, exportFile);
      return;
    }

    const exportFile = await useCases.exportCreditHistoryAuditExcel({ actor: req.user, filters });
    const buffer = await buildWorkbookBuffer(exportFile.sheets);
    sendBufferDownload(res, {
      contentType: exportFile.contentType,
      fileName: exportFile.fileName,
      buffer,
    });
  }));

  router.get('/associates/profitability/:associateId', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const report = await useCases.getAssociateProfitabilityReport({ actor: req.user, associateId: req.params.associateId });
    res.json({ success: true, data: { report } });
  }));

  router.get('/associates/profitability', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const report = await useCases.getAssociateProfitabilityReport({ actor: req.user });
    res.json({ success: true, data: { report } });
  }));

  router.get('/associates/:associateId/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const exportFile = await useCases.exportAssociateProfitabilityReport({
      actor: req.user,
      associateId: req.params.associateId,
      format,
    });
    sendBufferDownload(res, exportFile);
  }));

  // === Financial Analytics Routes ===

  router.get('/credit-earnings', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getCreditEarnings({ actor: req.user }));
  }));

  router.get('/interest-earnings', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getInterestEarnings({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/monthly-earnings', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getMonthlyEarnings({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/monthly-interest', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getMonthlyInterest({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/performance-analysis', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getPerformanceAnalysis({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/executive-dashboard', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getExecutiveDashboard({ actor: req.user }));
  }));

  router.get('/comprehensive-analytics', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getComprehensiveAnalytics({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/comparative-analysis', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getComparativeAnalysis({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.post('/comparative-analysis', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const requestedYear = req.body?.year;
    const parsedYear = requestedYear !== undefined ? parseInt(requestedYear, 10) : undefined;
    res.json(await useCases.getComparativeAnalysis({ actor: req.user, year: Number.isNaN(parsedYear) ? undefined : parsedYear }));
  }));

  router.post('/earnings-report', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const requestedYear = req.body?.year;
    const parsedYear = requestedYear !== undefined ? parseInt(requestedYear, 10) : undefined;
    const earnings = await useCases.getMonthlyEarnings({ actor: req.user, year: Number.isNaN(parsedYear) ? undefined : parsedYear });
    const interest = await useCases.getInterestEarnings({ actor: req.user, year: Number.isNaN(parsedYear) ? undefined : parsedYear });

    res.json({
      success: true,
      data: {
        year: earnings?.data?.year || (Number.isNaN(parsedYear) ? new Date().getFullYear() : parsedYear),
        monthlyEarnings: earnings?.data?.months || [],
        interestEarnings: interest?.data?.byMonth || [],
        totalInterest: interest?.data?.totalInterest || '0.00',
      },
    });
  }));

  router.get('/forecast-analysis', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getForecastAnalysis({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/next-month-projection', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getNextMonthProjection({ actor: req.user }));
  }));

  // Credits Excel Export and Summary
  router.get('/credits/excel', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const exportData = await useCases.exportCreditsExcel({ actor: req.user, filters: buildCreditExportFilters(req.query) });
    const workbookSheets = Array.isArray(exportData.data?.sheets) && exportData.data.sheets.length > 0
      ? exportData.data.sheets
      : [{ name: 'Credits', rows: exportData.data.rows }];
    const buffer = await buildWorkbookBuffer(workbookSheets);
    sendBufferDownload(res, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `reporte-creditos-${buildExportSuffix(req.query)}.xlsx`,
      buffer,
    });
  }));

  router.get('/credits/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const filters = buildCreditExportFilters(req.query);

    if (format === 'pdf') {
      const exportFile = await useCases.exportCreditsPdf({ actor: req.user, filters });
      sendBufferDownload(res, exportFile);
      return;
    }

    const exportData = await useCases.exportCreditsExcel({ actor: req.user, filters });
    const workbookSheets = Array.isArray(exportData.data?.sheets) && exportData.data.sheets.length > 0
      ? exportData.data.sheets
      : [{ name: 'Credits', rows: exportData.data.rows }];
    const buffer = await buildWorkbookBuffer(workbookSheets);
    sendBufferDownload(res, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `reporte-creditos-${buildExportSuffix(req.query)}.xlsx`,
      buffer,
    });
  }));

  router.get('/payouts/excel', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const exportData = await useCases.exportPayoutsExcel({ actor: req.user, filters: buildPayoutExportFilters(req.query) });
    const workbookSheets = Array.isArray(exportData.data?.sheets) && exportData.data.sheets.length > 0
      ? exportData.data.sheets
      : [{
        name: 'Pagos',
        title: 'REPORTE DE PAGOS',
        tabColor: STYLE_COLORS.green,
        headerFill: STYLE_COLORS.green,
        columns: PAYOUT_COLUMNS,
        rows: exportData.data.rows,
      }];
    const buffer = await buildWorkbookBuffer(workbookSheets);
    sendBufferDownload(res, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `reporte-pagos-${buildExportSuffix(req.query)}.xlsx`,
      buffer,
    });
  }));

  router.get('/credits/summary', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getCreditsSummary({ actor: req.user }));
  }));

  router.get('/associates/excel', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const exportData = await useCases.exportAssociatesExcel({ actor: req.user });
    const workbookSheets = Array.isArray(exportData.data?.sheets) && exportData.data.sheets.length > 0
      ? exportData.data.sheets
      : [{
        name: 'Detalle de Socios',
        title: 'DETALLE OPERATIVO DE SOCIOS',
        tabColor: STYLE_COLORS.red,
        headerFill: STYLE_COLORS.headerBlue,
        columns: ASSOCIATES_COLUMNS,
        rows: exportData.data.rows,
      }];
    const buffer = await buildWorkbookBuffer(workbookSheets);
    sendBufferDownload(res, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: 'associates-export.xlsx',
      buffer,
    });
  }));

  router.get('/partner-report/:associateId', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const exportFile = await useCases.exportAssociateProfitabilityReport({
      actor: req.user,
      associateId: req.params.associateId,
      format,
    });
    sendBufferDownload(res, exportFile);
  }));

  // === Enhanced Reports: Payouts and Payment Schedule ===

  // GET /reports/payouts - List all payouts across credits (admin only)
  router.get('/payouts', requirePermission('REPORTS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    res.json(await useCases.getPayoutsReport({
      actor: req.user,
      pagination: req.pagination,
      filters: {
        fromDate: req.query.fromDate,
        toDate: req.query.toDate,
        status: req.query.status,
        paymentType: req.query.paymentType,
      },
    }));
  }));

  // GET /reports/payment-schedule/:loanId - Get amortization schedule for a specific loan
  router.get('/payment-schedule/:loanId', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getPaymentSchedule({
      actor: req.user,
      loanId: parseInt(req.params.loanId, 10),
    }));
  }));

  return router;
};

module.exports = {
  createReportsRouter,
};
