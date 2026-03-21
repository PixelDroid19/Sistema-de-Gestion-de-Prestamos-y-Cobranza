const test = require('node:test');
const assert = require('node:assert/strict');

const { createCreditsDagConfig } = require('../../src/modules/credits/application/dag/config');
const { createCreditsCalculationService } = require('../../src/modules/credits/application/dag/calculationAdapter');
const { createDagRuntime } = require('../../src/modules/credits/application/dag/runtime');
const { compareSimulationResults } = require('../../src/modules/credits/application/dag/parity');

test('createDagRuntime executes nodes in dependency order and returns deterministic outputs', () => {
  const runtime = createDagRuntime({
    nodes: [
      {
        id: 'principal',
        execute: ({ input }) => Number(input.amount || 0),
      },
      {
        id: 'doublePrincipal',
        dependencies: ['principal'],
        execute: ({ values }) => values.principal * 2,
      },
    ],
  });

  const result = runtime.execute({
    input: { amount: 125 },
    requestedOutputs: ['doublePrincipal'],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.nodeOrder, ['principal', 'doublePrincipal']);
  assert.deepEqual(result.outputs, { doublePrincipal: 250 });
});

test('compareSimulationResults accepts values within tolerance and rejects material mismatches', () => {
  const legacy = {
    lateFeeMode: 'NONE',
    summary: {
      installmentAmount: 100,
      totalPayable: 300,
      outstandingBalance: 300,
    },
    schedule: [{
      installmentNumber: 1,
      scheduledPayment: 100,
      principalComponent: 90,
      interestComponent: 10,
      remainingBalance: 200,
      remainingPrincipal: 90,
      remainingInterest: 10,
    }],
  };

  const nearMatch = {
    lateFeeMode: 'NONE',
    summary: {
      installmentAmount: 100.009,
      totalPayable: 300,
      outstandingBalance: 300,
    },
    schedule: [{
      installmentNumber: 1,
      scheduledPayment: 100.009,
      principalComponent: 90,
      interestComponent: 10,
      remainingBalance: 200,
      remainingPrincipal: 90,
      remainingInterest: 10,
    }],
  };

  const mismatch = {
    ...nearMatch,
    summary: {
      ...nearMatch.summary,
      outstandingBalance: 301,
    },
  };

  assert.equal(compareSimulationResults({ legacyResult: legacy, dagResult: nearMatch, tolerance: 0.01 }).passed, true);
  assert.equal(compareSimulationResults({ legacyResult: legacy, dagResult: mismatch, tolerance: 0.01 }).passed, false);
});

test('createCreditsDagConfig normalizes supported rollout modes', () => {
  assert.equal(createCreditsDagConfig({ mode: 'PRIMARY' }).mode, 'primary');
  assert.equal(createCreditsDagConfig({ mode: 'shadow' }).mode, 'shadow');
  assert.equal(createCreditsDagConfig({ mode: 'unexpected-value' }).mode, 'off');
});

test('createCreditsDagConfig supports workbench rollout flags and scope gating', () => {
  const config = createCreditsDagConfig({
    workbenchEnabled: 'true',
    workbenchScopes: 'personal-loan, auto-loan',
  });

  assert.equal(config.workbenchEnabled, true);
  assert.deepEqual(config.workbenchScopes, ['personal-loan', 'auto-loan']);
  assert.equal(config.isScopeEnabled('personal-loan'), true);
  assert.equal(config.isScopeEnabled('mortgage'), false);
});

test('createCreditsCalculationService returns legacy results in shadow mode and logs parity metadata', () => {
  const logEntries = [];
  const legacyResult = {
    lateFeeMode: 'NONE',
    summary: { installmentAmount: 100, totalPayable: 200, outstandingBalance: 200 },
    schedule: [{ installmentNumber: 1, scheduledPayment: 100, principalComponent: 90, interestComponent: 10, remainingBalance: 100, remainingPrincipal: 90, remainingInterest: 10 }],
  };
  const dagResult = JSON.parse(JSON.stringify(legacyResult));

  const service = createCreditsCalculationService({
    dagConfig: createCreditsDagConfig({ mode: 'shadow' }),
    legacySimulator: () => legacyResult,
    dagExecutor: () => ({ ok: true, outputs: { result: dagResult } }),
    comparisonLogger: (event, payload) => logEntries.push({ event, payload }),
  });

  const execution = service.calculate({ amount: 100 });

  assert.equal(execution.selectedSource, 'legacy');
  assert.equal(execution.result, legacyResult);
  assert.equal(execution.parity.passed, true);
  assert.equal(logEntries[0].event, 'credits.dag.comparison');
  assert.equal(logEntries[0].payload.mode, 'shadow');
});

test('createCreditsCalculationService falls back to legacy results on primary parity mismatches', () => {
  const logEntries = [];
  const legacyResult = {
    lateFeeMode: 'NONE',
    summary: { installmentAmount: 100, totalPayable: 200, outstandingBalance: 200 },
    schedule: [{ installmentNumber: 1, scheduledPayment: 100, principalComponent: 90, interestComponent: 10, remainingBalance: 100, remainingPrincipal: 90, remainingInterest: 10 }],
  };
  const dagResult = {
    lateFeeMode: 'NONE',
    summary: { installmentAmount: 100, totalPayable: 200, outstandingBalance: 201 },
    schedule: [{ installmentNumber: 1, scheduledPayment: 100, principalComponent: 90, interestComponent: 10, remainingBalance: 101, remainingPrincipal: 91, remainingInterest: 10 }],
  };

  const service = createCreditsCalculationService({
    dagConfig: createCreditsDagConfig({ mode: 'primary' }),
    legacySimulator: () => legacyResult,
    dagExecutor: () => ({ ok: true, outputs: { result: dagResult } }),
    comparisonLogger: (event, payload) => logEntries.push({ event, payload }),
  });

  const execution = service.calculate({ amount: 100 });

  assert.equal(execution.selectedSource, 'legacy');
  assert.equal(execution.result, legacyResult);
  assert.equal(execution.parity.passed, false);
  assert.equal(execution.fallbackReason, 'parity_mismatch');
  assert.equal(execution.parity.mismatches.length > 0, true);
  assert.equal(logEntries[0].event, 'credits.dag.comparison');
  assert.equal(logEntries[0].payload.mode, 'primary');
  assert.equal(logEntries[0].payload.fallbackReason, 'parity_mismatch');
});

test('createCreditsCalculationService falls back to legacy results on DAG execution errors', () => {
  const logEntries = [];
  const legacyResult = {
    lateFeeMode: 'NONE',
    summary: { installmentAmount: 100, totalPayable: 200, outstandingBalance: 200 },
    schedule: [],
  };

  const service = createCreditsCalculationService({
    dagConfig: createCreditsDagConfig({ mode: 'primary' }),
    legacySimulator: () => legacyResult,
    dagExecutor: () => {
      throw new Error('dag exploded');
    },
    comparisonLogger: (event, payload) => logEntries.push({ event, payload }),
  });

  const execution = service.calculate({ amount: 100 });

  assert.equal(execution.selectedSource, 'legacy');
  assert.equal(execution.result, legacyResult);
  assert.equal(execution.fallbackReason, 'dag_execution_failed');
  assert.equal(logEntries[0].event, 'credits.dag.comparison');
  assert.equal(logEntries[0].payload.fallbackReason, 'dag_execution_failed');
});
