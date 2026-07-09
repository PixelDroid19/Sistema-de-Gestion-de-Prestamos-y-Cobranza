const test = require('node:test');
const assert = require('node:assert/strict');

const { associateValidation } = require('@/middleware/validation');
const { ValidationError } = require('@/utils/errorHandler');
const { captureMiddlewareError } = require('./helpers/middleware');

test('associateValidation.create rejects exponent notation for interest payment schedule fields', async () => {
  const error = await captureMiddlewareError(associateValidation.create, {
    user: { id: 1, role: 'admin' },
    body: {
      name: 'Socio QA',
      email: 'socio.qa@example.com',
      phone: '+573001112299',
      interestType: 'annual',
      interestRate: '2.0000',
      interestPaymentDay: '1e1',
      interestPaymentMonth: '1e1',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.deepEqual(error.errors, [
    {
      field: 'interestPaymentDay',
      message: 'El día de pago de intereses debe ser un entero entre 1 y 28',
    },
    {
      field: 'interestPaymentMonth',
      message: 'El mes de pago de intereses debe ser un entero entre 1 y 12',
    },
  ]);
});

test('associateValidation.create rejects retired participation and interest-start fields with ValidationError', async () => {
  const error = await captureMiddlewareError(associateValidation.create, {
    user: { id: 1, role: 'admin' },
    body: {
      name: 'Socio QA',
      email: 'socio.qa@example.com',
      phone: '+573001112299',
      interestType: 'monthly',
      interestRate: '2.0000',
      interestPaymentDay: 5,
      participationPercentage: '10',
      interestStartDate: '2026-01-01',
      interestStartsAt: '2026-01-01',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.deepEqual(
    error.errors.map((item) => item.field).sort(),
    ['interestStartDate', 'interestStartsAt', 'participationPercentage'],
  );
  error.errors.forEach((item) => {
    assert.match(item.message, /contrato de socios/i);
  });
});

test('associateValidation.update rejects retired associate fields with ValidationError', async () => {
  const error = await captureMiddlewareError(associateValidation.update, {
    user: { id: 1, role: 'admin' },
    body: {
      interestStartDate: '2026-02-01',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.errors[0].field, 'interestStartDate');
  assert.match(error.errors[0].message, /contrato de socios/i);
});
