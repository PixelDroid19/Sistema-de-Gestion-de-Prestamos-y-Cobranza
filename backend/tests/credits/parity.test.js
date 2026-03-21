const { test, describe } = require('node:test');
const assert = require('assert');

const { createStandardAmortizationGraph } = require('../../src/bootstrap/graphDefinitions');
const { CalculationEngine } = require('../../src/core/domain/calculation/CalculationEngine');

const products = [
  { name: 'Personal Loan 12%', principal: 10000, rate: 12, term: 12, payment: 1000 },
  { name: 'Business Loan 18%', principal: 50000, rate: 18, term: 24, payment: 2500 },
  { name: 'Quick Loan 24%', principal: 5000, rate: 24, term: 6, payment: 1000 },
];

function calculateLegacyAmortization(principal, annualRate, termMonths, paymentAmount) {
  const monthlyRate = annualRate / 100 / 12;
  let balance = principal;
  let totalInterest = 0;

  for (let i = 0; i < termMonths && balance > 0; i++) {
    const interest = balance * monthlyRate;
    totalInterest += interest;
    balance -= (paymentAmount - interest);
  }

  return { totalInterest, finalBalance: Math.max(0, balance) };
}

function calculateDagAmortization(graph, principal, rate, termMonths, paymentAmount) {
  let balance = principal;
  let totalInterest = 0;

  for (let i = 0; i < termMonths && balance > 0; i++) {
    const scope = {
      principal,
      rate,
      paymentAmount,
      balance,
      totalInterest,
    };

    const result = CalculationEngine.execute(graph, scope);

    balance = result.scope.newBalance || 0;
    totalInterest = result.scope.totalInterest || 0;
  }

  return { totalInterest, finalBalance: Math.max(0, balance) };
}

describe('DAG vs Legacy Parity', () => {
  const graph = createStandardAmortizationGraph();

  products.forEach(product => {
    test(`${product.name}: DAG matches legacy within 0.01 tolerance`, () => {
      const legacy = calculateLegacyAmortization(
        product.principal,
        product.rate,
        product.term,
        product.payment
      );

      const dag = calculateDagAmortization(
        graph,
        product.principal,
        product.rate,
        product.term,
        product.payment
      );

      const tolerance = 0.01;
      const diff = Math.abs(dag.totalInterest - legacy.totalInterest);

      assert.ok(
        diff <= tolerance,
        `Interest mismatch: DAG=${dag.totalInterest.toFixed(4)}, Legacy=${legacy.totalInterest.toFixed(4)}, Diff=${diff.toFixed(4)}`
      );
    });
  });
});
