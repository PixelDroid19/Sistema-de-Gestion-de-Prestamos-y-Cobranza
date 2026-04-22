import React, { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Undo2, Redo2, ZoomIn, ZoomOut, Save, ChevronLeft, Loader2, Play, Plus, Trash2, Link, X } from 'lucide-react';
import { useBlockEditorStore } from '../store/blockEditorStore';
import { dagService } from '../services/dagService';
import { queryKeys } from '../services/queryKeys';
import { getScopeLabel, DagNode, DagEdge } from '../types/dag';
import { toast } from '../lib/toast';

const MINIMAL_DEFAULT_GRAPH = {
  nodes: [
    { id: 'amount', kind: 'constant' as const, label: 'Monto', outputVar: 'amount' },
    { id: 'interestRate', kind: 'constant' as const, label: 'Tasa', outputVar: 'interestRate' },
    { id: 'termMonths', kind: 'constant' as const, label: 'Plazo', outputVar: 'termMonths' },
    { id: 'schedule', kind: 'formula' as const, label: 'Cronograma', outputVar: 'schedule', formula: 'buildAmortizationSchedule(amount, interestRate, termMonths, startDate, lateFeeMode)' },
    { id: 'summary', kind: 'formula' as const, label: 'Resumen', outputVar: 'summary', formula: 'summarizeSchedule(schedule)' },
    { id: 'result', kind: 'output' as const, label: 'Resultado', outputVar: 'result', formula: 'buildSimulationResult(lateFeeMode, schedule, summary)' },
  ],
  edges: [
    { source: 'amount', target: 'schedule' },
    { source: 'interestRate', target: 'schedule' },
    { source: 'termMonths', target: 'schedule' },
    { source: 'schedule', target: 'summary' },
    { source: 'schedule', target: 'result' },
    { source: 'summary', target: 'result' },
  ],
};

