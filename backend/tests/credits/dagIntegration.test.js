/**
 * Integration tests for the unified DAG formula system.
 *
 * These tests wire the real production chain:
 *   graphExecutor  ->  calculationAdapter  ->  creditSimulationService  ->  loanCreation
 *
 * The only mock is the database repository — the CalculationEngine, FormulaCompiler,
 * BigNumberEngine, scopeBuilder helpers, and scopeRegistry are all real.
 */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const models = require('@/models');
const { createGraphExecutor } = require('@/modules/credits/application/dag/graphExecutor');
const { createCreditsCalculationService } = require('@/modules/credits/application/dag/calculationAdapter');
const { createCreditSimulationService } = require('@/modules/credits/application/creditSimulationService');
const { createLoanFromCanonicalDataFactory } = require('@/modules/credits/infrastructure/loanCreation');
const { getDagWorkbenchScopeDefinition } = require('@/modules/credits/application/dag/scopeRegistry');

// ─── Shared Fixtures ────────────────────────────────────────────────────────

const scope = getDagWorkbenchScopeDefinition('credit-simulation');

/** A persisted DagGraphVersion record (mocked DB shape) */
const createMockGraphVersionRecord = (overrides = {}) => ({
  id: 42,
  scopeKey: 'credit-simulation',
  version: 1,
  status: 'active',
  name: 'Integration test graph',
  graph: scope.defaultGraph,
  ...overrides,
});

/** Mock repository that returns the seeded default graph as the "active" version */
const createMockRepo = (graphVersionRecord) => ({
  getLatestActive: async (scopeKey) => {
    if (scopeKey === 'credit-simulation') return graphVersionRecord;
    return null;
  },
  findById: async (id) => {
    if (id === graphVersionRecord.id) return graphVersionRecord;
    return null;
  },
});

const standardInput = {
  amount: 10000,
  interestRate: 12,
  termMonths: 12,
  lateFeeMode: 'SIMPLE',
};

afterEach(() => {
  mock.restoreAll();
});

// ─── graphExecutor ──────────────────────────────────────────────────────────

test('graphExecutor executes the seeded default graph and returns a valid result', async () => {
  const record = createMockGraphVersionRecord();
  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(record) });

  const result = await executor.execute({
    scopeKey: 'credit-simulation',
    contractVars: standardInput,
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, 'persisted_graph');
  assert.equal(result.graphVersionId, 42);
  assert.equal(result.scopeKey, 'credit-simulation');

  // The result object matches the scope contract
  assert.ok(result.result.lateFeeMode);
  assert.ok(Array.isArray(result.result.schedule));
  assert.equal(result.result.schedule.length, 12);
  assert.ok(result.result.summary.installmentAmount > 0);
  assert.ok(result.result.summary.totalPayable > 10000);
  assert.ok(result.result.summary.totalInterest > 0);
});

test('graphExecutor rejects execution when no active version exists', async () => {
  const executor = createGraphExecutor({
    dagGraphRepository: {
      getLatestActive: async () => null,
      findById: async () => null,
    },
  });

  await assert.rejects(
    () => executor.execute({ scopeKey: 'credit-simulation', contractVars: standardInput }),
    (err) => {
      assert.match(err.message, /no active formula version/i);
      return true;
    },
  );
});

test('graphExecutor rejects execution with missing required inputs', async () => {
  const record = createMockGraphVersionRecord();
  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(record) });

  await assert.rejects(
    () => executor.execute({ scopeKey: 'credit-simulation', contractVars: { amount: 1000 } }),
    (err) => {
      assert.match(err.message, /missing required inputs/i);
      return true;
    },
  );
});

// ─── Full chain: graphExecutor -> calculationAdapter -> creditSimulationService ─

test('full chain: simulateDetailed returns DAG result with graphVersionId', async () => {
  const record = createMockGraphVersionRecord();
  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(record) });

  const calculationService = createCreditsCalculationService({
    graphExecutor: executor,
  });

  const creditSimulator = createCreditSimulationService({ calculationService });
  const detailed = await creditSimulator.simulateDetailed(standardInput);

  assert.equal(detailed.graphVersionId, 42);
  assert.equal(detailed.result.schedule.length, 12);
  assert.ok(detailed.result.summary.installmentAmount > 0);
});

