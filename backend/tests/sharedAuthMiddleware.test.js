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
  assert.equal(error.message, 'Authorization header is required');
});

test('createAuthMiddleware enforces role policies', async () => {
  const auth = createAuthMiddleware({
    tokenService: {
      verify() {
        return { id: 44, role: 'customer' };
      },
    },
  });

  const error = await captureMiddlewareError(auth(['admin']), {
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.ok(error instanceof AuthorizationError);
  assert.match(error.message, /Required roles: admin/);
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
    assert.ok(error.message.includes('unsupported application role'), `Expected error message to contain 'unsupported application role', got: ${error.message}`);
  }
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