export default function FormulaEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const {
    graph,
    selectedNodeId,
    zoom,
    formulaName,
    formulaDescription,
    status,
    scopeKey,
    isLoading: storeLoading,
    error: storeError,
    setGraph,
    updateNodeFormula,
    updateNodeField,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    selectNode,
    setZoom,
    setFormulaName,
    setFormulaDescription,
    setStatus,
    setScopeKey,
    setLoading,
    setError,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    generateNodeId,
  } = useBlockEditorStore();

  const [edgeSource, setEdgeSource] = useState<string>('');
  const [edgeTarget, setEdgeTarget] = useState<string>('');
  const [showAddNode, setShowAddNode] = useState(false);

  // Load scope definition
  const { data: scopeData, isLoading: scopeLoading } = useQuery({
    queryKey: queryKeys.loans.workbenchScopes,
    queryFn: () => dagService.listScopes(),
  });

  const scope = scopeData?.data?.scopes?.find((s: any) => s.key === scopeKey);
  const defaultGraph = scope?.defaultGraph;
  const helpers = scope?.helpers || [];
  const requiredInputs = scope?.requiredInputs || [];

  // Load active graph version
  const { data: graphsData, isLoading: graphLoading } = useQuery({
    queryKey: queryKeys.dag.graphs(scopeKey),
    queryFn: () => dagService.listGraphs(scopeKey),
    enabled: !!scopeKey,
  });

  // Reset store when formula id changes
  useEffect(() => {
    reset();
  }, [id, reset]);

  // Initialize graph from scope or existing version
  useEffect(() => {
    if (graph) return; // Don't re-init if already loaded

    if (isNew) {
      const initialGraph = defaultGraph
        ? JSON.parse(JSON.stringify(defaultGraph))
        : JSON.parse(JSON.stringify(MINIMAL_DEFAULT_GRAPH));
      setGraph(initialGraph);
      setFormulaName(scope?.defaultName || 'Nueva formula');
    } else if (!isNew && id && graphsData) {
      const graphs = graphsData?.data?.graphs || [];
      const existing = graphs.find((g: any) => g.id === Number(id));
      if (existing?.graph) {
        setGraph(JSON.parse(JSON.stringify(existing.graph)));
        setFormulaName(existing.name || '');
        setFormulaDescription(existing.description || '');
        setStatus(existing.status || 'draft');
      }
    }
  }, [isNew, id, defaultGraph, graphsData, scope, graph, setGraph, setFormulaName, setFormulaDescription, setStatus]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (payload: any) => dagService.saveGraph(payload),
    onSuccess: () => {
      toast.success({ description: 'Formula guardada exitosamente' });
    },
    onError: (err: any) => {
      setError(err.message || 'Error al guardar');
      toast.error({ description: err.message || 'Error al guardar' });
    },
  });

  // Simulate mutation
  const simulateMutation = useMutation({
    mutationFn: (payload: any) => dagService.simulateGraph(payload),
    onSuccess: (data) => {
      toast.success({ description: `Prueba exitosa!` });
    },
    onError: (err: any) => {
      toast.error({ description: `Error en prueba: ${err.message}` });
    },
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    }
  }, [undo, redo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSave = async () => {
    if (!graph) return;

    const payload = {
      scopeKey,
      name: formulaName,
      graph,
    };

    saveMutation.mutate(payload);
  };

  const handleSimulate = async () => {
    if (!graph || !scope) return;

    const simulationInput = scope.simulationInput || { amount: 2000000, interestRate: 60, termMonths: 12, lateFeeMode: 'SIMPLE' };

    simulateMutation.mutate({
      scopeKey,
      graph,
      simulationInput,
    });
  };

  const handleAddNode = (kind: DagNode['kind']) => {
    const prefix = kind === 'constant' ? 'input' : kind;
    const nodeId = generateNodeId(prefix);
    const newNode: DagNode = {
      id: nodeId,
      kind,
      label: nodeId,
      outputVar: kind === 'output' ? 'result' : nodeId,
    };
    if (kind === 'formula' || kind === 'conditional' || kind === 'output') {
      newNode.formula = '';
    }
    addNode(newNode);
    setShowAddNode(false);
    selectNode(nodeId);
  };

  const handleAddEdge = () => {
    if (!edgeSource || !edgeTarget || edgeSource === edgeTarget) return;
    if (graph?.edges.find((e: DagEdge) => e.source === edgeSource && e.target === edgeTarget)) return;
    addEdge({ source: edgeSource, target: edgeTarget });
    setEdgeSource('');
    setEdgeTarget('');
  };

  const handleDeleteNode = (nodeId: string) => {
    removeNode(nodeId);
  };

  const selectedNode = graph?.nodes.find((n: DagNode) => n.id === selectedNodeId);

  if (graphLoading || storeLoading || scopeLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-brand-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border-subtle bg-bg-surface">
        <button
          onClick={() => navigate('/formulas')}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={16} />
          Volver
        </button>

        <input
          type="text"
          value={formulaName}
          onChange={(e) => setFormulaName(e.target.value)}
          className="flex-1 max-w-md px-3 py-1.5 rounded-lg border border-border-subtle bg-bg-base text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          placeholder="Nombre de la formula"
        />

        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {status === 'active' ? 'ACTIVA' : 'BORRADOR'}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={undo}
            disabled={!canUndo()}
            title="Deshacer (Ctrl+Z)"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors disabled:opacity-30"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            title="Rehacer (Ctrl+Shift+Z)"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors disabled:opacity-30"
          >
            <Redo2 size={16} />
          </button>
          <div className="w-px h-5 bg-border-subtle mx-1" />
          <button
            onClick={() => setZoom(zoom - 0.1)}
            title="Alejar"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-text-secondary w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(zoom + 0.1)}
            title="Acercar"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-px h-5 bg-border-subtle mx-1" />
          <button
            onClick={handleSimulate}
            disabled={!graph || simulateMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors disabled:opacity-50"
          >
            <Play size={14} />
            Probar
          </button>
          <button
            onClick={handleSave}
            disabled={!graph || saveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Error message */}
      {storeError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          Error: {storeError}
        </div>
      )}

      {/* 3-Pane Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Variables, Helpers, Add Node */}
        <div className="w-64 flex flex-col gap-4 p-4 bg-bg-surface border-r border-border-subtle overflow-y-auto">
          <div>
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-2">Variables de entrada</h3>
            <div className="flex flex-col gap-1">
              {requiredInputs.map((input: string) => (
                <div key={input} className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                  {input}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-2">Funciones disponibles</h3>
            <div className="flex flex-col gap-1">
              {helpers.map((helper: any) => (
                <div key={helper.name} className="px-2 py-1 rounded bg-purple-50 border border-purple-200 text-purple-700 text-xs">
                  <span className="font-semibold">{helper.name}</span>
                  <p className="text-[10px] text-purple-600 mt-0.5">{helper.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border-subtle pt-3">
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-2">Agregar nodo</h3>
            <div className="flex flex-col gap-1.5">
              <button onClick={() => handleAddNode('constant')} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                <Plus size={12} /> Constante / Input
              </button>
              <button onClick={() => handleAddNode('formula')} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors">
                <Plus size={12} /> Formula
              </button>
              <button onClick={() => handleAddNode('conditional')} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                <Plus size={12} /> Condicional
              </button>
              <button onClick={() => handleAddNode('output')} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                <Plus size={12} /> Output
              </button>
            </div>
          </div>

          <div className="border-t border-border-subtle pt-3">
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-2">Conectar nodos</h3>
            <div className="flex flex-col gap-1.5">
              <select
                value={edgeSource}
                onChange={(e) => setEdgeSource(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-border-subtle bg-bg-base text-xs text-text-primary"
              >
                <option value="">Desde nodo...</option>
                {graph?.nodes.map((n: DagNode) => (
                  <option key={n.id} value={n.id}>{n.label || n.id}</option>
                ))}
              </select>
              <select
                value={edgeTarget}
                onChange={(e) => setEdgeTarget(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-border-subtle bg-bg-base text-xs text-text-primary"
              >
                <option value="">Hacia nodo...</option>
                {graph?.nodes.map((n: DagNode) => (
                  <option key={n.id} value={n.id}>{n.label || n.id}</option>
                ))}
              </select>
              <button
                onClick={handleAddEdge}
                disabled={!edgeSource || !edgeTarget || edgeSource === edgeTarget}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-40"
              >
                <Link size={12} /> Crear conexion
              </button>
            </div>
          </div>
        </div>

        {/* Center: Graph Canvas */}
        <div className="flex-1 relative overflow-auto bg-bg-base">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            }}
          />
          <div className="relative min-h-full p-6 flex flex-col gap-3" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            {graph?.nodes.map((node: DagNode) => (
              <div
                key={node.id}
                onClick={() => selectNode(node.id === selectedNodeId ? null : node.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedNodeId === node.id
                    ? 'border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/20'
                    : 'border-border-subtle bg-bg-surface hover:border-border-strong'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    node.kind === 'constant' ? 'bg-blue-100 text-blue-700' :
                    node.kind === 'formula' ? 'bg-purple-100 text-purple-700' :
                    node.kind === 'conditional' ? 'bg-amber-100 text-amber-700' :
                    node.kind === 'output' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {node.kind}
                  </span>
                  <span className="text-sm font-semibold text-text-primary">{node.label || node.id}</span>
                  {node.outputVar && (
                    <span className="text-xs text-text-secondary font-mono">→ {node.outputVar}</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                    className="ml-auto p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Eliminar nodo"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {node.description && (
                  <p className="text-xs text-text-secondary mb-2">{node.description}</p>
                )}

                {node.formula && (
                  <div className="mt-2">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Formula</label>
                    {selectedNodeId === node.id ? (
                      <textarea
                        value={node.formula}
                        onChange={(e) => updateNodeFormula(node.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full mt-1 px-2 py-1.5 rounded-lg border border-border-subtle bg-bg-base text-xs font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-y"
                        rows={3}
                      />
                    ) : (
                      <code className="block mt-1 px-2 py-1.5 rounded bg-bg-base border border-border-subtle text-xs font-mono text-text-primary break-all">
                        {node.formula}
                      </code>
                    )}
                  </div>
                )}

                {/* Show outgoing edges */}
                {graph.edges.filter((e: DagEdge) => e.source === node.id).length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-text-secondary">
                    <span>Conexiones a:</span>
                    {graph.edges
                      .filter((e: DagEdge) => e.source === node.id)
                      .map((e: DagEdge) => {
                        const target = graph.nodes.find((n: DagNode) => n.id === e.target);
                        return (
                          <span key={e.target} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-base border border-border-subtle">
                            {target?.label || e.target}
                            <button
                              onClick={(ev) => { ev.stopPropagation(); removeEdge(node.id, e.target); }}
                              className="text-red-400 hover:text-red-600"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        );
                      })}
                  </div>
                )}
              </div>
            ))}

            {!graph && (
              <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
                Cargando grafo...
              </div>
            )}
          </div>
        </div>

        {/* Right: Node Details / Properties */}
        <div className="w-72 flex flex-col gap-4 p-4 bg-bg-surface border-l border-border-subtle overflow-y-auto">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            {selectedNode ? 'Propiedades del nodo' : 'Detalles'}
          </h3>

          {selectedNode ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">ID</label>
                <input
                  type="text"
                  value={selectedNode.id}
                  onChange={(e) => updateNodeField(selectedNode.id, 'id', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg border border-border-subtle bg-bg-base text-xs font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Tipo</label>
                <select
                  value={selectedNode.kind}
                  onChange={(e) => updateNodeField(selectedNode.id, 'kind', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg border border-border-subtle bg-bg-base text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                >
                  <option value="constant">Constante / Input</option>
                  <option value="formula">Formula</option>
                  <option value="conditional">Condicional</option>
                  <option value="output">Output</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Etiqueta</label>
                <input
                  type="text"
                  value={selectedNode.label || ''}
                  onChange={(e) => updateNodeField(selectedNode.id, 'label', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg border border-border-subtle bg-bg-base text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Variable de salida</label>
                <input
                  type="text"
                  value={selectedNode.outputVar || ''}
                  onChange={(e) => updateNodeField(selectedNode.id, 'outputVar', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg border border-border-subtle bg-bg-base text-xs font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>

              {selectedNode.formula !== undefined && (
                <div>
                  <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Formula</label>
                  <textarea
                    value={selectedNode.formula}
                    onChange={(e) => updateNodeFormula(selectedNode.id, e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 rounded-lg border border-border-subtle bg-bg-base text-xs font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-y"
                    rows={4}
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Descripcion</label>
                <textarea
                  value={selectedNode.description || ''}
                  onChange={(e) => updateNodeField(selectedNode.id, 'description', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg border border-border-subtle bg-bg-base text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-y"
                  rows={2}
                />
              </div>

              <button
                onClick={() => handleDeleteNode(selectedNode.id)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-xs text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={12} />
                Eliminar nodo
              </button>
            </div>
          ) : (
            <div className="text-sm text-text-secondary">
              <p>Selecciona un nodo del grafo para ver y editar sus propiedades.</p>

              <div className="mt-4 p-3 rounded-lg bg-bg-base border border-border-subtle">
                <h4 className="text-xs font-semibold text-text-primary mb-2">Grafo actual</h4>
                <div className="space-y-1 text-xs text-text-secondary">
                  <p>Nodos: {graph?.nodes.length || 0}</p>
                  <p>Edges: {graph?.edges.length || 0}</p>
                  <p>Scope: {getScopeLabel(scopeKey)}</p>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-bg-base border border-border-subtle">
                <h4 className="text-xs font-semibold text-text-primary mb-2">Ayuda</h4>
                <ul className="space-y-1 text-xs text-text-secondary list-disc list-inside">
                  <li>Usa el panel izquierdo para agregar nodos</li>
                  <li>Clic en un nodo para seleccionarlo</li>
                  <li>Edita propiedades en el panel derecho</li>
                  <li>Usa &quot;Conectar nodos&quot; para crear edges</li>
                  <li>Usa &quot;Probar&quot; para simular</li>
                  <li>Guarda para crear una version</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
