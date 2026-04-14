const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateDagWorkbenchGraph,
  createDagWorkbenchService,
} = require('../../src/modules/credits/application/dag/workbenchService');

const buildGraph = () => ({
  nodes: [
    { id: 'amount', kind: 'input', label: 'Monto' },
    { id: 'interest', kind: 'input', label: 'Interes' },
    { id: 'result', kind: 'output', label: 'Resultado', formula: 'amount + interest' },
  ],
  edges: [
    { id: 'edge-1', source: 'amount', target: 'result' },
    { id: 'edge-2', source: 'interest', target: 'result' },
  ],
});

test('validateDagWorkbenchGraph rejects duplicate nodes and circular edges', () => {
  const duplicateResult = validateDagWorkbenchGraph({
    nodes: [
      { id: 'amount', kind: 'input' },
      { id: 'amount', kind: 'output' },
    ],
    edges: [],
  });

  const circularResult = validateDagWorkbenchGraph({
    nodes: [
      { id: 'a', kind: 'calculation', formula: 'b' },
      { id: 'b', kind: 'calculation', formula: 'a' },
    ],
    edges: [
      { id: 'ab', source: 'a', target: 'b' },
      { id: 'ba', source: 'b', target: 'a' },
    ],
  });

  assert.equal(duplicateResult.valid, false);
  assert.match(duplicateResult.errors[0].message, /duplicate/i);
  assert.equal(circularResult.valid, false);
  assert.match(circularResult.errors.at(-1).message, /circular/i);
});

test('createDagWorkbenchService saves, loads, simulates, and summarizes scoped graphs', async () => {
  const savedGraphs = new Map();
  const savedSummaries = new Map();

  const service = createDagWorkbenchService({
    dagConfig: { mode: 'shadow', workbenchEnabled: true },
    dagGraphRepository: {
      async getLatest(scopeKey) {
        return savedGraphs.get(scopeKey) || null;
      },
      async saveVersion(record) {
        const nextRecord = {
          id: `${record.scopeKey}:v1`,
          version: 1,
          createdAt: '2026-03-21T00:00:00.000Z',
          updatedAt: '2026-03-21T00:00:00.000Z',
          ...record,
        };
        savedGraphs.set(record.scopeKey, nextRecord);
        return nextRecord;
      },
    },
    dagSimulationSummaryRepository: {
      async save(record) {
        const nextRecord = {
          id: `${record.scopeKey}:summary-1`,
          createdAt: '2026-03-21T00:05:00.000Z',
          ...record,
        };
        savedSummaries.set(record.scopeKey, nextRecord);
        return nextRecord;
      },
      async getLatest(scopeKey) {
        return savedSummaries.get(scopeKey) || null;
      },
    },
    creditDomainService: {
      simulateDetailed(input) {
        return {
          selectedSource: 'legacy',
          fallbackReason: null,
          parity: { passed: true, mismatches: [] },
          result: {
            lateFeeMode: 'NONE',
            schedule: [{ installmentNumber: 1, scheduledPayment: 125 }],
            summary: { totalPayable: Number(input.amount || 0) + Number(input.interestRate || 0) },
          },
        };
      },
    },
  });

  const actor = { id: 1, role: 'admin' };
  const saveResult = await service.saveGraph({ actor, scopeKey: 'credit-simulation', name: 'Personal Loan', graph: buildGraph() });
  const loadResult = await service.loadGraph({ actor, scopeKey: 'credit-simulation' });
  const simulationResult = await service.simulateGraph({
    actor,
    scopeKey: 'credit-simulation',
    graph: buildGraph(),
    simulationInput: { amount: 1000, interestRate: 12, termMonths: 12 },
  });
  const summaryResult = await service.getSummary({ actor, scopeKey: 'credit-simulation' });

  assert.equal(saveResult.graphVersion.scopeKey, 'credit-simulation');
  assert.equal(saveResult.graphVersion.status, 'active');
  assert.equal(saveResult.validation.valid, true);
  assert.equal(loadResult.graphVersion.name, 'Personal Loan');
  assert.equal(simulationResult.simulation.summary.totalPayable, 1012);
  assert.equal(simulationResult.summary.latestSimulation.selectedSource, 'legacy');
  assert.equal(summaryResult.latestGraph.version, 1);
  assert.equal(summaryResult.latestSimulation.selectedSource, 'legacy');
});

