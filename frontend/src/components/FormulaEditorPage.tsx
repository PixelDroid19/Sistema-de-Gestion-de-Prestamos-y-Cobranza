import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Save, Play, ChevronLeft,
  Plus, GripVertical, GitBranch, Trash2, Power, LockKeyhole,
  ShieldCheck, ArrowRight, CheckCircle2, ListChecks, SlidersHorizontal,
} from 'lucide-react';
import { useBlockEditorStore, generateBlockId } from '../store/blockEditorStore';
import { dagService } from '../services/dagService';
import { variableService } from '../services/variableService';
import { queryKeys } from '../services/queryKeys';
import { toast } from '../lib/toast';
import { FormulaContainerBlock } from './LogicBlock';
import { decompileGraphToContainers } from '../lib/blockCompiler';
import type { BlockDefinition, FormulaContainer, BlockKind, DagVariable } from '../types/dag';
import {
  FORMULA_FLOW_STEPS,
  FORMULA_INPUT_OPTIONS,
  FORMULA_TARGET_OPTIONS,
  LATE_FEE_MODE_OPTIONS,
  getFormulaTargetKind,
  getFormulaValueLabel,
  getFormulaVariableLabel,
  getInputKindLabel,
  normalizeModeValue,
} from '../lib/formulaDisplay';

const MD3 = {
  surface: '#f8f9ff', onSurface: '#0b1c30', onSurfaceVariant: '#5a6271',
  secondary: '#00668a', secondaryContainer: '#cce5f3', onSecondaryContainer: '#00344a',
  outline: '#c4c6cf', outlineVariant: '#dee1ea', error: '#ba1a1a',
  keywordBg: '#e2dfff', keywordBorder: '#c3c0ff', keywordText: '#0f0069',
} as const;

