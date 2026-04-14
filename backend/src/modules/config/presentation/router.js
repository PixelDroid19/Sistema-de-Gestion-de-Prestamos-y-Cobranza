const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createConfigRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

  // Public endpoint - no auth required
  router.get('/roles', asyncHandler(async (_req, res) => {
    const roles = await useCases.listRoles();
    res.json({ success: true, data: { roles } });
  }));

  router.use(authMiddleware(['admin']));

  router.get('/payment-methods', asyncHandler(async (_req, res) => {
    const paymentMethods = await useCases.listPaymentMethods();
    res.json({ success: true, data: { paymentMethods } });
  }));

  router.get('/pmconfig', asyncHandler(async (_req, res) => {
    const paymentMethods = await useCases.listPaymentMethodsLegacy();
    res.json({ success: true, data: { paymentMethods } });
  }));

  router.post('/payment-methods', asyncHandler(async (req, res) => {
    const paymentMethod = await useCases.createPaymentMethod(req.body);
    res.status(201).json({ success: true, message: 'Payment method created successfully', data: { paymentMethod } });
  }));

  router.put('/payment-methods/:paymentMethodId', asyncHandler(async (req, res) => {
    const paymentMethod = await useCases.updatePaymentMethod(req.params.paymentMethodId, req.body);
    res.json({ success: true, message: 'Payment method updated successfully', data: { paymentMethod } });
  }));

  router.delete('/payment-methods/:paymentMethodId', asyncHandler(async (req, res) => {
    const result = await useCases.deletePaymentMethod(req.params.paymentMethodId);
    res.json({ success: true, message: 'Payment method deleted successfully', data: result });
  }));

  router.get('/settings', asyncHandler(async (_req, res) => {
    const settings = await useCases.listSettings();
    res.json({ success: true, data: { settings } });
  }));

  router.put('/settings/:settingKey', asyncHandler(async (req, res) => {
    const setting = await useCases.upsertSetting(req.params.settingKey, req.body);
    res.json({ success: true, message: 'Setting saved successfully', data: { setting } });
  }));

  router.get('/catalogs', asyncHandler(async (_req, res) => {
    const catalogs = await useCases.listAdminCatalogs();
    res.json({ success: true, data: { catalogs } });
  }));

  // TNA Rates
  router.get('/tna-rates', asyncHandler(async (_req, res) => {
    const tnaRates = await useCases.listTnaRates();
    res.json({ success: true, data: { tnaRates } });
  }));

  router.get('/tna-rates/stats', asyncHandler(async (_req, res) => {
    const result = await useCases.getTnaRateStats();
    res.json({ success: true, data: result });
  }));

  router.get('/tna-rates/user/:id', asyncHandler(async (req, res) => {
    const result = await useCases.findTnaRatesByUser({ userId: req.params.id });
    res.json({ success: true, data: result });
  }));

  router.post('/tna-rates', asyncHandler(async (req, res) => {
    const tnaRate = await useCases.createTnaRate(req.body);
    res.status(201).json({ success: true, message: 'TNA rate created successfully', data: { tnaRate } });
  }));

  router.put('/tna-rates/:id', asyncHandler(async (req, res) => {
    const tnaRate = await useCases.updateTnaRate(req.params.id, req.body);
    res.json({ success: true, message: 'TNA rate updated successfully', data: { tnaRate } });
  }));

  router.delete('/tna-rates/:id', asyncHandler(async (req, res) => {
    const result = await useCases.deleteTnaRate(req.params.id);
    res.json({ success: true, message: 'TNA rate deleted successfully', data: result });
  }));

  // Late Fee Policies
  router.get('/late-fee-policies', asyncHandler(async (_req, res) => {
    const policies = await useCases.listLateFeePolicies();
    res.json({ success: true, data: { lateFeePolicies: policies } });
  }));

  router.post('/late-fee-policies', asyncHandler(async (req, res) => {
    const policy = await useCases.createLateFeePolicy(req.body);
    res.status(201).json({ success: true, message: 'Late fee policy created successfully', data: { lateFeePolicy: policy } });
  }));

  router.put('/late-fee-policies/:id', asyncHandler(async (req, res) => {
    const policy = await useCases.updateLateFeePolicy(req.params.id, req.body);
    res.json({ success: true, message: 'Late fee policy updated successfully', data: { lateFeePolicy: policy } });
  }));

  router.delete('/late-fee-policies/:id', asyncHandler(async (req, res) => {
    const result = await useCases.deleteLateFeePolicy(req.params.id);
    res.json({ success: true, message: 'Late fee policy deleted successfully', data: result });
  }));

  router.post('/late-fee/resolve', asyncHandler(async (req, res) => {
    const userId = req.body?.userId || req.user?.id;
    const result = await useCases.resolveLateFeePolicyForUser({ userId });
    res.json({ success: true, data: result });
  }));

  router.get('/late-fee/user/:id', asyncHandler(async (req, res) => {
    const result = await useCases.resolveLateFeePolicyForUser({ userId: req.params.id });
    res.json({ success: true, data: result });
  }));

  // Interest Nodes
  router.get('/interest-nodes', asyncHandler(async (_req, res) => {
    const nodes = await useCases.listInterestNodes();
    res.json({ success: true, data: { interestNodes: nodes } });
  }));

  router.post('/interest-nodes', asyncHandler(async (req, res) => {
    const node = await useCases.createInterestNode(req.body);
    res.status(201).json({ success: true, message: 'Interest node created successfully', data: { interestNode: node } });
  }));

  router.put('/interest-nodes/:id', asyncHandler(async (req, res) => {
    const node = await useCases.updateInterestNode(req.params.id, req.body);
    res.json({ success: true, message: 'Interest node updated successfully', data: { interestNode: node } });
  }));

  router.delete('/interest-nodes/:id', asyncHandler(async (req, res) => {
    const result = await useCases.deleteInterestNode(req.params.id);
    res.json({ success: true, message: 'Interest node deleted successfully', data: result });
  }));

  return router;
};

module.exports = {
  createConfigRouter,
};
