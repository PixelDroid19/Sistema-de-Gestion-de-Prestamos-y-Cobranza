const test = require('node:test');
const assert = require('node:assert/strict');

const { ValidationError, formatErrorResponse } = require('../src/utils/errorHandler');

test('formatErrorResponse preserves validation field names from middleware output', () => {
  const error = new ValidationError('Please correct the following errors');
  error.errors = [
    {
      field: 'lateFeeMode',
      message: 'Late fee mode must not be one of: LINEAR, EFFECTIVE, SMART HYBRID',
      value: 'LINEAR',
    },
  ];

  const response = formatErrorResponse(error, {
    path: '/api/loans/simulations',
    method: 'POST',
  });

  assert.deepEqual(response.error.validationErrors, [
    {
      field: 'lateFeeMode',
      message: 'Late fee mode must not be one of: LINEAR, EFFECTIVE, SMART HYBRID',
      value: 'LINEAR',
    },
  ]);
});
