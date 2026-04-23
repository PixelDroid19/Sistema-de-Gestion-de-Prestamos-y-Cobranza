import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Save, Play, ChevronLeft,
  Plus, Trash2, X, Variable, Equal, GitBranch, GripVertical,
  FunctionSquare, RotateCcw, Maximize2,
} from 'lucide-react';
import { useBlockEditorStore } from '../store/blockEditorStore';
import { dagService } from '../services/dagService';
import { queryKeys } from '../services/queryKeys';
import { toast } from '../lib/toast';
import { VisualNodeBlock } from './VisualNodeBlock';
import type { DagNode, DagEdge, NodeKind } from '../types/dag';

// ── Constants ──
const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2400;
const NODE_WIDTH = 260;
const NODE_HEIGHT = 120;
const COL_GAP = 420;
const ROW_GAP = 160;

// Material Design 3 tokens
const MD3 = {
  surface: '#f8f9ff',
  onSurface: '#0b1c30',
  onSurfaceVariant: '#5a6271',
  secondary: '#00668a',
  secondaryContainer: '#cce5f3',
  onSecondaryContainer: '#00344a',
  outline: '#c4c6cf',
  outlineVariant: '#dee1ea',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  success: '#2e7d32',
} as const;

// ── Helpers ──
const kindLabel: Record<NodeKind, string> = {
  constant: 'Constante',
  formula: 'Formula',
  conditional: 'Condicional',
  output: 'Output',
  lookup: 'Lookup',
};

const kindColor: Record<NodeKind, string> = {
  constant: 'bg-[#e3f2fd] border-[#90caf9] text-[#0d47a1]',
  formula: 'bg-[#fff8e1] border-[#ffe082] text-[#5d4037]',
  conditional: 'bg-[#f3e5f5] border-[#ce93d8] text-[#4a148c]',
  output: 'bg-[#e8f5e9] border-[#a5d6a7] text-[#1b5e20]',
  lookup: 'bg-[#fce4ec] border-[#f48fb1] text-[#880e4f]',
};

const kindBadge: Record<NodeKind, string> = {
  constant: 'bg-[#bbdefb] text-[#1565c0]',
  formula: 'bg-[#ffecb3] text-[#6d4c41]',
  conditional: 'bg-[#e1bee7] text-[#6a1b9a]',
  output: 'bg-[#c8e6c9] text-[#2e7d32]',
  lookup: 'bg-[#f8bbd0] text-[#c2185b]',
};

const kindHandle: Record<NodeKind, string> = {
  constant: 'bg-[#42a5f5]',
  formula: 'bg-[#ffa726]',
  conditional: 'bg-[#ab47bc]',
  output: 'bg-[#66bb6a]',
  lookup: 'bg-[#ec407a]',
};

function getIncomingEdges(nodeId: string, edges: DagEdge[]) {
  return edges.filter((e) => e.target === nodeId);
}

function getOutgoingEdges(nodeId: string, edges: DagEdge[]) {
  return edges.filter((e) => e.source === nodeId);
}

// ── Edge compatibility rules ──
const VALID_TARGETS: Record<NodeKind, NodeKind[]> = {
  constant: ['formula', 'conditional', 'output'],
  formula: ['formula', 'conditional', 'output'],
  conditional: ['formula', 'conditional', 'output'],
  output: [],
  lookup: ['formula', 'conditional', 'output'],
};

function isConnectionCompatible(sourceKind: NodeKind, targetKind: NodeKind): boolean {
  return VALID_TARGETS[sourceKind]?.includes(targetKind) ?? false;
}

