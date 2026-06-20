const express = require('express');
const { asyncHandler, ValidationError } = require('@/utils/errorHandler');
const { attachPagination } = require('@/middleware/validation');
const { sendBufferDownload } = require('@/modules/shared/http');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');
const { buildPdfBuffer, formatDisplayMoney } = require('@/modules/reports/application/reportHelpers');
const { formatOperationalStatus, formatPaymentType } = require('@/modules/reports/application/reportLabels');
const { buildWorkbookBuffer, STYLE_COLORS } = require('@/modules/reports/application/workbookBuilder');
const {
  MONEY_FORMAT,
  PERCENT_FORMAT,
  INTEGER_FORMAT,
  dashboardRow,
  parseExcelMoney,
  parseExcelPercent,
  toExcelDate,
} = require('@/modules/reports/application/excelExportFormats');

const moneyColumn = (header, key, width = 18) => ({ header, key, width, numFmt: MONEY_FORMAT });
const dateColumn = (header, key, width = 16) => ({ header, key, width, numFmt: 'dd/mm/yyyy' });

const DASHBOARD_EVOLUTION_COLUMNS = [
  { header: 'Periodo', key: 'period', width: 16 },
  moneyColumn('Desembolsado', 'disbursed'),
  moneyColumn('Recuperado', 'recovered'),
];

const DASHBOARD_LOAN_COLUMNS = [
  { header: 'Crédito', key: 'creditId', width: 12 },
  { header: 'Cliente', key: 'customerName', width: 28 },
  moneyColumn('Monto', 'amount'),
  { header: 'Estado', key: 'status', width: 16 },
  dateColumn('Fecha', 'date', 18),
];

const DASHBOARD_PAYMENT_COLUMNS = [
  { header: 'Pago', key: 'paymentId', width: 12 },
  { header: 'Crédito', key: 'creditId', width: 12 },
  { header: 'Cliente', key: 'customerName', width: 28 },
  moneyColumn('Monto', 'amount'),
  { header: 'Tipo Pago', key: 'paymentType', width: 16 },
  { header: 'Estado', key: 'status', width: 16 },
  dateColumn('Fecha', 'date', 18),
];

const DASHBOARD_ALERT_COLUMNS = [
  { header: 'Alerta', key: 'alertId', width: 12 },
  { header: 'Crédito', key: 'creditId', width: 12 },
  { header: 'Cliente', key: 'customerName', width: 28 },
  { header: 'Tipo', key: 'type', width: 18 },
  { header: 'Estado', key: 'status', width: 16 },
  dateColumn('Fecha', 'date', 18),
  { header: 'Descripción', key: 'description', width: 38 },
];

const DASHBOARD_PROMISE_COLUMNS = [
  { header: 'Compromiso', key: 'promiseId', width: 16 },
  { header: 'Crédito', key: 'creditId', width: 12 },
  { header: 'Cliente', key: 'customerName', width: 28 },
  moneyColumn('Monto Prometido', 'amount', 20),
  { header: 'Estado', key: 'status', width: 16 },
  dateColumn('Fecha Compromiso', 'date', 20),
];

const DASHBOARD_NOTIFICATION_COLUMNS = [
  { header: 'Notificación', key: 'notificationId', width: 16 },
  { header: 'Título', key: 'title', width: 28 },
  { header: 'Tipo', key: 'type', width: 18 },
  { header: 'Estado Lectura', key: 'readStatus', width: 16 },
  dateColumn('Fecha', 'date', 18),
  { header: 'Descripción', key: 'description', width: 38 },
];

const formatExcelDate = (value) => toExcelDate(value);

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
  status: formatOperationalStatus(loan.status || loan.recoveryStatus),
  date: formatExcelDate(loan.createdAt || loan.startDate || loan.disbursementDate),
});

const normalizeDashboardPaymentRow = (payment = {}) => ({
  paymentId: payment.paymentId || payment.id || '',
  creditId: payment.loanId || payment.creditId || payment.Loan?.id || payment.loan?.id || '',
  customerName: pickCustomerName(payment),
  amount: Number(payment.amount || 0),
  paymentType: formatPaymentType(payment.paymentType || payment.type),
  status: formatOperationalStatus(payment.status),
  date: formatExcelDate(payment.paymentDate || payment.createdAt),
});

const normalizeDashboardAlertRow = (alert = {}) => ({
  alertId: alert.alertId || alert.id || '',
  creditId: alert.loanId || alert.creditId || alert.Loan?.id || '',
  customerName: pickCustomerName(alert),
  type: alert.type || alert.alertType || '',
  status: formatOperationalStatus(alert.status),
  date: formatExcelDate(alert.dueDate || alert.createdAt),
  description: alert.description || alert.message || alert.title || '',
});

