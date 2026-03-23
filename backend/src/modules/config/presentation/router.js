const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createConfigRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

  router.use(authMiddleware(['admin']));

  router.get('/payment-methods', asyncHandler(async (_req, res) => {
    const paymentMethods = await useCases.listPaymentMethods();
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

  return router;
};

module.exports = {
  createConfigRouter,
};
