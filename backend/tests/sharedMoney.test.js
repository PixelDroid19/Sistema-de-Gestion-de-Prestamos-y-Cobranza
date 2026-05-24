const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parsePositiveCurrencyAmount } = require('@/modules/shared/money');

test('parsePositiveCurrencyAmount accepts plain positive currency values', () => {
  assert.equal(parsePositiveCurrencyAmount('250'), 250);
  assert.equal(parsePositiveCurrencyAmount('250.50'), 250.5);
  assert.equal(parsePositiveCurrencyAmount(250.5), 250.5);
});

test('parsePositiveCurrencyAmount rejects partial, exponent, and non-positive values', () => {
  assert.equal(parsePositiveCurrencyAmount('250abc'), null);
  assert.equal(parsePositiveCurrencyAmount('1e2'), null);
  assert.equal(parsePositiveCurrencyAmount('250.999'), null);
  assert.equal(parsePositiveCurrencyAmount(0), null);
  assert.equal(parsePositiveCurrencyAmount(''), null);
});
