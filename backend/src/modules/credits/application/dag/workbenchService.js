const {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} = require('../../../../utils/errorHandler');
const { logSecurity, logBusiness } = require('../../../../utils/logger');
const BigNumberEngine = require('../../../../core/domain/calculation/BigNumberEngine');
const { CalculationEngine } = require('../../../../core/domain/calculation/CalculationEngine');

const ALLOWED_WORKBENCH_ROLES = new Set(['admin']);

// Blocked patterns that could bypass formula validation
const BLOCKED_FORMULA_PATTERNS = [
  /import\s*\(/i,
  /evaluate\s*\(/i,
  /parse\s*\(/i,
  /createUnit\s*\(/i,
  /simplify\s*\(/i,
  /derivative\s*\(/i,
  /chain\s*\(/i,
  /typed\s*\(/i,
  /config\s*\(/i,
  /importFrom\s*\(/i,
];

const normalizeScopeKey = (value) => String(value || '').trim().toLowerCase();

const buildGraphSummary = ({ nodes, edges }) => ({
  nodeCount: nodes.length,
  edgeCount: edges.length,
  outputCount: nodes.filter((node) => node.kind === 'output').length,
  formulaNodeCount: nodes.filter((node) => typeof node.formula === 'string' && node.formula.trim()).length,
});

/**
 * Validate a formula string for dangerous patterns before saving.
 * Logs validation errors for security monitoring.
 * @param {string} formula - The formula string to validate
 * @param {string} nodeId - The node ID for error reporting
 * @returns {{ valid: boolean, error?: { field: string, message: string } }}
 */
const validateFormulaInput = (formula, nodeId) => {
  if (!formula || typeof formula !== 'string') {
    return { valid: true }; // No formula to validate
  }

  const trimmedFormula = formula.trim();
  if (!trimmedFormula) {
    return { valid: true }; // Empty formula is valid (optional field)
  }

  // Check for blocked patterns that could bypass the mathjs whitelist
  for (const pattern of BLOCKED_FORMULA_PATTERNS) {
    if (pattern.test(trimmedFormula)) {
      logSecurity('dag.workbench.blocked_formula_pattern', {
        nodeId,
        formula: trimmedFormula.substring(0, 100),
        pattern: pattern.toString(),
      });
      return {
        valid: false,
        error: {
          field: `nodes.formula`,
          message: `Node '${nodeId}': Blocked pattern detected in formula - potentially unsafe operation`,
        },
      };
    }
  }

  // Validate formula syntax and function whitelist using BigNumberEngine
  try {
    BigNumberEngine.validateFormula(trimmedFormula);
    return { valid: true };
  } catch (validationError) {
    logSecurity('dag.workbench.formula_validation_failed', {
      nodeId,
      formula: trimmedFormula.substring(0, 100),
      error: validationError.message,
    });
    return {
      valid: false,
      error: {
        field: `nodes.formula`,
        message: `Node '${nodeId}': ${validationError.message}`,
      },
    };
  }
};

/**
 * Validate all formula nodes in a graph.
 * @param {Array} nodes - Array of graph nodes
 * @returns {Array} Array of validation errors
 */
const validateFormulaNodes = (nodes) => {
  const errors = [];

  for (const node of nodes) {
    if (node.kind === 'formula' && node.formula) {
      const result = validateFormulaInput(node.formula, node.id);
      if (!result.valid && result.error) {
        errors.push(result.error);
      }
    }
  }

  return errors;
};

const detectCycles = ({ nodes, incomingByTarget }) => {
  const visited = new Set();
  const stack = new Set();

  const visit = (nodeId) => {
    if (stack.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    stack.add(nodeId);

    const parents = incomingByTarget.get(nodeId) || [];
    for (const parentId of parents) {
      if (visit(parentId)) {
        return true;
      }
    }

    stack.delete(nodeId);
    return false;
  };

  return nodes.some((node) => visit(node.id));
};

const validateDagWorkbenchGraph = (graph = {}) => {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const errors = [];
  const warnings = [];
  const seenNodeIds = new Set();
  const nodeIds = new Set();
  const incomingByTarget = new Map();

  if (nodes.length === 0) {
    errors.push({ field: 'nodes', message: 'Graph must include at least one node' });
  }

  nodes.forEach((node, index) => {
    const nodeId = String(node?.id || '').trim();
    if (!nodeId) {
      errors.push({ field: `nodes.${index}.id`, message: 'Node id is required' });
      return;
    }

    if (seenNodeIds.has(nodeId)) {
      errors.push({ field: `nodes.${index}.id`, message: `Duplicate node id '${nodeId}'` });
      return;
    }

    seenNodeIds.add(nodeId);
    nodeIds.add(nodeId);

    if (!String(node?.kind || '').trim()) {
      errors.push({ field: `nodes.${index}.kind`, message: `Node '${nodeId}' must declare a kind` });
    }
  });

  edges.forEach((edge, index) => {
    const source = String(edge?.source || '').trim();
    const target = String(edge?.target || '').trim();

    if (!source || !target) {
      errors.push({ field: `edges.${index}`, message: 'Edge source and target are required' });
      return;
    }

    if (!nodeIds.has(source)) {
      errors.push({ field: `edges.${index}.source`, message: `Edge source '${source}' does not match any node` });
    }

    if (!nodeIds.has(target)) {
      errors.push({ field: `edges.${index}.target`, message: `Edge target '${target}' does not match any node` });
    }

    if (source === target) {
      errors.push({ field: `edges.${index}`, message: `Edge '${edge?.id || index}' cannot self-reference node '${source}'` });
    }

    if (!incomingByTarget.has(target)) {
      incomingByTarget.set(target, []);
    }
    incomingByTarget.get(target).push(source);
  });

  if (errors.length === 0 && detectCycles({ nodes, incomingByTarget })) {
    errors.push({ field: 'edges', message: 'Graph contains circular dependencies' });
  }

  // Validate formula nodes for dangerous patterns and syntax
  const formulaErrors = validateFormulaNodes(nodes);
  errors.push(...formulaErrors);

  if (!nodes.some((node) => node.kind === 'output')) {
    warnings.push({ field: 'nodes', message: 'Graph does not declare any output nodes' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: buildGraphSummary({ nodes, edges }),
  };
};

const assertWorkbenchAccess = ({ actor, dagConfig, scopeKey }) => {
  if (!actor || !ALLOWED_WORKBENCH_ROLES.has(actor.role)) {
    throw new AuthorizationError('Only admins can access the DAG workbench');
  }

  if (!dagConfig?.workbenchEnabled) {
    throw new AuthorizationError('DAG workbench is not enabled');
  }

  if (typeof dagConfig.isScopeEnabled === 'function' && !dagConfig.isScopeEnabled(scopeKey)) {
    throw new AuthorizationError(`DAG workbench is not enabled for scope '${scopeKey}'`);
  }
};

const assertScopeKey = (scopeKey) => {
  const normalizedScopeKey = normalizeScopeKey(scopeKey);
  if (!normalizedScopeKey) {
    throw new ValidationError('scopeKey is required');
  }
  return normalizedScopeKey;
};

const createDagWorkbenchService = ({
  dagConfig,
  dagGraphRepository,
  dagSimulationSummaryRepository,
  creditDomainService,
} = {}) => {
  if (!dagGraphRepository || !dagSimulationSummaryRepository || !creditDomainService) {
    throw new Error('DagWorkbenchService requires graph, summary, and credit domain dependencies');
  }

  return {
    async loadGraph({ actor, scopeKey }) {
      const normalizedScopeKey = assertScopeKey(scopeKey);
      assertWorkbenchAccess({ actor, dagConfig, scopeKey: normalizedScopeKey });

      const graphVersion = await dagGraphRepository.getLatest(normalizedScopeKey);
      if (!graphVersion) {
        throw new NotFoundError('DAG graph');
      }

      return { graphVersion };
    },

    async saveGraph({ actor, scopeKey, name, graph }) {
      const normalizedScopeKey = assertScopeKey(scopeKey);
      assertWorkbenchAccess({ actor, dagConfig, scopeKey: normalizedScopeKey });

      const validation = validateDagWorkbenchGraph(graph);
      if (!validation.valid) {
        const error = new ValidationError('DAG graph validation failed');
        error.errors = validation.errors;
        throw error;
      }
      const graphVersion = await dagGraphRepository.saveVersion({
        scopeKey: normalizedScopeKey,
        name: String(name || 'Untitled DAG Graph').trim() || 'Untitled DAG Graph',
        graph,
        graphSummary: validation.summary,
        validation,
        createdByUserId: actor.id,
      });

      logBusiness('dag.graph.saved', {
        graphId: graphVersion.id,
        scopeKey: normalizedScopeKey,
        actorId: actor.id,
        version: graphVersion.version,
      });

      return { graphVersion, validation };
    },

    async validateGraph({ actor, scopeKey, graph }) {
      const normalizedScopeKey = assertScopeKey(scopeKey);
      assertWorkbenchAccess({ actor, dagConfig, scopeKey: normalizedScopeKey });
      return validateDagWorkbenchGraph(graph);
    },

    async simulateGraph({ actor, scopeKey, graph, simulationInput = {} }) {
      const normalizedScopeKey = assertScopeKey(scopeKey);
      assertWorkbenchAccess({ actor, dagConfig, scopeKey: normalizedScopeKey });

      const validation = validateDagWorkbenchGraph(graph);
      if (!validation.valid) {
        const error = new ValidationError('DAG graph validation failed');
        error.errors = validation.errors;
        throw error;
      }

      const graphVersion = await dagGraphRepository.getLatest(normalizedScopeKey);

      // Execute the DAG graph using CalculationEngine, which properly evaluates
      // formulas with calculateLateFee and other helpers available in scope
      let dagExecution;
      try {
        dagExecution = CalculationEngine.execute(graph, simulationInput);
      } catch (engineError) {
        // If DAG execution fails, fall back to legacy simulation
        const legacyResult = typeof creditDomainService.simulateDetailed === 'function'
          ? await creditDomainService.simulateDetailed(simulationInput)
          : { selectedSource: 'legacy', fallbackReason: null, parity: { passed: true, mismatches: [] }, result: await creditDomainService.simulate(simulationInput) };
        dagExecution = {
          selectedSource: 'legacy',
          fallbackReason: 'dag_execution_failed',
          result: legacyResult.result,
          parity: { passed: false, mismatches: [{ scope: 'dag', field: 'execution', expected: 'success', actual: engineError.message }] },
        };
      }

      const latestSimulation = await dagSimulationSummaryRepository.save({
        scopeKey: normalizedScopeKey,
        graphVersionId: graphVersion?.id || null,
        createdByUserId: actor.id,
        selectedSource: dagExecution.selectedSource || 'dag',
        fallbackReason: dagExecution.fallbackReason || null,
        parity: dagExecution.parity || { passed: true, mismatches: [] },
        simulationInput,
        summary: dagExecution.result?.summary || dagExecution.result || {},
        schedulePreview: Array.isArray(dagExecution.result?.schedule) ? dagExecution.result.schedule.slice(0, 5) : [],
      });

      return {
        graphVersion,
        validation,
        simulation: dagExecution.result,
        summary: {
          latestGraph: graphVersion,
          latestSimulation,
        },
      };
    },

    async getSummary({ actor, scopeKey }) {
      const normalizedScopeKey = assertScopeKey(scopeKey);
      assertWorkbenchAccess({ actor, dagConfig, scopeKey: normalizedScopeKey });

      return {
        latestGraph: await dagGraphRepository.getLatest(normalizedScopeKey),
        latestSimulation: await dagSimulationSummaryRepository.getLatest(normalizedScopeKey),
      };
    },

    async listGraphs({ actor, scopeKey }) {
      const normalizedScopeKey = assertScopeKey(scopeKey);
      assertWorkbenchAccess({ actor, dagConfig, scopeKey: normalizedScopeKey });

      const graphs = await dagGraphRepository.listByScopeKey(normalizedScopeKey);
      return { graphs };
    },

    async getGraphDetails({ actor, graphId }) {
      if (!actor || !ALLOWED_WORKBENCH_ROLES.has(actor.role)) {
        throw new AuthorizationError('Only admins can access the DAG workbench');
      }
      if (!dagConfig?.workbenchEnabled) {
        throw new AuthorizationError('DAG workbench is not enabled');
      }

      const graph = await dagGraphRepository.findById(graphId);
      if (!graph) {
        throw new NotFoundError('DAG graph');
      }

      return { graph };
    },

    async activateGraph({ actor, graphId }) {
      if (!actor || !ALLOWED_WORKBENCH_ROLES.has(actor.role)) {
        throw new AuthorizationError('Only admins can access the DAG workbench');
      }
      if (!dagConfig?.workbenchEnabled) {
        throw new AuthorizationError('DAG workbench is not enabled');
      }

      const graph = await dagGraphRepository.findById(graphId);
      if (!graph) {
        throw new NotFoundError('DAG graph');
      }

      const updated = await dagGraphRepository.updateStatus(graphId, 'active');
      
      logSecurity('dag.graph.activated', {
        graphId,
        actorId: actor.id,
        name: graph.name,
      });

      return { graph: updated };
    },

    async deactivateGraph({ actor, graphId }) {
      if (!actor || !ALLOWED_WORKBENCH_ROLES.has(actor.role)) {
        throw new AuthorizationError('Only admins can access the DAG workbench');
      }
      if (!dagConfig?.workbenchEnabled) {
        throw new AuthorizationError('DAG workbench is not enabled');
      }

      const graph = await dagGraphRepository.findById(graphId);
      if (!graph) {
        throw new NotFoundError('DAG graph');
      }

      const updated = await dagGraphRepository.updateStatus(graphId, 'inactive');
      
      logSecurity('dag.graph.deactivated', {
        graphId,
        actorId: actor.id,
        name: graph.name,
      });

      return { graph: updated };
    },

    async deleteGraph({ actor, graphId }) {
      if (!actor || !ALLOWED_WORKBENCH_ROLES.has(actor.role)) {
        throw new AuthorizationError('Only admins can access the DAG workbench');
      }
      if (!dagConfig?.workbenchEnabled) {
        throw new AuthorizationError('DAG workbench is not enabled');
      }

      const graph = await dagGraphRepository.findById(graphId);
      if (!graph) {
        throw new NotFoundError('DAG graph');
      }

      const usageCount = await dagGraphRepository.getUsageCount(graphId);
      if (usageCount > 0) {
        throw new ValidationError(`Cannot delete formula: ${usageCount} credit(s) are using it. Deactivate it instead.`);
      }

      await dagGraphRepository.deleteGraph(graphId);

      logSecurity('dag.graph.deleted', {
        graphId,
        actorId: actor.id,
        name: graph.name,
      });

      return { deleted: true };
    },
  };
};

module.exports = {
  normalizeScopeKey,
  validateDagWorkbenchGraph,
  validateFormulaInput,
  validateFormulaNodes,
  createDagWorkbenchService,
};
