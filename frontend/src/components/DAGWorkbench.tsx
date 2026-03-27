import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Handle,
  Position,
  NodeProps,





  NodeTypes,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Save, 
  Play, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  AlertCircle,
  ChevronRight,
  Settings,
  FileText,
  Calculator,
  GitBranch,
  Hash,
  HelpCircle,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Undo,
  Redo,
  Loader2,
} from 'lucide-react';
import { useDagStore, AppNode, AppEdge, RFNodeData } from '../store/dagWorkbenchStore';
import type { DagWorkbenchState } from '../store/dagWorkbenchStore';
import type { NodeKind, DagNode, DAG_SCOPES } from '../types/dag';

// =============================================================================
// CUSTOM NODE COMPONENT
// =============================================================================

const nodeKindConfig: Record<NodeKind, { color: string; icon: React.ReactNode; label: string }> = {
  formula: { 
    color: 'bg-blue-500 ', 
    icon: <Calculator size={14} />, 
    label: 'Fórmula' 
  },
  output: { 
    color: 'bg-emerald-500 ', 
    icon: <FileText size={14} />, 
    label: 'Salida' 
  },
  constant: { 
    color: 'bg-amber-500 ', 
    icon: <Hash size={14} />, 
    label: 'Constante' 
  },
  conditional: { 
    color: 'bg-purple-500 ', 
    icon: <GitBranch size={14} />, 
    label: 'Condicional' 
  },
  lookup: { 
    color: 'bg-rose-500 ', 
    icon: <Search size={14} />, 
    label: 'Búsqueda' 
  },
};

const DagNodeComponent = ({ data, selected }: any) => {
  const config = nodeKindConfig[data.kind as NodeKind] || nodeKindConfig.formula;
  
  return (
    <div
      className={`
        min-w-[180px] max-w-[220px] rounded-lg border-2 shadow-lg overflow-hidden
        ${selected 
          ? 'border-blue-500 ring-2 ring-blue-300 ' 
          : 'border-border-subtle '
        }
        bg-bg-surface 
      `}
    >
      {/* Header */}
      <div className={`${config.color} text-white px-3 py-1.5 flex items-center gap-2`}>
        <span className="flex-shrink-0">{config.icon}</span>
        <span className="text-xs font-medium truncate flex-1">{data.label || config.label}</span>
        <span className="text-[10px] opacity-80 uppercase">{data.kind}</span>
      </div>
      
      {/* Body */}
      <div className="px-3 py-2">
        {data.description && (
          <p className="text-[10px] text-text-secondary  mb-1.5 line-clamp-2">
            {data.description}
          </p>
        )}
        {data.formula && (
          <code className="text-[9px] bg-bg-base  px-1.5 py-0.5 rounded block truncate">
            {data.formula}
          </code>
        )}
      </div>
      
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-gray-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-gray-400"
      />
    </div>
  );
};

const nodeTypes: NodeTypes = {
  dagNode: DagNodeComponent,
};

// =============================================================================
// NODE PALETTE (Drag to add)
// =============================================================================

interface NodePaletteProps {
  onAddNode: (kind: NodeKind) => void;
}

