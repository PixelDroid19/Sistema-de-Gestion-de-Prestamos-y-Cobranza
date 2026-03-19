const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createReportsRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

  router.get('/recovered', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getRecoveredLoans({ actor: req.user }));
  }));

  router.get('/outstanding', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getOutstandingLoans({ actor: req.user }));
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

  router.get('/recovery/export', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'csv').toLowerCase();
    const exportFile = await useCases.exportRecoveryReport({ actor: req.user, format });
    res.setHeader('Content-Type', exportFile.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.fileName}"`);
    res.send(exportFile.buffer);
  }));

  router.get('/credit-history/loan/:loanId', authMiddleware(['admin', 'agent', 'customer', 'socio']), asyncHandler(async (req, res) => {
    const history = await useCases.getCustomerCreditHistory({ actor: req.user, loanId: req.params.loanId });
    res.json({ success: true, data: { history } });
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

  return router;
};

module.exports = {
  createReportsRouter,
};
