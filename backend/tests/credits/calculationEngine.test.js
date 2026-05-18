const assert = require('assert/strict');
const test = require('node:test');

const {
  calculateCredit,
  calculateLateFee,
  DEFAULT_CALCULATION_PROFILE,
} = require('@/modules/credits/domain/calculation');

const activeProfile = {
  id: 11,
  ...DEFAULT_CALCULATION_PROFILE,
};

const baseInput = {
  amount: 1200,
  interestRate: 12,
  termMonths: 12,
  startDate: '2026-01-01',
  lateFeeMode: 'SIMPLE',
};

test('calculateCredit returns a traceable profile-backed contract', () => {
  const result = calculateCredit({
    input: baseInput,
    profileVersion: activeProfile,
    policySnapshot: { ratePolicyId: 2 },
  });

  assert.equal(result.calculationVersionId, 11);
  assert.equal(result.calculationProfileVersionId, 11);
  assert.equal(result.method, 'FRENCH');
  assert.equal(result.policySnapshot.ratePolicyId, 2);
  assert.equal(result.policySnapshot.calculationProfileVersionId, 11);
  assert.equal(result.summary.installmentAmount, 106.62);
  assert.equal(result.summary.totalInterest, 79.42);
  assert.equal(result.summary.totalPayable, 1279.42);
  assert.equal(result.schedule.length, 12);
  assert.equal(result.schedule[0].dueDate, '2026-02-01T00:00:00.000Z');
  assert.ok(result.explanation.method.formula.includes('cuota'));
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'graphVersionId'), false);
});

test('calculateCredit rejects malformed start dates instead of falling back silently', () => {
  assert.throws(() => calculateCredit({
    input: { ...baseInput, startDate: '60620-02-02' },
    profileVersion: activeProfile,
  }), /startDate/);

  assert.throws(() => calculateCredit({
    input: { ...baseInput, startDate: '2026-02-31' },
    profileVersion: activeProfile,
  }), /startDate/);
});

test('calculateCredit supports FRENCH, SIMPLE, and COMPOUND methods with explicit totals', () => {
  const scenarios = [
    ['FRENCH', { installmentAmount: 106.62, totalInterest: 79.42, totalPayable: 1279.42 }],
    ['SIMPLE', { installmentAmount: 112, totalInterest: 144, totalPayable: 1344 }],
    ['COMPOUND', { installmentAmount: 112.68, totalInterest: 152.19, totalPayable: 1352.19 }],
  ];

  for (const [method, expected] of scenarios) {
    const result = calculateCredit({
      input: { ...baseInput, calculationMethod: method },
      profileVersion: activeProfile,
    });

    assert.equal(result.method, method);
    assert.deepEqual({
      installmentAmount: result.summary.installmentAmount,
      totalInterest: result.summary.totalInterest,
      totalPayable: result.summary.totalPayable,
    }, expected);
  }
});

test('calculateLateFee handles all supported mora modes deterministically', () => {
  const input = {
    overdueAmount: 1000,
    daysOverdue: 45,
    annualRate: 36,
    flatFeePerDay: 2,
    baseRate: 24,
  };

  assert.equal(calculateLateFee({ ...input, feeMode: 'NONE' }), 0);
  assert.equal(calculateLateFee({ ...input, feeMode: 'SIMPLE' }), 44.38);
  assert.equal(calculateLateFee({ ...input, feeMode: 'COMPOUND' }), 45.36);
  assert.equal(calculateLateFee({ ...input, feeMode: 'FLAT' }), 90);
  assert.equal(calculateLateFee({ ...input, feeMode: 'TIERED' }), 34.52);
});
