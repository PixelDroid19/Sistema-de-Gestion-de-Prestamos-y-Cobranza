const express = require('express');
const { asyncHandler } = require('@/utils/errorHandler');

const runOptionalSideEffect = async (label, sideEffect) => {
  try {
    await sideEffect();
  } catch (error) {
    console.error(`${label} failed:`, error?.message || error);
  }
};

/**
 * Persist operator-facing traceability for configuration mutations.
 * @param {{ auditService?: object, notificationService?: object, req: object, action: string, entityType: string, entityId?: string|number, payload?: object, message: string }} params
 * @returns {Promise<void>}
 */
const recordConfigMutation = async ({
  auditService,
  notificationService,
  req,
  action,
  entityType,
  entityId,
  payload,
  message,
}) => {
  const actor = req.user;
  const eventPayload = {
    entityType,
    entityId: entityId ?? null,
    message,
    ...(payload ? { payload } : {}),
  };

  await runOptionalSideEffect('Config audit logging', () => auditService?.log?.({
    actor,
    action,
    module: 'config',
    entityId,
    entityType,
    newData: payload || null,
    metadata: eventPayload,
    req,
  }));

  if (!actor?.id) return;

  await runOptionalSideEffect('Config notification', () => notificationService?.sendNotification?.(
    actor.id,
    message,
    'config_changed',
    eventPayload,
    { dedupeKey: `config:${action}:${entityType}:${entityId ?? 'unknown'}:${Date.now()}` },
  ));
};

const createConfigRouter = ({ authMiddleware, useCases, auditService, notificationService }) => {
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

  router.get('/rate-policies', asyncHandler(async (_req, res) => {
    const policies = await useCases.listRatePolicies();
    res.json({ success: true, data: { policies } });
  }));

  router.get('/rate-policies/resolve', asyncHandler(async (req, res) => {
    const policy = await useCases.resolveRatePolicy({ amount: req.query.amount });
    res.json({ success: true, data: { policy } });
  }));

  router.post('/rate-policies', asyncHandler(async (req, res) => {
    const policy = await useCases.createRatePolicy(req.body);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'CREATE',
      entityType: 'RatePolicy',
      entityId: policy?.id,
      payload: { policy },
      message: `Política de tasa "${policy?.label || policy?.key || policy?.id}" creada.`,
    });
    res.status(201).json({ success: true, message: 'Rate policy created successfully', data: { policy } });
  }));

  router.put('/rate-policies/:policyId', asyncHandler(async (req, res) => {
    const policy = await useCases.updateRatePolicy(req.params.policyId, req.body);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'UPDATE',
      entityType: 'RatePolicy',
      entityId: policy?.id || req.params.policyId,
      payload: { policy },
      message: `Política de tasa "${policy?.label || policy?.key || req.params.policyId}" actualizada.`,
    });
    res.json({ success: true, message: 'Rate policy updated successfully', data: { policy } });
  }));

  router.delete('/rate-policies/:policyId', asyncHandler(async (req, res) => {
    const result = await useCases.deleteRatePolicy(req.params.policyId);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'DELETE',
      entityType: 'RatePolicy',
      entityId: result?.id || req.params.policyId,
      payload: { result },
      message: `Política de tasa #${result?.id || req.params.policyId} eliminada.`,
    });
    res.json({ success: true, message: 'Rate policy deleted successfully', data: result });
  }));

  router.get('/late-fee-policies', asyncHandler(async (_req, res) => {
    const policies = await useCases.listLateFeePolicies();
    res.json({ success: true, data: { policies } });
  }));

  router.get('/late-fee-policies/resolve', asyncHandler(async (_req, res) => {
    const policy = await useCases.resolveLateFeePolicy();
    res.json({ success: true, data: { policy } });
  }));

  router.post('/late-fee-policies', asyncHandler(async (req, res) => {
    const policy = await useCases.createLateFeePolicy(req.body);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'CREATE',
      entityType: 'LateFeePolicy',
      entityId: policy?.id,
      payload: { policy },
      message: `Política de mora "${policy?.label || policy?.key || policy?.id}" creada.`,
    });
    res.status(201).json({ success: true, message: 'Late fee policy created successfully', data: { policy } });
  }));

  router.put('/late-fee-policies/:policyId', asyncHandler(async (req, res) => {
    const policy = await useCases.updateLateFeePolicy(req.params.policyId, req.body);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'UPDATE',
      entityType: 'LateFeePolicy',
      entityId: policy?.id || req.params.policyId,
      payload: { policy },
      message: `Política de mora "${policy?.label || policy?.key || req.params.policyId}" actualizada.`,
    });
    res.json({ success: true, message: 'Late fee policy updated successfully', data: { policy } });
  }));

  router.delete('/late-fee-policies/:policyId', asyncHandler(async (req, res) => {
    const result = await useCases.deleteLateFeePolicy(req.params.policyId);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'DELETE',
      entityType: 'LateFeePolicy',
      entityId: result?.id || req.params.policyId,
      payload: { result },
      message: `Política de mora #${result?.id || req.params.policyId} eliminada.`,
    });
    res.json({ success: true, message: 'Late fee policy deleted successfully', data: result });
  }));

  router.post('/payment-methods', asyncHandler(async (req, res) => {
    const paymentMethod = await useCases.createPaymentMethod(req.body);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'CREATE',
      entityType: 'PaymentMethod',
      entityId: paymentMethod?.id,
      payload: { paymentMethod },
      message: `Método de pago "${paymentMethod?.label || paymentMethod?.key || paymentMethod?.id}" creado.`,
    });
    res.status(201).json({ success: true, message: 'Payment method created successfully', data: { paymentMethod } });
  }));

  router.put('/payment-methods/:paymentMethodId', asyncHandler(async (req, res) => {
    const paymentMethod = await useCases.updatePaymentMethod(req.params.paymentMethodId, req.body);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'UPDATE',
      entityType: 'PaymentMethod',
      entityId: paymentMethod?.id || req.params.paymentMethodId,
      payload: { paymentMethod },
      message: `Método de pago "${paymentMethod?.label || paymentMethod?.key || req.params.paymentMethodId}" actualizado.`,
    });
    res.json({ success: true, message: 'Payment method updated successfully', data: { paymentMethod } });
  }));

  router.delete('/payment-methods/:paymentMethodId', asyncHandler(async (req, res) => {
    const result = await useCases.deletePaymentMethod(req.params.paymentMethodId);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'DELETE',
      entityType: 'PaymentMethod',
      entityId: result?.id || req.params.paymentMethodId,
      payload: { result },
      message: `Método de pago #${result?.id || req.params.paymentMethodId} eliminado.`,
    });
    res.json({ success: true, message: 'Payment method deleted successfully', data: result });
  }));

  router.get('/settings', asyncHandler(async (_req, res) => {
    const settings = await useCases.listSettings();
    res.json({ success: true, data: { settings } });
  }));

  router.put('/settings/:settingKey', asyncHandler(async (req, res) => {
    const setting = await useCases.upsertSetting(req.params.settingKey, req.body);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'UPDATE',
      entityType: 'BusinessSetting',
      entityId: setting?.id || req.params.settingKey,
      payload: { setting },
      message: `Ajuste "${setting?.label || setting?.key || req.params.settingKey}" actualizado.`,
    });
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
