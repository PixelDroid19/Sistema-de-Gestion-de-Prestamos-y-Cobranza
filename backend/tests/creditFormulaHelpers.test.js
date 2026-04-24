const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAmortizationSchedule,
  roundCurrency,
  summarizeSchedule,
} = require('@/modules/credits/application/creditFormulaHelpers');
const { listDagWorkbenchScopes } = require('@/modules/credits/application/dag/scopeRegistry');

test('workbench scope exposes backend-supported calculation methods', () => {
  const [scope] = listDagWorkbenchScopes();

  assert.deepEqual(scope.calculationMethods.map((method) => method.key), ['FRENCH', 'SIMPLE', 'COMPOUND']);
  assert.equal(scope.calculationMethods[0].label, 'Sistema frances');
});

test('buildAmortizationSchedule defaults legacy graphs without calculationMethod to french method', () => {
  const legacySchedule = buildAmortizationSchedule({
    amount: 1200000,
    interestRate: 24,
    termMonths: 12,
    startDate: '2026-01-01T00:00:00.000Z',
  });
  const explicitSchedule = buildAmortizationSchedule({
    amount: 1200000,
    interestRate: 24,
    termMonths: 12,
    startDate: '2026-01-01T00:00:00.000Z',
    calculationMethod: 'FRENCH',
  });

  assert.equal(legacySchedule[0].scheduledPayment, explicitSchedule[0].scheduledPayment);
});

test('buildAmortizationSchedule rejects invalid calculation methods with a clear error', () => {
  assert.throws(() => buildAmortizationSchedule({
    amount: 2000000,
    interestRate: 60,
    termMonths: 12,
    startDate: '2026-01-01T00:00:00.000Z',
    calculationMethod: 'UNKNOWN',
  }), /Metodo de calculo invalido: UNKNOWN/);
});

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

test('buildAmortizationSchedule applies manual fixed installment before the base method', () => {
  const schedule = buildAmortizationSchedule({
    amount: 2000000,
    interestRate: 60,
    termMonths: 12,
    startDate: '2026-01-01T00:00:00.000Z',
    calculationMethod: 'COMPOUND',
    installmentAmount: 200000,
  });

  const summary = summarizeSchedule(schedule);

  assert.equal(summary.installmentAmount, 200000);
  assert.equal(summary.totalPrincipal, 2000000);
  assert.equal(summary.totalPayable, 2808287.36);
});
