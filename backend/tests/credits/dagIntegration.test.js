/**
 * Integration tests for the unified DAG formula system.
 *
 * These tests wire the real production chain:
 *   graphExecutor  ->  calculationAdapter  ->  creditCalculationService  ->  loanCreation
 *
 * The only mock is the database repository — the CalculationEngine, FormulaCompiler,
 * BigNumberEngine, scopeBuilder helpers, and scopeRegistry are all real.
 */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const models = require('@/models');
const { createGraphExecutor } = require('@/modules/credits/application/dag/graphExecutor');
const { createCreditsCalculationService } = require('@/modules/credits/application/dag/calculationAdapter');
const { createCreditCalculationService } = require('@/modules/credits/application/creditCalculationService');
const { createLoanFromCanonicalDataFactory } = require('@/modules/credits/infrastructure/loanCreation');
const { getDagWorkbenchScopeDefinition } = require('@/modules/credits/application/dag/scopeRegistry');
const BigNumberEngine = require('@/core/domain/calculation/BigNumberEngine');

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

test('graphExecutor injects active custom variables into real formula execution', async () => {
  const graph = JSON.parse(JSON.stringify(scope.defaultGraph));
  graph.nodes.push({
    id: 'minimum_rate_rule',
    kind: 'formula',
    label: 'Tasa minima personalizada',
    formula: 'max(interestRate, minimum_rate)',
    outputVar: 'interestRate',
  });
  graph.edges = graph.edges.map((edge) => (
    edge.source === 'input_rate'
      ? { ...edge, source: 'minimum_rate_rule' }
      : edge
  ));
  graph.edges.push({ source: 'input_rate', target: 'minimum_rate_rule' });

  const record = createMockGraphVersionRecord({ graph });
  const dagVariableRepository = {
    list: async () => ({
      items: [
        { name: 'minimum_rate', type: 'percent', value: '24', status: 'active' },
      ],
    }),
  };
  const executor = createGraphExecutor({
    dagGraphRepository: createMockRepo(record),
    dagVariableRepository,
  });

  const result = await executor.execute({
    scopeKey: 'credit-simulation',
    contractVars: standardInput,
  });

  assert.equal(result.ok, true);
  assert.ok(result.result.summary.installmentAmount > 900);
  assert.ok(result.result.summary.totalInterest > 800);
});

test('graphExecutor handles zero-interest formulas without evaluating the interest branch', async () => {
  const record = createMockGraphVersionRecord();
  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(record) });

  const result = await executor.execute({
    scopeKey: 'credit-simulation',
    contractVars: {
      amount: 12000,
      interestRate: 0,
      termMonths: 12,
      lateFeeMode: 'SIMPLE',
    },
  });

  assert.equal(result.result.schedule.length, 12);
  assert.equal(result.result.summary.installmentAmount, 1000);
  assert.equal(result.result.summary.totalInterest, 0);
});

test('graphExecutor normalizes persisted legacy result nodes before execution', async () => {
  const legacyGraph = JSON.parse(JSON.stringify(scope.defaultGraph));
  const resultNode = legacyGraph.nodes.find((n) => n.id === 'credit_result');
  resultNode.id = 'simulation_result';
  resultNode.formula = 'buildSimulationResult(lateFeeMode, schedule, summary)';
  legacyGraph.edges = legacyGraph.edges.map((edge) => ({
    ...edge,
    source: edge.source === 'credit_result' ? 'simulation_result' : edge.source,
    target: edge.target === 'credit_result' ? 'simulation_result' : edge.target,
  }));

  assert.throws(
    () => BigNumberEngine.validateFormula('buildSimulationResult(lateFeeMode, schedule, summary)'),
    /disallowed functions/i,
  );

  const record = createMockGraphVersionRecord({ graph: legacyGraph });
  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(record) });
  const result = await executor.execute({
    scopeKey: 'credit-simulation',
    contractVars: standardInput,
  });

  assert.equal(result.ok, true);
  assert.equal(result.graphVersionId, 42);
  assert.equal(result.result.schedule.length, 12);
  assert.ok(result.result.summary.installmentAmount > 0);
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

