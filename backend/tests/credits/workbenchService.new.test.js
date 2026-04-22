const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDagWorkbenchService,
} = require('@/modules/credits/application/dag/workbenchService');

test('createDagWorkbenchService lists and creates variables', async () => {
  const variables = [];

  const service = createDagWorkbenchService({
    dagConfig: { mode: 'shadow', workbenchEnabled: true },
    dagGraphRepository: {
      async getLatest() { return null; },
      async saveVersion() { throw new Error('should not be called'); },
    },
    dagSimulationSummaryRepository: {
      async save() { throw new Error('should not be called'); },
      async getLatest() { return null; },
    },
    graphExecutor: { executeDraft() { throw new Error('should not be called'); } },
    dagVariableRepository: {
      async listAll() { return variables; },
      async create(record) {
        const v = { id: variables.length + 1, ...record, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        variables.push(v);
        return v;
      },
    },
  });

  const actor = { id: 1, role: 'admin' };

  const listResult = await service.listVariables({ actor });
  assert.equal(listResult.variables.length, 0);

  const createResult = await service.createVariable({ actor, name: 'Credit_Score', type: 'integer', source: 'bureau_api', description: 'Bureau score' });
  assert.equal(createResult.variable.name, 'Credit_Score');
  assert.equal(createResult.variable.type, 'integer');

  const listResult2 = await service.listVariables({ actor });
  assert.equal(listResult2.variables.length, 1);
});

test('createDagWorkbenchService returns graph history', async () => {
  const graphs = [
    { id: 1, scopeKey: 'credit-simulation', version: 1, status: 'inactive', name: 'V1', commitMessage: 'Initial', authorName: 'Alice', createdAt: '2026-01-01T00:00:00Z' },
    { id: 2, scopeKey: 'credit-simulation', version: 2, status: 'active', name: 'V2', commitMessage: 'Adjusted tiers', authorName: 'Bob', createdAt: '2026-02-01T00:00:00Z' },
  ];

  const service = createDagWorkbenchService({
    dagConfig: { mode: 'shadow', workbenchEnabled: true },
    dagGraphRepository: {
      async listByScopeKey(scopeKey) {
        return graphs.filter((g) => g.scopeKey === scopeKey);
      },
      async findById(id) {
        return graphs.find((g) => g.id === id) || null;
      },
    },
    dagSimulationSummaryRepository: {
      async save() { throw new Error('should not be called'); },
      async getLatest() { return null; },
    },
    graphExecutor: { executeDraft() { throw new Error('should not be called'); } },
  });

  const actor = { id: 1, role: 'admin' };
  const history = await service.getGraphHistory({ actor, graphId: 1 });

  assert.equal(history.history.length, 2);
  assert.equal(history.history[0].version, 1);
  assert.equal(history.history[1].isActive, true);
});

test('createDagWorkbenchService restores a graph version as new version', async () => {
  const validGraph = {
    nodes: [
      { id: 'amount', kind: 'constant', label: 'Monto', outputVar: 'amount' },
      { id: 'interestRate', kind: 'constant', label: 'Interes', outputVar: 'interestRate' },
      { id: 'termMonths', kind: 'constant', label: 'Plazo', outputVar: 'termMonths' },
      { id: 'lateFeeMode', kind: 'conditional', label: 'Modo mora', outputVar: 'lateFeeMode', formula: 'assertSupportedLateFeeMode(lateFeeMode)' },
      { id: 'schedule', kind: 'formula', label: 'Cronograma', outputVar: 'schedule', formula: 'buildAmortizationSchedule(amount, interestRate, termMonths, startDate, lateFeeMode)' },
      { id: 'summary', kind: 'formula', label: 'Resumen', outputVar: 'summary', formula: 'summarizeSchedule(schedule)' },
      { id: 'result', kind: 'output', label: 'Resultado', outputVar: 'result', formula: 'buildSimulationResult(lateFeeMode, schedule, summary)' },
    ],
    edges: [
      { source: 'amount', target: 'schedule' },
      { source: 'interestRate', target: 'schedule' },
      { source: 'termMonths', target: 'schedule' },
      { source: 'lateFeeMode', target: 'schedule' },
      { source: 'schedule', target: 'summary' },
      { source: 'lateFeeMode', target: 'result' },
      { source: 'schedule', target: 'result' },
      { source: 'summary', target: 'result' },
    ],
  };

  const graphs = [
    { id: 1, scopeKey: 'credit-simulation', version: 1, status: 'inactive', name: 'V1', graph: validGraph, commitMessage: 'Old', authorName: 'Alice', createdAt: '2026-01-01T00:00:00Z' },
    { id: 2, scopeKey: 'credit-simulation', version: 2, status: 'active', name: 'V2', graph: validGraph, commitMessage: 'Current', authorName: 'Bob', createdAt: '2026-02-01T00:00:00Z' },
  ];

  const service = createDagWorkbenchService({
    dagConfig: { mode: 'shadow', workbenchEnabled: true },
    dagGraphRepository: {
      async findById(id) {
        return graphs.find((g) => g.id === id) || null;
      },
      async getLatest(scopeKey) {
        return graphs.filter((g) => g.scopeKey === scopeKey).sort((a, b) => b.version - a.version)[0] || null;
      },
      async saveVersion(record) {
        const v = graphs.length + 1;
        const newGraph = { id: v, version: v, status: 'inactive', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...record };
        graphs.push(newGraph);
        return newGraph;
      },
    },
    dagSimulationSummaryRepository: {
      async save() { throw new Error('should not be called'); },
      async getLatest() { return null; },
    },
    graphExecutor: { executeDraft() { throw new Error('should not be called'); } },
  });

  const actor = { id: 1, role: 'admin', name: 'Charlie', email: 'charlie@example.com' };
  const result = await service.restoreGraph({ actor, graphId: 1, commitMessage: 'Restored v1' });

  assert.equal(result.graph.version, 3);
  assert.equal(result.graph.restoredFromVersionId, 1);
  assert.equal(result.graph.commitMessage, 'Restored v1');
});

test('createDagWorkbenchService produces node-level diff', async () => {
  const oldGraph = {
    nodes: [
      { id: 'n1', kind: 'formula', formula: 'Score > 700', outputVar: 'tier' },
      { id: 'n2', kind: 'formula', formula: '0.03', outputVar: 'rate' },
    ],
    edges: [{ source: 'n1', target: 'n2' }],
  };
  const newGraph = {
    nodes: [
      { id: 'n1', kind: 'formula', formula: 'Score > 750', outputVar: 'tier' },
      { id: 'n2', kind: 'formula', formula: '0.03', outputVar: 'rate' },
      { id: 'n3', kind: 'formula', formula: '0.05', outputVar: 'rate2' },
    ],
    edges: [{ source: 'n1', target: 'n2' }, { source: 'n1', target: 'n3' }],
  };

  const graphs = [
    { id: 1, scopeKey: 'credit-simulation', version: 1, graph: oldGraph },
    { id: 2, scopeKey: 'credit-simulation', version: 2, graph: newGraph },
  ];

  const service = createDagWorkbenchService({
    dagConfig: { mode: 'shadow', workbenchEnabled: true },
    dagGraphRepository: {
      async findById(id) {
        return graphs.find((g) => g.id === id) || null;
      },
    },
    dagSimulationSummaryRepository: {
      async save() { throw new Error('should not be called'); },
      async getLatest() { return null; },
    },
    graphExecutor: { executeDraft() { throw new Error('should not be called'); } },
  });

  const actor = { id: 1, role: 'admin' };
  const diff = await service.getGraphDiff({ actor, graphId: 2, compareToVersionId: 1 });

  assert.ok(diff.diff.impactedVariables.includes('tier'));
  assert.ok(Array.isArray(diff.diff.previousGraph.nodes));
  assert.ok(Array.isArray(diff.diff.newGraph.nodes));
});
