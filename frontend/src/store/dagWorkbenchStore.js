import { create } from 'zustand';

import {
  buildDagSummary,
  createDagNode,
  createEmptyDagGraph,
  formatDagGraphDraft,
  getNodeConnections,
  normalizeDagGraph,
  serializeDagGraphForApi,
} from '@/features/loans/dagWorkbench/dagWorkbench.utils';

const createInitialSimulationInput = () => ({
  amount: '1000',
  interestRate: '12',
  termMonths: '12',
});

const createInitialState = () => ({
  workspaceMode: 'portfolio',
  scopeKey: 'personal-loan',
  graphName: 'Untitled DAG Graph',
  graph: createEmptyDagGraph(),
  draftGraphText: formatDagGraphDraft(),
  draftParseError: '',
  validation: null,
  latestSummary: null,
  simulationResult: null,
  simulationSummary: null,
  simulationInput: createInitialSimulationInput(),
  hasUnsavedChanges: false,
  lastLoadedGraphId: null,
  lastLoadedVersion: null,
  lastLoadedScopeKey: '',
  selectedNodeId: '',
  canvasTab: 'canvas',
  connectionDraft: { sourceNodeId: '', targetNodeId: '' },
  cycleErrors: [],
  topologyStatus: 'unknown',
  canvasDrag: null,
});

