const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateLoan,
  buildAmortizationSchedule,
  createCalculateLoanUseCase,
} = require('../src/modules/credit-simulator/application/calculateLoan');

test('calculateLoan computes correct French (compound) amortization for standard inputs', () => {
  // P = 100,000, term = 12 months, rate = 12% annual (1% monthly)
  const result = calculateLoan({
    principal: 100000,
    term: 12,
    interestRate: 12,
    paymentMethod: 'french',
  });

  // PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
  // r = 0.12/12 = 0.01
  // factor = (1.01)^12 ≈ 1.126825
  // PMT = 100000 * [0.01 * 1.126825] / [1.126825 - 1] = 100000 * 0.01126825 / 0.126825 ≈ 8884.88
  const expectedMonthlyPayment = 8884.88; // rounded to 2 decimals

  assert.equal(result.principal, 100000);
  assert.equal(result.term, 12);
  assert.equal(result.interestRate, 12);
  assert.equal(result.paymentMethod, 'french');
  assert.equal(result.monthlyPayment, expectedMonthlyPayment);
  assert.ok(result.totalPayment > result.principal, 'Total payment should exceed principal');
  assert.ok(result.totalInterest > 0, 'Total interest should be positive');
  assert.equal(result.schedule.length, 12, 'Schedule should have 12 entries');
});

test('calculateLoan computes correct Simple/Direct interest for standard inputs', () => {
  // P = 50000, term = 6 months, rate = 24% annual (2% monthly)
  const result = calculateLoan({
    principal: 50000,
    term: 6,
    interestRate: 24,
    paymentMethod: 'simple',
  });

  // Simple interest: totalInterest = P * r * n = 50000 * 0.02 * 6 = 6000
  // monthlyPayment = (P + totalInterest) / n = (50000 + 6000) / 6 = 9333.33
  const expectedMonthlyPayment = 9333.33; // rounded
  const expectedTotalInterest = 6000;

  assert.equal(result.principal, 50000);
  assert.equal(result.term, 6);
  assert.equal(result.interestRate, 24);
  assert.equal(result.paymentMethod, 'simple');
  assert.equal(result.monthlyPayment, expectedMonthlyPayment);
  assert.equal(result.totalInterest, expectedTotalInterest);
  assert.equal(result.totalPayment, 56000); // 50000 + 6000
  assert.equal(result.schedule.length, 6, 'Schedule should have 6 entries');
});

test('calculateLoan handles zero interest rate correctly', () => {
  const result = calculateLoan({
    principal: 12000,
    term: 12,
    interestRate: 0,
    paymentMethod: 'french',
  });

  // With 0% interest, monthlyPayment = principal / term = 12000 / 12 = 1000
  assert.equal(result.monthlyPayment, 1000);
  assert.equal(result.totalInterest, 0);
  assert.equal(result.totalPayment, 12000);
});

test('calculateLoan handles final period rounding adjustment', () => {
  // This test verifies that the final period properly adjusts for rounding
  const result = calculateLoan({
    principal: 100000,
    term: 12,
    interestRate: 12,
    paymentMethod: 'french',
  });

  // The last entry should have balance close to 0
  const lastEntry = result.schedule[result.schedule.length - 1];
  assert.ok(lastEntry.balance < 1, 'Final balance should be essentially 0 after rounding');

  // The last principal payment should equal remaining balance
  assert.ok(lastEntry.principal > 0, 'Last principal payment should be positive');
});

test('buildAmortizationSchedule generates correct French schedule structure', () => {
  const schedule = buildAmortizationSchedule({
    principal: 10000,
    term: 3,
    interestRate: 12,
    monthlyRate: 0.01,
    monthlyPayment: 3520.15,
    paymentMethod: 'french',
  });

  assert.equal(schedule.length, 3);

  // Verify first entry
  assert.equal(schedule[0].period, 1);
  assert.equal(schedule[0].payment, 3520.15);
  assert.ok(schedule[0].principal > 0);
  assert.ok(schedule[0].interest > 0);
  assert.ok(schedule[0].balance < 10000);

  // Verify decreasing balance
  assert.ok(schedule[1].balance < schedule[0].balance);
  assert.ok(schedule[2].balance < schedule[1].balance);
});

test('buildAmortizationSchedule generates correct Simple schedule structure', () => {
  const schedule = buildAmortizationSchedule({
    principal: 30000,
    term: 6,
    interestRate: 24,
    monthlyRate: 0.02,
    monthlyPayment: 5700,
    paymentMethod: 'simple',
  });

  assert.equal(schedule.length, 6);

  // For simple interest, principal payment should be equal each period
  const principalPayment = schedule[0].principal;
  schedule.forEach((entry, i) => {
    assert.equal(entry.principal, principalPayment, `Period ${i + 1} principal should equal ${principalPayment}`);
    assert.equal(entry.interest, 600, `Period ${i + 1} interest should be 600 (30000 * 0.02)`);
  });
});

test('createCalculateLoanUseCase delegates to standard calculation by default', () => {
  let calculationEngineCalled = false;

  const useCase = createCalculateLoanUseCase({
    calculationEngine: {
      calculateAmortization() {
        calculationEngineCalled = true;
        return {};
      },
    },
  });

  const result = useCase.execute({
    principal: 50000,
    term: 12,
    interestRate: 18,
    paymentMethod: 'french',
  });

  assert.equal(calculationEngineCalled, false, 'DAG engine should not be called without useDAGEngine flag');
  assert.ok(result.monthlyPayment > 0);
});

test('createCalculateLoanUseCase uses DAG engine when useDAGEngine flag is set', () => {
  let dagCalculationCalled = false;
  const dagResult = { monthlyPayment: 4444.44, schedule: [] };

  const useCase = createCalculateLoanUseCase({
    calculationEngine: {
      calculateAmortization() {
        dagCalculationCalled = true;
        return dagResult;
      },
    },
  });

  const result = useCase.execute({
    principal: 50000,
    term: 12,
    interestRate: 18,
    paymentMethod: 'french',
    useDAGEngine: true,
  });

  assert.equal(dagCalculationCalled, true, 'DAG engine should be called with useDAGEngine flag');
  assert.equal(result.monthlyPayment, 4444.44);
});

test('calculateLoan throws error for invalid inputs', () => {
  assert.throws(
    () => calculateLoan({ principal: -1000, term: 12, interestRate: 10, paymentMethod: 'french' }),
    /Principal must be a positive number/
  );

  assert.throws(
    () => calculateLoan({ principal: 1000, term: 0, interestRate: 10, paymentMethod: 'french' }),
    /Term must be a positive number/
  );

  assert.throws(
    () => calculateLoan({ principal: 1000, term: 12, interestRate: -5, paymentMethod: 'french' }),
    /Interest rate must be non-negative/
  );
});

test('calculateLoan accepts both french and frances payment method names', () => {
  const frenchResult = calculateLoan({
    principal: 50000,
    term: 12,
    interestRate: 12,
    paymentMethod: 'french',
  });

  const francesResult = calculateLoan({
    principal: 50000,
    term: 12,
    interestRate: 12,
    paymentMethod: 'frances',
  });

  assert.equal(frenchResult.monthlyPayment, francesResult.monthlyPayment);
  assert.equal(frenchResult.totalInterest, francesResult.totalInterest);
});
