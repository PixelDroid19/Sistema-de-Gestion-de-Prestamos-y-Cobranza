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
      message: 'interestPaymentDay must be an integer between 1 and 28',
    },
    {
      field: 'interestPaymentMonth',
      message: 'interestPaymentMonth must be an integer between 1 and 12',
    },
  ]);
});
