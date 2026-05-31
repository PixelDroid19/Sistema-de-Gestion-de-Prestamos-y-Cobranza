const express = require('express');
const { asyncHandler, ValidationError } = require('@/utils/errorHandler');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');

/**
 * Composes permission catalog, effective-permission and grant/revoke routes
 * from authorization middleware and permission use cases.
 * @param {{ authMiddleware: Function, useCases: object }} dependencies
 * @returns {import('express').Router} Express router for administrative permission management.
 */
const createPermissionsRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();
  /**
   * Parses user route identifiers without accepting partial numeric coercion.
   * @param {string|number} value
   * @returns {number}
   */
  const parseUserId = (value) => {
    if (!validateIntegerId(value)) {
      throw new ValidationError(buildInvalidIntegerIdMessage('userId'));
    }

    return Number(String(value).trim());
  };

  const extractTargetUserId = (body = {}) => body.targetUserId ?? body.userId;
  const extractPermissionReference = (body = {}) => ({
    permissionId: body.permissionId,
    permission: body.permission,
  });

  // API contract notes:
  // - Grant/Revoke accept either numeric permission ids or permission names.
  // - Listing endpoints always include: permissions (flat), permissionsByModule, total.
  // - User permission endpoints include flat permissions plus role/direct breakdown.

  router.get('/', authMiddleware({ permissions: ['PERMISSIONS_VIEW_ALL'] }), asyncHandler(async (_req, res) => {
    const result = await useCases.listPermissions();
    res.json({ success: true, data: result });
  }));

  router.get('/by-module/:module', authMiddleware({ permissions: ['PERMISSIONS_VIEW_ALL'] }), asyncHandler(async (req, res) => {
    const result = await useCases.getPermissionsByModule({ module: req.params.module });
    res.json({ success: true, data: result });
  }));

  router.get('/user/:userId', authMiddleware({ permissions: ['PERMISSIONS_VIEW_ALL'] }), asyncHandler(async (req, res) => {
    const targetUserId = parseUserId(req.params.userId);
    const result = await useCases.getUserPermissions({ actor: req.user, targetUserId });
    res.json({ success: true, data: result });
  }));

  router.get('/me', authMiddleware(), asyncHandler(async (req, res) => {
    const result = await useCases.getMyPermissions({ actor: req.user });
    res.json({ success: true, data: result });
  }));

  router.get('/me/summary', authMiddleware(), asyncHandler(async (req, res) => {
    const result = await useCases.getMyPermissions({ actor: req.user });
    const permissions = result.permissions || [];

    const summary = permissions.reduce((acc, perm) => {
      const module = perm.module || 'OTHER';
      const permissionName = perm.name || perm.permission || perm.permissionName;
      if (!acc[module]) {
        acc[module] = { count: 0, permissions: [] };
      }
      acc[module].count++;
      if (permissionName) {
        acc[module].permissions.push(permissionName);
      }
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        total: permissions.length,
        byModule: summary,
      },
    });
  }));

  router.post('/grant', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const { permissionId, permission } = extractPermissionReference(req.body);
    const result = await useCases.grantPermission({
      actor: req.user,
      targetUserId: extractTargetUserId(req.body),
      permissionId,
      permission,
    });
    res.status(201).json({ success: true, message: 'Permiso concedido correctamente', data: result });
  }));

  router.post('/grant/batch', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.grantBatchPermissions({
      actor: req.user,
      targetUserId: extractTargetUserId(req.body),
      permissionIds: req.body.permissionIds,
      permissions: req.body.permissions,
    });
    res.status(201).json({ success: true, message: 'Permisos concedidos correctamente', data: result });
  }));

  router.post('/revoke', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const { permissionId, permission } = extractPermissionReference(req.body);
    const result = await useCases.revokePermission({
      actor: req.user,
      targetUserId: extractTargetUserId(req.body),
      permissionId,
      permission,
    });
    res.json({ success: true, message: 'Permiso revocado correctamente', data: result });
  }));

  router.delete('/direct', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const { permissionId, permission } = extractPermissionReference(payload);
    const result = await useCases.revokePermission({
      actor: req.user,
      targetUserId: extractTargetUserId(payload),
      permissionId,
      permission,
    });
    res.json({ success: true, message: 'Permiso directo revocado correctamente', data: result });
  }));

  router.post('/check', authMiddleware(), asyncHandler(async (req, res) => {
    const result = await useCases.checkPermission({
      actor: req.user,
      permissionName: req.body.permissionName ?? req.body.permission,
    });
    res.json({ success: true, data: result });
  }));

  router.post('/check-multiple', authMiddleware(), asyncHandler(async (req, res) => {
    const result = await useCases.checkMultiplePermissions({
      actor: req.user,
      permissionNames: req.body.permissionNames,
      permissions: req.body.permissions,
    });
    res.json({ success: true, data: result });
  }));

  return router;
};

module.exports = {
  createPermissionsRouter,
};
