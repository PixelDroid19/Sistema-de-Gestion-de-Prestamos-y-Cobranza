const {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} = require('../../../../utils/errorHandler');
const { logSecurity, logBusiness } = require('../../../../utils/logger');

const ALLOWED_WORKBENCH_ROLES = new Set(['admin']);

const normalizeScopeKey = (value) => String(value || '').trim().toLowerCase();

const buildGraphSummary = ({ nodes, edges }) => ({
  nodeCount: nodes.length,
  edgeCount: edges.length,
  outputCount: nodes.filter((node) => node.kind === 'output').length,
  formulaNodeCount: nodes.filter((node) => typeof node.formula === 'string' && node.formula.trim()).length,
});

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
    throw new AuthorizationError('Only admins and agents can access the DAG workbench');
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
      const execution = typeof creditDomainService.simulateDetailed === 'function'
        ? await creditDomainService.simulateDetailed(simulationInput)
        : { selectedSource: 'legacy', fallbackReason: null, parity: { passed: true, mismatches: [] }, result: await creditDomainService.simulate(simulationInput) };

      const latestSimulation = await dagSimulationSummaryRepository.save({
        scopeKey: normalizedScopeKey,
        graphVersionId: graphVersion?.id || null,
        createdByUserId: actor.id,
        selectedSource: execution.selectedSource || 'legacy',
        fallbackReason: execution.fallbackReason || null,
        parity: execution.parity || { passed: true, mismatches: [] },
        simulationInput,
        summary: execution.result?.summary || {},
        schedulePreview: Array.isArray(execution.result?.schedule) ? execution.result.schedule.slice(0, 5) : [],
      });

      return {
        graphVersion,
        validation,
        simulation: execution.result,
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
  createDagWorkbenchService,
};
