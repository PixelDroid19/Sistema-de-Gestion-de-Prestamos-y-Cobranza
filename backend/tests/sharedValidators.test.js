const test = require('node:test');
const assert = require('node:assert/strict');

const { validateIntegerId } = require('@/modules/shared/validators');

test('validateIntegerId rejects exponent, decimal, and mixed identifier text', () => {
  assert.equal(validateIntegerId(10), true);
  assert.equal(validateIntegerId('10'), true);
  assert.equal(validateIntegerId('0010'), true);

  assert.equal(validateIntegerId('1e1'), false);
  assert.equal(validateIntegerId('10.5'), false);
  assert.equal(validateIntegerId('10abc'), false);
  assert.equal(validateIntegerId(''), false);
  assert.equal(validateIntegerId(0), false);
});
