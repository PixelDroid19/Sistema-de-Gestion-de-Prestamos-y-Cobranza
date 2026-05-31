const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createPermissionsRouter } = require('@/modules/permissions/presentation/router');
const { globalErrorHandler, NotFoundError } = require('@/utils/errorHandler');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

test('GET /api/permissions returns all permissions (requires auth)', async () => {
  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({
      permissions: [{ id: 1, name: 'CREDITS_VIEW_ALL', module: 'CREDITOS', description: null }],
      permissionsByModule: {
        CREDITOS: [{ id: 1, name: 'CREDITS_VIEW_ALL', module: 'CREDITOS' }],
      },
      total: 1,
    })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: mock.fn(() => Promise.resolve({})),
    grantBatchPermissions: mock.fn((payload) => Promise.resolve({ granted: payload.permissions || [], failed: [] })),
    revokePermission: mock.fn(() => Promise.resolve({ success: true })),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
  };

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 7, role: 'customer' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(Array.isArray(response.body.data.permissions), true);
  assert.equal(response.body.data.total, 1);
  assert.ok(response.body.data.permissionsByModule);
});

test('GET /api/permissions/me returns current user permissions', async () => {
  const myPermissions = [
    { permission: 'CREDITS_VIEW_ALL', module: 'CREDITOS', source: 'direct' },
    { permission: 'CLIENTS_VIEW_ALL', module: 'CLIENTES', source: 'role' },
  ];

  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {} })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({
      userId: 7,
      permissions: myPermissions,
      directPermissions: [myPermissions[0]],
      rolePermissions: [myPermissions[1]],
      allPermissions: ['CREDITS_VIEW_ALL', 'CLIENTS_VIEW_ALL'],
      total: 2,
    })),
    grantPermission: mock.fn(() => Promise.resolve({})),
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: mock.fn(() => Promise.resolve({ success: true })),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
  };

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 7, role: 'customer' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/me',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data.permissions, myPermissions);
  assert.equal(response.body.data.total, 2);
  assert.deepEqual(response.body.data.allPermissions, ['CREDITS_VIEW_ALL', 'CLIENTS_VIEW_ALL']);
});

test('GET /api/permissions/user/:userId rejects malformed route identifiers before reading permissions', async () => {
  const calls = [];
  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {}, permissions: [], total: 0 })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn((payload) => {
      calls.push(payload);
      return Promise.resolve({ userId: Number(payload.targetUserId), permissions: [] });
    }),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: mock.fn(() => Promise.resolve({})),
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: mock.fn(() => Promise.resolve({ success: true })),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
  };

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message },
    });
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/user/1e2',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error.message, /número del usuario/i);
  assert.deepEqual(calls, []);
});

test('POST /api/permissions/grant accepts legacy permissionId and modern permission payloads', async () => {
  const calls = [];
  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {}, permissions: [], total: 0 })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: mock.fn((payload) => {
      calls.push(payload);
      return Promise.resolve({
        userId: Number(payload.targetUserId),
        permissionId: payload.permissionId ?? 50,
        permission: payload.permission ?? 'CREDITS_VIEW_ALL',
      });
    }),
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: mock.fn(() => Promise.resolve({ success: true })),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
  };

  const allowAdmin = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAdmin, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const legacyResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/grant',
    headers: { authorization: 'Bearer valid-token' },
    body: { targetUserId: 5, permissionId: 10 },
  });

  const modernResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/grant',
    headers: { authorization: 'Bearer valid-token' },
    body: { userId: 5, permission: 'CREDITS_VIEW_ALL' },
  });
  const batchResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/grant/batch',
    headers: { authorization: 'Bearer valid-token' },
    body: { userId: 5, permissions: ['CREDITS_VIEW_ALL'] },
  });

  assert.equal(legacyResponse.statusCode, 201);
  assert.equal(modernResponse.statusCode, 201);
  assert.equal(batchResponse.statusCode, 201);
  assert.equal(legacyResponse.body.message, 'Permiso concedido correctamente');
  assert.equal(modernResponse.body.message, 'Permiso concedido correctamente');
  assert.equal(batchResponse.body.message, 'Permisos concedidos correctamente');
  assert.deepEqual(calls, [
    { actor: { id: 1, role: 'admin' }, targetUserId: 5, permissionId: 10, permission: undefined },
    { actor: { id: 1, role: 'admin' }, targetUserId: 5, permissionId: undefined, permission: 'CREDITS_VIEW_ALL' },
  ]);
});

