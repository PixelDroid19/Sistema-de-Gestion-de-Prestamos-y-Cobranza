const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  createDagWorkbenchService,
} = require('@/modules/credits/application/dag/workbenchService');

describe('Visual Formula Editor E2E Integration', () => {
  test('full flow: save graph, simulate, create variable, get history, diff, restore', async () => {
    const variables = [];
    const graphVersions = [];
    let versionCounter = 0;

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

    const service = createDagWorkbenchService({
      dagConfig: { mode: 'shadow', workbenchEnabled: true },
      dagGraphRepository: {
        async getLatest(scopeKey) {
          return graphVersions.filter((g) => g.scopeKey === scopeKey).sort((a, b) => b.version - a.version)[0] || null;
        },
        async findById(id) {
          return graphVersions.find((g) => g.id === id) || null;
        },
        async listByScopeKey(scopeKey) {
          return graphVersions.filter((g) => g.scopeKey === scopeKey);
        },
        async saveVersion(record) {
          versionCounter += 1;
          const newGraph = { id: graphVersions.length + 1, version: versionCounter, status: 'inactive', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...record };
          graphVersions.push(newGraph);
          return newGraph;
        },
      },
      dagSimulationSummaryRepository: {
        async save() { return {}; },
        async getLatest() { return null; },
      },
      graphExecutor: {
        executeDraft() {
          return { ok: true, result: { lateFeeMode: 'SIMPLE', schedule: [], summary: {} } };
        },
      },
      dagVariableRepository: {
        async listAll() { return variables; },
        async create(record) {
          const v = { id: variables.length + 1, ...record, usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          variables.push(v);
          return v;
        },
      },
    });

    const actor = { id: 1, role: 'admin', name: 'Test User', email: 'test@example.com' };

    // 1. Save a new graph version
    const saved = await service.saveGraph({
      actor,
      scopeKey: 'credit-simulation',
      name: 'Test Integration Formula',
      description: 'E2E test formula',
      graph: validGraph,
      graphSummary: { nodeCount: 7, edgeCount: 8, outputCount: 1, formulaNodeCount: 3 },
      commitMessage: 'Initial test version',
      authorName: 'Test User',
      authorEmail: 'test@example.com',
    });

    assert.ok(saved.graphVersion);
    const graphId = saved.graphVersion.id;
    const version1 = saved.graphVersion.version;

    // 2. Simulate the graph
    const simulation = await service.simulateGraph({
      actor,
      scopeKey: 'credit-simulation',
      graph: validGraph,
      input: { amount: 100000, interestRate: 0.24, termMonths: 12, lateFeeMode: 'SIMPLE' },
    });

    assert.ok(simulation.simulation);

    // 3. Create a variable
    const variable = await service.createVariable({
      actor,
      name: 'Test_Score',
      type: 'integer',
      source: 'bureau_api',
      description: 'Test variable for integration',
    });

    assert.equal(variable.variable.name, 'Test_Score');

    // 4. List variables
    const listResult = await service.listVariables({ actor });
    assert.ok(listResult.variables.length >= 1);
    assert.ok(listResult.variables.some((v) => v.name === 'Test_Score'));

    // 5. Update graph (create v2)
    const savedV2 = await service.saveGraph({
      actor,
      scopeKey: 'credit-simulation',
      name: 'Test Integration Formula',
      description: 'E2E test formula v2',
      graph: validGraph,
      graphSummary: { nodeCount: 7, edgeCount: 8, outputCount: 1, formulaNodeCount: 3 },
      commitMessage: 'Updated test version',
      authorName: 'Test User',
      authorEmail: 'test@example.com',
    });

    assert.ok(savedV2.graphVersion);
    const version2 = savedV2.graphVersion.version;
    assert.ok(version2 > version1);

    // 6. Get history
    const history = await service.getGraphHistory({ actor, graphId });
    assert.ok(history.history.length >= 2);
    assert.ok(history.history.some((h) => h.version === version1));
    assert.ok(history.history.some((h) => h.version === version2));

    // 7. Diff versions
    const diff = await service.getGraphDiff({ actor, graphId, compareToVersionId: version1 });
    assert.ok(diff.diff);
    assert.ok(Array.isArray(diff.diff.previousGraph.nodes));
    assert.ok(Array.isArray(diff.diff.newGraph.nodes));

    // 8. Restore v1 as new version
    const restored = await service.restoreGraph({ actor, graphId, commitMessage: 'Restored from v1' });
    assert.ok(restored.graph.version > version2);
    assert.equal(restored.graph.restoredFromVersionId, version1);
    assert.equal(restored.graph.commitMessage, 'Restored from v1');
  });
});
