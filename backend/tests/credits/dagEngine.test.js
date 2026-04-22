const test = require('node:test');
const assert = require('node:assert/strict');

const { createCreditsDagConfig } = require('@/modules/credits/application/dag/config');
const { createCreditsCalculationService } = require('@/modules/credits/application/dag/calculationAdapter');
const { compareSimulationResults } = require('@/modules/credits/application/dag/parity');

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
      dueDate: '2026-02-01T00:00:00.000Z',
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
      dueDate: '2026-02-01T00:00:00.000Z',
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

test('compareSimulationResults rejects due date mismatches in the canonical schedule', () => {
  const legacy = {
    summary: { installmentAmount: 100, totalPayable: 100, outstandingBalance: 100 },
    schedule: [{
      installmentNumber: 1,
      dueDate: '2026-02-01T00:00:00.000Z',
      scheduledPayment: 100,
      principalComponent: 90,
      interestComponent: 10,
      remainingBalance: 0,
      remainingPrincipal: 90,
      remainingInterest: 10,
    }],
  };

  const dag = {
    summary: { installmentAmount: 100, totalPayable: 100, outstandingBalance: 100 },
    schedule: [{
      installmentNumber: 1,
      dueDate: '1970-02-01T00:00:00.000Z',
      scheduledPayment: 100,
      principalComponent: 90,
      interestComponent: 10,
      remainingBalance: 0,
      remainingPrincipal: 90,
      remainingInterest: 10,
    }],
  };

  const comparison = compareSimulationResults({ legacyResult: legacy, dagResult: dag, tolerance: 0.01 });

  assert.equal(comparison.passed, false);
  assert.deepEqual(comparison.mismatches, [{
    scope: 'schedule[1]',
    field: 'dueDate',
    expected: '2026-02-01T00:00:00.000Z',
    actual: '1970-02-01T00:00:00.000Z',
  }]);
});

test('createCreditsDagConfig normalizes supported rollout modes', () => {
  assert.equal(createCreditsDagConfig({ mode: 'PRIMARY' }).mode, 'primary');
  assert.equal(createCreditsDagConfig({ mode: 'shadow' }).mode, 'shadow');
  assert.equal(createCreditsDagConfig({ mode: 'unexpected-value' }).mode, 'off');
});

test('createCreditsDagConfig honors DAG_ROLLOUT_MODE for deployed environments', () => {
  const config = createCreditsDagConfig({
    env: { DAG_ROLLOUT_MODE: 'primary' },
  });

  assert.equal(config.mode, 'primary');
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

test('createCreditsCalculationService returns DAG results in shadow mode and logs parity metadata', async () => {
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
    graphExecutor: { execute: async () => ({ ok: true, source: 'persisted_graph', graphVersionId: 1, result: dagResult }) },
    comparisonLogger: (event, payload) => logEntries.push({ event, payload }),
  });

  const execution = await service.calculate({ amount: 100 });

  // DAG is the single source of truth — shadow logs parity but always returns DAG
  assert.equal(execution.selectedSource, 'dag');
  assert.equal(execution.result, dagResult);
  assert.equal(execution.parity.passed, true);
  assert.equal(logEntries[0].event, 'credits.dag.comparison');
  assert.equal(logEntries[0].payload.mode, 'shadow');
});

test('createCreditsCalculationService returns DAG results in primary mode even when parity mismatches', async () => {
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
    graphExecutor: { execute: async () => ({ ok: true, source: 'persisted_graph', graphVersionId: 1, result: dagResult }) },
    comparisonLogger: (event, payload) => logEntries.push({ event, payload }),
  });

  const execution = await service.calculate({ amount: 100 });

  // DAG is the single source of truth — no fallback to legacy
  assert.equal(execution.selectedSource, 'dag');
  assert.equal(execution.result, dagResult);
  assert.equal(execution.parity.passed, false);
  assert.equal(execution.fallbackReason, null);
  assert.equal(execution.parity.mismatches.length > 0, true);
  assert.equal(logEntries[0].event, 'credits.dag.comparison');
  assert.equal(logEntries[0].payload.mode, 'primary');
  assert.equal(logEntries[0].payload.fallbackReason, undefined);
});

test('createCreditsCalculationService propagates DAG execution errors in primary mode', async () => {
  const logEntries = [];
  const legacyResult = {
    lateFeeMode: 'NONE',
    summary: { installmentAmount: 100, totalPayable: 200, outstandingBalance: 200 },
    schedule: [],
  };

  const service = createCreditsCalculationService({
    dagConfig: createCreditsDagConfig({ mode: 'primary' }),
    legacySimulator: () => legacyResult,
    graphExecutor: { execute: async () => { throw new Error('dag exploded'); } },
    comparisonLogger: (event, payload) => logEntries.push({ event, payload }),
  });

  await assert.rejects(
    () => service.calculate({ amount: 100 }),
    (err) => {
      assert.equal(err.message, 'dag exploded');
      return true;
    },
  );
});

test('createCreditsCalculationService injects one shared startDate when callers omit it', async () => {
  const service = createCreditsCalculationService({
    dagConfig: createCreditsDagConfig({ mode: 'primary' }),
    legacySimulator: (input) => ({
      summary: { installmentAmount: 100, totalPayable: 100, outstandingBalance: 100 },
      schedule: [{
        installmentNumber: 1,
        dueDate: input.startDate,
        scheduledPayment: 100,
        principalComponent: 90,
        interestComponent: 10,
        remainingBalance: 0,
        remainingPrincipal: 90,
        remainingInterest: 10,
      }],
    }),
    graphExecutor: { execute: async ({ contractVars }) => ({
      ok: true,
      source: 'persisted_graph',
      graphVersionId: 1,
      result: {
        summary: { installmentAmount: 100, totalPayable: 100, outstandingBalance: 100 },
        schedule: [{
          installmentNumber: 1,
          dueDate: contractVars.startDate,
          scheduledPayment: 100,
          principalComponent: 90,
          interestComponent: 10,
          remainingBalance: 0,
          remainingPrincipal: 90,
          remainingInterest: 10,
        }],
      },
    }) },
  });

  const execution = await service.calculate({ amount: 100, interestRate: 12, termMonths: 1 });

  assert.equal(execution.selectedSource, 'dag');
  assert.equal(execution.parity.passed, true);
  assert.match(execution.result.schedule[0].dueDate, /^\d{4}-\d{2}-\d{2}T/);
});
