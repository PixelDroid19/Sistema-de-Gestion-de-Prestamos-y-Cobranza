const test = require('node:test');
const assert = require('node:assert/strict');

const { simulateCredit } = require('../src/services/creditSimulationService');
const { loanValidation, associateValidation } = require('../src/middleware/validation');
const { ValidationError } = require('../src/utils/errorHandler');
const { runMiddleware, captureMiddlewareError } = require('./helpers/middleware');

test('simulateCredit returns canonical backend preview data', () => {
  const simulation = simulateCredit({
    amount: 12000,
    interestRate: 12,
    termMonths: 12,
  });

  assert.equal(simulation.lateFeeMode, 'NONE');
  assert.equal(simulation.schedule.length, 12);
  assert.equal(simulation.summary.installmentAmount, 1066.19);
  assert.equal(simulation.summary.totalPayable, 12794.23);
  assert.equal(simulation.summary.outstandingBalance, 12794.23);
});

test('loanValidation.simulate rejects unsupported late-fee modes', async () => {
  const error = await captureMiddlewareError(loanValidation.simulate, {
    body: {
      amount: 12000,
      interestRate: 12,
      termMonths: 12,
      lateFeeMode: 'LINEAR',
    },
  });

  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Please correct the following errors');
  assert.deepEqual(error.errors, [
    {
      field: 'lateFeeMode',
      message: 'Late fee mode must not be one of: LINEAR, EFFECTIVE, SMART HYBRID',
    },
  ]);
});

test('loanValidation.create accepts a canonical loan payload', async () => {
  await assert.doesNotReject(() => runMiddleware(loanValidation.create, {
    body: {
      customerId: 1,
      associateId: 2,
      amount: 12000,
      interestRate: 12,
      termMonths: 12,
      lateFeeMode: 'none',
    },
  }));
});

test('associateValidation.create accepts a valid associate payload', async () => {
  await assert.doesNotReject(() => runMiddleware(associateValidation.create, {
    body: {
      name: 'Ana Associate',
      email: 'ana@example.com',
      phone: '+573001112233',
      status: 'active',
    },
  }));
});
