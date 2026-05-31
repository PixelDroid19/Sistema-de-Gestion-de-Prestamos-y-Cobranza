const test = require('node:test');
const assert = require('node:assert/strict');

const { validate } = require('@/middleware/validation');
const { ValidationError } = require('@/utils/errorHandler');
const { captureMiddlewareError } = require('./helpers/middleware');

test('generic schema validation middleware preserves field-level validation errors', async () => {
  const middleware = validate({
    validate() {
      return {
        error: {
          details: [
            {
              path: ['amount'],
              message: 'El monto es obligatorio',
              context: { value: '' },
            },
          ],
        },
      };
    },
  });

  const error = await captureMiddlewareError(middleware, { body: { amount: '' } });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'La validación falló');
  assert.deepEqual(error.errors, [
    { field: 'amount', message: 'El monto es obligatorio', value: '' },
  ]);
});