test('createDagWorkbenchService saves subsequent formula versions as inactive until explicitly activated', async () => {
  const savedGraphs = [
    {
      id: 'credit-simulation:v1',
      scopeKey: 'credit-simulation',
      version: 1,
      status: 'active',
      name: 'Version base',
      graph: buildGraph(),
    },
  ];

  const service = createDagWorkbenchService({
    dagConfig: { mode: 'shadow', workbenchEnabled: true },
    dagGraphRepository: {
      async getLatest(scopeKey) {
        return savedGraphs
          .filter((graph) => graph.scopeKey === scopeKey)
          .sort((left, right) => right.version - left.version)[0] || null;
      },
      async saveVersion(record) {
        const nextRecord = {
          id: `${record.scopeKey}:v${savedGraphs.length + 1}`,
          version: savedGraphs.length + 1,
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z',
          ...record,
        };
        savedGraphs.push(nextRecord);
        return nextRecord;
      },
    },
    dagSimulationSummaryRepository: {
      async save() {
        throw new Error('save should not be called');
      },
      async getLatest() {
        return null;
      },
    },
    creditDomainService: {
      simulateDetailed() {
        throw new Error('simulateDetailed should not be called');
      },
    },
  });

  const result = await service.saveGraph({
    actor: { id: 1, role: 'admin' },
    scopeKey: 'credit-simulation',
    name: 'Version candidata',
    graph: buildGraph(),
  });

  assert.equal(result.graphVersion.version, 2);
  assert.equal(result.graphVersion.status, 'inactive');
});

test('createDagWorkbenchService activates a formula version without leaving previous versions active', async () => {
  const graphs = [
    { id: 1, scopeKey: 'credit-simulation', version: 1, status: 'active', name: 'Version 1' },
    { id: 2, scopeKey: 'credit-simulation', version: 2, status: 'inactive', name: 'Version 2' },
  ];

  const service = createDagWorkbenchService({
    dagConfig: { mode: 'shadow', workbenchEnabled: true },
    dagGraphRepository: {
      async findById(id) {
        return graphs.find((graph) => graph.id === id) || null;
      },
      async activateVersion(id) {
        graphs.forEach((graph) => {
          if (graph.scopeKey === 'credit-simulation') {
            graph.status = graph.id === id ? 'active' : 'inactive';
          }
        });
        return graphs.find((graph) => graph.id === id) || null;
      },
    },
    dagSimulationSummaryRepository: {
      async save() {
        throw new Error('save should not be called');
      },
      async getLatest() {
        return null;
      },
    },
    creditDomainService: {
      simulateDetailed() {
        throw new Error('simulateDetailed should not be called');
      },
    },
  });

  const result = await service.activateGraph({ actor: { id: 1, role: 'admin' }, graphId: 2 });

  assert.equal(result.graph.id, 2);
  assert.deepEqual(
    graphs.map((graph) => ({ id: graph.id, status: graph.status })),
    [
      { id: 1, status: 'inactive' },
      { id: 2, status: 'active' },
    ],
  );
});

test('createDagWorkbenchService rejects deactivating the only active version in a scope', async () => {
  const service = createDagWorkbenchService({
    dagConfig: { mode: 'shadow', workbenchEnabled: true },
    dagGraphRepository: {
      async findById(id) {
        return { id, scopeKey: 'credit-simulation', version: 3, status: 'active', name: 'Version 3' };
      },
      async countActiveByScopeKey() {
        return 1;
      },
      async deactivateVersion() {
        throw new Error('deactivateVersion should not be called');
      },
    },
    dagSimulationSummaryRepository: {
      async save() {
        throw new Error('save should not be called');
      },
      async getLatest() {
        return null;
      },
    },
    creditDomainService: {
      simulateDetailed() {
        throw new Error('simulateDetailed should not be called');
      },
    },
  });

  await assert.rejects(
    () => service.deactivateGraph({ actor: { id: 1, role: 'admin' }, graphId: 3 }),
    (error) => {
      assert.match(error.message, /only active formula/i);
      return true;
    },
  );
});