// ─── Full chain: graphExecutor -> calculationAdapter -> creditCalculationService ─

test('full chain: calculateDetailed returns DAG result with graphVersionId', async () => {
  const record = createMockGraphVersionRecord();
  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(record) });

  const calculationService = createCreditsCalculationService({
    graphExecutor: executor,
  });

  const creditCalculator = createCreditCalculationService({ calculationService });
  const detailed = await creditCalculator.calculateDetailed(standardInput);

  assert.equal(detailed.graphVersionId, 42);
  assert.equal(detailed.result.schedule.length, 12);
  assert.ok(detailed.result.summary.installmentAmount > 0);
});

test('full chain: calculate returns credit result with graphVersionId', async () => {
  const record = createMockGraphVersionRecord();
  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(record) });

  const calculationService = createCreditsCalculationService({
    graphExecutor: executor,
  });

  const creditCalculator = createCreditCalculationService({ calculationService });
  const result = await creditCalculator.calculate(standardInput);

  // calculate() spreads graphVersionId onto the result
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

// ─── Formula Editor Integration: edited graph affects real credit calculations ─

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

  const creditCalculator = createCreditCalculationService({ calculationService });

  // Pass 12 months as input, but the edited formula uses 6
  const detailed = await creditCalculator.calculateDetailed({
    amount: 10000,
    interestRate: 12,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  });

  // DAG is the single source of truth — edited formula is always used
  assert.equal(detailed.graphVersionId, 99);
  assert.equal(detailed.result.schedule.length, 6, 'Edited formula produces 6 installments');
});

test('edited installment formula changes the generated amortization schedule', async () => {
  const modifiedGraph = JSON.parse(JSON.stringify(scope.defaultGraph));
  const installmentNode = modifiedGraph.nodes.find((n) => n.id === 'installment_amount');
  assert.ok(installmentNode, 'installment_amount node should exist in default graph');

  installmentNode.formula = '1500';

  const modifiedRecord = createMockGraphVersionRecord({
    id: 100,
    name: 'Edited installment formula',
    graph: modifiedGraph,
  });

  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(modifiedRecord) });
  const calculationService = createCreditsCalculationService({ graphExecutor: executor });
  const creditCalculator = createCreditCalculationService({ calculationService });

  const detailed = await creditCalculator.calculateDetailed({
    amount: 10000,
    interestRate: 12,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  });

  assert.equal(detailed.graphVersionId, 100);
  assert.equal(detailed.result.schedule[0].scheduledPayment, 1500);
  assert.equal(detailed.result.summary.installmentAmount, 1500);
});

test('edited installment formula is persisted through real loan creation payload', async () => {
  let persistedPayload;

  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Formula Customer' }));
  mock.method(models.Associate, 'findByPk', async () => null);
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Formula Product' }));
  mock.method(models.Loan, 'create', async (payload) => {
    persistedPayload = payload;
    return { id: 101, ...payload };
  });

  const modifiedGraph = JSON.parse(JSON.stringify(scope.defaultGraph));
  const installmentNode = modifiedGraph.nodes.find((n) => n.id === 'installment_amount');
  assert.ok(installmentNode, 'installment_amount node should exist in default graph');
  installmentNode.formula = '1500';

  const modifiedRecord = createMockGraphVersionRecord({
    id: 100,
    name: 'Edited installment formula',
    graph: modifiedGraph,
  });

  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(modifiedRecord) });
  const calculationService = createCreditsCalculationService({ graphExecutor: executor });
  const createLoan = createLoanFromCanonicalDataFactory({ calculationService });

  const loan = await createLoan({
    customerId: 1,
    amount: 10000,
    interestRate: 12,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  });

  assert.equal(loan.id, 101);
  assert.equal(persistedPayload.dagGraphVersionId, 100);
  assert.equal(persistedPayload.installmentAmount, 1500);
  assert.equal(persistedPayload.emiSchedule[0].scheduledPayment, 1500);
  assert.equal(persistedPayload.financialSnapshot.installmentAmount, 1500);
  assert.equal(persistedPayload.financialSnapshot.calculationMethod, 'FRENCH');
});

