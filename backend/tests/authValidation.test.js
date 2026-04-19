const test = require('node:test');
const assert = require('node:assert/strict');

const { authValidation } = require('@/middleware/validation');
const { ValidationError } = require('@/utils/errorHandler');
const { runMiddleware, captureMiddlewareError } = require('./helpers/middleware');

test('authValidation.register accepts customer self-signup without phone', async () => {
  await assert.doesNotReject(() => runMiddleware(authValidation.register, {
    body: {
      name: 'Ana Customer',
      email: 'ana@example.com',
      password: 'Secret12',
      role: 'customer',
    },
  }));
});

test('authValidation.register rejects privileged public roles with a clear role error', async () => {
  const error = await captureMiddlewareError(authValidation.register, {
    body: {
      name: 'Ana Agent',
      email: 'agent@example.com',
      password: 'Secret12',
      role: 'agent',
      phone: '+573001112233',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Please correct the following errors');
  assert.deepEqual(error.errors, [
    {
      field: 'role',
      message: 'Public registration only allows the customer role',
    },
  ]);
});

test('authValidation.adminRegister rejects legacy agent as an unsupported application role', async () => {
  const error = await captureMiddlewareError(authValidation.adminRegister, {
    body: {
      name: 'Ana Agent',
      email: 'agent@example.com',
      password: 'Secret12',
      role: 'agent',
      phone: '+573001112233',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.deepEqual(error.errors, [
    {
      field: 'role',
      message: 'Role must be one of: admin, customer, socio',
    },
  ]);
});

test('authValidation.adminRegister accepts admin registration without a phone number', async () => {
  await assert.doesNotReject(() => runMiddleware(authValidation.adminRegister, {
    body: {
      name: 'Ana Admin',
      email: 'admin@example.com',
      password: 'Secret12',
      role: 'admin',
    },
  }));
});

test('authValidation.login accepts username-only legacy payloads', async () => {
  await assert.doesNotReject(() => runMiddleware(authValidation.login, {
    body: {
      username: 'ana.user',
      password: 'Secret12',
    },
  }));
});

test('authValidation.adminRegister accepts legacy roleIds payloads', async () => {
  await assert.doesNotReject(() => runMiddleware(authValidation.adminRegister, {
    body: {
      name: 'Ana Partner',
      email: 'partner@example.com',
      password: 'Secret12',
      roleIds: ['PARTNER'],
      phone: '+573001112233',
      associateId: 77,
    },
  }));
});
