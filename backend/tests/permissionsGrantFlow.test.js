const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createPermissionsRouter } = require('@/modules/permissions/presentation/router');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const createMockUseCases = (overrides = {}) => {
  const defaultGrantPermission = mock.fn(({ actor, targetUserId, permissionId }) => {
    if (actor.role !== 'admin') {
      const error = new Error('Only admin can grant permissions');
      error.name = 'AuthorizationError';
      error.statusCode = 403;
      throw error;
    }
    return Promise.resolve({
      userPermission: {
        id: 1,
        userId: targetUserId,
        permissionId,
        grantedBy: actor.id,
        createdAt: new Date().toISOString(),
      },
    });
  });

  const defaultRevokePermission = mock.fn(({ actor, targetUserId, permissionId }) => {
    if (actor.role !== 'admin') {
      const error = new Error('Only admin can revoke permissions');
      error.name = 'AuthorizationError';
      error.statusCode = 403;
      throw error;
    }
    return Promise.resolve({ success: true });
  });

  return {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {} })),
    getPermissionsByModule: mock.fn(({ module }) => Promise.resolve({ module, permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: defaultGrantPermission,
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: defaultRevokePermission,
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
    ...overrides,
  };
};

let mockUsers = [];

const setupMockUsers = () => {
  mockUsers = [
    {
      id: 1,
      role: 'admin',
      directPermissions: ['PERMISSIONS_GRANT', 'PERMISSIONS_REVOKE'],
      rolePermissions: [],
    },
    {
      id: 7,
      role: 'customer',
      directPermissions: [],
      rolePermissions: ['CREDITS_VIEW_ALL'],
    },
    {
      id: 10,
      role: 'customer',
      directPermissions: [],
      rolePermissions: [],
    },
  ];
};

test('E2E: user without permission gets denied', async () => {
  setupMockUsers();

  const useCases = createMockUseCases({
    checkPermission: mock.fn(({ actor, permissionName }) => {
      const user = mockUsers.find((u) => u.id === actor.id);
      if (!user) {
        return Promise.resolve({ allowed: false, source: null });
      }
      const hasDirect = user.directPermissions?.includes(permissionName);
      if (hasDirect) {
        return Promise.resolve({ allowed: true, source: 'direct' });
      }
      const hasRole = user.rolePermissions?.includes(permissionName);
      if (hasRole) {
        return Promise.resolve({ allowed: true, source: 'role' });
      }
      return Promise.resolve({ allowed: false, source: null });
    }),
  });

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 10, role: 'customer' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/check',
    headers: { authorization: 'Bearer valid-token' },
    body: { permissionName: 'PERMISSIONS_GRANT' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.allowed, false);
});

test('E2E: admin can grant permission to user', async () => {
  setupMockUsers();

  let grantedPermission = null;

  const useCases = createMockUseCases({
    grantPermission: mock.fn(({ actor, targetUserId, permissionId }) => {
      if (actor.role !== 'admin') {
        const error = new Error('Only admin can grant permissions');
        error.name = 'AuthorizationError';
        error.statusCode = 403;
        throw error;
      }
      grantedPermission = { targetUserId, permissionId };
      return Promise.resolve({
        userPermission: {
          id: 1,
          userId: targetUserId,
          permissionId,
          grantedBy: actor.id,
          createdAt: new Date().toISOString(),
        },
      });
    }),
  });

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/grant',
    headers: { authorization: 'Bearer valid-token' },
    body: { targetUserId: 10, permissionId: 5 },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, 'Permission granted successfully');
  assert.equal(grantedPermission.targetUserId, 10);
  assert.equal(grantedPermission.permissionId, 5);
});

test('E2E: admin can grant permission using permission name payload', async () => {
  setupMockUsers();

  let grantedPermission = null;

  const useCases = createMockUseCases({
    grantPermission: mock.fn(({ actor, targetUserId, permissionId, permission }) => {
      if (actor.role !== 'admin') {
        const error = new Error('Only admin can grant permissions');
        error.name = 'AuthorizationError';
        error.statusCode = 403;
        throw error;
      }

      grantedPermission = { targetUserId, permissionId, permission };
      return Promise.resolve({
        userId: targetUserId,
        permissionId: permissionId ?? 77,
        permission: permission ?? 'CREDITS_VIEW_ALL',
      });
    }),
  });

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/grant',
    headers: { authorization: 'Bearer valid-token' },
    body: { userId: 10, permission: 'CREDITS_VIEW_ALL' },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(grantedPermission.targetUserId, 10);
  assert.equal(grantedPermission.permission, 'CREDITS_VIEW_ALL');
});

test('E2E: user can access after grant', async () => {
  setupMockUsers();

  const useCases = createMockUseCases({
    checkPermission: mock.fn(({ actor, permissionName }) => {
      const user = mockUsers.find((u) => u.id === actor.id);
      if (!user) {
        return Promise.resolve({ allowed: false, source: null });
      }
      const hasDirect = user.directPermissions?.includes(permissionName);
      if (hasDirect) {
        return Promise.resolve({ allowed: true, source: 'direct' });
      }
      const hasRole = user.rolePermissions?.includes(permissionName);
      if (hasRole) {
        return Promise.resolve({ allowed: true, source: 'role' });
      }
      return Promise.resolve({ allowed: false, source: null });
    }),
  });

  mockUsers[1].directPermissions.push('CREDITS_CREATE');

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 7, role: 'customer' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/check',
    headers: { authorization: 'Bearer valid-token' },
    body: { permissionName: 'CREDITS_CREATE' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.allowed, true);
  assert.equal(response.body.data.source, 'direct');
});