test('full chain: simulate returns simulation result with graphVersionId', async () => {
  const record = createMockGraphVersionRecord();
  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(record) });

  const calculationService = createCreditsCalculationService({
    graphExecutor: executor,
  });

  const creditSimulator = createCreditSimulationService({ calculationService });
  const result = await creditSimulator.simulate(standardInput);

  // simulate() now spreads graphVersionId onto the result
  assert.equal(result.graphVersionId, 42);
  assert.equal(result.lateFeeMode, 'SIMPLE');
  assert.equal(result.schedule.length, 12);
  assert.ok(result.summary.installmentAmount > 0);
});

// ─── Full chain through loanCreation ────────────────────────────────────────

test('full chain: loanCreation uses DAG result and persists correct graphVersionId', async () => {
  let persistedPayload;

  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Test Customer' }));
  mock.method(models.Associate, 'findByPk', async () => null);
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Personal 12%' }));
  mock.method(models.Loan, 'create', async (payload) => {
    persistedPayload = payload;
    return { id: 99, ...payload };
  });

  const record = createMockGraphVersionRecord();
  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(record) });

  const calculationService = createCreditsCalculationService({
    graphExecutor: executor,
  });

  const createLoan = createLoanFromCanonicalDataFactory({ calculationService });

  const loan = await createLoan({
    customerId: 1,
    amount: 10000,
    interestRate: 12,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  });

  assert.equal(loan.id, 99);
  assert.equal(persistedPayload.dagGraphVersionId, 42);
  assert.equal(persistedPayload.emiSchedule.length, 12);
  assert.ok(persistedPayload.installmentAmount > 0);
  assert.ok(persistedPayload.totalPayable > 10000);
  assert.equal(persistedPayload.lateFeeMode, 'SIMPLE');
  assert.equal(persistedPayload.financialSnapshot.outstandingInstallments, 12);
});

// ─── Formula Editor Integration: edited graph affects simulation ────────────

test('edited formula graph is executed and used in primary mode — DAG is source of truth', async () => {
  // Clone the default graph and modify the amortization formula
  // to use a hardcoded 6-month term instead of the input termMonths
  const modifiedGraph = JSON.parse(JSON.stringify(scope.defaultGraph));
  const scheduleNode = modifiedGraph.nodes.find((n) => n.id === 'amortization_schedule');
  assert.ok(scheduleNode, 'amortization_schedule node should exist in default graph');

  // Edit the formula: replace termMonths with hardcoded 6
  scheduleNode.formula = 'buildAmortizationSchedule(amount, interestRate, 6, startDate, lateFeeMode)';

  const modifiedRecord = createMockGraphVersionRecord({
    id: 99,
    name: 'Edited 6-month term formula',
    graph: modifiedGraph,
  });

  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(modifiedRecord) });

  const calculationService = createCreditsCalculationService({
    graphExecutor: executor,
  });

  const creditSimulator = createCreditSimulationService({ calculationService });

  // Pass 12 months as input, but the edited formula uses 6
  const detailed = await creditSimulator.simulateDetailed({
    amount: 10000,
    interestRate: 12,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  });

  // DAG is the single source of truth — edited formula is always used
  assert.equal(detailed.graphVersionId, 99);
  assert.equal(detailed.result.schedule.length, 6, 'Edited formula produces 6 installments');
});

test('formula editor save flow: graphExecutor.executeDraft validates edited formulas', async () => {
  const modifiedGraph = JSON.parse(JSON.stringify(scope.defaultGraph));
  const scheduleNode = modifiedGraph.nodes.find((n) => n.id === 'amortization_schedule');
  scheduleNode.formula = 'buildAmortizationSchedule(amount, interestRate, 24, startDate, lateFeeMode)';

  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(createMockGraphVersionRecord()) });

  // executeDraft runs a graph without persisting it — exactly what the workbench "Probar" button does
  const draftResult = await executor.executeDraft({
    scopeKey: 'credit-simulation',
    contractVars: standardInput,
    graph: modifiedGraph,
  });

  assert.equal(draftResult.ok, true);
  assert.equal(draftResult.source, 'draft');
  assert.equal(draftResult.result.schedule.length, 24, 'Draft formula with 24-month term should produce 24 installments');
  assert.ok(draftResult.result.summary.totalPayable > 10000);
});
