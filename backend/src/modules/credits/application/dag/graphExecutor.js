/**
 * Unified Graph Executor Service
 *
 * This is the single runtime entrypoint that loads a persisted DagGraphVersion
 * from the database and executes it via the CalculationEngine. Both credit
 * previews and loan origination MUST use this service so the exact same graph version
 * drives the numbers and gets recorded on the resulting loan.
 *
 * Key guarantees:
 * - The executed graph is always a persisted, validated DagGraphVersion.
 * - The exact graphVersionId is returned with every execution result.
 * - If no active graph version exists, execution fails explicitly.
 * - Contract validation (inputs / outputs) is enforced per scope.
 */

const { CalculationEngine } = require('@/core/domain/calculation/CalculationEngine');
const { ValidationError } = require('@/utils/errorHandler');
const { logBusiness } = require('@/utils/logger');
const { normalizeCreditGraph, validateContractInputs, validateContractOutputs } = require('./scopeRegistry');

// ─── Execution Result ────────────────────────────────────────────────────────

/**
 * @typedef {object} GraphExecutionResult
 * @property {boolean}      ok                - Whether execution succeeded
 * @property {string}       source            - Always 'persisted_graph'
 * @property {number}       graphVersionId    - The exact DagGraphVersion.id executed
 * @property {number}       graphVersion      - The version number
 * @property {string}       scopeKey          - The scope key
 * @property {object}       result            - The output object (lateFeeMode, schedule, summary)
 * @property {object}       executionMetrics  - Timing and node count
 */

