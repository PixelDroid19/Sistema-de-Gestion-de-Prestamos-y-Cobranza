const test = require('node:test');
const assert = require('node:assert/strict');

const { ValidationError, BusinessRuleViolationError, formatErrorResponse } = require('../src/utils/errorHandler');

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

test('formatErrorResponse exposes business-rule codes and denial reasons', () => {
  const error = new BusinessRuleViolationError('Capital payment is not allowed for this loan', {
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
