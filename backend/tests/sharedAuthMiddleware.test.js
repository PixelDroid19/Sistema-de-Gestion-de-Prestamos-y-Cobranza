const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthenticationError, AuthorizationError } = require('@/utils/errorHandler');
const { createAuthMiddleware } = require('@/modules/shared/auth');
const { captureMiddlewareError } = require('./helpers/middleware');

test('createAuthMiddleware rejects requests without a bearer token', async () => {
  const auth = createAuthMiddleware({
    tokenService: {
      verify() {
        throw new Error('should not be called');
      },
    },
  });

  const error = await captureMiddlewareError(auth(), { headers: {} });

  assert.ok(error instanceof AuthenticationError);
  assert.equal(error.message, 'Debes iniciar sesión para continuar.');
  assert.doesNotMatch(error.message, /Authorization|Bearer|token|header/i);
});

test('createAuthMiddleware rejects malformed authorization headers with an operational session message', async () => {
  const auth = createAuthMiddleware({
    tokenService: {
      verify() {
        throw new Error('should not be called');
      },
    },
  });

  const error = await captureMiddlewareError(auth(), {
    headers: { authorization: 'Basic abc123' },
  });

  assert.ok(error instanceof AuthenticationError);
  assert.equal(error.message, 'La sesión no es válida. Inicia sesión de nuevo.');
  assert.doesNotMatch(error.message, /Bearer|token|format/i);
});

test('createAuthMiddleware maps token verification errors to operational session messages', async () => {
  const auth = createAuthMiddleware({
    tokenService: {
      verify(token) {
        const error = new Error(token === 'expired-token' ? 'expired' : 'bad token');
        error.name = token === 'expired-token' ? 'TokenExpiredError' : 'JsonWebTokenError';
        throw error;
      },
    },
  });

  const expired = await captureMiddlewareError(auth(), {
    headers: { authorization: 'Bearer expired-token' },
  });
  assert.ok(expired instanceof AuthenticationError);
  assert.equal(expired.message, 'La sesión expiró. Inicia sesión de nuevo.');

  const malformed = await captureMiddlewareError(auth(), {
    headers: { authorization: 'Bearer malformed-token' },
  });
  assert.ok(malformed instanceof AuthenticationError);
  assert.equal(malformed.message, 'La sesión no es válida. Inicia sesión de nuevo.');
  assert.doesNotMatch(malformed.message, /token|format/i);
});

test('createAuthMiddleware enforces role policies', async () => {
  const auth = createAuthMiddleware({
    tokenService: {
      verify() {
        return { id: 44, role: 'employee' };
      },
    },
  });

  const error = await captureMiddlewareError(auth(['admin']), {
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.ok(error instanceof AuthorizationError);
  assert.equal(error.message, 'No tienes acceso a esta sección.');
  assert.doesNotMatch(error.message, /admin|employee|customer|socio|agent/i);
});

test('createAuthMiddleware supports single-string role policies', async () => {
  const auth = createAuthMiddleware({
    tokenService: {
      verify() {
        return { id: 44, role: 'employee' };
      },
    },
  });

  const error = await captureMiddlewareError(auth('admin'), {
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.ok(error instanceof AuthorizationError);
  assert.equal(error.message, 'No tienes acceso a esta sección.');
  assert.doesNotMatch(error.message, /admin|employee|customer|socio|agent/i);
});

test('createAuthMiddleware assigns req.user when verification succeeds', async () => {
  const auth = createAuthMiddleware({
    tokenService: {
      verify() {
        return { id: 7, role: 'admin' };
      },
    },
  });

  const req = { body: {}, params: {}, query: {}, headers: { authorization: 'Bearer valid-token' } };
  await new Promise((resolve, reject) => {
    auth(['admin'])(req, {}, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  assert.deepEqual(req.user, { id: 7, role: 'admin' });
});

test('createAuthMiddleware rejects legacy agent role', async () => {
  const auth = createAuthMiddleware({
    tokenService: {
      verify() {
        return { id: 14, role: 'agent' };
      },
    },
  });

  const req = { body: {}, params: {}, query: {}, headers: { authorization: 'Bearer valid-token' } };
  try {
    await new Promise((resolve, reject) => {
      auth(['admin'])(req, {}, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    assert.fail('Should have rejected legacy agent role');
  } catch (error) {
    assert.equal(error.statusCode, 401);
    assert.equal(error.message, 'La sesión no es válida. Inicia sesión de nuevo.');
  }
});

test('createAuthMiddleware rejects non-administrative login roles with an operational message', async () => {
  const auth = createAuthMiddleware({
    tokenService: {
      verify() {
        return { id: 14, role: 'customer' };
      },
    },
  });

  const error = await captureMiddlewareError(auth(['admin', 'employee']), {
    body: {},
    params: {},
    query: {},
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.ok(error instanceof AuthenticationError);
  assert.equal(error.message, 'Esta cuenta no puede acceder a la plataforma administrativa.');
  assert.doesNotMatch(error.message, /customer|socio|agent|backoffice/i);
});

test('createAuthMiddleware rejects unsupported role policies during setup', () => {
  const auth = createAuthMiddleware({
    tokenService: {
      verify() {
        return { id: 7, role: 'admin' };
      },
    },
  });

  assert.throws(() => auth(['agent']), /Unsupported role policy requested: agent/);
});
