// frontend/src/store/blockEditorStore.ts
import { create } from 'zustand';
import type { DagGraph, DagNode, DagEdge } from '../types/dag';

export type EditorStatus = 'draft' | 'active' | 'inactive' | 'archived';

interface GraphEditorState {
  graph: DagGraph | null;
  selectedNodeId: string | null;
  zoom: number;
  formulaName: string;
  formulaDescription: string;
  status: EditorStatus;
  scopeKey: string;
  undoStack: DagGraph[];
  redoStack: DagGraph[];
  isLoading: boolean;
  error: string | null;
}

interface GraphEditorActions {
  setGraph: (graph: DagGraph) => void;
  updateNodeFormula: (nodeId: string, formula: string) => void;
  updateNodeOutputVar: (nodeId: string, outputVar: string) => void;
  updateNodeField: (nodeId: string, field: keyof DagNode, value: unknown) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  addNode: (node: DagNode) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: DagEdge) => void;
  removeEdge: (source: string, target: string) => void;
  generateNodeId: (prefix: string) => string;
  selectNode: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setFormulaName: (name: string) => void;
  setFormulaDescription: (desc: string) => void;
  setStatus: (status: EditorStatus) => void;
  setScopeKey: (key: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

const initialState: GraphEditorState = {
  graph: null,
  selectedNodeId: null,
  zoom: 1,
  formulaName: 'Formula de credito',
  formulaDescription: '',
  status: 'draft',
  scopeKey: 'credit-simulation',
  undoStack: [],
  redoStack: [],
  isLoading: false,
  error: null,
};

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export const useBlockEditorStore = create<GraphEditorState & GraphEditorActions>((set, get) => ({
  ...initialState,

  setGraph: (graph) => {
    set((state) => ({
      graph,
      undoStack: state.graph ? [...state.undoStack, state.graph] : state.undoStack,
      redoStack: [],
    }));
  },

  updateNodeFormula: (nodeId, formula) => {
    set((state) => {
      if (!state.graph) return state;
      const newNodes = state.graph.nodes.map((node) =>
        node.id === nodeId ? { ...node, formula } : node
      );
      const newGraph = { ...state.graph, nodes: newNodes };
      return {
        graph: newGraph,
        undoStack: [...state.undoStack, state.graph],
        redoStack: [],
      };
    });
  },

  updateNodeOutputVar: (nodeId, outputVar) => {
    set((state) => {
      if (!state.graph) return state;
      const newNodes = state.graph.nodes.map((node) =>
        node.id === nodeId ? { ...node, outputVar } : node
      );
      const newGraph = { ...state.graph, nodes: newNodes };
      return {
        graph: newGraph,
        undoStack: [...state.undoStack, state.graph],
        redoStack: [],
      };
    });
  },

  updateNodeField: (nodeId, field, value) => {
    set((state) => {
      if (!state.graph) return state;
      const oldId = nodeId;
      const newId = field === 'id' ? String(value) : oldId;

      const newNodes = state.graph.nodes.map((node) =>
        node.id === nodeId ? { ...node, [field]: value } : node
      );

      // If renaming a node, update all edges that reference it
      const newEdges = field === 'id'
        ? state.graph.edges.map((edge) => ({
            ...edge,
            source: edge.source === oldId ? newId : edge.source,
            target: edge.target === oldId ? newId : edge.target,
          }))
        : state.graph.edges;

      const newGraph = { ...state.graph, nodes: newNodes, edges: newEdges };

      return {
        graph: newGraph,
        undoStack: [...state.undoStack, state.graph],
        redoStack: [],
        selectedNodeId: field === 'id' && state.selectedNodeId === oldId ? newId : state.selectedNodeId,
      };
    });
  },

  updateNodePosition: (nodeId, x, y) => {
    set((state) => {
      if (!state.graph) return state;
      const newNodes = state.graph.nodes.map((node) =>
        node.id === nodeId ? { ...node, x, y } : node
      );
      return {
        graph: { ...state.graph, nodes: newNodes },
      };
    });
  },

  addNode: (node) => {
    set((state) => {
      if (!state.graph) return state;
      const newGraph = {
        ...state.graph,
        nodes: [...state.graph.nodes, node],
      };
      return {
        graph: newGraph,
        undoStack: [...state.undoStack, state.graph],
        redoStack: [],
      };
    });
  },

  removeNode: (nodeId) => {
    set((state) => {
      if (!state.graph) return state;
      const newGraph = {
        ...state.graph,
        nodes: state.graph.nodes.filter((n) => n.id !== nodeId),
        edges: state.graph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      };
      return {
        graph: newGraph,
        undoStack: [...state.undoStack, state.graph],
        redoStack: [],
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      };
    });
  },

  addEdge: (edge) => {
    set((state) => {
      if (!state.graph) return state;
      const newGraph = {
        ...state.graph,
        edges: [...state.graph.edges, edge],
      };
      return {
        graph: newGraph,
        undoStack: [...state.undoStack, state.graph],
        redoStack: [],
      };
    });
  },

  removeEdge: (source, target) => {
    set((state) => {
      if (!state.graph) return state;
      const newGraph = {
        ...state.graph,
        edges: state.graph.edges.filter((e) => !(e.source === source && e.target === target)),
      };
      return {
        graph: newGraph,
        undoStack: [...state.undoStack, state.graph],
        redoStack: [],
      };
    });
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),

  setFormulaName: (name) => set({ formulaName: name }),

  setFormulaDescription: (desc) => set({ formulaDescription: desc }),

  setStatus: (status) => set({ status }),

  setScopeKey: (key) => set({ scopeKey: key }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  undo: () => {
    const { undoStack, redoStack, graph } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      graph: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: graph ? [...redoStack, graph] : redoStack,
    });
  },

  redo: () => {
    const { undoStack, redoStack, graph } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      graph: next,
      undoStack: graph ? [...undoStack, graph] : undoStack,
      redoStack: redoStack.slice(0, -1),
    });
  },

  reset: () => set(initialState),

  generateNodeId: (prefix) => {
    const { graph } = get();
    const existingIds = new Set(graph?.nodes.map((n) => n.id) || []);
    let counter = 1;
    let id = `${prefix}_${counter}`;
    while (existingIds.has(id)) {
      counter += 1;
      id = `${prefix}_${counter}`;
    }
    return id;
  },

  canUndo: () => get().undoStack.length > 0,

  canRedo: () => get().redoStack.length > 0,
}));
