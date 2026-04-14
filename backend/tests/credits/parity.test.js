const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { simulateCredit } = require('../../src/modules/credits/application/creditSimulationService');
const { createSimulationDagExecutor } = require('../../src/modules/credits/application/dag/simulationGraph');

const scenarios = [
  { name: 'Personal Loan 12%', amount: 10000, interestRate: 12, termMonths: 12, lateFeeMode: 'SIMPLE' },
  { name: 'Business Loan 18%', amount: 50000, interestRate: 18, termMonths: 24, lateFeeMode: 'SIMPLE' },
  { name: 'Quick Loan 24%', amount: 5000, interestRate: 24, termMonths: 6, lateFeeMode: 'FLAT' },
];

const compareWithinTolerance = (left, right, tolerance = 0.01) => Math.abs(Number(left || 0) - Number(right || 0)) <= tolerance;

describe('DAG vs canonical simulation parity', () => {
  const executeDagSimulation = createSimulationDagExecutor();

  scenarios.forEach((scenario) => {
    test(`${scenario.name}: DAG executor matches canonical simulation output`, () => {
      const canonical = simulateCredit(scenario);
      const dag = executeDagSimulation(scenario).outputs.result;

      assert.equal(dag.lateFeeMode, canonical.lateFeeMode);
      assert.equal(dag.schedule.length, canonical.schedule.length);
      assert.ok(compareWithinTolerance(dag.summary.installmentAmount, canonical.summary.installmentAmount));
      assert.ok(compareWithinTolerance(dag.summary.totalInterest, canonical.summary.totalInterest));
      assert.ok(compareWithinTolerance(dag.summary.totalPayable, canonical.summary.totalPayable));
      assert.ok(compareWithinTolerance(
        dag.schedule[dag.schedule.length - 1].remainingBalance,
        canonical.schedule[canonical.schedule.length - 1].remainingBalance,
      ));
    });
  });
});