test('calculation method selected by active formula is persisted in loan snapshot', async () => {
  let persistedPayload;

  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Method Customer' }));
  mock.method(models.Associate, 'findByPk', async () => null);
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Method Product' }));
  mock.method(models.Loan, 'create', async (payload) => {
    persistedPayload = payload;
    return { id: 102, ...payload };
  });

  const modifiedGraph = JSON.parse(JSON.stringify(scope.defaultGraph));
  const methodNode = modifiedGraph.nodes.find((n) => n.id === 'calculation_method');
  assert.ok(methodNode, 'calculation_method node should exist in default graph');
  methodNode.formula = "'COMPOUND'";

  const modifiedRecord = createMockGraphVersionRecord({
    id: 101,
    name: 'Compound method formula',
    graph: modifiedGraph,
  });

  const executor = createGraphExecutor({ dagGraphRepository: createMockRepo(modifiedRecord) });
  const calculationService = createCreditsCalculationService({ graphExecutor: executor });
  const createLoan = createLoanFromCanonicalDataFactory({ calculationService });

  const loan = await createLoan({
    customerId: 1,
    amount: 10000,
    interestRate: 12,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  });

  assert.equal(loan.id, 102);
  assert.equal(persistedPayload.dagGraphVersionId, 101);
  assert.equal(persistedPayload.financialSnapshot.calculationMethod, 'COMPOUND');
  assert.equal(persistedPayload.emiSchedule.length, 12);
});

test('new active formula affects only new loans while old graph versions remain executable', async () => {
  const graphV1 = JSON.parse(JSON.stringify(scope.defaultGraph));
  graphV1.nodes.find((n) => n.id === 'installment_amount').formula = '1500';

  const graphV2 = JSON.parse(JSON.stringify(scope.defaultGraph));
  graphV2.nodes.find((n) => n.id === 'installment_amount').formula = '1800';

  const records = new Map([
    [501, createMockGraphVersionRecord({ id: 501, version: 1, name: 'Formula cuota 1500', graph: graphV1 })],
    [502, createMockGraphVersionRecord({ id: 502, version: 2, name: 'Formula cuota 1800', graph: graphV2 })],
  ]);
  let activeGraphId = 501;

  const executor = createGraphExecutor({
    dagGraphRepository: {
      getLatestActive: async () => records.get(activeGraphId),
      findById: async (id) => records.get(id) || null,
    },
  });
  const calculationService = createCreditsCalculationService({ graphExecutor: executor });

  let nextLoanId = 200;
  const persistedLoans = [];
  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Versioned Customer' }));
  mock.method(models.Associate, 'findByPk', async () => null);
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Versioned Product' }));
  mock.method(models.Loan, 'create', async (payload) => {
    const loan = { id: nextLoanId += 1, ...payload };
    persistedLoans.push(loan);
    return loan;
  });

  const createLoan = createLoanFromCanonicalDataFactory({ calculationService });

  const oldLoan = await createLoan({
    customerId: 1,
    amount: 10000,
    interestRate: 12,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  });

  activeGraphId = 502;
  const newLoan = await createLoan({
    customerId: 1,
    amount: 10000,
    interestRate: 12,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  });

  const oldVersionExecution = await executor.execute({
    graphVersionId: oldLoan.dagGraphVersionId,
    contractVars: standardInput,
  });

  assert.equal(oldLoan.dagGraphVersionId, 501);
  assert.equal(oldLoan.installmentAmount, 1500);
  assert.equal(newLoan.dagGraphVersionId, 502);
  assert.equal(newLoan.installmentAmount, 1800);
  assert.equal(oldVersionExecution.result.summary.installmentAmount, 1500);
  assert.equal(persistedLoans.length, 2);
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