// ── Layout helpers ──
function assignLayoutPositions(nodes: DagNode[], edges: DagEdge[]) {
  // Preserve nodes that already have positions
  const positioned = new Set<string>();
  for (const n of nodes) {
    if (n.x != null && n.y != null) positioned.add(n.id);
  }

  // Build adjacency maps
  const incoming: Record<string, string[]> = {};
  const outgoing: Record<string, string[]> = {};
  for (const e of edges) {
    incoming[e.target] = incoming[e.target] || [];
    incoming[e.target].push(e.source);
    outgoing[e.source] = outgoing[e.source] || [];
    outgoing[e.source].push(e.target);
  }

  // Compute topological level (max distance from any root)
  const level: Record<string, number> = {};
  const computeLevel = (id: string, visited = new Set<string>()): number => {
    if (level[id] !== undefined) return level[id];
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);
    const preds = incoming[id] || [];
    if (preds.length === 0) {
      level[id] = 0;
      return 0;
    }
    const maxPred = Math.max(...preds.map((p) => computeLevel(p, new Set(visited))));
    level[id] = maxPred + 1;
    return level[id];
  };

  for (const n of nodes) computeLevel(n.id);

  // Group nodes by level
  const levelGroups: Record<number, DagNode[]> = {};
  let maxLevel = 0;
  for (const n of nodes) {
    if (positioned.has(n.id)) continue;
    const lv = level[n.id] ?? 0;
    levelGroups[lv] = levelGroups[lv] || [];
    levelGroups[lv].push(n);
    if (lv > maxLevel) maxLevel = lv;
  }

  // Assign positions per level
  const updatedNodes = nodes.map((node) => {
    if (positioned.has(node.id)) return node;
    const lv = level[node.id] ?? 0;
    const idxInLevel = levelGroups[lv].indexOf(node);
    return {
      ...node,
      x: 80 + lv * COL_GAP,
      y: 80 + idxInLevel * ROW_GAP,
    };
  });

  return updatedNodes;
}

