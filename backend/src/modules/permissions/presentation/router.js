const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createPermissionsRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

  router.use(authMiddleware());

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
      if (!acc[module]) {
        acc[module] = { count: 0, permissions: [] };
      }
      acc[module].count++;
      acc[module].permissions.push(perm.name);
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
    const result = await useCases.grantPermission({
      actor: req.user,
      targetUserId: req.body.targetUserId,
      permissionId: req.body.permissionId,
    });
    res.status(201).json({ success: true, message: 'Permission granted successfully', data: result });
  }));

  router.post('/grant/batch', asyncHandler(async (req, res) => {
    const result = await useCases.grantBatchPermissions({
      actor: req.user,
      targetUserId: req.body.targetUserId,
      permissionIds: req.body.permissionIds,
    });
    res.status(201).json({ success: true, message: 'Batch permissions granted', data: result });
  }));

  router.post('/revoke', asyncHandler(async (req, res) => {
    const result = await useCases.revokePermission({
      actor: req.user,
      targetUserId: req.body.targetUserId,
      permissionId: req.body.permissionId,
    });
    res.json({ success: true, message: 'Permission revoked successfully', data: result });
  }));

  router.post('/check', asyncHandler(async (req, res) => {
    const result = await useCases.checkPermission({
      actor: req.user,
      permissionName: req.body.permissionName,
    });
    res.json({ success: true, data: result });
  }));

  router.post('/check-multiple', asyncHandler(async (req, res) => {
    const result = await useCases.checkMultiplePermissions({
      actor: req.user,
      permissionNames: req.body.permissionNames,
    });
    res.json({ success: true, data: result });
  }));

  return router;
};

module.exports = {
  createPermissionsRouter,
};
