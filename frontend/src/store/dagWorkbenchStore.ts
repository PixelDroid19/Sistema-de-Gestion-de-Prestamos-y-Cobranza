import { create } from 'zustand';
import {
  Connection,
  Edge as RFEdge,
  EdgeChange,
  Node as RFNode,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { dagService } from '../services/dagService';
import {
  DagGraphVersion,
  DagGraphStatus,
  DagNode,
  DagEdge,
  DagGraph,
  SimulationInput,
  SimulationResult,
  ValidationResult,
  NodeKind,
} from '../types/dag';
import { getSafeErrorText } from '../services/safeErrorMessages';

// Type describing our internal React Flow Node's structured data
export type RFNodeData = {
  id: string;
  kind: NodeKind;
  label: string;
  description: string;
  formula: string;
  outputVar: string;
  metadata: Record<string, unknown>;
  onNodeChange: (id: string, data: Partial<RFNodeData>) => void;
};

export type AppNode = RFNode<RFNodeData>;
export type AppEdge = RFEdge;

export interface DagWorkbenchState {
  // Metadata
  scopeKey: string;
  graphVersion: DagGraphVersion | null;
  graphName: string;
  isLoading: boolean;
  isSimulating: boolean;
  isSaving: boolean;
  error: string | null;

  // React Flow State
  nodes: AppNode[];
  edges: AppEdge[];
  selectedNodeId: string | null;

  // Validation & Simulation
  validation: ValidationResult | null;
  simulationInput: SimulationInput;
  simulationResult: SimulationResult | null;

  // Actions - Core RF
  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<AppEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  
  // Actions - Canvas management
  setSelectedNodeId: (id: string | null) => void;
  setGraphName: (name: string) => void;
  updateNodeData: (id: string, data: Partial<RFNodeData>) => void;
  addNode: (node: AppNode) => void;
  
  // Actions - API integration
  loadGraph: (scopeKey: string) => Promise<void>;
  validateGraph: () => Promise<void>;
  saveGraph: (name: string) => Promise<void>;
  simulateGraph: () => Promise<void>;
  setSimulationInput: (input: Partial<SimulationInput>) => void;
  
  // Actions - Formula Management
  graphList: DagGraphVersion[];
  isLoadingGraphList: boolean;
  loadGraphList: (scopeKey: string) => Promise<void>;
  activateGraph: (graphId: number) => Promise<void>;
  deactivateGraph: (graphId: number) => Promise<void>;
  deleteGraph: (graphId: number) => Promise<void>;
  selectGraph: (graphId: number) => Promise<void>;
  
  // Converters
  getDagGraph: () => { nodes: DagNode[]; edges: { source: string; target: string }[] };
}

// =============================================================================
// Helpers for conversion
// =============================================================================

const mapDagNodeToRFNode = (
  n: DagNode, 
  x: number, 
  y: number,
  onNodeChange: (id: string, data: Partial<RFNodeData>) => void
): AppNode => {
  return {
    id: n.id,
    type: 'dagNode',
    position: { x, y },
    data: {
      id: n.id,
      kind: n.kind,
      label: n.label || '',
      description: n.description || '',
      formula: n.formula || '',
      outputVar: n.outputVar || '',
      metadata: n.metadata || {},
      onNodeChange,
    },
  };
};

const mapRFNodeToDagNode = (n: AppNode, edges: AppEdge[]): DagNode => {
  const dependencies = edges
    .filter(e => e.target === n.id)
    .map(e => e.source);
  
  return {
    id: n.id,
    kind: n.data.kind,
    label: n.data.label || undefined,
    description: n.data.description || undefined,
    dependencies: dependencies.length > 0 ? dependencies : undefined,
    formula: n.data.formula || undefined,
    outputVar: n.data.outputVar || undefined,
    metadata: Object.keys(n.data.metadata).length > 0 ? n.data.metadata : undefined,
  };
};

// Calculate auto-layout positions
const calculateAutoLayout = (nodes: DagNode[]): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  
  // Build dependency graph
  const nodeInDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  
  nodes.forEach(n => {
    nodeInDegree.set(n.id, (n.dependencies || []).length);
    dependents.set(n.id, []);
  });
  
  nodes.forEach(n => {
    (n.dependencies || []).forEach(dep => {
      dependents.get(dep)?.push(n.id);
    });
  });
  
  // BFS to assign layers
  const layers = new Map<string, number>();
  const queue = nodes.filter(n => (n.dependencies || []).length === 0);
  queue.forEach((n) => layers.set(n.id, 0));
  
  while (queue.length > 0) {
    const node = queue.shift()!;
    const layer = layers.get(node.id)!;
    
    for (const dependent of dependents.get(node.id) || []) {
      const currentLayer = layers.get(dependent) || 0;
      const newLayer = Math.max(currentLayer, layer + 1);
      layers.set(dependent, newLayer);
      
      // Add to queue if all dependencies processed
      const newInDegree = (nodeInDegree.get(dependent) || 1) - 1;
      nodeInDegree.set(dependent, newInDegree);
      if (newInDegree === 0) {
        queue.push(nodes.find(n => n.id === dependent)!);
      }
    }
  }
  
  // Assign unvisited nodes to last layer
  const maxLayer = Math.max(0, ...[...layers.values()]);
  nodes.forEach(n => {
    if (!layers.has(n.id)) {
      layers.set(n.id, maxLayer);
    }
  });
  
  // Group by layer
  const layerGroups = new Map<number, string[]>();
  layers.forEach((layer, nodeId) => {
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(nodeId);
  });
  
  // Position nodes
  const horizontalSpacing = 320;
  const verticalSpacing = 140;
  
  layerGroups.forEach((nodeIds, layerIndex) => {
    const totalHeight = (nodeIds.length - 1) * verticalSpacing;
    const startY = Math.max(60, 200 - totalHeight / 2);
    nodeIds.forEach((nodeId, idx) => {
      positions.set(nodeId, {
        x: 80 + layerIndex * horizontalSpacing,
        y: startY + idx * verticalSpacing,
      });
    });
  });
  
  return positions;
};

