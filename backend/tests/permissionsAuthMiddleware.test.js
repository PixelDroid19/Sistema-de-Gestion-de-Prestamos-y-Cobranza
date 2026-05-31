const { test } = require('node:test');
const assert = require('node:assert/strict');

const { AuthenticationError, AuthorizationError } = require('@/utils/errorHandler');
const { createAuthMiddleware } = require('@/modules/shared/auth');
const { captureMiddlewareError, runMiddleware } = require('./helpers/middleware');

test('authMiddleware accepts { roles, permissions } options - permissions denied', async () => {
  const mockTokenService = {
    verify() {
      return { id: 7, role: 'employee' };
    },
  };

  const mockPermissionService = {
    checkMultiple: () => Promise.resolve({ granted: [], denied: ['PERMISSIONS_VIEW_ALL'] }),
  };

  const auth = createAuthMiddleware({
    tokenService: mockTokenService,
    permissionService: mockPermissionService,
  });

  const req = {
    body: {},
    params: {},
    query: {},
    headers: { authorization: 'Bearer valid-token' },
  };

  const error = await captureMiddlewareError(auth({ roles: ['employee'], permissions: ['PERMISSIONS_VIEW_ALL'] }), req);

  assert.ok(error instanceof AuthorizationError);
  assert.equal(error.code, 'INSUFFICIENT_PERMISSION');
});

test('authMiddleware accepts { roles, permissions } options - permission granted', async () => {
  const mockTokenService = {
    verify() {
      return { id: 7, role: 'employee' };
    },
  };

  const mockPermissionService = {
    checkMultiple: () => Promise.resolve({ granted: ['PERMISSIONS_VIEW_ALL'], denied: [] }),
  };

  const auth = createAuthMiddleware({
    tokenService: mockTokenService,
    permissionService: mockPermissionService,
  });

  const req = {
    body: {},
    params: {},
    query: {},
    headers: { authorization: 'Bearer valid-token' },
  };

  await runMiddleware(auth({ roles: ['employee'], permissions: ['PERMISSIONS_VIEW_ALL'] }), req);

  assert.deepEqual(req.user, { id: 7, role: 'employee' });
});

test('permission checking works after role check passes', async () => {
  const mockTokenService = {
    verify() {
      return { id: 1, role: 'admin' };
    },
  };

  let checkMultipleCalled = false;
  const mockPermissionService = {
    checkMultiple: () => {
      checkMultipleCalled = true;
      return Promise.resolve({ granted: ['PERMISSIONS_GRANT'], denied: [] });
    },
  };

  const auth = createAuthMiddleware({
    tokenService: mockTokenService,
    permissionService: mockPermissionService,
  });

  const req = {
    body: {},
    params: {},
    query: {},
    headers: { authorization: 'Bearer valid-token' },
  };

  await runMiddleware(auth({ roles: ['admin'], permissions: ['PERMISSIONS_GRANT'] }), req);

  assert.deepEqual(req.user, { id: 1, role: 'admin' });
  assert.equal(checkMultipleCalled, true);
});

test('INSUFFICIENT_PERMISSION error is thrown with code when permissions denied', async () => {
  const mockTokenService = {
    verify() {
      return { id: 7, role: 'employee' };
    },
  };

  const mockPermissionService = {
    checkMultiple: () => Promise.resolve({ granted: [], denied: ['ADMIN_ONLY'] }),
  };

  const auth = createAuthMiddleware({
    tokenService: mockTokenService,
    permissionService: mockPermissionService,
  });

  const req = {
    body: {},
    params: {},
    query: {},
    headers: { authorization: 'Bearer valid-token' },
  };

  const error = await captureMiddlewareError(auth({ roles: ['employee'], permissions: ['ADMIN_ONLY'] }), req);

  assert.ok(error instanceof AuthorizationError);
  assert.equal(error.code, 'INSUFFICIENT_PERMISSION');
  assert.equal(error.message, 'No tienes permisos suficientes para realizar esta acción.');
  assert.doesNotMatch(error.message, /ADMIN_ONLY|PERMISSIONS|CREDITS|CLIENTS/);
});

test('backward compatibility with array syntax authMiddleware([\'admin\'])', async () => {
  const mockTokenService = {
    verify() {
      return { id: 7, role: 'employee' };
    },
  };

  const auth = createAuthMiddleware({
    tokenService: mockTokenService,
  });

  const req = {
    body: {},
    params: {},
    query: {},
    headers: { authorization: 'Bearer valid-token' },
  };

  const error = await captureMiddlewareError(auth(['admin']), req);

  assert.ok(error instanceof AuthorizationError);
  assert.equal(error.message, 'No tienes acceso a esta sección.');
  assert.doesNotMatch(error.message, /admin|employee|customer|socio|agent/i);
});

test('authMiddleware rejects customer and socio tokens before role authorization', async () => {
  for (const role of ['customer', 'socio']) {
    const mockTokenService = {
      verify() {
        return { id: 7, role };
      },
    };

    const auth = createAuthMiddleware({
      tokenService: mockTokenService,
    });

    const req = {
      body: {},
      params: {},
      query: {},
      headers: { authorization: 'Bearer valid-token' },
    };

    const error = await captureMiddlewareError(auth(['admin', 'employee']), req);

    assert.ok(error instanceof AuthenticationError);
    assert.equal(error.message, 'Esta cuenta no puede acceder a la plataforma administrativa.');
    assert.doesNotMatch(error.message, /customer|socio|agent|backoffice/i);
  }
});

test('authMiddleware works with array syntax for roles only', async () => {
  const mockTokenService = {
    verify() {
      return { id: 1, role: 'admin' };
    },
  };

  const auth = createAuthMiddleware({
    tokenService: mockTokenService,
  });

  const req = {
    body: {},
    params: {},
    query: {},
    headers: { authorization: 'Bearer valid-token' },
  };

  await runMiddleware(auth(['admin']), req);

  assert.deepEqual(req.user, { id: 1, role: 'admin' });
});

test('authMiddleware with roles and no permissions does not call permissionService', async () => {
  const mockTokenService = {
    verify() {
      return { id: 1, role: 'admin' };
    },
  };

  let checkMultipleCalled = false;
  const mockPermissionService = {
    checkMultiple: () => {
      checkMultipleCalled = true;
      return Promise.resolve({ granted: [], denied: [] });
    },
  };

  const auth = createAuthMiddleware({
    tokenService: mockTokenService,
    permissionService: mockPermissionService,
  });

  const req = {
    body: {},
    params: {},
    query: {},
    headers: { authorization: 'Bearer valid-token' },
  };

  await runMiddleware(auth({ roles: ['admin'] }), req);

  assert.deepEqual(req.user, { id: 1, role: 'admin' });
  assert.equal(checkMultipleCalled, false);
});

test('authMiddleware without permissionService ignores permissions option', async () => {
  const mockTokenService = {
    verify() {
      return { id: 1, role: 'admin' };
    },
  };

  const auth = createAuthMiddleware({
    tokenService: mockTokenService,
  });

  const req = {
    body: {},
    params: {},
    query: {},
    headers: { authorization: 'Bearer valid-token' },
  };

  await runMiddleware(auth({ roles: ['admin'], permissions: ['SOME_PERM'] }), req);

  assert.deepEqual(req.user, { id: 1, role: 'admin' });
});
