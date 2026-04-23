import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Save, Play, ChevronLeft,
  Plus, GripVertical, GitBranch, Equal, Variable, Trash2,
} from 'lucide-react';
import { useBlockEditorStore, generateBlockId } from '../store/blockEditorStore';
import { dagService } from '../services/dagService';
import { queryKeys } from '../services/queryKeys';
import { toast } from '../lib/toast';
import { FormulaContainerBlock } from './LogicBlock';
import { decompileGraphToContainers, compileBlocksToGraph } from '../lib/blockCompiler';
import type { BlockDefinition, FormulaContainer, BlockKind } from '../types/dag';

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

function makeBlock(kind: BlockKind): BlockDefinition {
  const id = generateBlockId(kind);
  if (kind === 'if' || kind === 'elseIf') return { id, kind, condition: { variable: 'amount', operator: '>', value: '1000000' }, thenValue: '0.035' };
  if (kind === 'else') return { id, kind, elseValue: '0.05' };
  return { id, kind, label: 'expression' };
}

export default function FormulaEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const store = useBlockEditorStore();
  const { containers, selectedBlockId, zoom, formulaName, scopeKey } = store;

  const [testInputs, setTestInputs] = useState<Record<string, any>>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);

  const { data: scopeData } = useQuery({ queryKey: queryKeys.loans.workbenchScopes, queryFn: () => dagService.listScopes() });
  const scope = scopeData?.data?.scopes?.[0];

  // Load existing graph by ID
  const { data: existingGraphData } = useQuery({
    queryKey: ['dag.graphDetails', id],
    queryFn: () => dagService.getGraphDetails(Number(id)),
    enabled: !isNew && !!id,
  });

  // Init
  useEffect(() => {
    if (!scope) return;
    if (isNew) {
      // New formula: start with one empty container
      store.setContainers([{
        id: 'base',
        label: 'Logica principal',
        blocks: [],
        outputVar: 'custom_rate',
      }]);
      store.setFormulaName(scope.defaultName || 'Nueva formula');
      setTestInputs(scope.simulationInput || {});
    } else if (existingGraphData?.data?.graph) {
      const existing = existingGraphData.data.graph;
      if (existing.graph) {
        const c = decompileGraphToContainers(existing.graph);
        store.setContainers(c.length > 0 ? c : [{ id: 'base', label: 'Logica principal', blocks: [], outputVar: 'custom_rate' }]);
        store.setFormulaName(existing.name || 'Formula');
        store.setFormulaDescription(existing.description || '');
      }
      setTestInputs(scope.simulationInput || {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, existingGraphData, id, isNew]);

  useEffect(() => { return () => store.reset(); }, []);// eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: (payload: any) => dagService.saveGraph(payload),
    onSuccess: () => toast.success({ description: 'Formula guardada exitosamente' }),
    onError: (err: any) => toast.error({ description: err.message || 'Error al guardar' }),
  });

  const handleSave = () => {
    const graph = store.compileGraph();
    saveMutation.mutate({ scopeKey, name: formulaName, graph });
  };

  const handleTest = async () => {
    setTestError(null); setTestResult(null);
    try {
      const graph = store.compileGraph();
      const res = await dagService.simulateGraph({ scopeKey, graph, simulationInput: testInputs });
      setTestResult(res?.data?.simulation || null);
    } catch (err: any) { setTestError(err.message || 'Error en prueba'); }
  };

  const handleAddContainer = () => {
    const c: FormulaContainer = { id: generateBlockId('container'), label: 'New Formula Block', blocks: [], outputVar: generateBlockId('output') };
    store.addContainer(c);
  };

  const handleAddBlock = (containerId: string, kind: BlockKind) => {
    store.addBlock(containerId, makeBlock(kind));
  };

  const handleDeleteBlock = (containerId: string, blockId: string) => {
    store.removeBlock(containerId, blockId);
  };

  // Drop handler
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    try {
      const { action, kind } = JSON.parse(data);
      if (action === 'addBlock' && selectedContainerId) {
        handleAddBlock(selectedContainerId, kind);
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

  // ── Render ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: MD3.surface, fontFamily: "'Inter', sans-serif" }}>
      {/* Toolbar */}
      <div style={sty.toolbar}>
        <button onClick={() => navigate('/formulas')} style={{ ...sty.btn('transparent', MD3.onSurfaceVariant), border: 'none', padding: '4px 8px' }}>
          <ChevronLeft size={16} /> Volver
        </button>
        <input type="text" value={formulaName} onChange={e => store.setFormulaName(e.target.value)}
          style={{ flex: 1, maxWidth: 320, padding: '6px 12px', borderRadius: 8, border: `1px solid ${MD3.outlineVariant}`, fontSize: 14, fontWeight: 600, color: MD3.onSurface, backgroundColor: MD3.surface, outline: 'none' }}
          placeholder="Nombre de la formula" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <button onClick={store.undo} disabled={!store.canUndo()} style={{ ...sty.btn('transparent', MD3.onSurfaceVariant), opacity: store.canUndo() ? 1 : 0.3 }}><Undo2 size={16} /></button>
          <button onClick={store.redo} disabled={!store.canRedo()} style={{ ...sty.btn('transparent', MD3.onSurfaceVariant), opacity: store.canRedo() ? 1 : 0.3 }}><Redo2 size={16} /></button>
          <div style={{ width: 1, height: 20, backgroundColor: MD3.outlineVariant, margin: '0 4px' }} />
          <button onClick={() => store.setZoom(Math.max(0.5, zoom - 0.1))} style={sty.btn('transparent', MD3.onSurfaceVariant)}><ZoomOut size={16} /></button>
          <span style={{ fontSize: 12, width: 40, textAlign: 'center', color: MD3.onSurfaceVariant, fontFamily: "'JetBrains Mono'" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => store.setZoom(Math.min(2, zoom + 0.1))} style={sty.btn('transparent', MD3.onSurfaceVariant)}><ZoomIn size={16} /></button>
          <div style={{ width: 1, height: 20, backgroundColor: MD3.outlineVariant, margin: '0 4px' }} />
          <button onClick={handleTest} style={{ ...sty.btn('#fff', MD3.onSurface), border: `1px solid ${MD3.outlineVariant}` }}><Play size={14} /> Probar</button>
          <button onClick={handleSave} disabled={saveMutation.isPending} style={{ ...sty.btn(MD3.onSurface, '#fff'), opacity: saveMutation.isPending ? 0.5 : 1 }}>
            <Save size={14} /> {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Toolbox */}
        <aside style={sty.aside}>
          <div>
            <div style={sty.heading}>Variables</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(scope?.requiredInputs || ['amount', 'interestRate', 'termMonths']).map((v: string) => (
                <div key={v} style={sty.dragItem} draggable onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ action: 'variable', name: v }))}>
                  <GripVertical size={12} color={MD3.onSurfaceVariant} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#40c2fd' }} />
                  {v}
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${MD3.outlineVariant}`, paddingTop: 12 }}>
            <div style={sty.heading}>Operations</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {['+', '-', '*', '/', '(', ')', '=', '>'].map(op => (
                <div key={op} style={sty.opBtn} draggable>{op}</div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${MD3.outlineVariant}`, paddingTop: 12 }}>
            <div style={sty.heading}>Logic Blocks</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {([['IF', 'if'], ['ELSE IF', 'elseIf'], ['ELSE', 'else']] as [string, BlockKind][]).map(([label, kind]) => (
                <div key={kind} style={sty.logicDrag} draggable
                  onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ action: 'addBlock', kind }))}
                  onClick={() => selectedContainerId && handleAddBlock(selectedContainerId, kind)}>
                  <GripVertical size={12} />
                  <GitBranch size={14} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${MD3.outlineVariant}`, paddingTop: 12 }}>
            <button onClick={handleAddContainer} style={{ ...sty.btn(MD3.secondary, '#fff'), width: '100%', justifyContent: 'center' }}>
              <Plus size={14} /> New Formula Block
            </button>
          </div>
        </aside>

        {/* Center Canvas */}
        <section style={sty.canvas} onDrop={handleCanvasDrop} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onClick={() => { store.selectBlock(null); setSelectedContainerId(null); }}>
          {/* Floating info bar */}
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', zIndex: 10, pointerEvents: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.92)', border: `1px solid ${MD3.outlineVariant}`, backdropFilter: 'blur(8px)', pointerEvents: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: MD3.onSurface }}>{formulaName}</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, backgroundColor: MD3.secondaryContainer, color: MD3.onSecondaryContainer, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: MD3.secondary }} /> DRAFT
              </span>
            </div>
            <div style={{ padding: '6px 12px', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.92)', border: `1px solid ${MD3.outlineVariant}`, fontSize: 12, color: MD3.onSurfaceVariant, pointerEvents: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              {containers.length} contenedores · {containers.reduce((a, c) => a + c.blocks.length, 0)} bloques
            </div>
          </div>

          {/* Canvas content */}
          <div style={{ padding: '80px 40px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, minHeight: '100%', transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
            {containers.map(c => (
              <FormulaContainerBlock key={c.id} container={c} selectedBlockId={selectedBlockId}
                onSelectBlock={bid => store.selectBlock(bid)} onDeleteBlock={handleDeleteBlock}
                onSelectContainer={cid => { setSelectedContainerId(cid); store.selectBlock(null); }}
                isContainerSelected={selectedContainerId === c.id} />
            ))}
            {containers.length === 0 && (
              <div style={{ textAlign: 'center', color: MD3.onSurfaceVariant, fontSize: 14, marginTop: 120 }}>
                <p style={{ marginBottom: 12 }}>Arrastrá bloques del Toolbox o hacé click en "New Formula Block"</p>
                <button onClick={handleAddContainer} style={{ ...sty.btn(MD3.secondary, '#fff') }}><Plus size={14} /> Crear primer bloque</button>
              </div>
            )}
          </div>
        </section>

        {/* Right Panel: Properties + Live Test */}
        <aside style={sty.right}>
          {/* Properties */}
          {selectedBlock && (
            <div style={{ padding: 16, borderBottom: `1px solid ${MD3.outlineVariant}` }}>
              <div style={{ ...sty.heading, marginBottom: 12 }}>Block Properties</div>
              {(selectedBlock.block.kind === 'if' || selectedBlock.block.kind === 'elseIf') && selectedBlock.block.condition && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Variable</label>
                  <input style={sty.input} value={selectedBlock.block.condition.variable}
                    onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { condition: { ...selectedBlock.block.condition!, variable: e.target.value } })} />
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Operator</label>
                  <select style={sty.input} value={selectedBlock.block.condition.operator}
                    onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { condition: { ...selectedBlock.block.condition!, operator: e.target.value as any } })}>
                    {['>', '<', '>=', '<=', '==', '!='].map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Value</label>
                  <input style={sty.input} value={selectedBlock.block.condition.value}
                    onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { condition: { ...selectedBlock.block.condition!, value: e.target.value } })} />
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Then Value</label>
                  <input style={sty.input} value={selectedBlock.block.thenValue || ''}
                    onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { thenValue: e.target.value })} />
                </div>
              )}
              {selectedBlock.block.kind === 'else' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Else Value</label>
                  <input style={sty.input} value={selectedBlock.block.elseValue || ''}
                    onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { elseValue: e.target.value })} />
                </div>
              )}
            </div>
          )}

          {/* Selected container properties */}
          {selectedContainerId && !selectedBlock && (() => {
            const c = containers.find(ct => ct.id === selectedContainerId);
            if (!c) return null;
            return (
              <div style={{ padding: 16, borderBottom: `1px solid ${MD3.outlineVariant}` }}>
                <div style={{ ...sty.heading, marginBottom: 12 }}>Container Properties</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Label</label>
                  <input style={sty.input} value={c.label} onChange={e => store.updateContainer(c.id, { label: e.target.value })} />
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Output Variable</label>
                  <input style={sty.input} value={c.outputVar} onChange={e => store.updateContainer(c.id, { outputVar: e.target.value })} />
                  <button onClick={() => store.removeContainer(c.id)} style={{ ...sty.btn(MD3.error, '#fff'), justifyContent: 'center', marginTop: 8 }}>
                    <Trash2 size={14} /> Delete Container
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Live Test */}
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Play size={18} color={MD3.secondary} />
              <span style={{ fontSize: 18, fontWeight: 700, color: MD3.onSurface }}>Live Test</span>
            </div>

            <div>
              <div style={sty.heading}>Input Values</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(testInputs).map(([key, value]) => (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: MD3.onSurface }}>{key}</label>
                      <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono'", color: MD3.onSurfaceVariant }}>{typeof value === 'number' ? 'Decimal' : 'Str'}</span>
                    </div>
                    <input type={typeof value === 'number' ? 'number' : 'text'} value={value as any} style={sty.input}
                      onChange={e => setTestInputs(prev => ({ ...prev, [key]: typeof value === 'number' ? Number(e.target.value) : e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleTest} style={{ ...sty.btn('#fff', MD3.onSurface), border: `1px solid ${MD3.outlineVariant}`, justifyContent: 'center', width: '100%' }}>
              <Play size={16} /> Evaluate Formula
            </button>

            {testError && (
              <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#ffdad6', color: MD3.error, fontSize: 12 }}>{testError}</div>
            )}

            {testResult && (
              <div>
                <div style={sty.heading}>Execution Result</div>
                <div style={{ borderRadius: 12, padding: 16, backgroundColor: MD3.surface, border: `1px solid ${MD3.outlineVariant}`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', backgroundColor: '#2e7d32' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: MD3.onSurface }}>Result</span>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, backgroundColor: '#e8f5e9', color: '#1b5e20' }}>SUCCESS</span>
                  </div>
                  <pre style={{ fontSize: 12, fontFamily: "'JetBrains Mono'", color: MD3.onSurface, overflow: 'auto', maxHeight: 192, paddingLeft: 8, margin: 0 }}>
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Save button at bottom */}
          <div style={{ padding: 16, borderTop: `1px solid ${MD3.outlineVariant}`, marginTop: 'auto' }}>
            <button onClick={handleSave} disabled={saveMutation.isPending}
              style={{ ...sty.btn(MD3.secondary, '#fff'), width: '100%', justifyContent: 'center', padding: '10px 16px', opacity: saveMutation.isPending ? 0.5 : 1 }}>
              <Save size={16} /> {saveMutation.isPending ? 'Guardando...' : 'Save Formula'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
