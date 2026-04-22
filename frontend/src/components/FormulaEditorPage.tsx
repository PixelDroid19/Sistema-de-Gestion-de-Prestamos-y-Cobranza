import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Save, Play, ChevronLeft,
  Plus, Trash2, X, Variable, Equal, GitBranch,
  FunctionSquare,
} from 'lucide-react';
import { useBlockEditorStore } from '../store/blockEditorStore';
import { dagService } from '../services/dagService';
import { queryKeys } from '../services/queryKeys';
import type { DagNode, DagEdge, NodeKind } from '../types/dag';

// ── Constants ──
const CANVAS_WIDTH = 2400;
const CANVAS_HEIGHT = 1600;
const NODE_WIDTH = 260;
const NODE_HEIGHT = 120;

// ── Helpers ──
const kindLabel: Record<NodeKind, string> = {
  constant: 'Constante',
  formula: 'Fórmula',
  conditional: 'Condicional',
  output: 'Output',
  lookup: 'Lookup',
};

const kindColor: Record<NodeKind, string> = {
  constant: 'bg-sky-50 border-sky-300 text-sky-900',
  formula: 'bg-amber-50 border-amber-300 text-amber-900',
  conditional: 'bg-violet-50 border-violet-300 text-violet-900',
  output: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  lookup: 'bg-rose-50 border-rose-300 text-rose-900',
};

const kindBadge: Record<NodeKind, string> = {
  constant: 'bg-sky-200 text-sky-800',
  formula: 'bg-amber-200 text-amber-800',
  conditional: 'bg-violet-200 text-violet-800',
  output: 'bg-emerald-200 text-emerald-800',
  lookup: 'bg-rose-200 text-rose-800',
};

const kindHandle: Record<NodeKind, string> = {
  constant: 'bg-sky-500',
  formula: 'bg-amber-500',
  conditional: 'bg-violet-500',
  output: 'bg-emerald-500',
  lookup: 'bg-rose-500',
};

function getIncomingEdges(nodeId: string, edges: DagEdge[]) {
  return edges.filter((e) => e.target === nodeId);
}

function getOutgoingEdges(nodeId: string, edges: DagEdge[]) {
  return edges.filter((e) => e.source === nodeId);
}

// ── Visual Formula Parser ──
type TokenType = 'action' | 'keyword' | 'variable' | 'operator' | 'value';
interface VisualToken { type: TokenType; text: string }

function buildHelperLabelMap(helpers: Array<{ name: string; label?: string }> = []): Record<string, string> {
  const map: Record<string, string> = {};
  helpers.forEach((h) => {
    if (h.name) map[h.name] = h.label || h.name;
  });
  return map;
}

function splitTopLevel(str: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of str) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === delimiter && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseExpression(expr: string): VisualToken[] {
  const tokens: VisualToken[] = [];
  const compMatch = expr.match(/^(.+?)\s*(>=|<=|>|<|=|!=)\s*(.+)$/);
  if (compMatch) {
    tokens.push(makeOperandToken(compMatch[1].trim()));
    tokens.push({ type: 'operator', text: compMatch[2] });
    tokens.push(makeOperandToken(compMatch[3].trim()));
    return tokens;
  }
  tokens.push(makeOperandToken(expr.trim()));
  return tokens;
}

function makeOperandToken(text: string): VisualToken {
  if (text.match(/^-?\d+\.?\d*$/)) return { type: 'value', text };
  if (text === 'true' || text === 'false') return { type: 'value', text: text === 'true' ? 'Sí' : 'No' };
  return { type: 'variable', text };
}

function parseFormulaVisual(formula: string, helperLabelMap: Record<string, string> = {}): VisualToken[] {
  if (!formula) return [];
  const f = formula.trim();

  const helperMatch = f.match(/^(\w+)\((.*)\)$/);
  if (helperMatch) {
    const [, name] = helperMatch;
    const friendly = helperLabelMap[name];
    if (friendly) return [{ type: 'action', text: friendly }];
  }

  const ifMatch = f.match(/^if(?:ThenElse)?\((.*)\)$/i);
  if (ifMatch) {
    const parts = splitTopLevel(ifMatch[1], ',');
    if (parts.length >= 3) {
      const tokens: VisualToken[] = [{ type: 'keyword', text: 'IF' }];
      tokens.push(...parseExpression(parts[0]));
      tokens.push({ type: 'keyword', text: 'THEN' });
      tokens.push(...parseExpression(parts[1]));
      tokens.push({ type: 'keyword', text: 'ELSE' });
      tokens.push(...parseExpression(parts[2]));
      return tokens;
    }
  }

  return parseExpression(f);
}

