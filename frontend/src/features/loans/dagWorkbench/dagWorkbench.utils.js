const NODE_WIDTH = 220;
const NODE_HEIGHT = 132;

const DEFAULT_NODE_KIND = 'formula';

const DEFAULT_VARIABLES = [
  { id: 'variable-commission-rate', key: 'commission_rate', value: '0.12' },
  { id: 'variable-risk-buffer', key: 'risk_buffer', value: '1.5' },
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toTitleCase = (value = '') => value
  .split(/[-_\s]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const toNumericIfPossible = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const numericValue = Number(trimmed);
  return Number.isNaN(numericValue) ? trimmed : numericValue;
};

const ensureNodePosition = (node = {}, index = 0) => {
  const fallbackX = 80 + (index % 3) * 260;
  const fallbackY = 80 + Math.floor(index / 3) * 180;

  const x = Number(node?.position?.x ?? node?.x ?? fallbackX);
  const y = Number(node?.position?.y ?? node?.y ?? fallbackY);

  return {
    x: Number.isFinite(x) ? x : fallbackX,
    y: Number.isFinite(y) ? y : fallbackY,
  };
};

const ensureNodeKind = (kind) => {
  const normalizedKind = String(kind || '').trim().toLowerCase();
  if (normalizedKind === 'input' || normalizedKind === 'output' || normalizedKind === 'formula') {
    return normalizedKind;
  }

  return DEFAULT_NODE_KIND;
};

export const createEmptyDagGraph = () => ({
  nodes: [],
  edges: [],
  variables: DEFAULT_VARIABLES.map((variable) => ({ ...variable })),
});

export const formatDagGraphDraft = (graph = createEmptyDagGraph()) => JSON.stringify(graph, null, 2);

export const normalizeDagGraph = (graph = createEmptyDagGraph()) => {
  const sourceGraph = graph && typeof graph === 'object' ? graph : createEmptyDagGraph();

  const variables = Array.isArray(sourceGraph.variables)
    ? sourceGraph.variables.map((variable, index) => ({
      id: String(variable?.id || `variable-${index + 1}`),
      key: String(variable?.key || `var_${index + 1}`).trim(),
      value: variable?.value ?? '',
    }))
    : DEFAULT_VARIABLES.map((variable) => ({ ...variable }));

  const nodes = (Array.isArray(sourceGraph.nodes) ? sourceGraph.nodes : []).map((node, index) => {
    const kind = ensureNodeKind(node?.kind);
    const nodeId = String(node?.id || `${kind}-${index + 1}`);

    return {
      id: nodeId,
      kind,
      label: String(node?.label || toTitleCase(nodeId) || `Node ${index + 1}`),
      formula: typeof node?.formula === 'string' ? node.formula : '',
      outputVar: String(node?.outputVar || nodeId).trim() || nodeId,
      value: node?.value ?? '',
      position: ensureNodePosition(node, index),
    };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (Array.isArray(sourceGraph.edges) ? sourceGraph.edges : [])
    .map((edge, index) => ({
      id: String(edge?.id || `edge-${index + 1}`),
      source: String(edge?.source || '').trim(),
      target: String(edge?.target || '').trim(),
    }))
    .filter((edge) => edge.source && edge.target && nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return {
    nodes,
    edges,
    variables,
  };
};

export const serializeDagGraphForApi = (graph = createEmptyDagGraph()) => {
  const normalizedGraph = normalizeDagGraph(graph);

  return {
    nodes: normalizedGraph.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.label,
      formula: node.formula,
      outputVar: node.outputVar,
      value: node.value,
      position: node.position,
    })),
    edges: normalizedGraph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
    variables: normalizedGraph.variables.map((variable) => ({
      id: variable.id,
      key: variable.key,
      value: variable.value,
    })),
  };
};

export const createDagNode = ({ kind = DEFAULT_NODE_KIND, index = 0 } = {}) => {
  const normalizedKind = ensureNodeKind(kind);
  const nodeId = `${normalizedKind}-${index + 1}`;

  return {
    id: nodeId,
    kind: normalizedKind,
    label: `${toTitleCase(normalizedKind)} ${index + 1}`,
    formula: normalizedKind === 'input' ? '' : normalizedKind === 'output' ? nodeId.replace(/^output-/, '') : '',
    outputVar: nodeId.replace(/-/g, '_'),
    value: normalizedKind === 'input' ? '0' : '',
    position: ensureNodePosition({}, index),
  };
};

export const buildDagSummary = (graph = createEmptyDagGraph()) => {
  const normalizedGraph = normalizeDagGraph(graph);

  return {
    nodeCount: normalizedGraph.nodes.length,
    edgeCount: normalizedGraph.edges.length,
    variableCount: normalizedGraph.variables.length,
    outputCount: normalizedGraph.nodes.filter((node) => node.kind === 'output').length,
    formulaNodeCount: normalizedGraph.nodes.filter((node) => node.formula.trim()).length,
  };
};

const buildNodeMaps = (graph = createEmptyDagGraph()) => {
  const nodesById = new Map();
  const incomingByTarget = new Map();
  const outgoingBySource = new Map();

  graph.nodes.forEach((node) => {
    nodesById.set(node.id, node);
    incomingByTarget.set(node.id, []);
    outgoingBySource.set(node.id, []);
  });

  graph.edges.forEach((edge) => {
    if (!incomingByTarget.has(edge.target)) {
      incomingByTarget.set(edge.target, []);
    }

    if (!outgoingBySource.has(edge.source)) {
      outgoingBySource.set(edge.source, []);
    }

    incomingByTarget.get(edge.target).push(edge);
    outgoingBySource.get(edge.source).push(edge);
  });

  return { nodesById, incomingByTarget, outgoingBySource };
};

export const evaluateDagGraph = ({ graph, simulationInput = {}, evaluateExpression }) => {
  const normalizedGraph = normalizeDagGraph(graph);
  const { nodesById, incomingByTarget, outgoingBySource } = buildNodeMaps(normalizedGraph);
  const indegree = new Map(normalizedGraph.nodes.map((node) => [node.id, incomingByTarget.get(node.id)?.length || 0]));
  const queue = normalizedGraph.nodes.filter((node) => (indegree.get(node.id) || 0) === 0);
  const orderedNodeIds = [];
  const outputsByNodeId = {};
  const outputsByVariable = {};
  const errors = [];
  const globalVariables = Object.fromEntries(
    normalizedGraph.variables
      .filter((variable) => variable.key)
      .map((variable) => [variable.key, toNumericIfPossible(variable.value)]),
  );

  while (queue.length > 0) {
    const nextNode = queue.shift();
    orderedNodeIds.push(nextNode.id);

    const outgoingEdges = outgoingBySource.get(nextNode.id) || [];
    outgoingEdges.forEach((edge) => {
      const nextValue = (indegree.get(edge.target) || 0) - 1;
      indegree.set(edge.target, nextValue);

      if (nextValue === 0 && nodesById.has(edge.target)) {
        queue.push(nodesById.get(edge.target));
      }
    });
  }

  const hasCycle = orderedNodeIds.length !== normalizedGraph.nodes.length;
  if (hasCycle) {
    errors.push({ field: 'edges', message: 'Graph contains circular dependencies' });
  }

  orderedNodeIds.forEach((nodeId) => {
    const node = nodesById.get(nodeId);
    if (!node) {
      return;
    }

    const incomingEdges = incomingByTarget.get(nodeId) || [];
    const dependencyScope = incomingEdges.reduce((result, edge) => {
      const dependencyNode = nodesById.get(edge.source);
      const dependencyValue = outputsByNodeId[edge.source];

      if (dependencyNode) {
        result[dependencyNode.outputVar || dependencyNode.id] = dependencyValue;
        result[dependencyNode.id] = dependencyValue;
      }

      return result;
    }, {});

    const runtimeScope = {
      ...simulationInput,
      ...globalVariables,
      ...outputsByVariable,
      ...dependencyScope,
    };

    try {
      let value;

      if (node.formula.trim()) {
        value = evaluateExpression
          ? evaluateExpression(node.formula, runtimeScope)
          : null;
      } else if (node.kind === 'input') {
        value = simulationInput[node.outputVar] ?? simulationInput[node.id] ?? toNumericIfPossible(node.value);
      } else if (incomingEdges.length > 0) {
        const firstSourceId = incomingEdges[0].source;
        value = outputsByNodeId[firstSourceId];
      } else {
        value = toNumericIfPossible(node.value);
      }

      outputsByNodeId[nodeId] = value;
      outputsByVariable[node.outputVar || node.id] = value;
    } catch (error) {
      outputsByNodeId[nodeId] = null;
      errors.push({ field: node.outputVar || node.id, message: error.message });
    }
  });

  return {
    orderedNodeIds,
    outputsByNodeId,
    outputsByVariable,
    errors,
    hasCycle,
    valid: !hasCycle && errors.length === 0,
  };
};

export const getNodeConnections = (graph = createEmptyDagGraph(), nodeId) => {
  const normalizedGraph = normalizeDagGraph(graph);

  return {
    incoming: normalizedGraph.edges.filter((edge) => edge.target === nodeId),
    outgoing: normalizedGraph.edges.filter((edge) => edge.source === nodeId),
  };
};

export const buildCanvasEdgePath = (sourcePosition, targetPosition) => {
  const sourceX = sourcePosition.x + NODE_WIDTH;
  const sourceY = sourcePosition.y + NODE_HEIGHT / 2;
  const targetX = targetPosition.x;
  const targetY = targetPosition.y + NODE_HEIGHT / 2;
  const curveOffset = clamp(Math.abs(targetX - sourceX) * 0.35, 60, 180);

  return `M ${sourceX} ${sourceY} C ${sourceX + curveOffset} ${sourceY}, ${targetX - curveOffset} ${targetY}, ${targetX} ${targetY}`;
};

export const getNodeViewport = (node = {}) => ({
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
  ...node.position,
});

export const DAG_NODE_WIDTH = NODE_WIDTH;
export const DAG_NODE_HEIGHT = NODE_HEIGHT;
