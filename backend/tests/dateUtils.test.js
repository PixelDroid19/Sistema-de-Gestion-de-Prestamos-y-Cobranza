const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeDateOnly,
  normalizeOperationalDate,
  normalizeOptionalDateOnlyString,
  toDateOnlyOrNull,
} = require('@/modules/shared/dateUtils');
const { validateOptionalDateInput } = require('@/modules/shared/validators');

test('date utilities reject malformed and out-of-range operational years', () => {
  assert.equal(normalizeOptionalDateOnlyString('2026-02-14', 'interestStartDate'), '2026-02-14');
  assert.equal(normalizeDateOnly('2026-02-14T18:30:00.000Z', 'dueDate').toISOString(), '2026-02-14T00:00:00.000Z');
  assert.equal(normalizeOperationalDate('2026-02-14T18:30:00.000Z', 'paymentDate').toISOString(), '2026-02-14T18:30:00.000Z');

  assert.throws(
    () => normalizeDateOnly('2026-02-31', 'dueDate'),
    /fecha de vencimiento.*AAAA-MM-DD/i,
  );
  assert.throws(
    () => normalizeDateOnly('60620-02-02', 'dueDate'),
    /fecha de vencimiento.*AAAA-MM-DD/i,
  );
  assert.throws(
    () => normalizeOperationalDate('+060517-02-14T00:00:00.000Z', 'paymentDate'),
    /fecha de pago.*operativa válida/i,
  );
  assert.equal(toDateOnlyOrNull('60517-02-14'), null);
});

test('shared optional date validator only accepts operational date payloads', () => {
  assert.equal(validateOptionalDateInput(undefined), true);
  assert.equal(validateOptionalDateInput('2026-05-17'), true);
  assert.equal(validateOptionalDateInput('2026-05-17T08:00:00.000Z'), true);
  assert.equal(validateOptionalDateInput('2026-02-31'), false);
  assert.equal(validateOptionalDateInput('60517-02-14'), false);
});