test('createDagWorkbenchService persists fallback and parity metadata for workbench simulations', async () => {
  const savedSummaries = [];

  const service = createDagWorkbenchService({
    dagConfig: { mode: 'primary', workbenchEnabled: true },
    dagGraphRepository: {
      async getLatest(scopeKey) {
        return {
          id: `${scopeKey}:v2`,
          scopeKey,
          version: 2,
          name: 'Personal Loan',
          graph: buildGraph(),
          graphSummary: { nodeCount: 3, edgeCount: 2, outputCount: 1, formulaNodeCount: 1 },
        };
      },
      async saveVersion() {
        throw new Error('saveVersion should not be called');
      },
    },
    dagSimulationSummaryRepository: {
      async save(record) {
        savedSummaries.push(record);
        return {
          id: `${record.scopeKey}:summary-2`,
          createdAt: '2026-03-21T00:06:00.000Z',
          ...record,
        };
      },
      async getLatest() {
        return null;
      },
    },
    creditDomainService: {
      simulateDetailed() {
        return {
          selectedSource: 'legacy',
          fallbackReason: 'parity_mismatch',
          parity: { passed: false, mismatches: [{ field: 'summary.totalPayable' }] },
          result: {
            lateFeeMode: 'NONE',
            schedule: [{ installmentNumber: 1, scheduledPayment: 125 }],
            summary: { totalPayable: 1300 },
          },
        };
      },
    },
  });

  const simulationResult = await service.simulateGraph({
    actor: { id: 1, role: 'admin' },
    scopeKey: 'credit-simulation',
    graph: buildGraph(),
    simulationInput: { amount: 1000, interestRate: 12, termMonths: 12 },
  });

  assert.equal(savedSummaries.length, 1);
  assert.equal(savedSummaries[0].selectedSource, 'legacy');
  assert.equal(savedSummaries[0].fallbackReason, 'dag_execution_failed');
  assert.equal(savedSummaries[0].parity.passed, false);
  assert.equal(simulationResult.summary.latestSimulation.fallbackReason, 'dag_execution_failed');
  assert.equal(simulationResult.summary.latestSimulation.parity.passed, false);
});

test('createDagWorkbenchService rejects rollout-disabled scopes', async () => {
  const service = createDagWorkbenchService({
    dagConfig: {
      mode: 'shadow',
      workbenchEnabled: true,
      isScopeEnabled(scopeKey) {
        return false;
      },
    },
    dagGraphRepository: {
      async getLatest() {
        return null;
      },
      async saveVersion() {
        throw new Error('saveVersion should not be called');
      },
    },
    dagSimulationSummaryRepository: {
      async save() {
        throw new Error('save should not be called');
      },
      async getLatest() {
        return null;
      },
    },
    creditDomainService: {
      async simulate() {
        throw new Error('simulate should not be called');
      },
    },
  });

  await assert.rejects(
    () => service.getSummary({ actor: { id: 2, role: 'admin' }, scopeKey: 'credit-simulation' }),
    (error) => {
      assert.match(error.message, /not enabled for scope 'credit-simulation'/i);
      return true;
    },
  );
});

test('assertWorkbenchAccess rejects non-admin roles with correct error message', async () => {
  const service = createDagWorkbenchService({
    dagConfig: { mode: 'shadow', workbenchEnabled: true },
    dagGraphRepository: {
      async getLatest() {
        throw new Error('getLatest should not be called');
      },
      async saveVersion() {
        throw new Error('saveVersion should not be called');
      },
    },
    dagSimulationSummaryRepository: {
      async save() {
        throw new Error('save should not be called');
      },
      async getLatest() {
        throw new Error('getLatest should not be called');
      },
    },
    creditDomainService: {
      async simulate() {
        throw new Error('simulate should not be called');
      },
    },
  });

  // Test that customer role is rejected
  await assert.rejects(
    () => service.getSummary({ actor: { id: 2, role: 'customer' }, scopeKey: 'credit-simulation' }),
    (error) => {
      assert.match(error.message, /Only admins can access/i);
      assert.ok(!error.message.includes('agents'), 'Error message should not mention agents');
      return true;
    },
  );

  // Test that socio role is rejected
  await assert.rejects(
    () => service.loadGraph({ actor: { id: 3, role: 'socio' }, scopeKey: 'credit-simulation' }),
    (error) => {
      assert.match(error.message, /Only admins can access/i);
      assert.ok(!error.message.includes('agents'), 'Error message should not mention agents');
      return true;
    },
  );
});
