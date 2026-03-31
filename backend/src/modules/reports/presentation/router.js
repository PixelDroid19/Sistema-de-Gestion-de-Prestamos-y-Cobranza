const express = require('express');
const XLSX = require('xlsx');
const { asyncHandler } = require('../../../utils/errorHandler');
const { attachPagination } = require('../../../middleware/validation');

const createReportsRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

  router.get('/recovered', authMiddleware(['admin']), attachPagination(), asyncHandler(async (req, res) => {
    res.json(await useCases.getRecoveredLoans({ actor: req.user, pagination: req.pagination }));
  }));

  router.get('/outstanding', authMiddleware(['admin']), attachPagination(), asyncHandler(async (req, res) => {
    res.json(await useCases.getOutstandingLoans({ actor: req.user, pagination: req.pagination }));
  }));

  router.get('/recovery', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getRecoveryReport({ actor: req.user }));
  }));

  router.get('/dashboard', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getDashboardSummary({ actor: req.user }));
  }));

  router.get('/customer-history/:customerId', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getCustomerHistory({ actor: req.user, customerId: req.params.customerId }));
  }));

  router.get('/customer-history/:customerId/export', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'pdf').toLowerCase();
    const exportFile = await useCases.exportCustomerHistory({ actor: req.user, customerId: req.params.customerId, format });
    res.setHeader('Content-Type', exportFile.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.fileName}"`);
    res.send(exportFile.buffer);
  }));

  router.get('/customer-credit-profile/:customerId', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getCustomerCreditProfile({ actor: req.user, customerId: req.params.customerId }));
  }));

  router.get('/customer-credit-profile/:customerId/export', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'pdf').toLowerCase();
    const exportFile = await useCases.exportCustomerCreditProfile({ actor: req.user, customerId: req.params.customerId, format });
    res.setHeader('Content-Type', exportFile.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.fileName}"`);
    res.send(exportFile.buffer);
  }));

  router.get('/profitability/customers', authMiddleware(['admin']), attachPagination(), asyncHandler(async (req, res) => {
    res.json(await useCases.getCustomerProfitabilityReport({
      actor: req.user,
      pagination: req.pagination,
      filters: { fromDate: req.query.fromDate, toDate: req.query.toDate },
    }));
  }));

  router.get('/profitability/loans', authMiddleware(['admin']), attachPagination(), asyncHandler(async (req, res) => {
    res.json(await useCases.getLoanProfitabilityReport({
      actor: req.user,
      pagination: req.pagination,
      filters: { fromDate: req.query.fromDate, toDate: req.query.toDate },
    }));
  }));

  router.get('/recovery/export', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'csv').toLowerCase();
    const exportFile = await useCases.exportRecoveryReport({ actor: req.user, format });
    res.setHeader('Content-Type', exportFile.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.fileName}"`);
    res.send(exportFile.buffer);
  }));

  router.get('/credit-history/loan/:loanId', authMiddleware(['admin', 'customer', 'socio']), asyncHandler(async (req, res) => {
    const history = await useCases.getCustomerCreditHistory({ actor: req.user, loanId: req.params.loanId });
    res.json({ success: true, data: { history } });
  }));

  router.get('/credit-history/loan/:loanId/export', authMiddleware(['admin', 'customer', 'socio']), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'pdf').toLowerCase();
    const exportFile = await useCases.exportCustomerCreditHistory({ actor: req.user, loanId: req.params.loanId, format });
    res.setHeader('Content-Type', exportFile.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.fileName}"`);
    res.send(exportFile.buffer);
  }));

  router.get('/associates/profitability/:associateId', authMiddleware(['admin', 'socio']), asyncHandler(async (req, res) => {
    const report = await useCases.getAssociateProfitabilityReport({ actor: req.user, associateId: req.params.associateId });
    res.json({ success: true, data: { report } });
  }));

  router.get('/associates/profitability', authMiddleware(['socio']), asyncHandler(async (req, res) => {
    const report = await useCases.getAssociateProfitabilityReport({ actor: req.user });
    res.json({ success: true, data: { report } });
  }));

  router.get('/associates/:associateId/export', authMiddleware(['admin', 'socio']), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    const exportFile = await useCases.exportAssociateProfitabilityReport({
      actor: req.user,
      associateId: req.params.associateId,
      format,
    });
    res.setHeader('Content-Type', exportFile.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.fileName}"`);
    res.send(exportFile.buffer);
  }));

  // === Financial Analytics Routes ===

  router.get('/credit-earnings', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getCreditEarnings({ actor: req.user }));
  }));

  router.get('/interest-earnings', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getInterestEarnings({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/monthly-earnings', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getMonthlyEarnings({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/monthly-interest', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getMonthlyInterest({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/performance-analysis', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getPerformanceAnalysis({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/executive-dashboard', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getExecutiveDashboard({ actor: req.user }));
  }));

  router.get('/comprehensive-analytics', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getComprehensiveAnalytics({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/comparative-analysis', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getComparativeAnalysis({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/forecast-analysis', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getForecastAnalysis({ actor: req.user, year: req.query.year ? parseInt(req.query.year, 10) : undefined }));
  }));

  router.get('/next-month-projection', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getNextMonthProjection({ actor: req.user }));
  }));

  // Credits Excel Export and Summary
  router.get('/credits/excel', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const exportData = await useCases.exportCreditsExcel({ actor: req.user });
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData.data.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Credits');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="credits-export.xlsx"');
    res.send(buffer);
  }));

  router.get('/credits/summary', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getCreditsSummary({ actor: req.user }));
  }));

  router.get('/associates/excel', authMiddleware(['admin', 'socio']), asyncHandler(async (req, res) => {
    const exportData = await useCases.exportAssociatesExcel({ actor: req.user });
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData.data.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Associates');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="associates-export.xlsx"');
    res.send(buffer);
  }));

  return router;
};

module.exports = {
  createReportsRouter,
};