const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  const kinds: NodeKind[] = ['formula', 'output', 'constant', 'conditional', 'lookup'];
  
  return (
    <div className="bg-bg-surface  rounded-lg border border-border-subtle p-3">
      <h4 className="text-xs font-semibold text-text-secondary  mb-2">
        AGREGAR NODOS
      </h4>
      <div className="space-y-1.5">
        {kinds.map((kind) => {
          const config = nodeKindConfig[kind];
          return (
            <button
              key={kind}
              onClick={() => onAddNode(kind)}
              className="
                w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md
                bg-bg-base hover:bg-hover-bg
                border border-transparent hover:border-border-subtle
                transition-all text-left
              "
            >
              <span className={`${config.color} text-white p-1 rounded text-[10px]`}>
                {config.icon}
              </span>
              <span className="text-xs font-medium">{config.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// PROPERTIES PANEL
// =============================================================================

interface PropertiesPanelProps {
  selectedNode: AppNode | null;
  onUpdateNode: (id: string, data: Partial<RFNodeData>) => void;
  onDeleteNode: (id: string) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
}) => {
  if (!selectedNode) {
    return (
      <div className="bg-bg-surface  rounded-lg border border-border-subtle p-4">
        <p className="text-xs text-text-secondary  text-center">
          Selecciona un nodo para ver sus propiedades
        </p>
      </div>
    );
  }
  
  const { data, id } = selectedNode;
  
  return (
    <div className="bg-bg-surface  rounded-lg border border-border-subtle overflow-hidden">
      <div className="px-3 py-2 border-b border-border-subtle bg-bg-base ">
        <h4 className="text-xs font-semibold">PROPIEDADES</h4>
      </div>
      
      <div className="p-3 space-y-3">
        {/* Kind Badge */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-secondary ">Tipo</span>
          <span className={`
            px-2 py-0.5 rounded text-[10px] font-medium text-white
            ${nodeKindConfig[data.kind as NodeKind]?.color || 'bg-gray-500'}
          `}>
            {nodeKindConfig[data.kind as NodeKind]?.label || data.kind}
          </span>
        </div>
        
        {/* Label */}
        <div>
          <label className="block text-[10px] text-text-secondary  mb-1">
            Etiqueta
          </label>
          <input
            type="text"
            value={data.label}
            onChange={(e) => onUpdateNode(id, { label: e.target.value })}
            className="
              w-full text-xs px-2 py-1.5 rounded border
              bg-bg-base  border-border-subtle 
              text-text-primary 
              focus:outline-none focus:ring-1 focus:ring-blue-500
            "
            placeholder="Nombre del nodo..."
          />
        </div>
        
        {/* Description */}
        <div>
          <label className="block text-[10px] text-text-secondary  mb-1">
            Descripción
          </label>
          <textarea
            value={data.description}
            onChange={(e) => onUpdateNode(id, { description: e.target.value })}
            rows={2}
            className="
              w-full text-xs px-2 py-1.5 rounded border resize-none
              bg-bg-base  border-border-subtle 
              text-text-primary 
              focus:outline-none focus:ring-1 focus:ring-blue-500
            "
            placeholder="Descripción del nodo..."
          />
        </div>
        
        {/* Formula */}
        {data.kind === 'formula' && (
          <div>
            <label className="block text-[10px] text-text-secondary  mb-1">
              Fórmula
            </label>
            <textarea
              value={data.formula}
              onChange={(e) => onUpdateNode(id, { formula: e.target.value })}
              rows={3}
              className="
                w-full text-[10px] font-mono px-2 py-1.5 rounded border resize-none
                bg-bg-base  border-border-subtle 
                text-text-primary 
                focus:outline-none focus:ring-1 focus:ring-blue-500
              "
              placeholder="input.amount * rate"
            />
          </div>
        )}
        
        {/* Output Variable */}
        {data.kind === 'output' && (
          <div>
            <label className="block text-[10px] text-text-secondary  mb-1">
              Variable de Salida
            </label>
            <input
              type="text"
              value={data.outputVar}
              onChange={(e) => onUpdateNode(id, { outputVar: e.target.value })}
              className="
                w-full text-xs px-2 py-1.5 rounded border font-mono
                bg-bg-base  border-border-subtle 
                text-text-primary 
                focus:outline-none focus:ring-1 focus:ring-blue-500
              "
              placeholder="result"
            />
          </div>
        )}
        
        {/* Dependencies Info */}
        <div>
          <label className="block text-[10px] text-text-secondary  mb-1">
            Dependencias
          </label>
          <div className="text-[10px] font-mono text-text-secondary  bg-bg-base  px-2 py-1.5 rounded border border-border-subtle ">
            {((data.metadata?.dependencies as string[]) || []).length 
              ? ((data.metadata?.dependencies as string[]) || []).join(' → ') 
              : '(ninguna)'}
          </div>
        </div>
        
        {/* Delete Button */}
        <button
          onClick={() => onDeleteNode(id)}
          className="
            w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded
            bg-red-500/10 hover:bg-red-500/20 text-red-500
            border border-red-500/20 hover:border-red-500/30
            transition-colors text-xs font-medium
          "
        >
          <Trash2 size={12} />
          Eliminar Nodo
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// VALIDATION PANEL
// =============================================================================

interface ValidationPanelProps {
  validation: DagWorkbenchState['validation'];
  isValidating: boolean;
  onValidate: () => void;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({
  validation,
  isValidating,
  onValidate,
}) => {
  return (
    <div className="bg-bg-surface  rounded-lg border border-border-subtle overflow-hidden">
      <button
        onClick={onValidate}
        disabled={isValidating}
        className="
          w-full px-3 py-2 flex items-center justify-between
          border-b border-border-subtle
          hover:bg-hover-bg
          transition-colors
        "
      >
        <span className="text-xs font-semibold">VALIDACIÓN</span>
        {isValidating ? (
          <Loader2 size={14} className="animate-spin text-blue-500" />
        ) : validation ? (
          validation.valid ? (
            <Check size={14} className="text-emerald-500" />
          ) : (
            <X size={14} className="text-red-500" />
          )
        ) : (
          <AlertCircle size={14} className="text-text-secondary" />
        )}
      </button>
      
      {validation && (
        <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
          {validation.errors.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-red-500">Errores:</span>
              {validation.errors.map((err, i) => (
                <div key={i} className="text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded">
                  {err.field}: {err.message}
                </div>
              ))}
            </div>
          )}
          
          {validation.warnings.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-amber-500">Advertencias:</span>
              {validation.warnings.map((warn, i) => (
                <div key={i} className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                  {warn.field}: {warn.message}
                </div>
              ))}
            </div>
          )}
          
          {validation.valid && validation.errors.length === 0 && (
            <div className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
              ✓ Grafo válido
            </div>
          )}
          
          <div className="pt-1 border-t border-border-subtle">
            <div className="text-[10px] text-text-secondary  grid grid-cols-2 gap-1">
              <span>Nodos:</span> <span className="font-medium">{validation.summary.nodeCount}</span>
              <span>Edges:</span> <span className="font-medium">{validation.summary.edgeCount}</span>
              <span>Outputs:</span> <span className="font-medium">{validation.summary.outputCount}</span>
              <span>Fórmulas:</span> <span className="font-medium">{validation.summary.formulaNodeCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// SIMULATION PANEL
// =============================================================================

interface SimulationPanelProps {
  simulationInput: DagWorkbenchState['simulationInput'];
  simulationResult: DagWorkbenchState['simulationResult'];
  isSimulating: boolean;
  error: string | null;
  onSetSimulationInput: (input: Partial<DagWorkbenchState['simulationInput']>) => void;
  onSimulate: () => void;
}

const SimulationPanel: React.FC<SimulationPanelProps> = ({
  simulationInput,
  simulationResult,
  isSimulating,
  error,
  onSetSimulationInput,
  onSimulate,
}) => {
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value);
  
  return (
    <div className="bg-bg-surface  rounded-lg border border-border-subtle overflow-hidden">
      <button
        onClick={onSimulate}
        disabled={isSimulating}
        className="
          w-full px-3 py-2 flex items-center justify-between
          border-b border-border-subtle
          hover:bg-hover-bg
          transition-colors
        "
      >
        <span className="text-xs font-semibold">SIMULACIÓN</span>
        {isSimulating ? (
          <Loader2 size={14} className="animate-spin text-blue-500" />
        ) : simulationResult ? (
          <Check size={14} className="text-emerald-500" />
        ) : (
          <Play size={14} className="text-text-secondary" />
        )}
      </button>
      
      <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
        {error && (
          <div className="text-[10px] text-red-400 bg-red-500/10 px-2 py-1.5 rounded border border-red-500/20">
            {error}
          </div>
        )}
        
        {/* Input Fields */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-text-secondary  mb-1">
              Monto
            </label>
            <input
              type="number"
              value={simulationInput.amount}
              onChange={(e) => onSetSimulationInput({ amount: Number(e.target.value) })}
              className="
                w-full text-xs px-2 py-1.5 rounded border font-mono
                bg-bg-base  border-border-subtle 
                text-text-primary 
                focus:outline-none focus:ring-1 focus:ring-blue-500
              "
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-secondary  mb-1">
              Tasa (%)
            </label>
            <input
              type="number"
              value={simulationInput.interestRate}
              onChange={(e) => onSetSimulationInput({ interestRate: Number(e.target.value) })}
              className="
                w-full text-xs px-2 py-1.5 rounded border font-mono
                bg-bg-base  border-border-subtle 
                text-text-primary 
                focus:outline-none focus:ring-1 focus:ring-blue-500
              "
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-secondary  mb-1">
              Plazo (meses)
            </label>
            <input
              type="number"
              value={simulationInput.termMonths}
              onChange={(e) => onSetSimulationInput({ termMonths: Number(e.target.value) })}
              className="
                w-full text-xs px-2 py-1.5 rounded border font-mono
                bg-bg-base  border-border-subtle 
                text-text-primary 
                focus:outline-none focus:ring-1 focus:ring-blue-500
              "
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-secondary  mb-1">
              Modo Mora
            </label>
            <select
              value={simulationInput.lateFeeMode}
              onChange={(e) => onSetSimulationInput({ lateFeeMode: e.target.value as any })}
              className="
                w-full text-xs px-2 py-1.5 rounded border
                bg-bg-base  border-border-subtle 
                text-text-primary 
                focus:outline-none focus:ring-1 focus:ring-blue-500
              "
            >
              <option value="SIMPLE">SIMPLE</option>
              <option value="FLAT">FLAT</option>
              <option value="TIERED">TIERED</option>
            </select>
          </div>
        </div>
        
        {/* Results */}
        {simulationResult && (
          <div className="space-y-2 pt-2 border-t border-border-subtle">
            <span className="text-[10px] font-semibold text-emerald-500">RESULTADOS</span>
            
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <span className="text-text-secondary ">Cuota:</span>
              <span className="font-semibold text-blue-500">
                {formatCurrency(simulationResult.summary.installmentAmount)}
              </span>
              
              <span className="text-text-secondary ">Total Intereses:</span>
              <span className="font-semibold text-amber-500">
                {formatCurrency(simulationResult.summary.totalInterest)}
              </span>
              
              <span className="text-text-secondary ">Total a Pagar:</span>
              <span className="font-semibold">
                {formatCurrency(simulationResult.summary.totalPayable)}
              </span>
            </div>
            
            {/* Schedule Preview */}
            {simulationResult.schedule.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] font-semibold text-text-secondary  block mb-1">
                  PRIMERAS 3 CUOTAS
                </span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {simulationResult.schedule.slice(0, 3).map((row) => (
                    <div 
                      key={row.installmentNumber}
                      className="text-[9px] bg-bg-base  px-2 py-1 rounded font-mono"
                    >
                      #{row.installmentNumber}: {formatCurrency(row.scheduledPayment)} 
                      (Cap: {formatCurrency(row.principalComponent)} / Int: {formatCurrency(row.interestComponent)})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN WORKBENCH COMPONENT
// =============================================================================

const DAGWorkbenchContent: React.FC = () => {
  const {
    nodes,
    edges,
    selectedNodeId,
    scopeKey,
    graphName,
    isLoading,
    isSaving,
    isSimulating,
    error,
    validation,
    simulationInput,
    simulationResult,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodeId,
    setGraphName,
    loadGraph,
    validateGraph,
    saveGraph,
    simulateGraph,
    setSimulationInput,
  } = useDagStore();

  const [rightPanel, setRightPanel] = useState<'properties' | 'validation' | 'simulation'>('properties');
  const [showScopeSelect, setShowScopeSelect] = useState(false);

  // Auto-load default graph on mount
  useEffect(() => {
    loadGraph(scopeKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const handleAddNode = useCallback((kind: NodeKind) => {
    const id = `${kind}_${Date.now()}`;
    const label = nodeKindConfig[kind]?.label || kind;
    const newNode: AppNode = {
      id,
      type: 'dagNode',
      position: { 
        x: 100 + Math.random() * 200, 
        y: 100 + Math.random() * 200 
      },
      data: {
        id,
        kind,
        label: `Nuevo ${label}`,
        description: '',
        formula: kind === 'formula' ? '' : '',
        outputVar: kind === 'output' ? 'result' : '',
        metadata: {},
        onNodeChange: () => {},
      },
    };
    
    useDagStore.setState((state) => ({
      nodes: [...state.nodes, newNode],
    }));
  }, []);

  const handleUpdateNode = useCallback((id: string, data: Partial<RFNodeData>) => {
    useDagStore.setState((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }));
  }, []);

  const handleDeleteNode = useCallback((id: string) => {
    useDagStore.setState((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    }));
  }, []);

  const handleSave = useCallback(async () => {
    await saveGraph(graphName);
  }, [saveGraph, graphName]);

  const scopes = [
    { key: 'credit-simulation', label: 'Simulación de Crédito' },
    { key: 'payment-calculation', label: 'Cálculo de Pagos' },
    { key: 'late-fee-calculation', label: 'Cálculo de Mora' },
    { key: 'amortization', label: 'Amortización' },
  ];

  return (
    <div className="h-full flex flex-col bg-bg-base ">
      {/* Header Toolbar */}
      <div className="flex-shrink-0 px-4 py-2 bg-bg-surface  border-b border-border-subtle flex items-center gap-3">
        {/* Scope Selector */}
        <div className="relative">
          <button
            onClick={() => setShowScopeSelect(!showScopeSelect)}
            className="
              flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
              bg-bg-base border border-border-subtle
              hover:bg-hover-bg
            "
          >
            <Settings size={12} />
            {scopes.find(s => s.key === scopeKey)?.label || scopeKey}
            <ChevronRight size={12} className={`transition-transform ${showScopeSelect ? 'rotate-90' : ''}`} />
          </button>
          
          {showScopeSelect && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-bg-surface  border border-border-subtle  rounded-lg shadow-xl z-50">
              {scopes.map((scope) => (
                <button
                  key={scope.key}
                  onClick={() => {
                    loadGraph(scope.key);
                    setShowScopeSelect(false);
                  }}
                  className={`
                    w-full text-left px-3 py-2 text-xs
                    hover:bg-hover-bg :bg-gray-700
                    ${scope.key === scopeKey ? 'text-blue-500 font-semibold' : 'text-text-primary '}
                  `}
                >
                  {scope.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Graph Name */}
        <input
          type="text"
          value={graphName}
          onChange={(e) => setGraphName(e.target.value)}
          className="
            flex-1 max-w-xs text-xs px-2 py-1.5 rounded border
            bg-bg-base  border-border-subtle 
            text-text-primary 
            focus:outline-none focus:ring-1 focus:ring-blue-500
          "
        />

        <div className="flex-1" />

        {/* Action Buttons */}
        <button
          onClick={() => validateGraph()}
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
            bg-bg-base  border border-border-subtle 
            hover:bg-hover-bg :bg-gray-600
          "
        >
          <AlertCircle size={12} />
          Validar
        </button>
        
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
            bg-blue-500 hover:bg-blue-600 text-white
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Guardar
        </button>
        
        <button
          onClick={() => simulateGraph()}
          disabled={isSimulating || !validation?.valid}
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
            bg-emerald-500 hover:bg-emerald-600 text-white
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {isSimulating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Simular
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
          <AlertCircle size={14} className="text-red-500" />
          <span className="text-xs text-red-400">{error}</span>
          <button 
            onClick={() => useDagStore.setState({ error: null })}
            className="ml-auto p-1 hover:bg-red-500/20 rounded"
          >
            <X size={12} className="text-red-400" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Node Palette */}
        <div className="w-48 flex-shrink-0 p-3 border-r border-border-subtle overflow-y-auto">
          <NodePalette onAddNode={handleAddNode} />
          
          {/* Node count info */}
          <div className="mt-4 text-[10px] text-text-secondary  space-y-1">
            <div>Nodos: {nodes.length}</div>
            <div>Edges: {edges.length}</div>
            {graphName && <div>Versión: {useDagStore.getState().graphVersion?.version || 'Nueva'}</div>}
          </div>
        </div>

        {/* Canvas - React Flow */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-base/80  z-10">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : (
            <ReactFlow
              nodes={nodes as any}
              edges={edges as any}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              nodeTypes={nodeTypes}
              fitView
              className=""
              defaultEdgeOptions={{
                animated: true,
                style: { strokeWidth: 2 },
              }}
            >
              <Background color="#9ca3af" size={1} />
              <Controls />
              <MiniMap 
                nodeColor={(node) => {
                  const kind = (node.data as any)?.kind as NodeKind;
                  const colorMap: Record<NodeKind, string> = {
                    formula: '#3b82f6',
                    output: '#10b981',
                    constant: '#f59e0b',
                    conditional: '#a855f7',
                    lookup: '#f43f5e',
                  };
                  return colorMap[kind] || '#6b7280';
                }}
                maskColor="rgba(0,0,0,0.5)"
              />
            </ReactFlow>
          )}
        </div>

        {/* Right Panel - Properties/Validation/Simulation */}
        <div className="w-72 flex-shrink-0 flex flex-col border-l border-border-subtle">
          {/* Tab Switcher */}
          <div className="flex-shrink-0 flex border-b border-border-subtle">
            {(['properties', 'validation', 'simulation'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightPanel(tab)}
                className={`
                  flex-1 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide
                  transition-colors border-b-2
                  ${rightPanel === tab
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-text-secondary hover:text-text-primary '
                  }
                `}
              >
                {tab === 'properties' && 'Props'}
                {tab === 'validation' && 'Validar'}
                {tab === 'simulation' && 'Simular'}
              </button>
            ))}
          </div>
          
          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {rightPanel === 'properties' && (
              <PropertiesPanel
                selectedNode={selectedNode}
                onUpdateNode={handleUpdateNode}
                onDeleteNode={handleDeleteNode}
              />
            )}
            
            {rightPanel === 'validation' && (
              <ValidationPanel
                validation={validation}
                isValidating={false}
                onValidate={() => validateGraph()}
              />
            )}
            
            {rightPanel === 'simulation' && (
              <SimulationPanel
                simulationInput={simulationInput}
                simulationResult={simulationResult}
                isSimulating={isSimulating}
                error={error}
                onSetSimulationInput={setSimulationInput}
                onSimulate={() => simulateGraph()}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// WRAPPER WITH PROVIDER
// =============================================================================

const DAGWorkbench: React.FC = () => {
  return (
    <ReactFlowProvider>
      <DAGWorkbenchContent />
    </ReactFlowProvider>
  );
};

export default DAGWorkbench;
