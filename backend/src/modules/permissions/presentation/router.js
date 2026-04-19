const express = require('express');
const { asyncHandler } = require('@/utils/errorHandler');

const createPermissionsRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

  router.use(authMiddleware());

  const extractTargetUserId = (body = {}) => body.targetUserId ?? body.userId;
  const extractPermissionReference = (body = {}) => ({
    permissionId: body.permissionId,
    permission: body.permission,
  });

  // API contract notes (backend/frontend compatibility):
  // - Grant/Revoke accept either { targetUserId, permissionId } (legacy)
  //   or { userId, permission } (frontend migration).
  // - Listing endpoints always include: permissions (flat), permissionsByModule, total.
  // - User permission endpoints include flat permissions plus role/direct breakdown.

  router.get('/', asyncHandler(async (_req, res) => {
    const result = await useCases.listPermissions();
    res.json({ success: true, data: result });
  }));

  router.get('/by-module/:module', asyncHandler(async (req, res) => {
    const result = await useCases.getPermissionsByModule({ module: req.params.module });
    res.json({ success: true, data: result });
  }));

  router.get('/user/:userId', asyncHandler(async (req, res) => {
    const result = await useCases.getUserPermissions({ actor: req.user, targetUserId: req.params.userId });
    res.json({ success: true, data: result });
  }));

  router.get('/me', asyncHandler(async (req, res) => {
    const result = await useCases.getMyPermissions({ actor: req.user });
    res.json({ success: true, data: result });
  }));

  router.get('/me/summary', asyncHandler(async (req, res) => {
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

  router.post('/grant', asyncHandler(async (req, res) => {
    const { permissionId, permission } = extractPermissionReference(req.body);
    const result = await useCases.grantPermission({
      actor: req.user,
      targetUserId: extractTargetUserId(req.body),
      permissionId,
      permission,
    });
    res.status(201).json({ success: true, message: 'Permission granted successfully', data: result });
  }));

  router.post('/grant/batch', asyncHandler(async (req, res) => {
    const result = await useCases.grantBatchPermissions({
      actor: req.user,
      targetUserId: extractTargetUserId(req.body),
      permissionIds: req.body.permissionIds,
      permissions: req.body.permissions,
    });
    res.status(201).json({ success: true, message: 'Batch permissions granted', data: result });
  }));

  router.post('/revoke', asyncHandler(async (req, res) => {
    const { permissionId, permission } = extractPermissionReference(req.body);
    const result = await useCases.revokePermission({
      actor: req.user,
      targetUserId: extractTargetUserId(req.body),
      permissionId,
      permission,
    });
    res.json({ success: true, message: 'Permission revoked successfully', data: result });
  }));

  router.delete('/direct', asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const { permissionId, permission } = extractPermissionReference(payload);
    const result = await useCases.revokePermission({
      actor: req.user,
      targetUserId: extractTargetUserId(payload),
      permissionId,
      permission,
    });
    res.json({ success: true, message: 'Direct permission revoked successfully', data: result });
  }));

  router.post('/check', asyncHandler(async (req, res) => {
    const result = await useCases.checkPermission({
      actor: req.user,
      permissionName: req.body.permissionName ?? req.body.permission,
    });
    res.json({ success: true, data: result });
  }));

  router.post('/check-multiple', asyncHandler(async (req, res) => {
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
