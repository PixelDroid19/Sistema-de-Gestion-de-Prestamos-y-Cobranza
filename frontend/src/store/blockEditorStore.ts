// frontend/src/store/blockEditorStore.ts
import { create } from 'zustand';
import type { DagGraph, FormulaContainer, BlockDefinition } from '../types/dag';
import { compileBlocksToGraph, generateBlockId } from '../lib/blockCompiler';

export type EditorStatus = 'draft' | 'active' | 'inactive' | 'archived';

interface BlockEditorState {
  /** Formula containers on the canvas */
  containers: FormulaContainer[];
  /** The compiled DagGraph (built from containers) */
  compiledGraph: DagGraph | null;
  /** Selected block or container ID */
  selectedBlockId: string | null;
  /** Zoom level */
  zoom: number;
  /** Formula name */
  formulaName: string;
  /** Formula description */
  formulaDescription: string;
  /** Formula status */
  status: EditorStatus;
  /** Scope key */
  scopeKey: string;
  /** Undo/redo stacks (snapshots of containers array) */
  undoStack: FormulaContainer[][];
  redoStack: FormulaContainer[][];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

interface BlockEditorActions {
  // Container operations
  addContainer: (container: FormulaContainer) => void;
  removeContainer: (containerId: string) => void;
  updateContainer: (containerId: string, updates: Partial<FormulaContainer>) => void;

  // Block operations within a container
  addBlock: (containerId: string, block: BlockDefinition, index?: number) => void;
  removeBlock: (containerId: string, blockId: string) => void;
  updateBlock: (containerId: string, blockId: string, updates: Partial<BlockDefinition>) => void;
  moveBlock: (containerId: string, blockId: string, newIndex: number) => void;

  // Selection
  selectBlock: (id: string | null) => void;

  // Compilation
  compileGraph: () => DagGraph;

  // Zoom
  setZoom: (zoom: number) => void;

  // Metadata
  setFormulaName: (name: string) => void;
  setFormulaDescription: (desc: string) => void;
  setStatus: (status: EditorStatus) => void;
  setScopeKey: (key: string) => void;

  // State
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setContainers: (containers: FormulaContainer[]) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Reset
  reset: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

const initialState: BlockEditorState = {
  containers: [],
  compiledGraph: null,
  selectedBlockId: null,
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

function pushUndo(state: BlockEditorState): Partial<BlockEditorState> {
  return {
    undoStack: [...state.undoStack, JSON.parse(JSON.stringify(state.containers))],
    redoStack: [],
  };
}

export const useBlockEditorStore = create<BlockEditorState & BlockEditorActions>((set, get) => ({
  ...initialState,

  // ── Container Operations ────────────────────────────────────────────────

  addContainer: (container) => {
    set((state) => ({
      ...pushUndo(state),
      containers: [...state.containers, container],
    }));
  },

  removeContainer: (containerId) => {
    set((state) => ({
      ...pushUndo(state),
      containers: state.containers.filter((c) => c.id !== containerId),
      selectedBlockId: state.selectedBlockId === containerId ? null : state.selectedBlockId,
    }));
  },

  updateContainer: (containerId, updates) => {
    set((state) => ({
      ...pushUndo(state),
      containers: state.containers.map((c) =>
        c.id === containerId ? { ...c, ...updates } : c
      ),
    }));
  },

  // ── Block Operations ────────────────────────────────────────────────────

  addBlock: (containerId, block, index) => {
    set((state) => ({
      ...pushUndo(state),
      containers: state.containers.map((c) => {
        if (c.id !== containerId) return c;
        const blocks = [...c.blocks];
        if (index !== undefined && index >= 0 && index <= blocks.length) {
          blocks.splice(index, 0, block);
        } else {
          blocks.push(block);
        }
        return { ...c, blocks };
      }),
    }));
  },

  removeBlock: (containerId, blockId) => {
    set((state) => ({
      ...pushUndo(state),
      containers: state.containers.map((c) => {
        if (c.id !== containerId) return c;
        return { ...c, blocks: c.blocks.filter((b) => b.id !== blockId) };
      }),
      selectedBlockId: state.selectedBlockId === blockId ? null : state.selectedBlockId,
    }));
  },

  updateBlock: (containerId, blockId, updates) => {
    set((state) => ({
      ...pushUndo(state),
      containers: state.containers.map((c) => {
        if (c.id !== containerId) return c;
        return {
          ...c,
          blocks: c.blocks.map((b) =>
            b.id === blockId ? { ...b, ...updates } : b
          ),
        };
      }),
    }));
  },

  moveBlock: (containerId, blockId, newIndex) => {
    set((state) => ({
      ...pushUndo(state),
      containers: state.containers.map((c) => {
        if (c.id !== containerId) return c;
        const blocks = [...c.blocks];
        const oldIndex = blocks.findIndex((b) => b.id === blockId);
        if (oldIndex === -1) return c;
        const [moved] = blocks.splice(oldIndex, 1);
        blocks.splice(newIndex, 0, moved);
        return { ...c, blocks };
      }),
    }));
  },

  // ── Selection ───────────────────────────────────────────────────────────

  selectBlock: (id) => set({ selectedBlockId: id }),

  // ── Compilation ─────────────────────────────────────────────────────────

  compileGraph: () => {
    const { containers } = get();
    const graph = compileBlocksToGraph(containers);
    set({ compiledGraph: graph });
    return graph;
  },

  // ── Zoom ────────────────────────────────────────────────────────────────

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),

  // ── Metadata ────────────────────────────────────────────────────────────

  setFormulaName: (name) => set({ formulaName: name }),
  setFormulaDescription: (desc) => set({ formulaDescription: desc }),
  setStatus: (status) => set({ status }),
  setScopeKey: (key) => set({ scopeKey: key }),

  // ── State ───────────────────────────────────────────────────────────────

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  setContainers: (containers) => {
    set((state) => ({
      ...pushUndo(state),
      containers: JSON.parse(JSON.stringify(containers)),
    }));
  },

  // ── Undo/Redo ───────────────────────────────────────────────────────────

  undo: () => {
    const { undoStack, redoStack, containers } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      containers: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, JSON.parse(JSON.stringify(containers))],
    });
  },

  redo: () => {
    const { undoStack, redoStack, containers } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      containers: next,
      undoStack: [...undoStack, JSON.parse(JSON.stringify(containers))],
      redoStack: redoStack.slice(0, -1),
    });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  // ── Reset ───────────────────────────────────────────────────────────────

  reset: () => set(initialState),
}));

// Re-export generateBlockId for convenience
export { generateBlockId };