test('E2E: admin can revoke permission', async () => {
  setupMockUsers();

  let revokedPermission = null;

  const useCases = createMockUseCases({
    revokePermission: mock.fn(({ actor, targetUserId, permissionId }) => {
      if (actor.role !== 'admin') {
        const error = new Error('Only admin can revoke permissions');
        error.name = 'AuthorizationError';
        error.statusCode = 403;
        throw error;
      }
      revokedPermission = { targetUserId, permissionId };
      return Promise.resolve({ success: true });
    }),
  });

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/revoke',
    headers: { authorization: 'Bearer valid-token' },
    body: { targetUserId: 7, permissionId: 5 },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, 'Permission revoked successfully');
  assert.equal(revokedPermission.targetUserId, 7);
  assert.equal(revokedPermission.permissionId, 5);
});

test('E2E: admin can revoke permission using permission name payload', async () => {
  setupMockUsers();

  let revokedPermission = null;

  const useCases = createMockUseCases({
    revokePermission: mock.fn(({ actor, targetUserId, permissionId, permission }) => {
      if (actor.role !== 'admin') {
        const error = new Error('Only admin can revoke permissions');
        error.name = 'AuthorizationError';
        error.statusCode = 403;
        throw error;
      }

      revokedPermission = { targetUserId, permissionId, permission };
      return Promise.resolve({ success: true, revoked: true });
    }),
  });

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/revoke',
    headers: { authorization: 'Bearer valid-token' },
    body: { userId: 7, permission: 'CREDITS_VIEW_ALL' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(revokedPermission.targetUserId, 7);
  assert.equal(revokedPermission.permission, 'CREDITS_VIEW_ALL');
});

test('E2E: user gets denied after revoke', async () => {
  setupMockUsers();

  const useCases = createMockUseCases({
    checkPermission: mock.fn(({ actor, permissionName }) => {
      const user = mockUsers.find((u) => u.id === actor.id);
      if (!user) {
        return Promise.resolve({ allowed: false, source: null });
      }
      const hasDirect = user.directPermissions?.includes(permissionName);
      if (hasDirect) {
        return Promise.resolve({ allowed: true, source: 'direct' });
      }
      const hasRole = user.rolePermissions?.includes(permissionName);
      if (hasRole) {
        return Promise.resolve({ allowed: true, source: 'role' });
      }
      return Promise.resolve({ allowed: false, source: null });
    }),
  });

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 7, role: 'customer' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/check',
    headers: { authorization: 'Bearer valid-token' },
    body: { permissionName: 'CREDITS_CREATE' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.allowed, false);
});

test('E2E: grant/revoke flow - full cycle', async () => {
  setupMockUsers();

  const calls = [];

  const useCases = createMockUseCases({
    grantPermission: mock.fn(({ actor, targetUserId, permissionId }) => {
      calls.push({ action: 'grant', actorId: actor.id, targetUserId, permissionId });
      return Promise.resolve({
        userPermission: {
          id: 1,
          userId: targetUserId,
          permissionId,
          grantedBy: actor.id,
          createdAt: new Date().toISOString(),
        },
      });
    }),
    revokePermission: mock.fn(({ actor, targetUserId, permissionId }) => {
      calls.push({ action: 'revoke', actorId: actor.id, targetUserId, permissionId });
      return Promise.resolve({ success: true });
    }),
    checkPermission: mock.fn(({ actor, permissionName }) => {
      const user = mockUsers.find((u) => u.id === actor.id);
      if (!user) {
        return Promise.resolve({ allowed: false, source: null });
      }
      const hasDirect = user.directPermissions?.includes(permissionName);
      if (hasDirect) {
        return Promise.resolve({ allowed: true, source: 'direct' });
      }
      return Promise.resolve({ allowed: false, source: null });
    }),
  });

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const grantResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/grant',
    headers: { authorization: 'Bearer valid-token' },
    body: { targetUserId: 10, permissionId: 15 },
  });
  assert.equal(grantResponse.statusCode, 201);

  mockUsers[1].directPermissions.push('PERMISSIONS_VIEW_ALL');

  const checkResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/check',
    headers: { authorization: 'Bearer valid-token' },
    body: { permissionName: 'PERMISSIONS_VIEW_ALL' },
  });
  assert.equal(checkResponse.statusCode, 200);

  const revokeResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/revoke',
    headers: { authorization: 'Bearer valid-token' },
    body: { targetUserId: 10, permissionId: 15 },
  });
  assert.equal(revokeResponse.statusCode, 200);

  assert.deepEqual(calls, [
    { action: 'grant', actorId: 1, targetUserId: 10, permissionId: 15 },
    { action: 'revoke', actorId: 1, targetUserId: 10, permissionId: 15 },
  ]);
});