const sty = {
  aside: { width: 280, backgroundColor: '#fff', borderRight: `1px solid ${MD3.outlineVariant}`, display: 'flex' as const, flexDirection: 'column' as const, overflow: 'auto' as const, flexShrink: 0, padding: 16, gap: 16 },
  canvas: { flex: 1, overflow: 'auto' as const, backgroundImage: `radial-gradient(${MD3.outline} 1px, transparent 1px)`, backgroundSize: '16px 16px', position: 'relative' as const, minHeight: 0 },
  right: { width: 320, backgroundColor: '#fff', borderLeft: `1px solid ${MD3.outlineVariant}`, display: 'flex' as const, flexDirection: 'column' as const, overflow: 'auto' as const, flexShrink: 0 },
  toolbar: { display: 'flex' as const, alignItems: 'center' as const, gap: 12, padding: '8px 16px', borderBottom: `1px solid ${MD3.outlineVariant}`, backgroundColor: '#fff', flexShrink: 0, zIndex: 30 },
  heading: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: MD3.onSurfaceVariant, marginBottom: 8 },
  dragItem: { display: 'flex' as const, alignItems: 'center' as const, gap: 8, padding: '6px 8px', borderRadius: 6, border: `1px solid ${MD3.outlineVariant}`, backgroundColor: MD3.surface, cursor: 'grab' as const, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: MD3.onSurface, fontWeight: 500 },
  logicDrag: { display: 'flex' as const, alignItems: 'center' as const, gap: 8, padding: '6px 8px', borderRadius: 6, border: `1px solid ${MD3.keywordBorder}`, backgroundColor: MD3.keywordBg, cursor: 'grab' as const, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: MD3.keywordText, fontWeight: 700 },
  opBtn: { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, height: 32, borderRadius: 6, border: `1px solid ${MD3.outlineVariant}`, backgroundColor: MD3.surface, cursor: 'grab' as const, fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: MD3.onSurface },
  btn: (bg: string, fg: string) => ({ display: 'flex' as const, alignItems: 'center' as const, gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', backgroundColor: bg, color: fg, fontSize: 13, fontWeight: 600, cursor: 'pointer' as const }),
  input: { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${MD3.outlineVariant}`, backgroundColor: MD3.surface, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: MD3.onSurface, outline: 'none' },
};

function getDefaultValueForTarget(outputVar = 'lateFeeMode'): string {
  if (outputVar === 'lateFeeMode') return 'SIMPLE';
  if (outputVar === 'interestRate') return '60';
  if (outputVar === 'termMonths') return '12';
  if (outputVar === 'installmentAmount') return '200000';
  return '0';
}

function getDefaultElseValueForTarget(outputVar = 'lateFeeMode'): string {
  if (outputVar === 'lateFeeMode') return 'NONE';
  if (outputVar === 'interestRate') return 'interestRate';
  if (outputVar === 'termMonths') return 'termMonths';
  return '0';
}

function makeBlock(kind: BlockKind, outputVar = 'lateFeeMode'): BlockDefinition {
  const id = generateBlockId(kind);
  if (kind === 'if') return { id, kind, condition: { variable: 'amount', operator: '>', value: '1000000' }, thenValue: getDefaultValueForTarget(outputVar) };
  if (kind === 'elseIf') return { id, kind, condition: { variable: 'amount', operator: '>', value: '500000' }, thenValue: getDefaultValueForTarget(outputVar) };
  if (kind === 'else') return { id, kind, elseValue: getDefaultElseValueForTarget(outputVar) };
  return { id, kind, label: 'expression' };
}

function createDefaultContainer(label = 'Regla principal'): FormulaContainer {
  return {
    id: generateBlockId('container'),
    label,
    blocks: [],
    outputVar: 'lateFeeMode',
  };
}

function createDefaultContainerForTarget(outputVar = 'lateFeeMode'): FormulaContainer {
  const option = FORMULA_TARGET_OPTIONS.find((item) => item.key === outputVar);
  const container: FormulaContainer = {
    id: generateBlockId(`container_${outputVar}`),
    label: option?.label || 'Regla de credito',
    outputVar,
    blocks: [makeBlock('if', outputVar)],
  };

  if (outputVar === 'interestRate' || outputVar === 'termMonths') {
    container.blocks.push({
      id: generateBlockId('else'),
      kind: 'else',
      elseValue: getDefaultElseValueForTarget(outputVar),
    });
  }

  return container;
}

export default function FormulaEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === 'new';
  const store = useBlockEditorStore();
  const { containers, selectedBlockId, zoom, formulaName, scopeKey } = store;

  const [testInputs, setTestInputs] = useState<Record<string, any>>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);

  const { data: scopeData } = useQuery({ queryKey: queryKeys.loans.workbenchScopes, queryFn: () => dagService.listScopes() });
  const scope = scopeData?.data?.scopes?.[0];
  const { data: variableData } = useQuery({
    queryKey: queryKeys.variables.list({ status: 'active', page: 1, pageSize: 100 }),
    queryFn: () => variableService.list({ status: 'active', page: 1, pageSize: 100 }),
  });
  const customVariables: DagVariable[] = variableData?.data?.variables ?? [];

  // Load existing graph by ID
  const { data: existingGraphData } = useQuery({
    queryKey: ['dag.graphDetails', id],
    queryFn: () => dagService.getGraphDetails(Number(id)),
    enabled: !isNew && !!id,
  });

  const existingGraph = existingGraphData?.data?.graph || null;
  const usageCount = Number(existingGraph?.usageCount || 0);
  const isLockedByCredits = Boolean(existingGraph?.isLocked || usageCount > 0);
  const isActiveVersion = existingGraph?.status === 'active';

  // Init
  useEffect(() => {
    if (!scope) return;
    if (isNew) {
      // New formula: start with one empty container
      const baseContainer: FormulaContainer = {
        id: 'base',
        label: 'Regla principal',
        blocks: [],
        outputVar: 'lateFeeMode',
      };
      store.setContainers([baseContainer]);
      setSelectedContainerId(baseContainer.id);
      store.setFormulaName(scope.defaultName || 'Nueva formula');
      setTestInputs(scope.calculationInput || scope.simulationInput || {});
    } else if (existingGraphData?.data?.graph) {
      const existing = existingGraphData.data.graph;
      if (existing.graph) {
        const c = decompileGraphToContainers(existing.graph);
        const fallbackContainer: FormulaContainer = {
          id: 'base',
          label: 'Regla principal',
          blocks: [],
          outputVar: 'lateFeeMode',
        };
        const nextContainers = c.length > 0 ? c : [fallbackContainer];
        store.setContainers(nextContainers);
        setSelectedContainerId(nextContainers[0]?.id || null);
        store.setFormulaName(existing.name || 'Formula');
        store.setFormulaDescription(existing.description || '');
        store.setStatus(existing.status || 'inactive');
      }
      setTestInputs(scope.calculationInput || scope.simulationInput || {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, existingGraphData, id, isNew]);

  useEffect(() => { return () => store.reset(); }, []);// eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (containers.length === 0) {
      setSelectedContainerId(null);
      return;
    }

    setSelectedContainerId((currentId) => {
      if (currentId && containers.some((container) => container.id === currentId)) {
        return currentId;
      }
      return containers[0].id;
    });
  }, [containers]);

  const saveMutation = useMutation({ mutationFn: (payload: any) => dagService.saveGraph(payload) });

  const activateMutation = useMutation({
    mutationFn: ({ graphId, status }: { graphId: number; status: 'active' | 'inactive' }) =>
      dagService.updateGraphStatus(graphId, status),
  });

  const persistGraph = async ({ activate }: { activate: boolean }) => {
    try {
      const graph = store.compileGraph();
      const saveResult = await saveMutation.mutateAsync({ scopeKey, name: formulaName, graph });
      const savedGraph = saveResult?.data?.graph || saveResult?.data?.graphVersion;

      if (activate && savedGraph?.id) {
        await activateMutation.mutateAsync({ graphId: Number(savedGraph.id), status: 'active' });
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.dag.graphs(scopeKey) });
      await queryClient.invalidateQueries({ queryKey: ['dag.graphDetails', id] });
      await queryClient.invalidateQueries({ queryKey: ['dag.graphDetails', String(savedGraph?.id)] });

      toast.success({
        description: activate
          ? 'Nueva version guardada y activada para creditos nuevos'
          : 'Nueva version guardada como borrador',
      });

      if (savedGraph?.id) {
        navigate(`/formulas/${savedGraph.id}`, { replace: true });
      }
    } catch (err: any) {
      toast.error({ description: err.message || 'Error al guardar formula' });
    }
  };

  const isSaving = saveMutation.isPending || activateMutation.isPending;

  const handleTest = async () => {
    setTestError(null); setTestResult(null);
    try {
      const graph = store.compileGraph();
      const res = await dagService.calculateGraph({ scopeKey, graph, calculationInput: testInputs });
      setTestResult(res?.data?.calculation || res?.data?.simulation || null);
    } catch (err: any) { setTestError(err.message || 'Error en prueba'); }
  };

  const handleAddContainer = () => {
    const c = createDefaultContainer('Nuevo bloque de formula');
    store.addContainer(c);
    setSelectedContainerId(c.id);
    store.selectBlock(null);
  };

  const handleAddTargetRule = (outputVar: string) => {
    const existing = containers.find((container) => container.outputVar === outputVar);
    if (existing) {
      setSelectedContainerId(existing.id);
      store.selectBlock(null);
      return;
    }

    const container = createDefaultContainerForTarget(outputVar);
    store.addContainer(container);
    setSelectedContainerId(container.id);
    store.selectBlock(container.blocks[0]?.id || null);
  };

  const handleAddBlock = (kind: BlockKind, preferredContainerId?: string) => {
    let targetContainerId = preferredContainerId || selectedContainerId || containers[0]?.id;

    if (!targetContainerId) {
      const fallbackContainer = createDefaultContainer();
      store.addContainer(fallbackContainer);
      targetContainerId = fallbackContainer.id;
      setSelectedContainerId(targetContainerId);
    }

    const targetContainer = store.containers.find((container) => container.id === targetContainerId);
    store.addBlock(targetContainerId, makeBlock(kind, targetContainer?.outputVar));
    setSelectedContainerId(targetContainerId);
  };

  const handleDeleteBlock = (containerId: string, blockId: string) => {
    store.removeBlock(containerId, blockId);
  };

  const handleUpdateContainerOutput = (container: FormulaContainer, outputVar: string) => {
    const currentKind = getFormulaTargetKind(container.outputVar);
    const nextKind = getFormulaTargetKind(outputVar);
    const shouldResetValues = currentKind !== nextKind;

    const nextBlocks = shouldResetValues
      ? container.blocks.map((block) => {
          if (block.kind === 'if' || block.kind === 'elseIf') {
            return { ...block, thenValue: getDefaultValueForTarget(outputVar) };
          }
          if (block.kind === 'else') {
            return { ...block, elseValue: getDefaultElseValueForTarget(outputVar) };
          }
          return block;
        })
      : container.blocks;

    store.setContainers(containers.map((item) => (
      item.id === container.id ? { ...item, outputVar, blocks: nextBlocks } : item
    )));
  };

  // Drop handler
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    try {
      const { action, kind, name } = JSON.parse(data);
      if (action === 'addBlock' && kind) {
        handleAddBlock(kind, selectedContainerId || undefined);
      } else if (action === 'variable' && name) {
        applyVariableToSelectedDecision(name);
      } else if (action === 'addContainer') {
        handleAddContainer();
      }
    } catch { /* ignore */ }
  };

  const selectedBlock = (() => {
    if (!selectedBlockId) return null;
    for (const c of containers) {
      const b = c.blocks.find(bl => bl.id === selectedBlockId);
      if (b) return { block: b, containerId: c.id };
    }
    return null;
  })();

  const selectedBlockContainer = selectedBlock
    ? containers.find((container) => container.id === selectedBlock.containerId) || null
    : null;
  const selectedOutputKind = getFormulaTargetKind(selectedBlockContainer?.outputVar || '');
  const conditionOptions = [
    ...FORMULA_INPUT_OPTIONS.filter((option) => (
      option.key !== 'startDate' && option.key !== 'lateFeeMode'
    )),
    ...customVariables.map((variable) => ({
      key: variable.name,
      label: variable.name,
      description: variable.description || 'Parametro personalizado definido en Variables de formulas.',
      valueKind: variable.type === 'boolean' ? 'number' as const : variable.type === 'currency' ? 'currency' as const : variable.type === 'percent' ? 'percent' as const : 'integer' as const,
    })),
  ];
  const activeOutputVars = new Set(containers.map((container) => container.outputVar));
  const lockedText = isLockedByCredits
    ? `${usageCount} credito${usageCount === 1 ? '' : 's'} ya usan esta version. Sus condiciones quedan congeladas.`
    : 'Esta version aun no esta asociada a creditos.';
  const floatingStatus = isNew
    ? { label: 'Borrador', bg: '#fff8e1', fg: '#8a5a00', dot: '#8a5a00' }
    : isLockedByCredits
      ? { label: 'Congelada', bg: '#fff8e1', fg: '#8a5a00', dot: '#8a5a00' }
      : isActiveVersion
        ? { label: 'Activa', bg: '#e8f5e9', fg: '#1b5e20', dot: '#2e7d32' }
        : { label: 'Inactiva', bg: MD3.secondaryContainer, fg: MD3.onSecondaryContainer, dot: MD3.secondary };
  const ruleCountLabel = `${containers.length} regla${containers.length === 1 ? '' : 's'} - ${containers.reduce((a, c) => a + c.blocks.length, 0)} bloque${containers.reduce((a, c) => a + c.blocks.length, 0) === 1 ? '' : 's'}`;
  const configuredBlockCount = containers.reduce((total, container) => total + container.blocks.length, 0);

  const applyVariableToSelectedDecision = (variableName: string) => {
    if (!selectedBlock || (selectedBlock.block.kind !== 'if' && selectedBlock.block.kind !== 'elseIf')) {
      return;
    }

    store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, {
      condition: {
        ...(selectedBlock.block.condition || { operator: '>', value: '0' }),
        variable: variableName,
      },
    });
  };

  // -- Render --
  return (
    <div className="formula-editor-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: MD3.surface, fontFamily: "'Inter', sans-serif" }}>
      {/* Toolbar */}
      <div className="formula-editor-toolbar" style={sty.toolbar}>
        <button onClick={() => navigate('/formulas')} style={{ ...sty.btn('transparent', MD3.onSurfaceVariant), border: 'none', padding: '4px 8px' }}>
          <ChevronLeft size={16} /> Volver
        </button>
        <input className="formula-editor-name-input" type="text" value={formulaName} onChange={e => store.setFormulaName(e.target.value)}
          style={{ flex: 1, maxWidth: 320, padding: '6px 12px', borderRadius: 8, border: `1px solid ${MD3.outlineVariant}`, fontSize: 14, fontWeight: 600, color: MD3.onSurface, backgroundColor: MD3.surface, outline: 'none' }}
          placeholder="Nombre de la formula" />
        <div className="formula-editor-toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <button onClick={store.undo} disabled={!store.canUndo()} style={{ ...sty.btn('transparent', MD3.onSurfaceVariant), opacity: store.canUndo() ? 1 : 0.3 }}><Undo2 size={16} /></button>
          <button onClick={store.redo} disabled={!store.canRedo()} style={{ ...sty.btn('transparent', MD3.onSurfaceVariant), opacity: store.canRedo() ? 1 : 0.3 }}><Redo2 size={16} /></button>
          <div style={{ width: 1, height: 20, backgroundColor: MD3.outlineVariant, margin: '0 4px' }} />
          <button onClick={() => store.setZoom(Math.max(0.5, zoom - 0.1))} style={sty.btn('transparent', MD3.onSurfaceVariant)}><ZoomOut size={16} /></button>
          <span style={{ fontSize: 12, width: 40, textAlign: 'center', color: MD3.onSurfaceVariant, fontFamily: "'JetBrains Mono'" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => store.setZoom(Math.min(2, zoom + 0.1))} style={sty.btn('transparent', MD3.onSurfaceVariant)}><ZoomIn size={16} /></button>
          <div style={{ width: 1, height: 20, backgroundColor: MD3.outlineVariant, margin: '0 4px' }} />
          <button onClick={handleTest} style={{ ...sty.btn('#fff', MD3.onSurface), border: `1px solid ${MD3.outlineVariant}` }}><Play size={14} /> Validar</button>
          <button onClick={() => persistGraph({ activate: false })} disabled={isSaving} style={{ ...sty.btn('#fff', MD3.onSurface), border: `1px solid ${MD3.outlineVariant}`, opacity: isSaving ? 0.5 : 1 }}>
            <Save size={14} /> Guardar borrador
          </button>
          <button onClick={() => persistGraph({ activate: true })} disabled={isSaving} style={{ ...sty.btn(MD3.onSurface, '#fff'), opacity: isSaving ? 0.5 : 1 }}>
            <Power size={14} /> {isSaving ? 'Guardando...' : 'Guardar y activar nueva'}
          </button>
        </div>
      </div>

      {!isNew && existingGraph && (
        <div className="formula-version-banner" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: `1px solid ${MD3.outlineVariant}`, backgroundColor: isLockedByCredits ? '#fff8e1' : '#eef7fb', color: MD3.onSurface }}>
          {isLockedByCredits ? <LockKeyhole size={16} color="#8a5a00" /> : <ShieldCheck size={16} color={MD3.secondary} />}
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            Version {existingGraph.version} {isActiveVersion ? 'activa' : 'inactiva'}
          </span>
          <span style={{ fontSize: 13, color: MD3.onSurfaceVariant }}>
            {lockedText} Guardar cambios siempre crea otra version; no modifica creditos anteriores.
          </span>
        </div>
      )}

      <div className="formula-editor-body" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Toolbox */}
        <aside className="formula-editor-toolbox" style={sty.aside}>
          <div className="formula-panel-intro">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MD3.onSurface, fontWeight: 800, fontSize: 14 }}>
              <SlidersHorizontal size={16} color={MD3.secondary} />
              Ajustes disponibles
            </div>
            <div style={{ color: MD3.onSurfaceVariant, fontSize: 12, lineHeight: 1.45, marginTop: 6 }}>
              Toca una etapa del flujo o agrega una condicion para cambiar como se crean los creditos nuevos.
            </div>
          </div>
          <div>
            <div style={sty.heading}>Datos del credito</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FORMULA_INPUT_OPTIONS.filter((option) => option.key !== 'startDate' && option.key !== 'lateFeeMode').map((option) => (
                <div
                  key={option.key}
                  style={sty.dragItem}
                  draggable
                  onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ action: 'variable', name: option.key }))}
                  onClick={() => applyVariableToSelectedDecision(option.key)}
                  title={selectedBlock ? option.description : `${option.description} Selecciona una decision para aplicarla.`}
                >
                  <GripVertical size={12} color={MD3.onSurfaceVariant} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#40c2fd' }} />
                  <span>{option.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${MD3.outlineVariant}`, paddingTop: 12 }}>
            <div style={sty.heading}>Variables personalizadas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {customVariables.length === 0 ? (
                <div style={{ fontSize: 12, lineHeight: 1.4, color: MD3.onSurfaceVariant, backgroundColor: MD3.surface, border: `1px dashed ${MD3.outlineVariant}`, borderRadius: 8, padding: 10 }}>
                  No hay variables activas. Crealas en Variables para usarlas como parametros de formulas reales.
                </div>
              ) : (
                customVariables.map((variable) => (
                  <div
                    key={variable.id}
                    style={sty.dragItem}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ action: 'variable', name: variable.name }))}
                    onClick={() => applyVariableToSelectedDecision(variable.name)}
                    title={selectedBlock ? (variable.description || 'Variable personalizada activa') : 'Selecciona una decision para aplicar esta variable.'}
                  >
                    <GripVertical size={12} color={MD3.onSurfaceVariant} />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#14b8a6' }} />
                    <span>{variable.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${MD3.outlineVariant}`, paddingTop: 12 }}>
            <div style={sty.heading}>Operaciones</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {['+', '-', '*', '/', '(', ')', '=', '>'].map(op => (
                <div key={op} style={sty.opBtn} draggable>{op}</div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${MD3.outlineVariant}`, paddingTop: 12 }}>
            <div style={sty.heading}>Bloques de decision</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {([['Si', 'if'], ['Si no, cuando', 'elseIf'], ['En cualquier otro caso', 'else']] as [string, BlockKind][]).map(([label, kind]) => (
                <div key={kind} style={sty.logicDrag} draggable
                  onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ action: 'addBlock', kind }))}
                  onClick={() => handleAddBlock(kind, selectedContainerId || undefined)}>
                  <GripVertical size={12} />
                  <GitBranch size={14} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${MD3.outlineVariant}`, paddingTop: 12 }}>
            <button onClick={handleAddContainer} style={{ ...sty.btn(MD3.secondary, '#fff'), width: '100%', justifyContent: 'center' }}>
              <Plus size={14} /> Nueva regla
            </button>
          </div>
        </aside>

        {/* Center Canvas */}
        <section className="formula-editor-canvas" style={sty.canvas} onDrop={handleCanvasDrop} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onClick={() => { store.selectBlock(null); setSelectedContainerId(null); }}>
          {/* Floating info bar */}
          <div className="formula-editor-floating-info" style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', zIndex: 10, pointerEvents: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.92)', border: `1px solid ${MD3.outlineVariant}`, backdropFilter: 'blur(8px)', pointerEvents: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: MD3.onSurface }}>{formulaName}</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, backgroundColor: floatingStatus.bg, color: floatingStatus.fg, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: floatingStatus.dot }} /> {floatingStatus.label}
              </span>
            </div>
            <div style={{ padding: '6px 12px', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.92)', border: `1px solid ${MD3.outlineVariant}`, fontSize: 12, color: MD3.onSurfaceVariant, pointerEvents: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              {ruleCountLabel}
            </div>
          </div>

          {/* Canvas content */}
          <div className="formula-editor-canvas-content" style={{ padding: '80px 40px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, minHeight: '100%', transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
            <div className="formula-editor-workflow-card" style={{ width: 'min(960px, calc(100vw - 520px))', minWidth: 620, backgroundColor: 'rgba(255,255,255,0.96)', border: `1px solid ${MD3.outlineVariant}`, borderRadius: 14, padding: 16, boxShadow: '0 4px 18px rgba(15,23,42,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: MD3.onSurface }}>Flujo real del credito</div>
                  <div style={{ fontSize: 12, color: MD3.onSurfaceVariant, marginTop: 2 }}>
                    El sistema recorre estas etapas al crear un credito. Las tarjetas con "Editar" pueden tener reglas propias.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isActiveVersion ? '#1b5e20' : '#8a5a00', backgroundColor: isActiveVersion ? '#e8f5e9' : '#fff8e1', padding: '5px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                  <CheckCircle2 size={13} />
                  {isActiveVersion ? 'Version activa' : 'Borrador o historica'}
                </div>
              </div>

              <div className="formula-flow-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, alignItems: 'stretch' }}>
                {FORMULA_FLOW_STEPS.map((step, index) => {
                  const editableTarget = step.editableTarget;
                  const isConfigured = editableTarget ? activeOutputVars.has(editableTarget) : true;
                  return (
                    <div className="formula-flow-step-wrap" key={step.key} style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                      <button
                        type="button"
                        disabled={!editableTarget}
                        onClick={() => {
                          if (editableTarget) {
                            handleAddTargetRule(editableTarget);
                          }
                        }}
                        className="formula-flow-step"
                        style={{
                          minHeight: 116,
                          width: '100%',
                          textAlign: 'left',
                          borderRadius: 10,
                          border: `1px solid ${editableTarget ? (isConfigured ? MD3.secondary : MD3.outlineVariant) : MD3.outlineVariant}`,
                          backgroundColor: editableTarget ? (isConfigured ? '#eef7fb' : '#ffffff') : MD3.surface,
                          padding: 10,
                          cursor: editableTarget ? 'pointer' : 'default',
                          color: MD3.onSurface,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: MD3.onSurface }}>{step.label}</span>
                          {editableTarget && (
                            <span style={{ fontSize: 9, fontWeight: 800, borderRadius: 999, padding: '2px 5px', color: isConfigured ? '#1b5e20' : MD3.onSurfaceVariant, backgroundColor: isConfigured ? '#e8f5e9' : MD3.surface }}>
                              {isConfigured ? 'AJUSTADA' : 'EDITAR'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, lineHeight: 1.35, color: MD3.onSurfaceVariant }}>{step.description}</div>
                      </button>
                      {index < FORMULA_FLOW_STEPS.length - 1 && (
                        <ArrowRight size={14} color={MD3.outline} style={{ alignSelf: 'center', flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {configuredBlockCount === 0 && (
              <div className="formula-editor-empty-guide" style={{ width: 'min(960px, calc(100vw - 520px))', minWidth: 620, background: '#ffffff', border: `1px solid ${MD3.outlineVariant}`, borderRadius: 14, padding: 18, boxShadow: '0 4px 18px rgba(15,23,42,0.06)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: '#e6fffa', color: '#0f766e', flexShrink: 0 }}>
                    <ListChecks size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: MD3.onSurface }}>Esta version usa el calculo base del sistema.</div>
                    <div style={{ fontSize: 13, color: MD3.onSurfaceVariant, lineHeight: 1.45, marginTop: 4 }}>
                      No hay condiciones personalizadas todavia. Puedes dejarla asi o crear una regla para cambiar tasa, plazo, cuota o politica de mora en los creditos nuevos.
                    </div>
                    <div className="formula-empty-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                      {FORMULA_TARGET_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleAddTargetRule(option.key);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            border: `1px solid ${MD3.outlineVariant}`,
                            background: activeOutputVars.has(option.key) ? '#eef7fb' : '#ffffff',
                            color: MD3.onSurface,
                            borderRadius: 10,
                            padding: '9px 11px',
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          <Plus size={14} color={MD3.secondary} />
                          Ajustar {option.label.toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {containers.map(c => (
              <FormulaContainerBlock key={c.id} container={c} selectedBlockId={selectedBlockId}
                onSelectBlock={bid => store.selectBlock(bid)} onDeleteBlock={handleDeleteBlock}
                onSelectContainer={cid => { setSelectedContainerId(cid); store.selectBlock(null); }}
                onAddBlock={(containerId, kind) => handleAddBlock(kind, containerId)}
                isContainerSelected={selectedContainerId === c.id} />
            ))}
            {containers.length === 0 && (
              <div style={{ textAlign: 'center', color: MD3.onSurfaceVariant, fontSize: 14, marginTop: 120 }}>
                <p style={{ marginBottom: 12 }}>Agrega una regla para decidir valores de credito sin escribir codigo.</p>
                <button onClick={handleAddContainer} style={{ ...sty.btn(MD3.secondary, '#fff') }}><Plus size={14} /> Crear primer bloque</button>
              </div>
            )}
          </div>
        </section>

        {/* Right Panel: Properties + Live Test */}
        <aside className="formula-editor-right-panel" style={sty.right}>
          {/* Properties */}
          {selectedBlock && (
            <div style={{ padding: 16, borderBottom: `1px solid ${MD3.outlineVariant}` }}>
              <div style={{ ...sty.heading, marginBottom: 12 }}>Editar decision</div>
              {(selectedBlock.block.kind === 'if' || selectedBlock.block.kind === 'elseIf') && selectedBlock.block.condition && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Cuando</label>
                  <select style={sty.input} value={selectedBlock.block.condition.variable}
                    onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { condition: { ...selectedBlock.block.condition!, variable: e.target.value } })}>
                    {conditionOptions.map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Comparacion</label>
                  <select style={sty.input} value={selectedBlock.block.condition.operator}
                    onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { condition: { ...selectedBlock.block.condition!, operator: e.target.value as any } })}>
                    {['>', '<', '>=', '<=', '==', '!='].map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Valor de comparacion</label>
                  <input style={sty.input} value={selectedBlock.block.condition.value}
                    onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { condition: { ...selectedBlock.block.condition!, value: e.target.value } })} />
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Entonces usar</label>
                  {selectedOutputKind === 'mode' ? (
                    <select style={sty.input} value={normalizeModeValue(selectedBlock.block.thenValue)}
                      onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { thenValue: e.target.value })}>
                      {LATE_FEE_MODE_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input style={sty.input} value={selectedBlock.block.thenValue || ''}
                      onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { thenValue: e.target.value })} />
                  )}
                </div>
              )}
              {selectedBlock.block.kind === 'else' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>En cualquier otro caso usar</label>
                  {selectedOutputKind === 'mode' ? (
                    <select style={sty.input} value={normalizeModeValue(selectedBlock.block.elseValue)}
                      onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { elseValue: e.target.value })}>
                      {LATE_FEE_MODE_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input style={sty.input} value={selectedBlock.block.elseValue || ''}
                      onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { elseValue: e.target.value })} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Selected container properties */}
          {selectedContainerId && !selectedBlock && (() => {
            const c = containers.find(ct => ct.id === selectedContainerId);
            if (!c) return null;
            const targetOption = FORMULA_TARGET_OPTIONS.find((option) => option.key === c.outputVar);
            return (
              <div style={{ padding: 16, borderBottom: `1px solid ${MD3.outlineVariant}` }}>
                <div style={{ ...sty.heading, marginBottom: 12 }}>Editar regla</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Nombre visible</label>
                  <input style={sty.input} value={c.label} onChange={e => store.updateContainer(c.id, { label: e.target.value })} />
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Que define esta regla</label>
                  <select style={sty.input} value={c.outputVar} onChange={e => handleUpdateContainerOutput(c, e.target.value)}>
                    {FORMULA_TARGET_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 12, color: MD3.onSurfaceVariant, lineHeight: 1.4 }}>
                    {targetOption?.description || 'Define un valor usado al crear creditos.'}
                    {' '}Si una condicion no aplica, el sistema conserva el valor original de esa etapa.
                  </span>
                  <button onClick={() => store.removeContainer(c.id)} style={{ ...sty.btn(MD3.error, '#fff'), justifyContent: 'center', marginTop: 8 }}>
                    <Trash2 size={14} /> Eliminar regla
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Live Test */}
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            <div style={{ border: `1px solid ${MD3.outlineVariant}`, borderRadius: 12, padding: 12, backgroundColor: MD3.surface }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <ShieldCheck size={16} color={MD3.secondary} />
                <span style={{ fontSize: 13, fontWeight: 800, color: MD3.onSurface }}>Impacto real</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: MD3.onSurfaceVariant }}>
                Validar prueba esta version sin guardarla. Guardar y activar hace que los creditos nuevos usen esta formula.
                Los creditos existentes mantienen la version que ya tienen registrada.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Play size={18} color={MD3.secondary} />
              <span style={{ fontSize: 18, fontWeight: 700, color: MD3.onSurface }}>Validacion de credito</span>
            </div>

            <div>
              <div style={sty.heading}>Datos del credito de prueba</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(testInputs).map(([key, value]) => (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: MD3.onSurface }}>{getFormulaVariableLabel(key)}</label>
                      <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono'", color: MD3.onSurfaceVariant }}>{getInputKindLabel(typeof value === 'number' ? 'number' : key === 'startDate' ? 'date' : key === 'lateFeeMode' ? 'mode' : 'number')}</span>
                    </div>
                    {key === 'lateFeeMode' ? (
                      <select value={normalizeModeValue(String(value))} style={sty.input}
                        onChange={e => setTestInputs(prev => ({ ...prev, [key]: e.target.value }))}>
                        {LATE_FEE_MODE_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input type={typeof value === 'number' ? 'number' : 'text'} value={value as any} style={sty.input}
                        onChange={e => setTestInputs(prev => ({ ...prev, [key]: typeof value === 'number' ? Number(e.target.value) : e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleTest} style={{ ...sty.btn('#fff', MD3.onSurface), border: `1px solid ${MD3.outlineVariant}`, justifyContent: 'center', width: '100%' }}>
              <Play size={16} /> Validar formula
            </button>

            {testError && (
              <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#ffdad6', color: MD3.error, fontSize: 12 }}>{testError}</div>
            )}

            {testResult && (
              <div>
                <div style={sty.heading}>Resultado operativo</div>
                <div style={{ borderRadius: 12, padding: 16, backgroundColor: MD3.surface, border: `1px solid ${MD3.outlineVariant}`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', backgroundColor: '#2e7d32' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: MD3.onSurface }}>Calculo listo para credito</span>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, backgroundColor: '#e8f5e9', color: '#1b5e20' }}>OK</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingLeft: 8 }}>
                    {[
                      ['Cuota', testResult?.summary?.installmentAmount],
                      ['Total a pagar', testResult?.summary?.totalPayable],
                      ['Intereses', testResult?.summary?.totalInterest],
                      ['Politica', getFormulaValueLabel(testResult?.lateFeeMode, 'lateFeeMode')],
                    ].map(([label, value]) => (
                      <div key={label} style={{ border: `1px solid ${MD3.outlineVariant}`, borderRadius: 8, padding: '8px 10px', backgroundColor: '#fff' }}>
                        <div style={{ fontSize: 10, color: MD3.onSurfaceVariant, textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
                        <div style={{ fontSize: 14, color: MD3.onSurface, fontWeight: 700, fontFamily: typeof value === 'number' ? "'JetBrains Mono'" : undefined }}>
                          {typeof value === 'number' ? value.toLocaleString('es-CO') : value || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Save button at bottom */}
          <div style={{ padding: 16, borderTop: `1px solid ${MD3.outlineVariant}`, marginTop: 'auto' }}>
            <button onClick={() => persistGraph({ activate: true })} disabled={isSaving}
              style={{ ...sty.btn(MD3.secondary, '#fff'), width: '100%', justifyContent: 'center', padding: '10px 16px', opacity: isSaving ? 0.5 : 1 }}>
              <Power size={16} /> {isSaving ? 'Guardando...' : 'Guardar y activar nueva version'}
            </button>
            <button onClick={() => persistGraph({ activate: false })} disabled={isSaving}
              style={{ ...sty.btn('#fff', MD3.onSurface), border: `1px solid ${MD3.outlineVariant}`, width: '100%', justifyContent: 'center', padding: '9px 16px', opacity: isSaving ? 0.5 : 1, marginTop: 8 }}>
              <Save size={16} /> Guardar solo como borrador
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