const normalizeDashboardPromiseRow = (promise = {}) => ({
  promiseId: promise.promiseId || promise.id || '',
  creditId: promise.loanId || promise.creditId || promise.Loan?.id || '',
  customerName: pickCustomerName(promise),
  amount: Number(promise.amount || promise.promisedAmount || 0),
  status: formatOperationalStatus(promise.status),
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

const requireWorkbookSheets = (exportData, exportName) => {
  const sheets = exportData?.data?.sheets;
  if (!Array.isArray(sheets) || sheets.length === 0) {
    throw new Error(`${exportName} debe devolver hojas de workbook en data.sheets.`);
  }

  return sheets;
};

/**
 * Composes reporting, analytics and export routes from authorization middleware
 * and reporting use cases.
 * @param {{ authMiddleware: Function, useCases: object }} dependencies
 * @returns {import('express').Router} Express router for administrative reports and operational exports.
 */
const createReportsRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();
  const requirePermission = (permission) => authMiddleware({ permissions: [permission] });
  /**
   * Parses optional report year filters without accepting partial-number
   * coercions such as "2026abc" or exponent notation.
   * @param {string|number|null|undefined} value
   * @returns {number|undefined}
   */
  const parseOptionalReportYear = (value) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const normalizedValue = String(value).trim();
    if (!/^\d{4}$/.test(normalizedValue)) {
      throw new ValidationError('El año del reporte debe tener cuatro dígitos.');
    }

    const year = Number(normalizedValue);
    if (!Number.isSafeInteger(year) || year < 1900 || year > 9999) {
      throw new ValidationError('El año del reporte debe ser un año calendario válido.');
    }

    return year;
  };
  /**
   * Parses route identifiers without accepting partial numeric coercions.
   * @param {string|number} value
   * @param {string} fieldName
   * @returns {number}
   */
  const parseRequiredRouteId = (value, fieldName) => {
    if (!validateIntegerId(value)) {
      throw new ValidationError(buildInvalidIntegerIdMessage(fieldName));
    }

    return Number(String(value).trim());
  };
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
    customerId: query.customerId,
    loanId: query.loanId || query.creditId,
    financialProductId: query.financialProductId,
  });
  const buildPayoutExportFilters = (query = {}) => ({
    customerId: query.customerId,
    loanId: query.loanId,
    creditId: query.creditId,
    startDate: query.startDate || query.fromDate,
    endDate: query.endDate || query.toDate,
    status: query.status,
    paymentType: query.paymentType,
    employeeId: query.employeeId || query.createdByUserId,
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
  const buildDashboardSummaryRows = (dashboardPayload = {}) => {
    const summary = dashboardPayload?.summary || {};
    const collections = dashboardPayload?.collections || {};
    return [
      dashboardRow('Créditos totales', Number(summary.totalLoans ?? 0), INTEGER_FORMAT),
      dashboardRow('Clientes registrados', Number(summary.totalCustomers ?? 0), INTEGER_FORMAT),
      dashboardRow('Créditos activos', Number(summary.activeLoans ?? 0), INTEGER_FORMAT),
      dashboardRow('Créditos finalizados', Number(summary.finalizedLoans ?? summary.recoveredLoans ?? 0), INTEGER_FORMAT),
      dashboardRow('Créditos en mora', Number(summary.delinquentLoans ?? summary.defaultedLoans ?? 0), INTEGER_FORMAT),
      dashboardRow('Créditos recuperados', Number(summary.recoveredLoans ?? 0), INTEGER_FORMAT),
      dashboardRow('Capital colocado', parseExcelMoney(summary.totalPortfolioAmount), MONEY_FORMAT),
      dashboardRow('Capital recuperado', parseExcelMoney(summary.totalRecoveredAmount), MONEY_FORMAT),
      dashboardRow('Capital actualmente prestado', parseExcelMoney(summary.totalOutstandingPrincipal), MONEY_FORMAT),
      dashboardRow('Interés generado', parseExcelMoney(summary.totalInterestGenerated), MONEY_FORMAT),
      dashboardRow('Interés pagado', parseExcelMoney(summary.totalInterestPaid), MONEY_FORMAT),
      dashboardRow('Interés pendiente', parseExcelMoney(summary.totalInterestPending), MONEY_FORMAT),
      dashboardRow('Pagos a socios', parseExcelMoney(summary.totalAssociatePayments), MONEY_FORMAT),
      dashboardRow('Cuotas pendientes', Number(summary.pendingInstallments ?? 0), INTEGER_FORMAT),
      dashboardRow('Cuotas vencidas', Number(summary.overdueInstallments ?? 0), INTEGER_FORMAT),
      dashboardRow('Saldo pendiente', parseExcelMoney(summary.totalOutstandingAmount), MONEY_FORMAT),
      dashboardRow('Tasa de recuperación', parseExcelPercent(summary.recoveryRate), PERCENT_FORMAT),
      dashboardRow('Porcentaje de mora', parseExcelPercent(summary.arrearsRate), PERCENT_FORMAT),
      dashboardRow('Caja disponible', parseExcelMoney(summary.availableCash), MONEY_FORMAT),
      dashboardRow('Resultado de intereses y mora', parseExcelMoney(summary.periodProfit), MONEY_FORMAT),
      dashboardRow('Pérdida del período', parseExcelMoney(summary.periodLoss), MONEY_FORMAT),
      dashboardRow('Alertas vencidas', Number(collections.overdueAlerts ?? 0), INTEGER_FORMAT),
      dashboardRow('Compromisos pendientes', Number(collections.pendingPromises ?? 0), INTEGER_FORMAT),
      dashboardRow('Notificaciones no leídas', Number(collections.unreadNotifications ?? 0), INTEGER_FORMAT),
    ];
  };

  const buildDashboardWorkbookBuffer = (dashboardPayload = {}) => {
    const monthlyPerformance = Array.isArray(dashboardPayload?.monthlyPerformance)
      ? dashboardPayload.monthlyPerformance
      : [];
    const recentActivity = dashboardPayload?.recentActivity || {};
    const summaryRows = buildDashboardSummaryRows(dashboardPayload);

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

  const buildDashboardPdfExport = (dashboardPayload = {}) => {
    const summaryRows = buildDashboardSummaryRows(dashboardPayload);
    const monthlyPerformance = Array.isArray(dashboardPayload?.monthlyPerformance)
      ? dashboardPayload.monthlyPerformance
      : [];
    const recentActivity = dashboardPayload?.recentActivity || {};

    const lines = [
      'Resumen operativo y financiero del dashboard general.',
      '',
      ...summaryRows.map((row) => `${row.indicador}: ${row.valor}`),
    ];

    if (monthlyPerformance.length > 0) {
      lines.push('', 'Evolución reciente:');
      monthlyPerformance.slice(-6).forEach((row) => {
        lines.push(
          `${row.period || row.month || row.date || 'Periodo'}: desembolsado ${formatDisplayMoney(row.disbursed || row.totalDisbursed || 0)} · recuperado ${formatDisplayMoney(row.recovered || row.totalRecovered || 0)}`,
        );
      });
    }

    const activityCounters = [
      `Créditos recientes: ${Array.isArray(recentActivity.loans) ? recentActivity.loans.length : 0}`,
      `Pagos recientes: ${Array.isArray(recentActivity.payments) ? recentActivity.payments.length : 0}`,
      `Alertas activas: ${Array.isArray(recentActivity.alerts) ? recentActivity.alerts.length : 0}`,
      `Compromisos recientes: ${Array.isArray(recentActivity.promises) ? recentActivity.promises.length : 0}`,
      `Notificaciones recientes: ${Array.isArray(recentActivity.notifications) ? recentActivity.notifications.length : 0}`,
    ];

    lines.push('', 'Actividad visible en el resumen:', ...activityCounters);

    return buildPdfBuffer({
      title: 'REPORTE GENERAL DEL DASHBOARD',
      lines,
    });
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

  router.get('/dashboard/pdf', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const dashboardSummary = await useCases.getDashboardSummary({ actor: req.user });
    const buffer = buildDashboardPdfExport(dashboardSummary?.data);

    sendBufferDownload(res, {
      contentType: 'application/pdf',
      fileName: `dashboard-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      buffer,
    });
  }));

  router.get('/cash-flow/monthly', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const year = parseOptionalReportYear(req.query.year);
    const filters = { fromDate: req.query.fromDate, toDate: req.query.toDate };
    res.json(await useCases.getMonthlyCashFlow({ actor: req.user, year, filters }));
  }));

  router.get('/cash-flow/daily', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const filters = {
      date: req.query.date,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    };
    res.json(await useCases.getDailyCashFlow({ actor: req.user, filters }));
  }));

  router.get('/cash-flow/annual', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const filters = {
      fromYear: req.query.fromYear,
      toYear: req.query.toYear,
    };
    res.json(await useCases.getAnnualCashFlow({ actor: req.user, filters }));
  }));

  router.get('/cash-flow/monthly/excel', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const year = parseOptionalReportYear(req.query.year);
    const filters = { fromDate: req.query.fromDate, toDate: req.query.toDate };
    const exportFile = await useCases.exportMonthlyCashFlowExcel({ actor: req.user, year, filters });
    const buffer = await buildWorkbookBuffer(exportFile.sheets);
    sendBufferDownload(res, {
      contentType: exportFile.contentType,
      fileName: exportFile.fileName,
      buffer,
    });
  }));

  router.get('/cash-flow/monthly/pdf', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const year = parseOptionalReportYear(req.query.year);
    const filters = { fromDate: req.query.fromDate, toDate: req.query.toDate };
    const exportFile = await useCases.exportMonthlyCashFlowPdf({ actor: req.user, year, filters });
    sendBufferDownload(res, exportFile);
  }));

  router.get('/operating-expenses/export', requirePermission('FINANCE_VIEW_ALL'), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const exportFile = await useCases.exportOperatingExpensesReport({
      actor: req.user,
      format,
      filters: {
        fromDate: req.query.fromDate || req.query.startDate,
        toDate: req.query.toDate || req.query.endDate,
        status: req.query.status,
        employeeId: req.query.employeeId || req.query.createdByUserId,
      },
    });

    if (Array.isArray(exportFile.sheets)) {
      const buffer = await buildWorkbookBuffer(exportFile.sheets);
      sendBufferDownload(res, {
        contentType: exportFile.contentType,
        fileName: exportFile.fileName,
        buffer,
      });
      return;
    }

    sendBufferDownload(res, exportFile);
  }));

  router.get('/customer-history/:customerId', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.customerId, 'customerId');
    res.json(await useCases.getCustomerHistory({ actor: req.user, customerId }));
  }));

  router.get('/customer-history/:customerId/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.customerId, 'customerId');
    const format = String(req.query.format || 'pdf').toLowerCase();
    const exportFile = await useCases.exportCustomerHistory({ actor: req.user, customerId, format });
    sendBufferDownload(res, exportFile);
  }));

  router.get('/customer-credit-profile/:customerId', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.customerId, 'customerId');
    res.json(await useCases.getCustomerCreditProfile({ actor: req.user, customerId }));
  }));

  router.get('/customer-credit-profile/:customerId/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.customerId, 'customerId');
    const format = String(req.query.format || 'pdf').toLowerCase();
    const exportFile = await useCases.exportCustomerCreditProfile({ actor: req.user, customerId, format });
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
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const exportFile = await useCases.exportCustomerProfitabilityReport({
      actor: req.user,
      filters: { fromDate: req.query.fromDate, toDate: req.query.toDate },
      format,
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
    const loanId = parseRequiredRouteId(req.params.loanId, 'loanId');
    const history = await useCases.getCustomerCreditHistory({ actor: req.user, loanId });
    res.json({ success: true, data: { history } });
  }));

  router.get('/credit-history/loan/:loanId/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'pdf').toLowerCase();
    const loanId = parseRequiredRouteId(req.params.loanId, 'loanId');
    const exportFile = await useCases.exportCustomerCreditHistory({ actor: req.user, loanId, format });
    sendBufferDownload(res, exportFile);
  }));

  router.get('/credit-history/financial-products', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.listCreditHistoryFinancialProducts({ actor: req.user }));
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

  // === Financial Analytics Routes ===

  router.get('/credit-earnings', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getCreditEarnings({ actor: req.user }));
  }));

  router.get('/interest-earnings', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getInterestEarnings({ actor: req.user, year: parseOptionalReportYear(req.query.year) }));
  }));

  router.get('/monthly-earnings', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getMonthlyEarnings({ actor: req.user, year: parseOptionalReportYear(req.query.year) }));
  }));

  router.get('/monthly-interest', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getMonthlyInterest({ actor: req.user, year: parseOptionalReportYear(req.query.year) }));
  }));

  router.get('/performance-analysis', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getPerformanceAnalysis({ actor: req.user, year: parseOptionalReportYear(req.query.year) }));
  }));

  router.get('/executive-dashboard', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getExecutiveDashboard({ actor: req.user }));
  }));

  router.get('/comprehensive-analytics', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getComprehensiveAnalytics({ actor: req.user, year: parseOptionalReportYear(req.query.year) }));
  }));

  router.get('/comparative-analysis', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getComparativeAnalysis({ actor: req.user, year: parseOptionalReportYear(req.query.year) }));
  }));

  router.post('/comparative-analysis', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const parsedYear = parseOptionalReportYear(req.body?.year);
    res.json(await useCases.getComparativeAnalysis({ actor: req.user, year: parsedYear }));
  }));

  router.post('/earnings-report', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const parsedYear = parseOptionalReportYear(req.body?.year);
    const earnings = await useCases.getMonthlyEarnings({ actor: req.user, year: parsedYear });
    const interest = await useCases.getInterestEarnings({ actor: req.user, year: parsedYear });

    res.json({
      success: true,
      data: {
        year: earnings?.data?.year || parsedYear || new Date().getFullYear(),
        monthlyEarnings: earnings?.data?.months || [],
        interestEarnings: interest?.data?.byMonth || [],
        totalInterest: interest?.data?.totalInterest || '0.00',
      },
    });
  }));

  router.get('/forecast-analysis', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getForecastAnalysis({ actor: req.user, year: parseOptionalReportYear(req.query.year) }));
  }));

  router.get('/next-month-projection', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getNextMonthProjection({ actor: req.user }));
  }));

  // Consolidated analytics bundle: one round-trip for the Analytics tab instead
  // of six overlapping requests reconciled on the client.
  router.get('/financial-analytics', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getFinancialAnalytics({ actor: req.user, year: parseOptionalReportYear(req.query.year) }));
  }));

  router.get('/analytics/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const exportFile = await useCases.exportFinancialAnalyticsReport({
      actor: req.user,
      year: parseOptionalReportYear(req.query.year),
      format: req.query.format,
    });

    if (exportFile.contentType === 'application/pdf') {
      sendBufferDownload(res, exportFile);
      return;
    }

    const workbookSheets = Array.isArray(exportFile.sheets) && exportFile.sheets.length > 0
      ? exportFile.sheets
      : requireWorkbookSheets({ data: { sheets: exportFile.sheets } }, 'La exportación de analítica financiera');
    const buffer = await buildWorkbookBuffer(workbookSheets);
    sendBufferDownload(res, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: exportFile.fileName || `analitica-financiera-${req.query.year || new Date().getFullYear()}.xlsx`,
      buffer,
    });
  }));

  // Credits Excel Export and Summary
  router.get('/credits/excel', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const exportData = await useCases.exportCreditsExcel({ actor: req.user, filters: buildCreditExportFilters(req.query) });
    const workbookSheets = requireWorkbookSheets(exportData, 'La exportación de créditos');
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
    const workbookSheets = requireWorkbookSheets(exportData, 'La exportación de créditos');
    const buffer = await buildWorkbookBuffer(workbookSheets);
    sendBufferDownload(res, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `reporte-creditos-${buildExportSuffix(req.query)}.xlsx`,
      buffer,
    });
  }));

  router.get('/payouts/excel', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const exportData = await useCases.exportPayoutsExcel({ actor: req.user, filters: buildPayoutExportFilters(req.query) });
    const workbookSheets = requireWorkbookSheets(exportData, 'La exportación de pagos');
    const buffer = await buildWorkbookBuffer(workbookSheets);
    sendBufferDownload(res, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `reporte-pagos-${buildExportSuffix(req.query)}.xlsx`,
      buffer,
    });
  }));

  router.get('/payouts/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const filters = buildPayoutExportFilters(req.query);

    if (format === 'pdf') {
      const exportFile = await useCases.exportPayoutsPdf({ actor: req.user, filters });
      sendBufferDownload(res, exportFile);
      return;
    }

    const exportData = await useCases.exportPayoutsExcel({ actor: req.user, filters });
    const workbookSheets = requireWorkbookSheets(exportData, 'La exportación de pagos');
    const buffer = await buildWorkbookBuffer(workbookSheets);
    sendBufferDownload(res, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `reporte-pagos-${buildExportSuffix(req.query)}.xlsx`,
      buffer,
    });
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
        employeeId: req.query.employeeId,
      },
    }));
  }));

  // GET /reports/payment-schedule/:loanId - Get amortization schedule for a specific loan
  router.get('/payment-schedule/:loanId', requirePermission('CREDITS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getPaymentSchedule({
      actor: req.user,
      loanId: parseRequiredRouteId(req.params.loanId, 'loanId'),
    }));
  }));

  return router;
};

module.exports = {
  createReportsRouter,
};
