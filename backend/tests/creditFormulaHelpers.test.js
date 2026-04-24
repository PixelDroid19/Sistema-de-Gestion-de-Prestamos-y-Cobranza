const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAmortizationSchedule,
  roundCurrency,
  summarizeSchedule,
} = require('@/modules/credits/application/creditFormulaHelpers');

test('buildAmortizationSchedule supports simple interest method as a real schedule', () => {
  const schedule = buildAmortizationSchedule({
    amount: 2000000,
    interestRate: 60,
    termMonths: 12,
    startDate: '2026-01-01T00:00:00.000Z',
    calculationMethod: 'SIMPLE',
  });

  const summary = summarizeSchedule(schedule);

  assert.equal(summary.installmentAmount, 266666.67);
  assert.equal(summary.totalPrincipal, 2000000);
  assert.equal(summary.totalInterest, 1200000);
  assert.equal(summary.totalPayable, 3200000);
});

test('buildAmortizationSchedule supports compound interest method as a real schedule', () => {
  const amount = 2000000;
  const monthlyRate = 60 / 100 / 12;
  const expectedTotalPayable = roundCurrency(amount * Math.pow(1 + monthlyRate, 12));
  const expectedInterest = roundCurrency(expectedTotalPayable - amount);

  const schedule = buildAmortizationSchedule({
    amount,
    interestRate: 60,
    termMonths: 12,
    startDate: '2026-01-01T00:00:00.000Z',
    calculationMethod: 'COMPOUND',
  });

  const summary = summarizeSchedule(schedule);

  assert.equal(summary.totalPrincipal, amount);
  assert.equal(summary.totalInterest, expectedInterest);
  assert.equal(summary.totalPayable, expectedTotalPayable);
  assert.equal(summary.installmentAmount, roundCurrency(expectedTotalPayable / 12));
});