// ── Main Page ──
export default function FormulaEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const store = useBlockEditorStore();
  const {
    graph,
    selectedNodeId,
    zoom,
    formulaName,
    formulaDescription,
    scopeKey,
    undoStack,
    redoStack,
    selectNode,
    setZoom,
    setGraph,
    setFormulaName,
    setFormulaDescription,
    updateNodeField,
    updateNodePosition,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    undo,
    redo,
    generateNodeId,
    reset,
  } = store;

  const [testInputs, setTestInputs] = useState<Record<string, any>>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [showNodeEditor, setShowNodeEditor] = useState(false);

  // Drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Edge drawing state
  const [drawingEdge, setDrawingEdge] = useState<{
    sourceId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Load scope
  const { data: scopeData, isLoading: scopeLoading } = useQuery({
    queryKey: queryKeys.loans.workbenchScopes,
    queryFn: () => dagService.listScopes(),
  });
  const scope = scopeData?.data?.scopes?.[0];

  // Load existing graphs
  const { data: graphsData, isLoading: graphsLoading } = useQuery({
    queryKey: queryKeys.dag.graphs(scopeKey),
    queryFn: () => dagService.listGraphs(scopeKey),
    enabled: !isNew && !!scopeKey,
  });

  // Detect if a loaded graph is the old format (pre-v2)
  const isLegacyGraph = useCallback((graph: any): boolean => {
    if (!graph || !Array.isArray(graph.nodes)) return false;
    // Old graphs had a conditional node for lateFeeMode with assertSupportedLateFeeMode
    const hasConditionalLateFee = graph.nodes.some(
      (n: any) => n.id === 'input_late_fee_mode' && n.kind === 'conditional'
    );
    const hasAssertFormula = graph.nodes.some(
      (n: any) => typeof n.formula === 'string' && n.formula.includes('assertSupportedLateFeeMode')
    );
    const hasNewNodes = graph.nodes.some(
      (n: any) => n.id === 'monthly_rate' || n.id === 'installment_amount'
    );
    return hasConditionalLateFee || hasAssertFormula || !hasNewNodes;
  }, []);

  // Initialize graph from scope default or existing
  useEffect(() => {
    if (!scope) return;

    if (isNew) {
      const defaultGraph = scope.defaultGraph;
      if (defaultGraph) {
            const withPositions = { ...defaultGraph, nodes: assignLayoutPositions(defaultGraph.nodes, defaultGraph.edges || []) };
        setGraph(JSON.parse(JSON.stringify(withPositions)));
        setFormulaName(scope.defaultName || 'Formula base de credito v2');
        setTestInputs(scope.simulationInput || {});
      }
    } else if (id && graphsData?.data?.graphs) {
      const existing = graphsData.data.graphs.find((g: any) => g.id === Number(id));
      if (existing?.graph) {
        if (isLegacyGraph(existing.graph)) {
          // Auto-migrate: replace old structure with the new default graph
          const defaultGraph = scope.defaultGraph;
          if (defaultGraph) {
        const withPositions = { ...defaultGraph, nodes: assignLayoutPositions(defaultGraph.nodes, defaultGraph.edges || []) };
            setGraph(JSON.parse(JSON.stringify(withPositions)));
            setFormulaName(existing.name || scope.defaultName || 'Formula base de credito v2');
            setFormulaDescription(existing.description || '');
            toast.info({
              description: 'La estructura de la formula fue actualizada automaticamente al nuevo formato v2. Guarda para persistir los cambios.',
            });
          }
        } else {
          const withPositions = { ...existing.graph, nodes: assignLayoutPositions(existing.graph.nodes, existing.graph.edges || []) };
          setGraph(JSON.parse(JSON.stringify(withPositions)));
          setFormulaName(existing.name || 'Formula');
          setFormulaDescription(existing.description || '');
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, graphsData, id, isNew]);

  useEffect(() => {
    return () => reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedNodeId) {
      setShowNodeEditor(true);
    }
  }, [selectedNodeId]);

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Ensure new nodes have positions
  const handleAddNode = (kind: NodeKind, presetFormula?: string) => {
    const newId = generateNodeId(kind);
    const usedPositions = new Set(nodes.map((n) => `${Math.round((n.x ?? 0) / 40)}:${Math.round((n.y ?? 0) / 40)}`));
    let x = 400;
    let y = 300;
    let attempts = 0;
    while (usedPositions.has(`${Math.round(x / 40)}:${Math.round(y / 40)}`) && attempts < 100) {
      x += 60;
      if (x > CANVAS_WIDTH - 300) { x = 100; y += 60; }
      attempts++;
    }

    const node: DagNode = {
      id: newId,
      kind,
      label: kindLabel[kind],
      outputVar: kind === 'output' ? 'result' : newId,
      formula: presetFormula || (kind === 'formula' ? 'roundCurrency()' : kind === 'conditional' ? 'if(condition, then, else)' : undefined),
      x,
      y,
    };
    addNode(node);
  };

  // ── Native DnD from toolbox ──
  const handleToolboxDragStart = (e: React.DragEvent, kind: NodeKind, preset?: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ kind, preset }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    try {
      const { kind, preset } = JSON.parse(data);
      if (kind) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          // Place near drop position, accounting for zoom
          const dropX = (e.clientX - rect.left) / zoom;
          const dropY = (e.clientY - rect.top) / zoom;
          const nodeKind = kind as NodeKind;
          const newId = generateNodeId(nodeKind);
          const node: DagNode = {
            id: newId,
            kind: nodeKind,
            label: kindLabel[nodeKind],
            outputVar: nodeKind === 'output' ? 'result' : newId,
            formula: preset || (nodeKind === 'formula' ? 'roundCurrency()' : nodeKind === 'conditional' ? 'if(condition, then, else)' : undefined),
            x: Math.round(dropX - NODE_WIDTH / 2),
            y: Math.round(dropY - 40),
          };
          addNode(node);
        }
      }
    } catch {
      // ignore invalid drop data
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // ── Drag handlers ──
  const handleNodeDragStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.x == null || node.y == null) return;
    setDraggingNodeId(nodeId);
    dragOffset.current = {
      x: e.clientX - node.x,
      y: e.clientY - node.y,
    };
  }, [nodes]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingNodeId) {
      const newX = (e.clientX - dragOffset.current.x) / zoom;
      const newY = (e.clientY - dragOffset.current.y) / zoom;
      updateNodePosition(draggingNodeId, Math.round(newX), Math.round(newY));
    }
    if (drawingEdge) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setDrawingEdge((prev) => prev ? {
          ...prev,
          endX: (e.clientX - rect.left) / zoom,
          endY: (e.clientY - rect.top) / zoom,
        } : null);
      }
    }
  }, [draggingNodeId, drawingEdge, zoom, updateNodePosition]);

  const handleCanvasMouseUp = useCallback(() => {
    setDraggingNodeId(null);
    if (drawingEdge) {
      setDrawingEdge(null);
    }
  }, [drawingEdge]);

  // ── Edge drawing ──
  const handleEdgeHandleClick = useCallback((nodeId: string, side: 'in' | 'out', e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.x == null || node.y == null) return;

    if (!drawingEdge) {
      if (side === 'out') {
        setDrawingEdge({
          sourceId: nodeId,
          startX: (node.x ?? 0) + NODE_WIDTH,
          startY: (node.y ?? 0) + 60,
          endX: (node.x ?? 0) + NODE_WIDTH,
          endY: (node.y ?? 0) + 60,
        });
      }
    } else {
      if (side === 'in' && drawingEdge.sourceId !== nodeId) {
        const sourceNode = nodes.find((n) => n.id === drawingEdge.sourceId);
        if (sourceNode && !isConnectionCompatible(sourceNode.kind, node.kind)) {
          toast.error({ description: `No se puede conectar ${kindLabel[sourceNode.kind]} a ${kindLabel[node.kind]}` });
        } else {
          addEdge({ source: drawingEdge.sourceId, target: nodeId });
        }
      }
      setDrawingEdge(null);
    }
  }, [drawingEdge, nodes, addEdge]);

  const handleCanvasClick = useCallback(() => {
    selectNode(null);
    setShowNodeEditor(false);
    if (drawingEdge) setDrawingEdge(null);
  }, [drawingEdge, selectNode]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (payload: any) => dagService.saveGraph(payload),
    onSuccess: () => {
      // eslint-disable-next-line no-console
      console.log('Formula guardada exitosamente');
    },
    onError: (err: any) => {
      // eslint-disable-next-line no-console
      console.error(err.message || 'Error al guardar');
    },
  });

  const handleSave = () => {
    if (!graph) return;
    saveMutation.mutate({
      scopeKey,
      name: formulaName,
      graph,
    });
  };

  const handleTest = async () => {
    if (!graph) return;
    setTestError(null);
    setTestResult(null);
    try {
      const response = await dagService.simulateGraph({
        scopeKey,
        graph,
        simulationInput: testInputs,
      });
      setTestResult(response?.data?.simulation || null);
    } catch (err: any) {
      setTestError(err.message || 'Error en prueba');
    }
  };

  const isLoading = scopeLoading || graphsLoading;

  // ── Toolbox items ──
  const operations = ['+', '-', '*', '/', '(', ')', '=', '>'];
  const logicBlocks = [
    { label: 'IF / THEN / ELSE', kind: 'conditional' as NodeKind, preset: 'if(condition, then, else)', icon: <GitBranch size={14} /> },
    { label: 'Formula', kind: 'formula' as NodeKind, preset: 'roundCurrency()', icon: <Equal size={14} /> },
    { label: 'Output', kind: 'output' as NodeKind, preset: undefined, icon: <Variable size={14} /> },
  ];

  // ── Render ──
  return (
    <div className="flex flex-col h-full select-none" style={{ backgroundColor: MD3.surface }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0 z-30" style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant }}>
        <button
          onClick={() => navigate('/formulas')}
          className="flex items-center gap-1 text-sm transition-colors hover:text-[#0b1c30]"
          style={{ color: MD3.onSurfaceVariant }}
        >
          <ChevronLeft size={16} />
          Volver
        </button>

        <input
          type="text"
          value={formulaName}
          onChange={(e) => setFormulaName(e.target.value)}
          className="flex-1 max-w-md px-3 py-1.5 rounded-lg border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#00668a]/30 focus:border-[#00668a]"
          style={{ backgroundColor: MD3.surface, borderColor: MD3.outlineVariant, color: MD3.onSurface }}
          placeholder="Nombre de la formula"
        />

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: MD3.onSurfaceVariant }}
            title="Deshacer"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: MD3.onSurfaceVariant }}
            title="Rehacer"
          >
            <Redo2 size={16} />
          </button>
          <div className="w-px h-5 mx-1" style={{ backgroundColor: MD3.outlineVariant }} />
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: MD3.onSurfaceVariant }}
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs w-10 text-center" style={{ color: MD3.onSurfaceVariant }}>{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: MD3.onSurfaceVariant }}
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-px h-5 mx-1" style={{ backgroundColor: MD3.outlineVariant }} />
          <button
            onClick={handleTest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors"
            style={{ borderColor: MD3.outlineVariant, color: MD3.onSurface }}
          >
            <Play size={14} />
            Probar
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: MD3.onSurface }}
          >
            <Save size={14} />
            {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbox */}
        <aside className="w-72 flex flex-col gap-4 p-4 border-r overflow-y-auto shrink-0 z-20" style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant }}>
          {/* Variables */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: MD3.onSurfaceVariant }}>
              Variables
            </h3>
            <div className="flex flex-col gap-1.5">
              {scope?.requiredInputs?.map((varName: string) => (
                <div
                  key={varName}
                  draggable
                  onDragStart={(e) => handleToolboxDragStart(e, 'constant')}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs border cursor-grab active:cursor-grabbing transition-colors"
                  style={{ backgroundColor: MD3.surface, borderColor: MD3.outlineVariant }}
                >
                  <GripVertical size={12} style={{ color: MD3.onSurfaceVariant }} />
                  <div className="w-2 h-2 rounded-full bg-[#42a5f5]" />
                  <span className="font-mono text-[#0b1c30]">{varName}</span>
                </div>
              ))}
              <button
                onClick={() => handleAddNode('constant')}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs border border-dashed transition-colors"
                style={{ borderColor: MD3.outline, color: MD3.onSurfaceVariant }}
              >
                <Plus size={12} /> Nueva constante
              </button>
            </div>
          </div>

          {/* Operations */}
          <div className="border-t pt-3" style={{ borderColor: MD3.outlineVariant }}>
            <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: MD3.onSurfaceVariant }}>
              Operations
            </h3>
            <div className="grid grid-cols-4 gap-1.5">
              {operations.map((op) => (
                <div
                  key={op}
                  draggable
                  onDragStart={(e) => handleToolboxDragStart(e, 'formula', op)}
                  className="flex items-center justify-center h-8 rounded-lg border text-xs font-bold font-mono cursor-grab active:cursor-grabbing transition-colors hover:border-[#00668a]"
                  style={{ backgroundColor: MD3.surface, borderColor: MD3.outlineVariant, color: MD3.onSurface }}
                >
                  {op}
                </div>
              ))}
            </div>
          </div>

          {/* Logic Blocks */}
          <div className="border-t pt-3" style={{ borderColor: MD3.outlineVariant }}>
            <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: MD3.onSurfaceVariant }}>
              Logic Blocks
            </h3>
            <div className="flex flex-col gap-1.5">
              {logicBlocks.map((block) => (
                <div
                  key={block.label}
                  draggable
                  onDragStart={(e) => handleToolboxDragStart(e, block.kind, block.preset)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs border cursor-grab active:cursor-grabbing transition-colors"
                  style={{ backgroundColor: '#f3e5f5', borderColor: '#ce93d8', color: '#4a148c' }}
                >
                  {block.icon}
                  <span>{block.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Helpers */}
          <div className="border-t pt-3" style={{ borderColor: MD3.outlineVariant }}>
            <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: MD3.onSurfaceVariant }}>
              Helpers
            </h3>
            <div className="flex flex-col gap-1.5">
              {scope?.helpers?.map((helper: any) => (
                <div
                  key={helper.name}
                  draggable
                  onDragStart={(e) => handleToolboxDragStart(e, 'formula', `${helper.name}()`)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs border cursor-grab active:cursor-grabbing transition-colors"
                  style={{ backgroundColor: '#fff8e1', borderColor: '#ffe082', color: '#5d4037' }}
                  title={helper.description}
                >
                  <FunctionSquare size={12} />
                  <span className="truncate">{helper.label || helper.name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <section
          className="flex-1 relative overflow-auto"
          style={{
            backgroundImage: 'radial-gradient(#c4c6cf 1px, transparent 1px)',
            backgroundSize: `${16 * zoom}px ${16 * zoom}px`,
          }}
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onClick={handleCanvasClick}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          {/* Floating toolbar */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-10 pointer-events-none">
            <div
              className="flex items-center gap-2 backdrop-blur border rounded-xl px-3 py-1.5 shadow-sm pointer-events-auto"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderColor: MD3.outlineVariant }}
            >
              <span className="font-semibold text-sm" style={{ color: MD3.onSurface }}>{formulaName}</span>
              <span
                className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm flex items-center gap-1"
                style={{ backgroundColor: MD3.secondaryContainer, color: MD3.onSecondaryContainer }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#00668a]" />
                DRAFT
              </span>
            </div>
            <div
              className="backdrop-blur border rounded-xl px-3 py-1.5 text-xs shadow-sm pointer-events-auto"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderColor: MD3.outlineVariant, color: MD3.onSurfaceVariant }}
            >
              {nodes.length} nodos · {edges.length} conexiones
            </div>
          </div>

          {/* Canvas content */}
          <div
            className="relative"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* SVG Edges layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              {edges.map((edge, idx) => {
                const src = nodes.find((n) => n.id === edge.source);
                const tgt = nodes.find((n) => n.id === edge.target);
                if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) return null;
                const x1 = (src.x ?? 0) + NODE_WIDTH;
                const y1 = (src.y ?? 0) + 60;
                const x2 = (tgt.x ?? 0);
                const y2 = (tgt.y ?? 0) + 60;
                return (
                  <g key={`${edge.source}-${edge.target}-${idx}`}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#94a3b8"
                      strokeWidth={2}
                      markerEnd="url(#arrowhead)"
                    />
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="transparent"
                      strokeWidth={12}
                      className="pointer-events-auto cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEdge(edge.source, edge.target);
                      }}
                    />
                  </g>
                );
              })}

              {drawingEdge && (
                <line
                  x1={drawingEdge.startX}
                  y1={drawingEdge.startY}
                  x2={drawingEdge.endX}
                  y2={drawingEdge.endY}
                  stroke="#00668a"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  markerEnd="url(#arrowhead-blue)"
                />
              )}

              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                </marker>
                <marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#00668a" />
                </marker>
              </defs>
            </svg>

            {/* Nodes */}
            {nodes.map((node) => (
              <VisualNodeBlock
                key={node.id}
                node={node}
                edges={edges}
                isSelected={selectedNodeId === node.id}
                onSelect={() => selectNode(node.id)}
                onDelete={(e) => {
                  e.stopPropagation();
                  removeNode(node.id);
                }}
                onDragStart={(e) => handleNodeDragStart(node.id, e)}
                onEdgeHandleClick={handleEdgeHandleClick}
              />
            ))}

            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm pointer-events-none" style={{ color: MD3.onSurfaceVariant }}>
                Arrastra bloques desde el panel izquierdo para empezar
              </div>
            )}
          </div>
        </section>

        {/* Right Panel: Properties + Live Test */}
        <aside className="w-80 flex flex-col gap-4 p-4 border-l overflow-y-auto shrink-0 z-20" style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant }}>
          {/* Properties Panel */}
          {selectedNode && (
            <div className="rounded-xl border p-4 flex flex-col gap-3" style={{ backgroundColor: MD3.surface, borderColor: MD3.outlineVariant }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${kindBadge[selectedNode.kind]}`}>
                    {kindLabel[selectedNode.kind]}
                  </span>
                  <span className="text-sm font-bold" style={{ color: MD3.onSurface }}>Propiedades</span>
                </div>
                <button
                  onClick={() => selectNode(null)}
                  className="text-[#5a6271] hover:text-[#ba1a1a]"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: MD3.onSurfaceVariant }}>ID</label>
                  <input
                    value={selectedNode.id}
                    onChange={(e) => updateNodeField(selectedNode.id, 'id', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none focus:border-[#00668a]"
                    style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant, color: MD3.onSurface }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: MD3.onSurfaceVariant }}>Label</label>
                  <input
                    value={selectedNode.label || ''}
                    onChange={(e) => updateNodeField(selectedNode.id, 'label', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none focus:border-[#00668a]"
                    style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant, color: MD3.onSurface }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: MD3.onSurfaceVariant }}>outputVar</label>
                  <input
                    value={selectedNode.outputVar || ''}
                    onChange={(e) => updateNodeField(selectedNode.id, 'outputVar', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none focus:border-[#00668a]"
                    style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant, color: MD3.onSurface }}
                  />
                </div>
                {['formula', 'conditional', 'output'].includes(selectedNode.kind) && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: MD3.onSurfaceVariant }}>Formula</label>
                    <textarea
                      value={selectedNode.formula || ''}
                      onChange={(e) => updateNodeField(selectedNode.id, 'formula', e.target.value)}
                      rows={3}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono border focus:outline-none focus:border-[#00668a] resize-none"
                      style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant, color: MD3.onSurface }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Play size={18} style={{ color: MD3.secondary }} />
            <h3 className="font-bold text-lg" style={{ color: MD3.onSurface }}>Live Test</h3>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: MD3.onSurfaceVariant }}>
              Input Values
            </h4>
            <div className="flex flex-col gap-3">
              {Object.entries(testInputs).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold flex justify-between" style={{ color: MD3.onSurface }}>
                    {key} <span className="text-[10px] font-mono" style={{ color: MD3.onSurfaceVariant }}>{typeof value === 'number' ? 'Decimal' : 'Str'}</span>
                  </label>
                  <input
                    type={typeof value === 'number' ? 'number' : 'text'}
                    value={value}
                    onChange={(e) => setTestInputs((prev) => ({ ...prev, [key]: typeof value === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none border focus:ring-1 transition-all"
                    style={{
                      backgroundColor: MD3.surface,
                      borderColor: MD3.outlineVariant,
                      color: MD3.onSurface,
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = MD3.secondary; e.currentTarget.style.boxShadow = `0 0 0 1px ${MD3.secondary}`; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = MD3.outlineVariant; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleTest}
            className="w-full rounded-lg py-2 font-semibold text-sm flex justify-center items-center gap-2 border transition-colors hover:bg-[#f8f9ff]"
            style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant, color: MD3.onSurface }}
          >
            <Play size={16} /> Evaluate Formula
          </button>

          {testError && (
            <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: MD3.errorContainer, color: MD3.error, border: `1px solid ${MD3.errorContainer}` }}>
              {testError}
            </div>
          )}

          {testResult && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: MD3.onSurfaceVariant }}>
                Execution Result
              </h4>
              <div className="rounded-lg p-4 relative overflow-hidden border" style={{ backgroundColor: MD3.surface, borderColor: MD3.outlineVariant }}>
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: MD3.success }} />
                <div className="flex justify-between items-center mb-2 pl-2">
                  <span className="text-sm font-semibold" style={{ color: MD3.onSurface }}>Result</span>
                  <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wide" style={{ backgroundColor: '#e8f5e9', color: '#1b5e20' }}>SUCCESS</span>
                </div>
                <pre className="text-xs font-mono overflow-auto max-h-48" style={{ color: MD3.onSurface }}>
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="w-full rounded-lg py-2.5 font-semibold text-sm flex justify-center items-center gap-2 text-white hover:opacity-90 transition-opacity disabled:opacity-50 mt-auto"
            style={{ backgroundColor: MD3.secondary }}
          >
            <Save size={16} />
            {saveMutation.isPending ? 'Guardando...' : 'Save Formula'}
          </button>
        </aside>
      </div>
    </div>
  );
}
