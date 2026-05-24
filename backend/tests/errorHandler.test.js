const test = require('node:test');
const assert = require('node:assert/strict');

const { ValidationError, BusinessRuleViolationError, formatErrorResponse } = require('@/utils/errorHandler');

test('formatErrorResponse preserves validation field names from middleware output', () => {
  const error = new ValidationError('Corrige los errores indicados');
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

test('formatErrorResponse exposes business-rule codes and denial reasons', () => {
  const error = new BusinessRuleViolationError('El abono a capital no está permitido para este crédito', {
    code: 'CAPITAL_PAYMENT_NOT_ALLOWED',
    denialReasons: [{
      code: 'FINANCIAL_BLOCK',
      message: 'Manual review block active',
      blockCode: 'MANUAL_REVIEW',
    }],
  });

  const response = formatErrorResponse(error, {
    path: '/api/payments/capital',
    method: 'POST',
  });

  assert.equal(response.error.code, 'CAPITAL_PAYMENT_NOT_ALLOWED');
  assert.deepEqual(response.error.denialReasons, [{
    code: 'FINANCIAL_BLOCK',
    message: 'Manual review block active',
    blockCode: 'MANUAL_REVIEW',
  }]);
});
