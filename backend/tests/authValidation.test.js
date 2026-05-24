const test = require('node:test');
const assert = require('node:assert/strict');

const { authValidation, loanValidation, paymentValidation } = require('@/middleware/validation');
const { ValidationError } = require('@/utils/errorHandler');
const { runMiddleware, captureMiddlewareError } = require('./helpers/middleware');

test('authValidation.register rejects public signup with a clear provisioning error', async () => {
  const error = await captureMiddlewareError(authValidation.register, {
    body: {
      name: 'Ana Customer',
      email: 'ana@example.com',
      password: 'Secret12',
      role: 'customer',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Corrige los errores indicados');
  assert.deepEqual(error.errors, [
    {
      field: 'role',
      message: 'El registro público está deshabilitado. Un administrador debe crear las cuentas de empleados.',
    },
  ]);
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
  assert.equal(error.message, 'Corrige los errores indicados');
  assert.deepEqual(error.errors, [
    {
      field: 'role',
      message: 'El registro público está deshabilitado. Un administrador debe crear las cuentas de empleados.',
    },
  ]);
});

test('authValidation.adminRegister rejects agent as an unsupported administrative role', async () => {
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
      message: 'El rol debe ser uno de: admin, employee',
    },
  ]);
});

test('authValidation.adminRegister rejects socio as a role only without socio provisioning hints', async () => {
  const error = await captureMiddlewareError(authValidation.adminRegister, {
    body: {
      name: 'Ana Socia',
      email: 'socia@example.com',
      password: 'Secret12',
      role: 'socio',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.deepEqual(error.errors, [
    {
      field: 'role',
      message: 'El rol debe ser uno de: admin, employee',
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

test('authValidation.login accepts username-only payloads', async () => {
  await assert.doesNotReject(() => runMiddleware(authValidation.login, {
    body: {
      username: 'ana.user',
      password: 'Secret12',
    },
  }));
});

test('authValidation.adminRegister rejects roleIds payloads without canonical role', async () => {
  await assert.rejects(() => runMiddleware(authValidation.adminRegister, {
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

test('loan validation does not expose account provisioning validators', () => {
  assert.equal(Object.prototype.hasOwnProperty.call(loanValidation, 'adminRegister'), false);
});

test('loanValidation.create rejects exponent notation for customer identifiers', async () => {
  const error = await captureMiddlewareError(loanValidation.create, {
    body: {
      customerId: '1e1',
      amount: 1000,
      termMonths: 12,
      rateSource: 'policy',
      lateFeeSource: 'policy',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.deepEqual(error.errors, [
    {
      field: 'customerId',
      message: 'El ID del cliente debe ser válido',
    },
  ]);
});

test('loanValidation.create rejects exponent notation for annual late fee rates', async () => {
  const error = await captureMiddlewareError(loanValidation.create, {
    body: {
      customerId: 10,
      amount: 1000,
      termMonths: 12,
      annualLateFeeRate: '1e1',
      rateSource: 'policy',
      lateFeeSource: 'policy',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.deepEqual(error.errors, [
    {
      field: 'annualLateFeeRate',
      message: 'La tasa anual de mora debe estar entre 0 y 100',
    },
  ]);
});

test('paymentValidation.create rejects exponent notation for loan identifiers', async () => {
  const error = await captureMiddlewareError(paymentValidation.create, {
    body: {
      loanId: '1e1',
      amount: 100,
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.deepEqual(error.errors, [
    {
      field: 'loanId',
      message: 'El ID del crédito debe ser válido',
    },
  ]);
});