test('POST /api/permissions/revoke accepts legacy permissionId and modern permission payloads', async () => {
  const calls = [];
  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {}, permissions: [], total: 0 })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: mock.fn(() => Promise.resolve({})),
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: mock.fn((payload) => {
      calls.push(payload);
      return Promise.resolve({ success: true, revoked: true });
    }),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
  };

  const allowAdmin = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAdmin, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const legacyResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/revoke',
    headers: { authorization: 'Bearer valid-token' },
    body: { targetUserId: 5, permissionId: 10 },
  });

  const modernResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/revoke',
    headers: { authorization: 'Bearer valid-token' },
    body: { userId: 5, permission: 'CREDITS_VIEW_ALL' },
  });

  assert.equal(legacyResponse.statusCode, 200);
  assert.equal(modernResponse.statusCode, 200);
  assert.equal(legacyResponse.body.message, 'Permiso revocado correctamente');
  assert.equal(modernResponse.body.message, 'Permiso revocado correctamente');
  assert.deepEqual(calls, [
    { actor: { id: 1, role: 'admin' }, targetUserId: 5, permissionId: 10, permission: undefined },
    { actor: { id: 1, role: 'admin' }, targetUserId: 5, permissionId: undefined, permission: 'CREDITS_VIEW_ALL' },
  ]);
});

test('DELETE /api/permissions/direct accepts legacy and modern payloads', async () => {
  const calls = [];
  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {}, permissions: [], total: 0 })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: mock.fn(() => Promise.resolve({})),
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: mock.fn((payload) => {
      calls.push(payload);
      return Promise.resolve({ success: true, revoked: true });
    }),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
  };

  const allowAdmin = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAdmin, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const legacyResponse = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/direct',
    headers: { authorization: 'Bearer valid-token' },
    body: { targetUserId: 7, permissionId: 10 },
  });

  const modernResponse = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/direct',
    headers: { authorization: 'Bearer valid-token' },
    body: { userId: 7, permission: 'CREDITS_VIEW_ALL' },
  });

  assert.equal(legacyResponse.statusCode, 200);
  assert.equal(modernResponse.statusCode, 200);
  assert.equal(legacyResponse.body.message, 'Permiso directo revocado correctamente');
  assert.equal(modernResponse.body.message, 'Permiso directo revocado correctamente');
  assert.deepEqual(calls, [
    { actor: { id: 1, role: 'admin' }, targetUserId: 7, permissionId: 10, permission: undefined },
    { actor: { id: 1, role: 'admin' }, targetUserId: 7, permissionId: undefined, permission: 'CREDITS_VIEW_ALL' },
  ]);
});

test('POST /api/permissions/grant requires admin role', async () => {
  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {} })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: mock.fn(({ actor }) => {
      if (actor.role !== 'admin') {
        const error = new Error('Solo un administrador puede conceder permisos.');
        error.name = 'AuthorizationError';
        error.statusCode = 403;
        throw error;
      }
      return Promise.resolve({});
    }),
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: mock.fn(() => Promise.resolve({ success: true })),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
  };

  const allowCustomer = () => (req, res, next) => {
    req.user = { id: 7, role: 'customer' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowCustomer, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/grant',
    headers: { authorization: 'Bearer valid-token' },
    body: { targetUserId: 5, permissionId: 10 },
  });

  assert.equal(response.statusCode, 403);
});

test('POST /api/permissions/revoke requires admin role', async () => {
  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {} })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: mock.fn(() => Promise.resolve({})),
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: mock.fn(({ actor }) => {
      if (actor.role !== 'admin') {
        const error = new Error('Solo un administrador puede revocar permisos.');
        error.name = 'AuthorizationError';
        error.statusCode = 403;
        throw error;
      }
      return Promise.resolve({ success: true });
    }),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
  };

  const allowCustomer = () => (req, res, next) => {
    req.user = { id: 7, role: 'customer' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowCustomer, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/revoke',
    headers: { authorization: 'Bearer valid-token' },
    body: { targetUserId: 5, permissionId: 10 },
  });

  assert.equal(response.statusCode, 403);
});

