const test = require('node:test');
const assert = require('node:assert/strict');

const { customerValidation } = require('@/middleware/validation');
const { ValidationError } = require('@/utils/errorHandler');
const { runMiddleware, captureMiddlewareError } = require('./helpers/middleware');

test('customerValidation.update accepts partial customer profile updates', async () => {
  await assert.doesNotReject(() => runMiddleware(customerValidation.update, {
    body: {
      name: 'Ana Customer',
      email: 'ana.updated@example.com',
      phone: '+573001112244',
      status: 'active',
      birthDate: '1990-01-10',
      documentNumber: '123456789',
      occupation: 'Teacher',
      department: 'Antioquia',
      city: 'Medellin',
      address: 'Main Street 123',
    },
  }));
});

test('customerValidation.create accepts supported customer statuses', async () => {
  await assert.doesNotReject(() => runMiddleware(customerValidation.create, {
    body: {
      name: 'Camila Torres',
      email: 'camila@example.com',
      phone: '+573001112244',
      status: 'blacklisted',
    },
  }));
});

test('customerValidation.update rejects invalid partial customer updates with structured errors', async () => {
  const error = await captureMiddlewareError(customerValidation.update, {
    body: {
      name: 'A',
      email: 'bad-email',
      phone: 'not-a-phone',
      status: 'archived',
      birthDate: 'not-a-date',
      documentNumber: '   ',
      occupation: '   ',
      department: '   ',
      city: '   ',
      address: '   ',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Corrige los errores indicados');
  assert.deepEqual(error.errors, [
    { field: 'name', message: 'El nombre debe tener al menos 2 caracteres' },
    { field: 'email', message: 'Ingresa un correo válido (por ejemplo, usuario.com)' },
    { field: 'phone', message: 'El teléfono debe ser válido' },
    { field: 'status', message: 'El estado debe ser activo, inactivo o bloqueado' },
    { field: 'birthDate', message: 'La fecha de nacimiento debe tener formato AAAA-MM-DD' },
    { field: 'documentNumber', message: 'El número de documento no puede estar vacío' },
    { field: 'occupation', message: 'La ocupación no puede estar vacía' },
    { field: 'department', message: 'El departamento no puede estar vacío' },
    { field: 'city', message: 'La ciudad no puede estar vacía' },
    { field: 'address', message: 'La dirección no puede estar vacía' },
  ]);
});

test('customerValidation.create rejects phone numbers with formatting spaces', async () => {
  const error = await captureMiddlewareError(customerValidation.create, {
    body: {
      name: 'Camila Torres',
      email: 'camila@example.com',
      phone: '+57 301 555 0101',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Corrige los errores indicados');
  assert.deepEqual(error.errors, [
    { field: 'phone', message: 'El teléfono debe ser válido' },
  ]);
});
