const express = require('express');
const { asyncHandler, ValidationError } = require('@/utils/errorHandler');
const { attachPagination } = require('@/middleware/validation');
const { sendBufferDownload } = require('@/modules/shared/http');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');
const { buildWorkbookBuffer } = require('@/modules/reports/application/workbookBuilder');

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
  router.get('/outstanding', requirePermission('REPORTS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    res.json(await useCases.getOutstandingLoans({ actor: req.user, pagination: req.pagination }));
  }));

  router.get('/outstanding/export', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const exportFile = await useCases.exportOutstandingReport({ actor: req.user, format });
    sendBufferDownload(res, exportFile);
  }));

  router.get('/dashboard', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    res.json(await useCases.getDashboardSummary({ actor: req.user }));
  }));

  router.get('/cash-flow/monthly', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const year = parseOptionalReportYear(req.query.year);
    const filters = { fromDate: req.query.fromDate, toDate: req.query.toDate };
    res.json(await useCases.getMonthlyCashFlow({ actor: req.user, year, filters }));
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

  router.get('/customer-credit-profile/:customerId', requirePermission('REPORTS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const customerId = parseRequiredRouteId(req.params.customerId, 'customerId');
    res.json(await useCases.getCustomerCreditProfile({ actor: req.user, customerId }));
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