test('POST /api/permissions/grant with invalid permission ID returns error', async () => {
  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {} })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: mock.fn(({ actor }) => {
      if (actor.role !== 'admin') {
        const error = new Error('Solo un administrador puede conceder permisos.');
        error.name = 'AuthorizationError';
        error.statusCode = 403;
        throw error;
      }
      throw new NotFoundError('Permission');
    }),
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: mock.fn(() => Promise.resolve({ success: true })),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
  };

  const allowAdmin = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAdmin, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/grant',
    headers: { authorization: 'Bearer valid-token' },
    body: { targetUserId: 5, permissionId: 9999 },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.message, 'El permiso no existe.');
});

test('POST /api/permissions/revoke with invalid permission ID returns error', async () => {
  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {} })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: mock.fn(() => Promise.resolve({})),
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: mock.fn(({ actor }) => {
      if (actor.role !== 'admin') {
        const error = new Error('Solo un administrador puede revocar permisos.');
        error.name = 'AuthorizationError';
        error.statusCode = 403;
        throw error;
      }
      throw new NotFoundError('Permission');
    }),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
  };

  const allowAdmin = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAdmin, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/revoke',
    headers: { authorization: 'Bearer valid-token' },
    body: { targetUserId: 5, permissionId: 9999 },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.message, 'El permiso no existe.');
});

test('GET /api/permissions without auth returns 401', async () => {
  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {} })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: mock.fn(() => Promise.resolve({})),
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: mock.fn(() => Promise.resolve({ success: true })),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
  };

  const rejectAuth = () => (req, res, next) => {
    const error = new Error('Debes iniciar sesión para continuar.');
    error.name = 'AuthenticationError';
    error.statusCode = 401;
    next(error);
  };

  const router = createPermissionsRouter({ authMiddleware: rejectAuth, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
  });

  assert.equal(response.statusCode, 401);
});

test('POST /api/permissions/check returns permission check result', async () => {
  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {} })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: mock.fn(() => Promise.resolve({})),
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: mock.fn(() => Promise.resolve({ success: true })),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: true, source: 'direct' })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({ permissions: [] })),
  };

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 7, role: 'customer' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/check',
    headers: { authorization: 'Bearer valid-token' },
    body: { permissionName: 'CREDITS_VIEW_ALL' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, { allowed: true, source: 'direct' });
});

test('POST /api/permissions/check-multiple returns multiple permission check results', async () => {
  const mockUseCases = {
    listPermissions: mock.fn(() => Promise.resolve({ permissionsByModule: {} })),
    getPermissionsByModule: mock.fn(() => Promise.resolve({ module: 'CREDITOS', permissions: [] })),
    getUserPermissions: mock.fn(() => Promise.resolve({})),
    getMyPermissions: mock.fn(() => Promise.resolve({ userId: 1, permissions: [] })),
    grantPermission: mock.fn(() => Promise.resolve({})),
    grantBatchPermissions: mock.fn(() => Promise.resolve({ granted: [], failed: [] })),
    revokePermission: mock.fn(() => Promise.resolve({ success: true })),
    checkPermission: mock.fn(() => Promise.resolve({ allowed: false, source: null })),
    checkMultiplePermissions: mock.fn(() => Promise.resolve({
      permissions: [
        { name: 'CREDITS_VIEW_ALL', allowed: true, source: 'direct' },
        { name: 'CLIENTS_CREATE', allowed: false, source: null },
      ],
    })),
  };

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 7, role: 'customer' };
    next();
  };

  const router = createPermissionsRouter({ authMiddleware: allowAuth, useCases: mockUseCases });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/check-multiple',
    headers: { authorization: 'Bearer valid-token' },
    body: { permissionNames: ['CREDITS_VIEW_ALL', 'CLIENTS_CREATE'] },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.permissions.length, 2);
});
