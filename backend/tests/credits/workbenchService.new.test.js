const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDagWorkbenchService,
  extractImpactedVariables,
} = require('@/modules/credits/application/dag/workbenchService');

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

// ── extractImpactedVariables unit tests ──

test('extractImpactedVariables returns empty deltas for identical graphs', () => {
  const graph = {
    nodes: [
      { id: 'n1', kind: 'formula', formula: 'a + b', outputVar: 'result' },
    ],
    edges: [],
  };

  const { deltas, impactedVariables } = extractImpactedVariables(graph, graph);

  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].change, 'unchanged');
  assert.equal(impactedVariables.length, 0);
});

test('extractImpactedVariables detects added nodes', () => {
  const oldGraph = {
    nodes: [{ id: 'n1', kind: 'formula', formula: 'a + b', outputVar: 'result' }],
    edges: [],
  };
  const newGraph = {
    nodes: [
      { id: 'n1', kind: 'formula', formula: 'a + b', outputVar: 'result' },
      { id: 'n2', kind: 'formula', formula: 'c * d', outputVar: 'bonus' },
    ],
    edges: [],
  };

  const { deltas, impactedVariables } = extractImpactedVariables(oldGraph, newGraph);

  const addedDelta = deltas.find((d) => d.nodeId === 'n2');
  assert.ok(addedDelta, 'Expected delta for added node n2');
  assert.equal(addedDelta.change, 'added');
  assert.equal(addedDelta.newFormula, 'c * d');
  assert.equal(addedDelta.newOutputVar, 'bonus');
  assert.ok(impactedVariables.includes('bonus'));
  assert.ok(impactedVariables.includes('c'));
  assert.ok(impactedVariables.includes('d'));
});

test('extractImpactedVariables detects removed nodes', () => {
  const oldGraph = {
    nodes: [
      { id: 'n1', kind: 'formula', formula: 'a + b', outputVar: 'result' },
      { id: 'n2', kind: 'formula', formula: 'c * d', outputVar: 'bonus' },
    ],
    edges: [],
  };
  const newGraph = {
    nodes: [{ id: 'n1', kind: 'formula', formula: 'a + b', outputVar: 'result' }],
    edges: [],
  };

  const { deltas, impactedVariables } = extractImpactedVariables(oldGraph, newGraph);

  const removedDelta = deltas.find((d) => d.nodeId === 'n2');
  assert.ok(removedDelta, 'Expected delta for removed node n2');
  assert.equal(removedDelta.change, 'removed');
  assert.equal(removedDelta.oldFormula, 'c * d');
  assert.equal(removedDelta.oldOutputVar, 'bonus');
  assert.ok(impactedVariables.includes('bonus'));
});

test('extractImpactedVariables detects modified formulas and outputVars', () => {
  const oldGraph = {
    nodes: [{ id: 'n1', kind: 'formula', formula: 'Score > 700', outputVar: 'tier' }],
    edges: [],
  };
  const newGraph = {
    nodes: [{ id: 'n1', kind: 'formula', formula: 'Score > 750', outputVar: 'tier' }],
    edges: [],
  };

  const { deltas, impactedVariables } = extractImpactedVariables(oldGraph, newGraph);

  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].change, 'modified');
  assert.equal(deltas[0].oldFormula, 'Score > 700');
  assert.equal(deltas[0].newFormula, 'Score > 750');
  assert.ok(impactedVariables.includes('tier'));
  assert.ok(impactedVariables.includes('Score'));
});

test('extractImpactedVariables detects outputVar rename', () => {
  const oldGraph = {
    nodes: [{ id: 'n1', kind: 'formula', formula: 'a + b', outputVar: 'oldResult' }],
    edges: [],
  };
  const newGraph = {
    nodes: [{ id: 'n1', kind: 'formula', formula: 'a + b', outputVar: 'newResult' }],
    edges: [],
  };

  const { deltas, impactedVariables } = extractImpactedVariables(oldGraph, newGraph);

  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].change, 'modified');
  assert.equal(deltas[0].oldOutputVar, 'oldResult');
  assert.equal(deltas[0].newOutputVar, 'newResult');
  assert.ok(impactedVariables.includes('newResult'));
  assert.ok(impactedVariables.includes('oldResult'));
});

test('extractImpactedVariables returns structured deltas array with all change types', () => {
  const oldGraph = {
    nodes: [
      { id: 'n1', kind: 'formula', formula: '1', outputVar: 'a' },
      { id: 'n2', kind: 'formula', formula: '2', outputVar: 'b' },
      { id: 'n3', kind: 'formula', formula: '3', outputVar: 'c' },
    ],
    edges: [],
  };
  const newGraph = {
    nodes: [
      { id: 'n1', kind: 'formula', formula: '1', outputVar: 'a' },
      { id: 'n2', kind: 'formula', formula: '2_updated', outputVar: 'b' },
      { id: 'n4', kind: 'formula', formula: '4', outputVar: 'd' },
    ],
    edges: [],
  };

  const { deltas, impactedVariables } = extractImpactedVariables(oldGraph, newGraph);

  assert.equal(deltas.length, 4);

  const unchanged = deltas.find((d) => d.nodeId === 'n1');
  assert.ok(unchanged);
  assert.equal(unchanged.change, 'unchanged');

  const modified = deltas.find((d) => d.nodeId === 'n2');
  assert.ok(modified);
  assert.equal(modified.change, 'modified');

  const removed = deltas.find((d) => d.nodeId === 'n3');
  assert.ok(removed);
  assert.equal(removed.change, 'removed');

  const added = deltas.find((d) => d.nodeId === 'n4');
  assert.ok(added);
  assert.equal(added.change, 'added');

  assert.ok(impactedVariables.includes('b'));
  assert.ok(impactedVariables.includes('d'));
  assert.ok(impactedVariables.includes('c'));
});