const parseVariableDefaultValue = (variable) => {
  const rawValue = variable?.value;
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return undefined;
  }

  if (variable.type === 'boolean') {
    return ['true', '1', 'si', 'sí', 'yes'].includes(String(rawValue).trim().toLowerCase());
  }

  if (variable.type === 'integer') {
    const parsed = Number.parseInt(String(rawValue), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (variable.type === 'currency' || variable.type === 'percent') {
    const parsed = Number(String(rawValue).replace(/[,$\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return rawValue;
};

const buildVariableDefaults = async (dagVariableRepository) => {
  if (!dagVariableRepository?.list) {
    return {};
  }

  const listed = await dagVariableRepository.list({ status: 'active', page: 1, pageSize: 500 });
  const variables = listed?.items || listed || [];

  return variables.reduce((defaults, variable) => {
    const name = String(variable?.name || '').trim();
    if (!name) {
      return defaults;
    }

    const value = parseVariableDefaultValue(variable);
    if (value !== undefined) {
      defaults[name] = value;
    }
    return defaults;
  }, {});
};

const createExecutionResult = ({ graphVersionRecord, result, executionMetrics }) => ({
  ok: true,
  source: 'persisted_graph',
  graphVersionId: graphVersionRecord.id,
  graphVersion: graphVersionRecord.version,
  scopeKey: graphVersionRecord.scopeKey,
  result,
  executionMetrics,
});

// ─── Graph Executor Factory ──────────────────────────────────────────────────

/**
 * Create the unified graph executor service.
 *
 * @param {object}   deps
 * @param {object}   deps.dagGraphRepository - Repository with getLatestActive(scopeKey), findById(id)
 * @param {object}   [deps.engine]           - Calculation engine (defaults to CalculationEngine)
 * @returns {object} graphExecutor
 */
const createGraphExecutor = ({ dagGraphRepository, dagVariableRepository, engine = CalculationEngine } = {}) => {
  if (!dagGraphRepository) {
    throw new Error('graphExecutor requires dagGraphRepository');
  }

  /**
   * Load a graph version record from the repository.
   * Supports loading by explicit graphVersionId or by active version for a scope.
   */
  const loadGraphVersion = async ({ scopeKey, graphVersionId }) => {
    if (graphVersionId) {
      const record = await dagGraphRepository.findById(graphVersionId);
      if (!record) {
        throw new ValidationError(`Graph version ${graphVersionId} not found`);
      }
      return record;
    }

    if (!scopeKey) {
      throw new ValidationError('Either scopeKey or graphVersionId is required');
    }

    const activeRecord = await dagGraphRepository.getLatestActive(scopeKey);
    if (!activeRecord) {
      throw new ValidationError(
        `No active formula version is configured for scope '${scopeKey}'. ` +
        'Activate one before running calculations.',
      );
    }

    return activeRecord;
  };

  /**
   * Execute a persisted graph with the given contract variables.
   *
   * @param {object} opts
   * @param {string} [opts.scopeKey]        - Load active version for this scope
   * @param {number} [opts.graphVersionId]  - Load a specific version by id
   * @param {object} opts.contractVars      - The input variables (amount, interestRate, etc.)
   * @returns {Promise<GraphExecutionResult>}
   */
  const execute = async ({ scopeKey, graphVersionId, contractVars = {} }) => {
    const graphVersionRecord = await loadGraphVersion({ scopeKey, graphVersionId });
    const effectiveScopeKey = graphVersionRecord.scopeKey;

    // Contract input validation
    const missingInputs = validateContractInputs(effectiveScopeKey, contractVars);
    if (missingInputs.length > 0) {
      throw new ValidationError(
        `Missing required inputs for scope '${effectiveScopeKey}': ${missingInputs.join(', ')}`,
      );
    }

    const graph = normalizeCreditGraph(graphVersionRecord.graph);
    if (!graph || !Array.isArray(graph.nodes)) {
      throw new ValidationError(
        `Graph version ${graphVersionRecord.id} has no valid graph data`,
      );
    }

    const startTime = Date.now();

    const variableDefaults = await buildVariableDefaults(dagVariableRepository);
    const executionVars = {
      ...variableDefaults,
      ...contractVars,
    };

    // Execute the graph through the CalculationEngine which handles:
    // - Topological sorting
    // - Formula compilation (with BigNumber + whitelist)
    // - Scoped evaluation with helpers (buildAmortizationSchedule, etc.)
    const engineResult = engine.execute(graph, executionVars);

    const executionTimeMs = Date.now() - startTime;

    // The CalculationEngine returns { result (=scope), scope, executionOrder, metrics }.
    // The graph's `result` outputVar is the canonical output object.
    const resultObj = engineResult.result?.result || engineResult.scope?.result || {};

    // Contract output validation
    const missingOutputs = validateContractOutputs(effectiveScopeKey, resultObj);
    if (missingOutputs.length > 0) {
      throw new ValidationError(
        `Graph version ${graphVersionRecord.id} is missing required outputs for scope ` +
        `'${effectiveScopeKey}': ${missingOutputs.join(', ')}. ` +
        'The active formula may need to be updated in the workbench.',
      );
    }

    const executionMetrics = {
      executionTimeMs,
      nodeCount: graph.nodes.length,
      edgeCount: (graph.edges || []).length,
      graphVersionId: graphVersionRecord.id,
      graphVersion: graphVersionRecord.version,
    };

    logBusiness('dag.graph.executed', {
      scopeKey: effectiveScopeKey,
      graphVersionId: graphVersionRecord.id,
      graphVersion: graphVersionRecord.version,
      executionTimeMs,
      nodeCount: graph.nodes.length,
    });

    return createExecutionResult({
      graphVersionRecord,
      result: resultObj,
      executionMetrics,
    });
  };

  /**
   * Execute a draft (unsaved) graph for workbench preview purposes.
   * This does NOT load from DB — it runs an ad-hoc graph directly.
   * The result is clearly marked as source='draft'.
   *
   * @param {object} opts
   * @param {object} opts.graph         - The draft graph { nodes, edges }
   * @param {object} opts.contractVars  - The input variables
   * @returns {object}
   */
  const executeDraft = async ({ graph, contractVars = {} }) => {
    if (!graph || !Array.isArray(graph.nodes)) {
      throw new ValidationError('Draft graph must have a nodes array');
    }
    const normalizedGraph = normalizeCreditGraph(graph);

    const startTime = Date.now();
    const variableDefaults = await buildVariableDefaults(dagVariableRepository);
    const engineResult = engine.execute(normalizedGraph, {
      ...variableDefaults,
      ...contractVars,
    });
    const executionTimeMs = Date.now() - startTime;

    const resultObj = engineResult.result?.result || engineResult.scope?.result || {};

    return {
      ok: true,
      source: 'draft',
      graphVersionId: null,
      graphVersion: null,
      scopeKey: null,
      result: resultObj,
      executionMetrics: {
        executionTimeMs,
        nodeCount: normalizedGraph.nodes.length,
        edgeCount: (normalizedGraph.edges || []).length,
        graphVersionId: null,
        graphVersion: null,
      },
    };
  };

  return {
    execute,
    executeDraft,
    loadGraphVersion,
  };
};

module.exports = {
  createGraphExecutor,
};