// Helper: given a DagGraph, convert to RF nodes and edges
const convertGraphToRFState = (
  dagGraph: DagGraph,
  updateNodeData: (id: string, data: Partial<RFNodeData>) => void
) => {
  const positions = calculateAutoLayout(dagGraph.nodes);
  
  const nodes: AppNode[] = dagGraph.nodes.map((n, i) => {
    const pos = positions.get(n.id) || { x: 100 + (i % 4) * 300, y: 100 + Math.floor(i / 4) * 150 };
    return mapDagNodeToRFNode(n, pos.x, pos.y, updateNodeData);
  });

  const edges: AppEdge[] = dagGraph.edges.map(e => ({
    id: `e-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    animated: true,
    style: { strokeWidth: 2 },
  }));

  return { nodes, edges };
};

// =============================================================================
// STORE
// =============================================================================

export const useDagStore = create<DagWorkbenchState>((set, get) => ({
  scopeKey: 'credit-simulation',
  graphVersion: null,
  graphName: 'Simulación de Crédito',
  isLoading: false,
  isSimulating: false,
  isSaving: false,
  error: null,

  // Formula management
  graphList: [],
  isLoadingGraphList: false,
  
  nodes: [],
  edges: [],
  selectedNodeId: null,

  validation: null,
  
  simulationInput: {
    amount: 2000000,
    interestRate: 60,
    termMonths: 12,
    lateFeeMode: 'SIMPLE',
  },
  simulationResult: null,

  // Event handlers for React Flow
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    const edge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}`,
      animated: true,
      style: { strokeWidth: 2 },
    } as AppEdge;
    set({ edges: addEdge(edge, get().edges) });
    get().validateGraph();
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  setGraphName: (name) => set({ graphName: name }),

  updateNodeData: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }));
  },

  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node] }));
  },

  setSimulationInput: (input) => {
    set((state) => ({
      simulationInput: { ...state.simulationInput, ...input }
    }));
  },

  getDagGraph: () => {
    const { nodes, edges } = get();
    return {
      nodes: nodes.map((n) => mapRFNodeToDagNode(n, edges)),
      edges: edges.map(e => ({ source: e.source!, target: e.target! })),
    };
  },

  loadGraph: async (scopeKey: string) => {
    set({ isLoading: true, error: null, scopeKey });
    try {
      const response = await dagService.loadGraph(scopeKey);
      
      // Backend returns { data: { graph: graphVersion } }
      const graphVersion = response.data?.graph || response.data?.graphVersion;
      
      if (!graphVersion || !graphVersion.graph) {
        throw { response: { status: 404 } };
      }
      
      const dagGraph = graphVersion.graph;
      const updateNodeData = get().updateNodeData;
      const { nodes, edges } = convertGraphToRFState(dagGraph, updateNodeData);

      set({ 
        nodes, 
        edges, 
        graphVersion,
        graphName: graphVersion.name || scopeKey,
        validation: graphVersion.validation || null,
        isLoading: false 
      });
      await get().loadGraphList(scopeKey);
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message;
      if (err?.response?.status === 404 || (typeof errMsg === 'string' && errMsg.includes('not found'))) {
        // No saved graph — load the DEFAULT template for this scope
        try {
          const scopesResponse = await dagService.listScopes();
          const scopeDefinition = scopesResponse.data?.scopes?.find((scope) => scope.key === scopeKey);
          const defaultGraph = scopeDefinition?.defaultGraph;

          if (defaultGraph) {
            const updateNodeData = get().updateNodeData;
            const { nodes, edges } = convertGraphToRFState(defaultGraph, updateNodeData);
            set({
              nodes,
              edges,
              graphName: scopeDefinition?.defaultName || scopeDefinition?.label || 'Nuevo Grafo',
              graphVersion: null,
              validation: null,
              simulationInput: scopeDefinition?.simulationInput || get().simulationInput,
              isLoading: false,
              error: null,
            });
            await get().loadGraphList(scopeKey);
            return;
          }
        } catch (scopeError) {
          console.error('[dag] listScopes fallback failed', scopeError);
        }

        set({
          nodes: [],
          edges: [],
          graphName: 'Nuevo Grafo',
          graphVersion: null,
          validation: null,
          isLoading: false,
        });
        await get().loadGraphList(scopeKey);
      } else {
        console.error('[dag] loadGraph failed', err);
        set({
          error: getSafeErrorText(err, { domain: 'dag', action: 'dag.load' }),
          isLoading: false,
        });
      }
    }
  },

  validateGraph: async () => {
    const { scopeKey, edges } = get();
    const dagNodes = get().getDagGraph().nodes;
    const dagEdges = edges.map(e => ({ source: e.source!, target: e.target! }));

    try {
      const response = await dagService.validateGraph({
        scopeKey,
        graph: { nodes: dagNodes, edges: dagEdges }
      });
      set({ validation: response.data.validation });
    } catch (err: any) {
      console.error('Validation error:', err);
    }
  },

  saveGraph: async (name: string) => {
    set({ isSaving: true, error: null, graphName: name });
    try {
      const { scopeKey } = get();
      const dagGraph = get().getDagGraph();
      
      const response = await dagService.saveGraph({
        scopeKey,
        name,
        graph: dagGraph,
      });
      
      // Backend returns { data: { graph: graphVersion } }
      const graphVersion = response.data?.graph || response.data?.graphVersion;
      
      set({ 
        graphVersion,
        isSaving: false,
        validation: graphVersion?.validation
      });
      await get().loadGraphList(scopeKey);
    } catch (err: any) {
      try {
        // Try to parse validation errors from response
        const errorData = err.response?.data?.error;
        if (errorData?.errors) {
          set({ 
            error: 'El grafo tiene errores de validación', 
            isSaving: false,
            validation: { 
              valid: false, 
              errors: errorData.errors, 
              warnings: [], 
              summary: { nodeCount: 0, edgeCount: 0, outputCount: 0, formulaNodeCount: 0 }
            }
          });
        } else {
          console.error('[dag] saveGraph failed', err);
          set({
            error: getSafeErrorText(err, { domain: 'dag', action: 'dag.save' }),
            isSaving: false,
          });
        }
      } catch {
        console.error('[dag] saveGraph failed', err);
        set({
          error: getSafeErrorText(err, { domain: 'dag', action: 'dag.save' }),
          isSaving: false,
        });
      }
    }
  },

  simulateGraph: async () => {
    set({ isSimulating: true, error: null, simulationResult: null });
    try {
      // Validate first
      await get().validateGraph();
      
      if (get().validation?.valid === false) {
        set({ 
          isSimulating: false, 
          error: 'No se puede simular: el grafo tiene errores de validación.' 
        });
        return;
      }

      const { scopeKey, simulationInput } = get();
      const dagGraph = get().getDagGraph();

      const response = await dagService.simulateGraph({
        scopeKey,
        simulationInput,
        graph: dagGraph,
      });

      set({ 
        simulationResult: response.data.simulation,
        isSimulating: false 
      });
    } catch (err: any) {
      console.error('[dag] simulateGraph failed', err);
      set({
        error: getSafeErrorText(err, { domain: 'dag', action: 'dag.simulate' }),
        isSimulating: false,
      });
    }
  },

  // ── Formula Management Actions ────────────────────────────────────────

  loadGraphList: async (scopeKey: string) => {
    set({ isLoadingGraphList: true });
    try {
      const response = await dagService.listGraphs(scopeKey);
      set({ graphList: response.data?.graphs || [], isLoadingGraphList: false });
    } catch (err: any) {
      console.error('Error loading graph list:', err);
      set({ graphList: [], isLoadingGraphList: false });
    }
  },

  activateGraph: async (graphId: number) => {
    try {
      const response = await dagService.updateGraphStatus(graphId, 'active');
      // Refresh the graph list
      const { scopeKey } = get();
      if (get().graphVersion?.id === graphId) {
        set({ graphVersion: response.data?.graph || get().graphVersion });
      }
      await get().loadGraphList(scopeKey);
    } catch (err: any) {
      console.error('[dag] activateGraph failed', err);
      set({ error: getSafeErrorText(err, { domain: 'dag', action: 'dag.save' }) });
    }
  },

  deactivateGraph: async (graphId: number) => {
    try {
      const response = await dagService.updateGraphStatus(graphId, 'inactive');
      // Refresh the graph list
      const { scopeKey } = get();
      if (get().graphVersion?.id === graphId) {
        set({ graphVersion: response.data?.graph || get().graphVersion });
      }
      await get().loadGraphList(scopeKey);
    } catch (err: any) {
      console.error('[dag] deactivateGraph failed', err);
      set({ error: getSafeErrorText(err, { domain: 'dag', action: 'dag.save' }) });
    }
  },

  deleteGraph: async (graphId: number) => {
    try {
      const { scopeKey, graphVersion } = get();
      await dagService.deleteGraph(graphId);
      const deletedCurrentGraph = graphVersion?.id === graphId;

      if (deletedCurrentGraph) {
        await get().loadGraph(scopeKey);
        return;
      }

      await get().loadGraphList(scopeKey);
    } catch (err: any) {
      console.error('[dag] deleteGraph failed', err);
      set({ error: getSafeErrorText(err, { domain: 'dag', action: 'dag.save' }) });
    }
  },

  selectGraph: async (graphId: number) => {
    set({ isLoading: true, error: null });
    try {
      const response = await dagService.getGraphDetails(graphId);
      const graphVersion = response.data?.graph;
      if (!graphVersion || !graphVersion.graph) {
        set({ error: 'Graph not found', isLoading: false });
        return;
      }

      const dagGraph = graphVersion.graph;
      const updateFn = (id: string, data: Partial<RFNodeData>) => {
        useDagStore.setState((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...data } } : n
          ),
        }));
      };
      const { nodes, edges } = convertGraphToRFState(dagGraph, updateFn);

      set({
        scopeKey: graphVersion.scopeKey || get().scopeKey,
        graphVersion,
        graphName: graphVersion.name || 'Grafo Cargado',
        nodes,
        edges,
        selectedNodeId: null,
        validation: graphVersion.validation || null,
        isLoading: false,
      });
    } catch (err: any) {
      console.error('[dag] selectGraph failed', err);
      set({
        error: getSafeErrorText(err, { domain: 'dag', action: 'dag.load' }),
        isLoading: false,
      });
    }
  },
}));

export default useDagStore;
