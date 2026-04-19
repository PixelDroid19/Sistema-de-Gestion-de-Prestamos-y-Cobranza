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
  assert.equal(error.message, 'Please correct the following errors');
  assert.deepEqual(error.errors, [
    { field: 'name', message: 'Name must be at least 2 characters long' },
    { field: 'email', message: 'Please enter a valid email format (e.g., user@example.com)' },
    { field: 'phone', message: 'Valid phone number is required' },
    { field: 'status', message: 'Status must be active or inactive' },
    { field: 'birthDate', message: 'Birth date must be a valid YYYY-MM-DD date' },
    { field: 'documentNumber', message: 'Document number cannot be empty' },
    { field: 'occupation', message: 'Occupation cannot be empty' },
    { field: 'department', message: 'Department cannot be empty' },
    { field: 'city', message: 'City cannot be empty' },
    { field: 'address', message: 'Address cannot be empty' },
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
  assert.equal(error.message, 'Please correct the following errors');
  assert.deepEqual(error.errors, [
    { field: 'phone', message: 'Valid phone number is required' },
  ]);
});