export const useDagWorkbenchStore = create((set) => ({
  ...createInitialState(),
  setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
  setScopeKey: (scopeKey) => set({
    scopeKey,
    graphName: 'Untitled DAG Graph',
    graph: createEmptyDagGraph(),
    draftGraphText: formatDagGraphDraft(),
    draftParseError: '',
    latestSummary: null,
    simulationResult: null,
    simulationSummary: null,
    validation: null,
    hasUnsavedChanges: false,
    lastLoadedGraphId: null,
    lastLoadedVersion: null,
    lastLoadedScopeKey: '',
    selectedNodeId: '',
    canvasTab: 'canvas',
    connectionDraft: { sourceNodeId: '', targetNodeId: '' },
    cycleErrors: [],
    topologyStatus: 'unknown',
    canvasDrag: null,
  }),
  setGraphName: (graphName) => set({ graphName, hasUnsavedChanges: true }),
  setDraftGraphText: (draftGraphText) => set(() => {
    try {
      const parsedGraph = normalizeDagGraph(JSON.parse(draftGraphText));

      return {
        draftGraphText,
        graph: parsedGraph,
        draftParseError: '',
        hasUnsavedChanges: true,
      };
    } catch (error) {
      return {
        draftGraphText,
        draftParseError: error.message,
        hasUnsavedChanges: true,
      };
    }
  }),
  setDraftParseError: (draftParseError) => set({ draftParseError }),
  setSimulationInputField: (field, value) => set((state) => ({
    simulationInput: {
      ...state.simulationInput,
      [field]: value,
    },
  })),
  setCanvasTab: (canvasTab) => set({ canvasTab }),
  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  setConnectionDraft: (connectionDraft) => set((state) => ({
    connectionDraft: {
      ...state.connectionDraft,
      ...connectionDraft,
    },
  })),
  clearConnectionDraft: () => set({ connectionDraft: { sourceNodeId: '', targetNodeId: '' } }),
  startCanvasDrag: (payload) => set({ canvasDrag: payload }),
  stopCanvasDrag: () => set({ canvasDrag: null }),
  hydrateGraph: (graphVersion) => set((state) => ({
    graph: normalizeDagGraph(graphVersion?.graph || createEmptyDagGraph()),
    scopeKey: graphVersion?.scopeKey || state.scopeKey,
    graphName: graphVersion?.name || state.graphName,
    draftGraphText: formatDagGraphDraft(graphVersion?.graph || createEmptyDagGraph()),
    draftParseError: '',
    validation: graphVersion?.validation || null,
    simulationResult: null,
    simulationSummary: null,
    hasUnsavedChanges: false,
    lastLoadedGraphId: graphVersion?.id || null,
    lastLoadedVersion: graphVersion?.version || null,
    lastLoadedScopeKey: graphVersion?.scopeKey || state.scopeKey,
    selectedNodeId: graphVersion?.graph?.nodes?.[0]?.id || '',
    cycleErrors: graphVersion?.validation?.errors?.filter((item) => item.field === 'edges') || [],
    topologyStatus: graphVersion?.validation?.valid ? 'valid' : 'invalid',
  })),
  markGraphSaved: ({ graphVersion, validation }) => set((state) => ({
    scopeKey: graphVersion?.scopeKey || state.scopeKey,
    graphName: graphVersion?.name || state.graphName,
    validation: validation || state.validation,
    draftParseError: '',
    hasUnsavedChanges: false,
    lastLoadedGraphId: graphVersion?.id || state.lastLoadedGraphId,
    lastLoadedVersion: graphVersion?.version || state.lastLoadedVersion,
    lastLoadedScopeKey: graphVersion?.scopeKey || state.lastLoadedScopeKey,
    cycleErrors: validation?.errors?.filter((item) => item.field === 'edges') || state.cycleErrors,
    topologyStatus: validation?.valid ? 'valid' : state.topologyStatus,
  })),
  setValidation: (validation) => set({
    validation,
    cycleErrors: validation?.errors?.filter((item) => item.field === 'edges') || [],
    topologyStatus: validation ? (validation.valid ? 'valid' : 'invalid') : 'unknown',
  }),
  setLatestSummary: (latestSummary) => set({ latestSummary }),
  setSimulationResult: (simulationResult) => set({ simulationResult }),
  setSimulationSummary: (simulationSummary) => set({ simulationSummary }),
  replaceGraph: (graph) => set((state) => {
    const normalizedGraph = normalizeDagGraph(graph);
    const currentSelectedNode = normalizedGraph.nodes.some((node) => node.id === state.selectedNodeId)
      ? state.selectedNodeId
      : normalizedGraph.nodes[0]?.id || '';

    return {
      graph: normalizedGraph,
      draftGraphText: formatDagGraphDraft(normalizedGraph),
      draftParseError: '',
      hasUnsavedChanges: true,
      selectedNodeId: currentSelectedNode,
    };
  }),
  addNode: (kind) => set((state) => {
    const graph = normalizeDagGraph(state.graph);
    const nextNode = createDagNode({ kind, index: graph.nodes.length });
    const nextGraph = {
      ...graph,
      nodes: [...graph.nodes, nextNode],
    };

    return {
      graph: nextGraph,
      draftGraphText: formatDagGraphDraft(nextGraph),
      hasUnsavedChanges: true,
      selectedNodeId: nextNode.id,
    };
  }),
  updateNode: (nodeId, updates) => set((state) => {
    const graph = normalizeDagGraph(state.graph);
    const nextGraph = {
      ...graph,
      nodes: graph.nodes.map((node) => (node.id === nodeId ? {
        ...node,
        ...updates,
        position: updates.position ? {
          ...node.position,
          ...updates.position,
        } : node.position,
      } : node)),
    };

    return {
      graph: nextGraph,
      draftGraphText: formatDagGraphDraft(nextGraph),
      hasUnsavedChanges: true,
    };
  }),
  removeNode: (nodeId) => set((state) => {
    const graph = normalizeDagGraph(state.graph);
    const nextGraph = {
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== nodeId),
      edges: graph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    };

    return {
      graph: nextGraph,
      draftGraphText: formatDagGraphDraft(nextGraph),
      hasUnsavedChanges: true,
      selectedNodeId: state.selectedNodeId === nodeId ? nextGraph.nodes[0]?.id || '' : state.selectedNodeId,
    };
  }),
  connectNodes: ({ sourceNodeId, targetNodeId }) => set((state) => {
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
      return state;
    }

    const graph = normalizeDagGraph(state.graph);
    const existingEdge = graph.edges.some((edge) => edge.source === sourceNodeId && edge.target === targetNodeId);
    if (existingEdge) {
      return state;
    }

    const nextGraph = {
      ...graph,
      edges: [
        ...graph.edges,
        { id: `edge-${sourceNodeId}-${targetNodeId}`, source: sourceNodeId, target: targetNodeId },
      ],
    };

    return {
      graph: nextGraph,
      draftGraphText: formatDagGraphDraft(nextGraph),
      hasUnsavedChanges: true,
      connectionDraft: { sourceNodeId: '', targetNodeId: '' },
    };
  }),
  disconnectNodes: ({ sourceNodeId, targetNodeId }) => set((state) => {
    const graph = normalizeDagGraph(state.graph);
    const nextGraph = {
      ...graph,
      edges: graph.edges.filter((edge) => !(edge.source === sourceNodeId && edge.target === targetNodeId)),
    };

    return {
      graph: nextGraph,
      draftGraphText: formatDagGraphDraft(nextGraph),
      hasUnsavedChanges: true,
    };
  }),
  upsertVariable: ({ id, key, value }) => set((state) => {
    const graph = normalizeDagGraph(state.graph);
    const variableId = id || `variable-${graph.variables.length + 1}`;
    const existingIndex = graph.variables.findIndex((variable) => variable.id === variableId);
    const nextVariable = {
      id: variableId,
      key,
      value,
    };
    const nextVariables = existingIndex >= 0
      ? graph.variables.map((variable, index) => (index === existingIndex ? nextVariable : variable))
      : [...graph.variables, nextVariable];
    const nextGraph = {
      ...graph,
      variables: nextVariables,
    };

    return {
      graph: nextGraph,
      draftGraphText: formatDagGraphDraft(nextGraph),
      hasUnsavedChanges: true,
    };
  }),
  removeVariable: (id) => set((state) => {
    const graph = normalizeDagGraph(state.graph);
    const nextGraph = {
      ...graph,
      variables: graph.variables.filter((variable) => variable.id !== id),
    };

    return {
      graph: nextGraph,
      draftGraphText: formatDagGraphDraft(nextGraph),
      hasUnsavedChanges: true,
    };
  }),
  getSelectedNode: () => {
    const state = useDagWorkbenchStore.getState();
    return state.graph.nodes.find((node) => node.id === state.selectedNodeId) || null;
  },
  getGraphSummary: () => buildDagSummary(useDagWorkbenchStore.getState().graph),
  getSerializedGraph: () => serializeDagGraphForApi(useDagWorkbenchStore.getState().graph),
  getNodeConnections: (nodeId) => getNodeConnections(useDagWorkbenchStore.getState().graph, nodeId),
  resetWorkbenchDraft: ({ preserveMode = true } = {}) => set((state) => ({
    ...createInitialState(),
    workspaceMode: preserveMode ? state.workspaceMode : 'portfolio',
  })),
}));