function VisualChip({ type, text }: { type: string; text: string }) {
  const styles: Record<string, string> = {
    action: 'bg-amber-100 text-amber-800 border-amber-200 font-medium',
    keyword: 'bg-violet-100 text-violet-800 border-violet-200 font-bold uppercase tracking-wide',
    variable: 'bg-sky-50 text-sky-700 border-sky-200',
    operator: 'bg-slate-100 text-slate-700 border-slate-200 font-bold',
    value: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-mono font-medium',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs border ${styles[type] || styles.variable}`}>
      {type === 'variable' && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mr-1.5" />}
      {text}
    </span>
  );
}

// ── Layout helpers ──
function assignLayoutPositions(nodes: DagNode[]) {
  const columns: Record<string, number> = { constant: 0, conditional: 1, formula: 2, output: 3, lookup: 2 };
  const colCount = [0, 0, 0, 0];
  return nodes.map((node) => {
    if (node.x != null && node.y != null) return node;
    const col = columns[node.kind] ?? 2;
    const row = colCount[col];
    colCount[col] += 1;
    return {
      ...node,
      x: 100 + col * 320,
      y: 100 + row * 160,
    };
  });
}

// ── Node Card ──
function NodeCard({
  node,
  edges,
  isSelected,
  onSelect,
  onDelete,
  helperLabelMap,
  onDragStart,
  onEdgeHandleClick,
}: {
  node: DagNode;
  edges: DagEdge[];
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  helperLabelMap: Record<string, string>;
  onDragStart: (e: React.MouseEvent) => void;
  onEdgeHandleClick: (nodeId: string, side: 'in' | 'out', e: React.MouseEvent) => void;
}) {
  const incoming = getIncomingEdges(node.id, edges);
  const outgoing = getOutgoingEdges(node.id, edges);
  const visualTokens = parseFormulaVisual(node.formula || '', helperLabelMap);

  return (
    <div
      className={`
        absolute w-[${NODE_WIDTH}px] rounded-xl border shadow-sm cursor-default select-none transition-shadow
        ${kindColor[node.kind]}
        ${isSelected ? 'ring-2 ring-offset-2 ring-sky-400 shadow-lg' : 'hover:shadow-md'}
      `}
      style={{ left: node.x ?? 0, top: node.y ?? 0, width: NODE_WIDTH }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Header — draggable area */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing"
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${kindBadge[node.kind]}`}>
            {kindLabel[node.kind]}
          </span>
          <span className="text-sm font-semibold truncate">{node.label || node.id}</span>
        </div>
        <button
          onClick={onDelete}
          className="text-slate-400 hover:text-red-500 transition-colors p-0.5 shrink-0"
          title="Eliminar nodo"
        >
          <X size={13} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 pb-3">
        {visualTokens.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 bg-white/60 border border-black/5 rounded-md px-2 py-1.5">
            {visualTokens.map((token, idx) => (
              <VisualChip key={idx} type={token.type} text={token.text} />
            ))}
          </div>
        )}

        {visualTokens.length === 0 && node.kind === 'constant' && (
          <div className="text-[10px] text-slate-400 italic">
            Variable: {node.outputVar}
          </div>
        )}
      </div>

      {/* Edge count badge */}
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] text-slate-400 whitespace-nowrap">
        {incoming.length > 0 && <span>{incoming.length} in</span>}
        {outgoing.length > 0 && <span>{outgoing.length} out</span>}
      </div>

      {/* Input handle (left) */}
      <button
        className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow ${kindHandle[node.kind]} hover:scale-125 transition-transform z-20`}
        onMouseDown={(e) => {
          e.stopPropagation();
          onEdgeHandleClick(node.id, 'in', e);
        }}
        title="Conectar entrada"
      />

      {/* Output handle (right) */}
      <button
        className={`absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow ${kindHandle[node.kind]} hover:scale-125 transition-transform z-20`}
        onMouseDown={(e) => {
          e.stopPropagation();
          onEdgeHandleClick(node.id, 'out', e);
        }}
        title="Conectar salida"
      />
    </div>
  );
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

  const helperLabelMap = React.useMemo(() => buildHelperLabelMap(scope?.helpers || []), [scope?.helpers]);

  // Initialize graph from scope default or existing
  useEffect(() => {
    if (!scope) return;

    if (isNew) {
      const defaultGraph = scope.defaultGraph;
      if (defaultGraph) {
        const withPositions = { ...defaultGraph, nodes: assignLayoutPositions(defaultGraph.nodes) };
        setGraph(JSON.parse(JSON.stringify(withPositions)));
        setFormulaName(scope.defaultName || 'Nueva formula');
        setTestInputs(scope.simulationInput || {});
      }
    } else if (id && graphsData?.data?.graphs) {
      const existing = graphsData.data.graphs.find((g: any) => g.id === Number(id));
      if (existing?.graph) {
        const withPositions = { ...existing.graph, nodes: assignLayoutPositions(existing.graph.nodes) };
        setGraph(JSON.parse(JSON.stringify(withPositions)));
        setFormulaName(existing.name || 'Formula');
        setFormulaDescription(existing.description || '');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, graphsData, id, isNew]);

  useEffect(() => {
    return () => reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Ensure new nodes have positions
  const handleAddNode = (kind: NodeKind) => {
    const newId = generateNodeId(kind);
    // Find a free spot near center
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
      formula: kind === 'formula' ? 'roundCurrency()' : kind === 'conditional' ? 'if(condition, then, else)' : undefined,
      x,
      y,
    };
    addNode(node);
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
      // Cancel if not completed
      setDrawingEdge(null);
    }
  }, [drawingEdge]);

  // ── Edge drawing ──
  const handleEdgeHandleClick = useCallback((nodeId: string, side: 'in' | 'out', e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.x == null || node.y == null) return;

    if (!drawingEdge) {
      // Start drawing from output
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
      // Complete drawing at input
      if (side === 'in' && drawingEdge.sourceId !== nodeId) {
        addEdge({ source: drawingEdge.sourceId, target: nodeId });
      }
      setDrawingEdge(null);
    }
  }, [drawingEdge, nodes, addEdge]);

  // Click on canvas cancels edge drawing
  const handleCanvasClick = useCallback(() => {
    selectNode(null);
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

  // ── Render ──
  return (
    <div className="flex flex-col h-full bg-slate-50 select-none">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200 bg-white shrink-0 z-30">
        <button
          onClick={() => navigate('/formulas')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={16} />
          Volver
        </button>

        <input
          type="text"
          value={formulaName}
          onChange={(e) => setFormulaName(e.target.value)}
          className="flex-1 max-w-md px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
          placeholder="Nombre de la formula"
        />

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-30"
            title="Deshacer"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-30"
            title="Rehacer"
          >
            <Redo2 size={16} />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button
            onClick={handleTest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <Play size={14} />
            Probar
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbox */}
        <aside className="w-64 flex flex-col gap-4 p-4 bg-white border-r border-slate-200 overflow-y-auto shrink-0 z-20">
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Variables
            </h3>
            <div className="flex flex-col gap-1.5">
              {scope?.requiredInputs?.map((varName: string) => (
                <button
                  key={varName}
                  onClick={() => handleAddNode('constant')}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 hover:border-sky-400 transition-colors text-left"
                >
                  <div className="w-2 h-2 rounded-full bg-sky-500" />
                  <span className="font-mono text-slate-700">{varName}</span>
                </button>
              ))}
              <button
                onClick={() => handleAddNode('constant')}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs bg-slate-50 border border-dashed border-slate-200 hover:border-sky-400 transition-colors text-slate-400"
              >
                <Plus size={12} /> Nueva constante
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Logic Blocks
            </h3>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => handleAddNode('conditional')}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 transition-colors"
              >
                <GitBranch size={12} /> IF / THEN / ELSE
              </button>
              <button
                onClick={() => handleAddNode('formula')}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 hover:border-sky-400 transition-colors"
              >
                <Equal size={12} /> Fórmula
              </button>
              <button
                onClick={() => handleAddNode('output')}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <Variable size={12} /> Output
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Helpers
            </h3>
            <div className="flex flex-col gap-1.5">
              {scope?.helpers?.map((helper: any) => (
                <button
                  key={helper.name}
                  onClick={() => handleAddNode('formula')}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors text-left"
                  title={helper.description}
                >
                  <FunctionSquare size={12} />
                  <span className="truncate">{helper.label || helper.name}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <section
          className="flex-1 relative overflow-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)]"
          style={{ backgroundSize: `${20 * zoom}px ${20 * zoom}px` }}
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onClick={handleCanvasClick}
        >
          {/* Floating info bar */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-10 pointer-events-none">
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm pointer-events-auto">
              <span className="font-medium text-sm text-slate-800">{formulaName}</span>
              <span className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                DRAFT
              </span>
            </div>
            <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-500 shadow-sm pointer-events-auto">
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
              {/* Existing edges */}
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
                    {/* Invisible hit area for delete */}
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

              {/* Drawing edge */}
              {drawingEdge && (
                <line
                  x1={drawingEdge.startX}
                  y1={drawingEdge.startY}
                  x2={drawingEdge.endX}
                  y2={drawingEdge.endY}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  markerEnd="url(#arrowhead-blue)"
                />
              )}

              {/* Arrow markers */}
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                </marker>
                <marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                </marker>
              </defs>
            </svg>

            {/* Nodes */}
            {nodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                edges={edges}
                isSelected={selectedNodeId === node.id}
                onSelect={() => selectNode(node.id)}
                onDelete={(e) => {
                  e.stopPropagation();
                  removeNode(node.id);
                }}
                helperLabelMap={helperLabelMap}
                onDragStart={(e) => handleNodeDragStart(node.id, e)}
                onEdgeHandleClick={handleEdgeHandleClick}
              />
            ))}

            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none">
                Agrega nodos desde el panel izquierdo para empezar
              </div>
            )}
          </div>
        </section>

        {/* Right Panel */}
        <aside className="w-80 flex flex-col gap-4 p-4 bg-white border-l border-slate-200 overflow-y-auto shrink-0 z-20">
          {selectedNode ? (
            <>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${kindBadge[selectedNode.kind]}`}>
                    {kindLabel[selectedNode.kind]}
                  </span>
                  <h3 className="font-bold text-slate-800 text-lg">Propiedades</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">ID</label>
                    <input
                      value={selectedNode.id}
                      onChange={(e) => updateNodeField(selectedNode.id, 'id', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Label</label>
                    <input
                      value={selectedNode.label || ''}
                      onChange={(e) => updateNodeField(selectedNode.id, 'label', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">outputVar</label>
                    <input
                      value={selectedNode.outputVar || ''}
                      onChange={(e) => updateNodeField(selectedNode.id, 'outputVar', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {['formula', 'conditional', 'output'].includes(selectedNode.kind) && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Formula</label>
                      <textarea
                        value={selectedNode.formula || ''}
                        onChange={(e) => updateNodeField(selectedNode.id, 'formula', e.target.value)}
                        rows={3}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs font-mono text-slate-700 focus:outline-none focus:border-sky-500 resize-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Descripción</label>
                    <textarea
                      value={selectedNode.description || ''}
                      onChange={(e) => updateNodeField(selectedNode.id, 'description', e.target.value)}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:border-sky-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Posición</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={selectedNode.x ?? 0}
                        onChange={(e) => updateNodePosition(selectedNode.id, Number(e.target.value), selectedNode.y ?? 0)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-sky-500"
                        placeholder="X"
                      />
                      <input
                        type="number"
                        value={selectedNode.y ?? 0}
                        onChange={(e) => updateNodePosition(selectedNode.id, selectedNode.x ?? 0, Number(e.target.value))}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-sky-500"
                        placeholder="Y"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Play size={18} className="text-sky-600" />
                <h3 className="font-bold text-slate-800 text-lg">Live Test</h3>
              </div>

              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Input Values
                </h4>
                <div className="flex flex-col gap-3">
                  {Object.entries(testInputs).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-slate-700 flex justify-between">
                        {key} <span className="text-[10px] text-slate-400 font-mono">{typeof value === 'number' ? 'Num' : 'Str'}</span>
                      </label>
                      <input
                        type={typeof value === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={(e) => setTestInputs((prev) => ({ ...prev, [key]: typeof value === 'number' ? Number(e.target.value) : e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleTest}
                className="w-full bg-white border border-slate-200 text-slate-700 rounded-lg py-2 font-medium text-sm flex justify-center items-center gap-2 hover:bg-slate-50 transition-colors"
              >
                <Play size={16} /> Evaluate Formula
              </button>

              {testError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs">
                  {testError}
                </div>
              )}

              {testResult && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Execution Result
                  </h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                    <div className="flex justify-between items-center mb-2 pl-2">
                      <span className="text-sm font-medium text-slate-800">Result</span>
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wide">SUCCESS</span>
                    </div>
                    <pre className="text-xs font-mono text-slate-700 overflow-auto max-h-48">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Grafo actual
                </h4>
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Scope:</span>
                    <span className="font-medium">{scope?.label || scopeKey}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Nodos:</span>
                    <span className="font-mono">{nodes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Edges:</span>
                    <span className="font-mono">{edges.length}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
