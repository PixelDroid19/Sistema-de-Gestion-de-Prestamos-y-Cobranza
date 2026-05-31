const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCreateLoanPayload,
  resolveSmokeConfig,
} = require('../scripts/railwayCreditSmokeTest');

test('railway credit smoke creates credits through configured policies only', () => {
  const payload = buildCreateLoanPayload({
    customerId: 12,
    associateId: 34,
    amount: 1200000,
    termMonths: 12,
  });

  assert.equal(payload.customerId, 12);
  assert.equal(payload.amount, 1200000);
  assert.equal(payload.termMonths, 12);
  assert.equal(payload.rateSource, 'policy');
  assert.equal(payload.lateFeeSource, 'policy');
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'associateId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'interestRate'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'lateFeeMode'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'annualLateFeeRate'), false);
});

test('railway credit smoke rejects malformed PORT defaults before requesting APIs', () => {
  assert.throws(
    () => resolveSmokeConfig({
      PORT: '5000ms',
      SMOKE_ADMIN_EMAIL: 'admin@example.test',
      SMOKE_ADMIN_PASSWORD: 'Admin123!',
      SMOKE_CUSTOMER_EMAIL: 'customer@example.test',
      SMOKE_SOCIO_EMAIL: 'socio@example.test',
    }),
    /PORT must be a valid TCP port/,
  );
});
