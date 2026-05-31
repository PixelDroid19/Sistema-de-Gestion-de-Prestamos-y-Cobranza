const express = require('express');
const { asyncHandler, ValidationError } = require('@/utils/errorHandler');
const { logger } = require('@/utils/logger');
const { domainEventBus } = require('@/modules/shared/events');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');

const runOptionalSideEffect = async (label, sideEffect) => {
  try {
    await sideEffect();
  } catch (error) {
    logger.warn(`Optional side-effect failed: ${label}`, { error: error?.message || String(error) });
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

  // Emit domain event for config mutations
  const configEvent = `config.${String(entityType || 'setting').toLowerCase()}.${String(action || 'updated').toLowerCase()}`;
  domainEventBus.emit(configEvent, { entityType, entityId, action });

  if (!actor?.id) return;

  await runOptionalSideEffect('Config notification', () => notificationService?.sendNotification?.(
    actor.id,
    message,
    'config_changed',
    eventPayload,
    { dedupeKey: `config:${action}:${entityType}:${entityId ?? 'unknown'}:${Date.now()}` },
  ));
};

/**
 * Composes public configuration reads and admin-only configuration mutation
 * routes with optional audit and notification side effects.
 * @param {{ authMiddleware: Function, useCases: object, auditService?: object, notificationService?: object }} dependencies
 * @returns {import('express').Router} Express router for operational configuration.
 */
const createConfigRouter = ({ authMiddleware, useCases, auditService, notificationService }) => {
  const router = express.Router();
  /**
   * Parses required config resource identifiers without accepting partial
   * numeric coercion.
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
    res.status(201).json({ success: true, message: 'Política de tasa creada correctamente', data: { policy } });
  }));

  router.put('/rate-policies/:policyId', asyncHandler(async (req, res) => {
    const policyId = parseRequiredRouteId(req.params.policyId, 'policyId');
    const policy = await useCases.updateRatePolicy(policyId, req.body);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'UPDATE',
      entityType: 'RatePolicy',
      entityId: policy?.id || policyId,
      payload: { policy },
      message: `Política de tasa "${policy?.label || policy?.key || policyId}" actualizada.`,
    });
    res.json({ success: true, message: 'Política de tasa actualizada correctamente', data: { policy } });
  }));

  router.delete('/rate-policies/:policyId', asyncHandler(async (req, res) => {
    const policyId = parseRequiredRouteId(req.params.policyId, 'policyId');
    const result = await useCases.deleteRatePolicy(policyId);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'DELETE',
      entityType: 'RatePolicy',
      entityId: result?.id || policyId,
      payload: { result },
      message: `Política de tasa #${result?.id || policyId} eliminada.`,
    });
    res.json({ success: true, message: 'Política de tasa eliminada correctamente', data: result });
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
    res.status(201).json({ success: true, message: 'Política de mora creada correctamente', data: { policy } });
  }));

  router.put('/late-fee-policies/:policyId', asyncHandler(async (req, res) => {
    const policyId = parseRequiredRouteId(req.params.policyId, 'policyId');
    const policy = await useCases.updateLateFeePolicy(policyId, req.body);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'UPDATE',
      entityType: 'LateFeePolicy',
      entityId: policy?.id || policyId,
      payload: { policy },
      message: `Política de mora "${policy?.label || policy?.key || policyId}" actualizada.`,
    });
    res.json({ success: true, message: 'Política de mora actualizada correctamente', data: { policy } });
  }));

  router.delete('/late-fee-policies/:policyId', asyncHandler(async (req, res) => {
    const policyId = parseRequiredRouteId(req.params.policyId, 'policyId');
    const result = await useCases.deleteLateFeePolicy(policyId);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'DELETE',
      entityType: 'LateFeePolicy',
      entityId: result?.id || policyId,
      payload: { result },
      message: `Política de mora #${result?.id || policyId} eliminada.`,
    });
    res.json({ success: true, message: 'Política de mora eliminada correctamente', data: result });
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
    res.status(201).json({ success: true, message: 'Método de pago creado correctamente', data: { paymentMethod } });
  }));

  router.put('/payment-methods/:paymentMethodId', asyncHandler(async (req, res) => {
    const paymentMethodId = parseRequiredRouteId(req.params.paymentMethodId, 'paymentMethodId');
    const paymentMethod = await useCases.updatePaymentMethod(paymentMethodId, req.body);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'UPDATE',
      entityType: 'PaymentMethod',
      entityId: paymentMethod?.id || paymentMethodId,
      payload: { paymentMethod },
      message: `Método de pago "${paymentMethod?.label || paymentMethod?.key || paymentMethodId}" actualizado.`,
    });
    res.json({ success: true, message: 'Método de pago actualizado correctamente', data: { paymentMethod } });
  }));

  router.delete('/payment-methods/:paymentMethodId', asyncHandler(async (req, res) => {
    const paymentMethodId = parseRequiredRouteId(req.params.paymentMethodId, 'paymentMethodId');
    const result = await useCases.deletePaymentMethod(paymentMethodId);
    await recordConfigMutation({
      auditService,
      notificationService,
      req,
      action: 'DELETE',
      entityType: 'PaymentMethod',
      entityId: result?.id || paymentMethodId,
      payload: { result },
      message: `Método de pago #${result?.id || paymentMethodId} eliminado.`,
    });
    res.json({ success: true, message: 'Método de pago eliminado correctamente', data: result });
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
    res.json({ success: true, message: 'Ajuste guardado correctamente', data: { setting } });
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
