const test = require('node:test');
const assert = require('node:assert/strict');

const { authValidation } = require('../src/middleware/validation');
const { ValidationError } = require('../src/utils/errorHandler');
const { runMiddleware, captureMiddlewareError } = require('./helpers/middleware');

test('authValidation.register accepts customer self-signup without phone', async () => {
  await assert.doesNotReject(() => runMiddleware(authValidation.register, {
    body: {
      name: 'Ana Customer',
      email: 'ana@example.com',
      password: 'secret1',
      role: 'customer',
    },
  }));
});

test('authValidation.register rejects privileged public roles with a clear role error', async () => {
  const error = await captureMiddlewareError(authValidation.register, {
    body: {
      name: 'Ana Agent',
      email: 'agent@example.com',
      password: 'secret1',
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
