import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Undo2, Redo2, Save, Play, ChevronLeft,
  Plus, GripVertical, GitBranch, Trash2, Power, LockKeyhole,
  ShieldCheck, ListChecks, SlidersHorizontal,
  Calculator, ArrowUp, ArrowDown, Edit3, Info,
} from 'lucide-react';
import { useBlockEditorStore, generateBlockId } from '../store/blockEditorStore';
import { dagService } from '../services/dagService';
import { variableService } from '../services/variableService';
import { queryKeys } from '../services/queryKeys';
import { toast } from '../lib/toast';
import { decompileGraphToContainers } from '../lib/blockCompiler';
import type {
  BlockDefinition,
  CalculationMethodKey,
  DagGraph,
  DagVariable,
  FormulaContainer,
  FormulaExceptionRule,
  BlockKind,
} from '../types/dag';
import {
  FORMULA_INPUT_OPTIONS,
  FORMULA_TARGET_OPTIONS,
  LATE_FEE_MODE_OPTIONS,
  getFormulaTargetKind,
  getFormulaValueLabel,
  getFormulaVariableLabel,
  getInputKindLabel,
  normalizeModeValue,
} from '../lib/formulaDisplay';
import {
  CREDIT_FORMULA_TEMPLATES,
  getFormulaFromBlock,
  type CreditFormulaTemplate,
} from '../lib/creditFormulaTemplates';

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
  if (outputVar === 'calculationMethod') return 'FRENCH';
  if (outputVar === 'interestRate') return '60';
  if (outputVar === 'termMonths') return '12';
  if (outputVar === 'installmentAmount') return '200000';
  return '0';
}

function getDefaultElseValueForTarget(outputVar = 'lateFeeMode'): string {
  if (outputVar === 'lateFeeMode') return 'NONE';
  if (outputVar === 'calculationMethod') return 'calculationMethod';
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

function createTemplateBlock(template: CreditFormulaTemplate): BlockDefinition {
  return {
    id: generateBlockId(`formula_${template.key}`),
    kind: 'expression',
    label: template.name,
    formula: template.formula,
    templateKey: template.key,
  };
}

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatMoney(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return CURRENCY_FORMATTER.format(numeric);
}

function normalizeMethodKey(value: unknown): CalculationMethodKey {
  const method = String(value || 'FRENCH').replace(/^['"]|['"]$/g, '').toUpperCase();
  if (method === 'SIMPLE' || method === 'COMPOUND') return method;
  return 'FRENCH';
}

function getTemplateMethodKey(template: CreditFormulaTemplate): CalculationMethodKey {
  return normalizeMethodKey(template.formula);
}

function getTemplateForMethod(method: CalculationMethodKey): CreditFormulaTemplate {
  return CREDIT_FORMULA_TEMPLATES.find((template) => getTemplateMethodKey(template) === method) || CREDIT_FORMULA_TEMPLATES[0];
}

function getBaseMethodFromContainers(containers: FormulaContainer[]): CalculationMethodKey {
  const container = containers.find((item) => item.outputVar === 'calculationMethod');
  if (!container) return 'FRENCH';

  const expression = container.blocks.find((block) => block.kind === 'expression');
  if (expression) {
    return normalizeMethodKey(getFormulaFromBlock(expression));
  }

  const fallback = [...container.blocks].reverse().find((block) => block.kind === 'else');
  return normalizeMethodKey(fallback?.elseValue || 'FRENCH');
}

function normalizeConditionalKinds(blocks: BlockDefinition[]): BlockDefinition[] {
  let conditionIndex = 0;
  return blocks.map((block) => {
    if (block.kind !== 'if' && block.kind !== 'elseIf') return block;
    const kind: BlockKind = conditionIndex === 0 ? 'if' : 'elseIf';
    conditionIndex += 1;
    return { ...block, kind };
  });
}

function isConditionalRule(block: BlockDefinition): block is BlockDefinition & {
  condition: NonNullable<BlockDefinition['condition']>;
} {
  return (block.kind === 'if' || block.kind === 'elseIf') && Boolean(block.condition);
}

function buildExceptionRules(containers: FormulaContainer[]): Array<{
  container: FormulaContainer;
  block: BlockDefinition & { condition: NonNullable<BlockDefinition['condition']> };
  priority: number;
}> {
  const rules: Array<{
    container: FormulaContainer;
    block: BlockDefinition & { condition: NonNullable<BlockDefinition['condition']> };
    priority: number;
  }> = [];

  containers.forEach((container) => {
    let priority = 0;
    container.blocks.forEach((block) => {
      if (!isConditionalRule(block)) return;
      priority += 1;
      rules.push({ container, block, priority });
    });
  });

  return rules;
}

function buildEditorModel(containers: FormulaContainer[]) {
  const exceptionRules: FormulaExceptionRule[] = buildExceptionRules(containers).map(({ container, block, priority }) => ({
    id: block.id,
    target: container.outputVar || 'lateFeeMode',
    condition: {
      variable: block.condition.variable,
      operator: block.condition.operator,
      value: String(block.condition.value),
    },
    value: String(block.thenValue ?? ''),
    priority,
  }));

  return {
    version: 1,
    baseMethod: getBaseMethodFromContainers(containers),
    exceptionRules,
  };
}

function describeRule(container: FormulaContainer, block: BlockDefinition): string {
  if (!isConditionalRule(block)) return 'Regla incompleta';
  const target = FORMULA_TARGET_OPTIONS.find((option) => option.key === container.outputVar);
  const variable = getFormulaVariableLabel(block.condition.variable);
  const value = getFormulaValueLabel(block.thenValue, container.outputVar);
  return `Si ${variable} ${block.condition.operator} ${block.condition.value}, cambiar ${target?.label || container.label} a ${value}`;
}

function getTargetHelp(outputVar?: string): string {
  if (outputVar === 'calculationMethod') {
    return 'Cambia el metodo financiero usado para calcular la cuota. Si no aplica, se conserva la formula base.';
  }
  if (outputVar === 'installmentAmount') {
    return 'Fija una cuota manual. Cuando esta excepcion aplica, reemplaza la cuota calculada por la formula base.';
  }
  const target = FORMULA_TARGET_OPTIONS.find((option) => option.key === outputVar);
  return `${target?.description || 'Ajusta un valor del credito.'} Si no aplica, el sistema conserva el dato original.`;
}

function conditionMatches(
  condition: NonNullable<BlockDefinition['condition']>,
  inputs: Record<string, any>,
): boolean {
  const leftValue = inputs[condition.variable];
  const leftNumber = Number(leftValue);
  const rightNumber = Number(condition.value);
  const canCompareAsNumber = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
  const left = canCompareAsNumber ? leftNumber : String(leftValue ?? '');
  const right = canCompareAsNumber ? rightNumber : String(condition.value ?? '');

  if (condition.operator === '>') return left > right;
  if (condition.operator === '<') return left < right;
  if (condition.operator === '>=') return left >= right;
  if (condition.operator === '<=') return left <= right;
  if (condition.operator === '!=') return left !== right;
  return left === right;
}

function getAppliedExceptionRules(containers: FormulaContainer[], inputs: Record<string, any>) {
  return containers.flatMap((container) => {
    const matchedBlock = container.blocks.find((block) => (
      isConditionalRule(block) && conditionMatches(block.condition, inputs)
    ));

    if (!matchedBlock || !isConditionalRule(matchedBlock)) return [];
    return [{ container, block: matchedBlock }];
  });
}

export default function FormulaEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === 'new';
  const store = useBlockEditorStore();
  const { containers, selectedBlockId, formulaName, scopeKey } = store;

  const [testInputs, setTestInputs] = useState<Record<string, any>>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [showToolbox, setShowToolbox] = useState(false);

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
    setShowToolbox(false);
    setTestError(null);
    setTestResult(null);
    store.selectBlock(null);
    if (isNew) {
      store.setContainers([]);
      setSelectedContainerId(null);
      store.setFormulaName(scope.defaultName || 'Nueva formula');
      setTestInputs(scope.calculationInput || scope.simulationInput || {});
    } else if (existingGraphData?.data?.graph) {
      const existing = existingGraphData.data.graph;
      if (existing.graph) {
        const c = decompileGraphToContainers(existing.graph);
        const nextContainers = c.length > 0 ? c : [];
        store.setContainers(nextContainers);
        setSelectedContainerId(null);
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
      return null;
    });
  }, [containers]);

  const saveMutation = useMutation({ mutationFn: (payload: any) => dagService.saveGraph(payload) });

  const activateMutation = useMutation({
    mutationFn: ({ graphId, status }: { graphId: number; status: 'active' | 'inactive' }) =>
      dagService.updateGraphStatus(graphId, status),
  });

  const compileGraphWithEditorModel = (): DagGraph => {
    const graph = store.compileGraph();
    return {
      ...graph,
      metadata: {
        ...(graph.metadata || {}),
        editorModel: buildEditorModel(containers),
      },
    };
  };

  const persistGraph = async ({ activate }: { activate: boolean }) => {
    try {
      const graph = compileGraphWithEditorModel();
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

      setShowToolbox(false);
      setSelectedContainerId(null);
      setTestError(null);
      setTestResult(null);
      store.selectBlock(null);

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
      const graph = compileGraphWithEditorModel();
      const res = await dagService.calculateGraph({ scopeKey, graph, calculationInput: testInputs });
      setTestResult(res?.data?.calculation || res?.data?.simulation || null);
    } catch (err: any) { setTestError(err.message || 'Error en prueba'); }
  };

  const handleAddContainer = () => {
    const c = createDefaultContainerForTarget('interestRate');
    store.addContainer(c);
    setSelectedContainerId(c.id);
    store.selectBlock(c.blocks[0]?.id || null);
  };

  const applyCreditFormulaTemplate = (template: CreditFormulaTemplate) => {
    const existing = containers.find((container) => container.outputVar === template.outputVar);
    const methodKey = getTemplateMethodKey(template);
    const fallbackBlock: BlockDefinition = {
      id: generateBlockId('else'),
      kind: 'else',
      elseValue: methodKey,
    };

    if (existing?.blocks.some((block) => block.kind === 'if' || block.kind === 'elseIf')) {
      const withoutFallback = existing.blocks.filter((block) => block.kind !== 'else');
      const nextContainer: FormulaContainer = {
        ...existing,
        label: 'Metodo financiero',
        blocks: [...normalizeConditionalKinds(withoutFallback), fallbackBlock],
      };
      store.setContainers(containers.map((container) => (container.id === existing.id ? nextContainer : container)));
      setSelectedContainerId(nextContainer.id);
      store.selectBlock(null);
      return;
    }

    const nextBlock = createTemplateBlock(template);
    const nextContainer: FormulaContainer = {
      id: existing?.id || generateBlockId(`container_${template.key}`),
      label: template.name,
      outputVar: template.outputVar,
      blocks: [nextBlock],
    };

    store.setContainers(existing
      ? containers.map((container) => (container.id === existing.id ? nextContainer : container))
      : [...containers, nextContainer]);
    setSelectedContainerId(null);
    store.selectBlock(null);
  };

  const handleAddTargetRule = (outputVar: string) => {
    const createRuleBlock = (target: string, kind: BlockKind): BlockDefinition => makeBlock(kind, target);

    if (outputVar === 'calculationMethod') {
      const existing = containers.find((container) => container.outputVar === outputVar);
      const currentBaseMethod = getBaseMethodFromContainers(containers);
      const nextBlock = createRuleBlock(outputVar, existing?.blocks.some((block) => block.kind === 'if' || block.kind === 'elseIf') ? 'elseIf' : 'if');
      nextBlock.thenValue = currentBaseMethod === 'COMPOUND' ? 'SIMPLE' : 'COMPOUND';

      if (existing) {
        const conditionalBlocks = existing.blocks.filter((block) => block.kind !== 'expression' && block.kind !== 'else');
        const fallback: BlockDefinition = {
          id: generateBlockId('else'),
          kind: 'else',
          elseValue: currentBaseMethod,
        };
        const nextBlocks = normalizeConditionalKinds([...conditionalBlocks, nextBlock, fallback]);
        store.setContainers(containers.map((container) => (
          container.id === existing.id
            ? { ...container, label: 'Metodo financiero', blocks: nextBlocks }
            : container
        )));
        setSelectedContainerId(existing.id);
        store.selectBlock(nextBlock.id);
        return;
      }

      const container: FormulaContainer = {
        id: generateBlockId('container_calculationMethod'),
        label: 'Metodo financiero',
        outputVar,
        blocks: [nextBlock, { id: generateBlockId('else'), kind: 'else', elseValue: currentBaseMethod }],
      };
      store.addContainer(container);
      setSelectedContainerId(container.id);
      store.selectBlock(nextBlock.id);
      return;
    }

    const existing = containers.find((container) => container.outputVar === outputVar);
    const nextKind: BlockKind = existing?.blocks.some((block) => block.kind === 'if' || block.kind === 'elseIf') ? 'elseIf' : 'if';
    const nextBlock = createRuleBlock(outputVar, nextKind);

    if (existing) {
      store.addBlock(existing.id, nextBlock);
      setSelectedContainerId(existing.id);
      store.selectBlock(nextBlock.id);
      return;
    }

    const option = FORMULA_TARGET_OPTIONS.find((item) => item.key === outputVar);
    const container: FormulaContainer = {
      id: generateBlockId(`container_${outputVar}`),
      label: option?.label || 'Regla de credito',
      outputVar,
      blocks: [nextBlock],
    };
    store.addContainer(container);
    setSelectedContainerId(container.id);
    store.selectBlock(nextBlock.id);
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
    const block = makeBlock(kind, targetContainer?.outputVar);
    store.addBlock(targetContainerId, block);
    setSelectedContainerId(targetContainerId);
    store.selectBlock(block.id);
  };

  const handleDeleteBlock = (containerId: string, blockId: string) => {
    const targetContainer = containers.find((container) => container.id === containerId);
    if (!targetContainer) return;
    const remainingBlocks = targetContainer.blocks.filter((block) => block.id !== blockId);
    const hasConditions = remainingBlocks.some((block) => block.kind === 'if' || block.kind === 'elseIf');

    if (!hasConditions && targetContainer.outputVar !== 'calculationMethod') {
      store.removeContainer(containerId);
      setSelectedContainerId(null);
      store.selectBlock(null);
      return;
    }

    if (targetContainer.outputVar === 'calculationMethod' && !hasConditions) {
      const baseTemplate = getTemplateForMethod(getBaseMethodFromContainers(containers));
      store.setContainers(containers.map((container) => (
        container.id === containerId
          ? { ...container, label: baseTemplate.name, blocks: [createTemplateBlock(baseTemplate)] }
          : container
      )));
      store.selectBlock(null);
      return;
    }

    store.setContainers(containers.map((container) => (
      container.id === containerId
        ? { ...container, blocks: normalizeConditionalKinds(remainingBlocks) }
        : container
    )));
    store.selectBlock(null);
  };

  const handleMoveRule = (containerId: string, blockId: string, direction: -1 | 1) => {
    const targetContainer = containers.find((container) => container.id === containerId);
    if (!targetContainer) return;

    const conditionals = targetContainer.blocks.filter((block) => block.kind === 'if' || block.kind === 'elseIf');
    const fallbackBlocks = targetContainer.blocks.filter((block) => block.kind === 'else');
    const currentIndex = conditionals.findIndex((block) => block.id === blockId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= conditionals.length) return;

    const nextConditionals = [...conditionals];
    const [moved] = nextConditionals.splice(currentIndex, 1);
    nextConditionals.splice(nextIndex, 0, moved);

    store.setContainers(containers.map((container) => (
      container.id === containerId
        ? { ...container, blocks: [...normalizeConditionalKinds(nextConditionals), ...fallbackBlocks] }
        : container
    )));
    store.selectBlock(blockId);
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
  const methodTemplates = useMemo(() => CREDIT_FORMULA_TEMPLATES.map((template) => {
    const methodKey = getTemplateMethodKey(template);
    const backendDefinition = scope?.calculationMethods?.find((method) => method.key === methodKey);
    return {
      ...template,
      name: backendDefinition?.label || template.name,
      equation: backendDefinition?.equation || template.equation,
      description: backendDefinition?.description || template.description,
      useCase: backendDefinition?.useCase || template.useCase,
    };
  }), [scope?.calculationMethods]);
  const configuredContainers = containers.filter((container) => (
    container.blocks.some((block) => block.kind === 'if' || block.kind === 'elseIf')
  ));
  const configuredOutputVars = new Set(configuredContainers.map((container) => container.outputVar));
  const exceptionRules = buildExceptionRules(containers);
  const baseMethod = getBaseMethodFromContainers(containers);
  const activeCreditFormulaTemplate = methodTemplates.find((template) => getTemplateMethodKey(template) === baseMethod) || methodTemplates[0];
  const hasConditionalInstallmentRule = exceptionRules.some(({ container }) => container.outputVar === 'installmentAmount');
  const appliedImpactRules = testResult ? getAppliedExceptionRules(containers, testInputs) : [];
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
  const ruleCountLabel = `${exceptionRules.length} excepcion${exceptionRules.length === 1 ? '' : 'es'}`;
  const selectedContainerForEdit = selectedContainerId && !selectedBlock
    ? containers.find((container) => container.id === selectedContainerId) || null
    : null;
  const shouldShowRightPanel = Boolean(selectedBlock || selectedContainerForEdit);

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
          <button onClick={() => setShowToolbox((value) => !value)} style={{ ...sty.btn(showToolbox ? MD3.secondaryContainer : '#fff', MD3.onSurface), border: `1px solid ${showToolbox ? MD3.secondary : MD3.outlineVariant}` }}>
            <SlidersHorizontal size={14} /> Datos disponibles
          </button>
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
            {isLockedByCredits ? lockedText : 'Sin creditos asociados.'} Los cambios se guardan como nueva version.
          </span>
        </div>
      )}

      <div className="formula-editor-body" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Toolbox */}
        {showToolbox && (
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

          <details style={{ borderTop: `1px solid ${MD3.outlineVariant}`, paddingTop: 12 }}>
            <summary style={{ ...sty.heading, cursor: 'pointer', marginBottom: 10 }}>Avanzado</summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {['+', '-', '*', '/', '(', ')', '=', '>'].map(op => (
                <div key={op} style={sty.opBtn} draggable>{op}</div>
              ))}
            </div>
          </details>

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
        )}

        {/* Guided product editor */}
        <section
          className="formula-product-stage"
          style={{ flex: 1, overflow: 'auto', backgroundColor: '#f4f7fb', minWidth: 0 }}
          onClick={() => { store.selectBlock(null); setSelectedContainerId(null); }}
        >
          <div className="formula-product-content" style={{ width: '100%', maxWidth: 1480, margin: '0 auto', padding: '18px 24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="formula-version-note" style={{ display: 'flex', gap: 10, alignItems: 'center', border: `1px solid ${MD3.outlineVariant}`, backgroundColor: '#ffffff', borderRadius: 12, padding: '10px 12px', color: MD3.onSurface }}>
              <Info size={18} color={MD3.secondary} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>Esta formula se guarda como version exacta.</div>
                <div style={{ fontSize: 12, color: MD3.onSurfaceVariant, lineHeight: 1.35, marginTop: 1 }}>
                  Los creditos nuevos usan la version activa al momento de crearse. Los creditos anteriores conservan su propia version y no se recalculan.
                </div>
              </div>
            </div>

            <div className="formula-workbench-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(620px, 1fr) minmax(360px, 430px)', alignItems: 'start', gap: 14 }}>
            <div className="formula-setup-column" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <section className="formula-product-card formula-method-card" style={{ backgroundColor: '#ffffff', border: `1px solid ${MD3.outlineVariant}`, borderRadius: 14, padding: 16, boxShadow: '0 3px 14px rgba(15,23,42,0.05)' }}>
              <div className="formula-section-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MD3.onSurface }}>
                    <Calculator size={18} color={MD3.secondary} />
                    <span style={{ fontSize: 18, fontWeight: 900 }}>1. Formula base de cuota</span>
                  </div>
                  <div style={{ fontSize: 12, color: MD3.onSurfaceVariant, lineHeight: 1.35, marginTop: 4 }}>
                    Esta eleccion define como se calcula la cuota del credito. Las excepciones de abajo solo cambian casos puntuales.
                  </div>
                </div>
                <div style={{ borderRadius: 999, padding: '6px 10px', background: hasConditionalInstallmentRule ? '#fff8e1' : '#e8f5e9', color: hasConditionalInstallmentRule ? '#8a5a00' : '#1b5e20', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {hasConditionalInstallmentRule ? 'Cuota fija puede reemplazarla' : activeCreditFormulaTemplate?.shortName || 'Sistema base'}
                </div>
              </div>

              <div className="formula-method-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                {methodTemplates.map((template) => {
                  const methodKey = getTemplateMethodKey(template);
                  const isSelected = baseMethod === methodKey;
                  return (
                    <button
                      key={template.key}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        applyCreditFormulaTemplate(template);
                      }}
                      className="formula-method-option"
                      style={{
                        textAlign: 'left',
                        borderRadius: 12,
                        border: `2px solid ${isSelected ? MD3.secondary : MD3.outlineVariant}`,
                        background: isSelected ? '#eef7fb' : '#ffffff',
                        color: MD3.onSurface,
                        padding: 14,
                        cursor: 'pointer',
                        minHeight: 116,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 900 }}>{template.name}</div>
                          <div style={{ color: MD3.onSurfaceVariant, fontSize: 12, marginTop: 2 }}>{template.shortName}</div>
                        </div>
                        {template.badge && (
                          <span style={{ alignSelf: 'flex-start', borderRadius: 999, background: '#dcfce7', color: '#166534', padding: '3px 7px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>
                            {template.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ border: `1px solid ${isSelected ? '#90cdf4' : MD3.outlineVariant}`, background: MD3.surface, borderRadius: 8, padding: '8px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 800, color: MD3.onSurface }}>
                        {template.equation}
                      </div>
                      <div style={{ fontSize: 12, color: MD3.onSurfaceVariant, lineHeight: 1.4 }}>{template.useCase}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="formula-product-card" style={{ backgroundColor: '#ffffff', border: `1px solid ${MD3.outlineVariant}`, borderRadius: 14, padding: 16, boxShadow: '0 3px 14px rgba(15,23,42,0.05)' }}>
              <div className="formula-section-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MD3.onSurface }}>
                    <ListChecks size={18} color={MD3.secondary} />
                    <span style={{ fontSize: 18, fontWeight: 900 }}>2. Reglas de excepcion</span>
                  </div>
                  <div style={{ fontSize: 12, color: MD3.onSurfaceVariant, lineHeight: 1.35, marginTop: 4 }}>
                    Si varias reglas cambian el mismo campo, se leen de arriba hacia abajo y gana la primera que aplique. Reglas de campos distintos se combinan.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <div style={{ padding: '6px 10px', borderRadius: 999, backgroundColor: floatingStatus.bg, color: floatingStatus.fg, fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                    {floatingStatus.label}
                  </div>
                  <div style={{ padding: '6px 10px', borderRadius: 999, backgroundColor: MD3.surface, border: `1px solid ${MD3.outlineVariant}`, fontSize: 11, color: MD3.onSurfaceVariant, fontWeight: 900 }}>
                    {ruleCountLabel}
                  </div>
                </div>
              </div>

              <div className="formula-target-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
                {FORMULA_TARGET_OPTIONS.map((option) => {
                  const isConfigured = configuredOutputVars.has(option.key);
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAddTargetRule(option.key);
                      }}
                      style={{
                        border: `1px solid ${isConfigured ? MD3.secondary : MD3.outlineVariant}`,
                        background: isConfigured ? '#eef7fb' : '#ffffff',
                        borderRadius: 10,
                        color: MD3.onSurface,
                        cursor: 'pointer',
                        padding: '10px 12px',
                        textAlign: 'left',
                      minHeight: 56,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 900 }}>{option.label}</div>
                      <div style={{ color: MD3.onSurfaceVariant, fontSize: 11, lineHeight: 1.35, marginTop: 3 }}>
                        {isConfigured ? 'Agregar otra prioridad' : 'Crear excepcion'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {exceptionRules.length === 0 ? (
                <div className="formula-rule-empty" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', border: `1px dashed ${MD3.outline}`, borderRadius: 12, padding: 16, backgroundColor: MD3.surface }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: '#e6fffa', color: '#0f766e', flexShrink: 0 }}>
                    <ListChecks size={18} />
                  </div>
                  <div>
                    <div style={{ color: MD3.onSurface, fontWeight: 900, fontSize: 14 }}>Sin excepciones.</div>
                    <div style={{ color: MD3.onSurfaceVariant, fontSize: 13, lineHeight: 1.45, marginTop: 3 }}>
                      El credito usara la formula base y los datos reales de la solicitud. Agrega excepciones solo si un producto necesita cambiar tasa, plazo, mora, metodo o cuota fija bajo una condicion.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="formula-rule-groups" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {configuredContainers.map((container) => {
                    const groupRules = exceptionRules.filter((rule) => rule.container.id === container.id);
                    const targetOption = FORMULA_TARGET_OPTIONS.find((option) => option.key === container.outputVar);
                    return (
                      <div key={container.id} style={{ border: `1px solid ${MD3.outlineVariant}`, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 12px', borderBottom: `1px solid ${MD3.outlineVariant}`, backgroundColor: MD3.surface }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 900, color: MD3.onSurface }}>{targetOption?.label || container.label}</div>
                            <div style={{ fontSize: 12, color: MD3.onSurfaceVariant, lineHeight: 1.35, marginTop: 2 }}>{getTargetHelp(container.outputVar)}</div>
                          </div>
                          <button type="button" onClick={(event) => { event.stopPropagation(); handleAddTargetRule(container.outputVar || 'lateFeeMode'); }} style={{ ...sty.btn('#fff', MD3.secondary), border: `1px solid ${MD3.outlineVariant}`, flexShrink: 0 }}>
                            <Plus size={14} /> Agregar
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {groupRules.map(({ block, priority }, index) => (
                            <div key={block.id} className="formula-rule-row" style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 12, alignItems: 'center', padding: 12, borderTop: index === 0 ? 'none' : `1px solid ${MD3.outlineVariant}` }}>
                              <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#eef7fb', display: 'grid', placeItems: 'center', color: MD3.secondary, fontWeight: 900 }}>
                                {priority}
                              </div>
                              <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedContainerId(container.id); store.selectBlock(block.id); }} style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', color: MD3.onSurface, cursor: 'pointer' }}>
                                <div style={{ fontWeight: 800, fontSize: 14 }}>{describeRule(container, block)}</div>
                                {container.outputVar === 'installmentAmount' && (
                                  <div style={{ color: '#8a5a00', fontSize: 12, marginTop: 3 }}>Cuando aplica, esta cuota reemplaza el calculo de la formula base.</div>
                                )}
                              </button>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button type="button" aria-label="Subir prioridad" onClick={(event) => { event.stopPropagation(); handleMoveRule(container.id, block.id, -1); }} style={{ ...sty.btn('transparent', MD3.onSurfaceVariant), padding: 6 }}><ArrowUp size={14} /></button>
                                <button type="button" aria-label="Bajar prioridad" onClick={(event) => { event.stopPropagation(); handleMoveRule(container.id, block.id, 1); }} style={{ ...sty.btn('transparent', MD3.onSurfaceVariant), padding: 6 }}><ArrowDown size={14} /></button>
                                <button type="button" aria-label="Editar excepcion" onClick={(event) => { event.stopPropagation(); setSelectedContainerId(container.id); store.selectBlock(block.id); }} style={{ ...sty.btn('transparent', MD3.secondary), padding: 6 }}><Edit3 size={14} /></button>
                                <button type="button" aria-label="Eliminar excepcion" onClick={(event) => { event.stopPropagation(); handleDeleteBlock(container.id, block.id); }} style={{ ...sty.btn('transparent', MD3.error), padding: 6 }}><Trash2 size={14} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            </div>

            <section className="formula-product-card formula-impact-card" style={{ backgroundColor: '#ffffff', border: `1px solid ${MD3.outlineVariant}`, borderRadius: 14, padding: 16, boxShadow: '0 3px 14px rgba(15,23,42,0.05)', position: 'sticky', top: 12 }}>
              <div className="formula-section-header" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MD3.onSurface }}>
                    <ShieldCheck size={18} color={MD3.secondary} />
                    <span style={{ fontSize: 18, fontWeight: 900 }}>3. Impacto real</span>
                  </div>
                  <div style={{ fontSize: 12, color: MD3.onSurfaceVariant, lineHeight: 1.35, marginTop: 4 }}>
                    Valida con datos de credito antes de guardar. Esto usa el mismo calculo que se aplicara a los creditos nuevos.
                  </div>
                </div>
                <button type="button" className="formula-impact-validate-button" onClick={(event) => { event.stopPropagation(); handleTest(); }} style={{ ...sty.btn(MD3.secondary, '#fff'), padding: '9px 14px', justifyContent: 'center' }}>
                  <Play size={15} /> Validar impacto
                </button>
              </div>

              <div className="formula-impact-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, alignItems: 'start' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 9 }}>
                  {Object.entries(testInputs).map(([key, value]) => (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                        <label style={{ fontSize: 13, fontWeight: 700, color: MD3.onSurface }}>{getFormulaVariableLabel(key)}</label>
                        <span style={{ fontSize: 11, color: MD3.onSurfaceVariant }}>{getInputKindLabel(typeof value === 'number' ? 'number' : key === 'startDate' ? 'date' : key === 'lateFeeMode' ? 'mode' : 'number')}</span>
                      </div>
                      {key === 'lateFeeMode' ? (
                        <select value={normalizeModeValue(String(value))} style={sty.input}
                          onClick={(event) => event.stopPropagation()}
                          onChange={e => setTestInputs(prev => ({ ...prev, [key]: e.target.value }))}>
                          {LATE_FEE_MODE_OPTIONS.map((option) => (
                            <option key={option.key} value={option.key}>{option.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input type={typeof value === 'number' ? 'number' : 'text'} value={value as any} style={sty.input}
                          onClick={(event) => event.stopPropagation()}
                          onChange={e => setTestInputs(prev => ({ ...prev, [key]: typeof value === 'number' ? Number(e.target.value) : e.target.value }))} />
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  {testError && (
                    <div style={{ padding: 12, borderRadius: 10, backgroundColor: '#ffdad6', color: MD3.error, fontSize: 13, fontWeight: 700 }}>{testError}</div>
                  )}

                  {!testError && !testResult && (
                    <div style={{ border: `1px dashed ${MD3.outline}`, borderRadius: 12, padding: 16, color: MD3.onSurfaceVariant, backgroundColor: MD3.surface, fontSize: 13, lineHeight: 1.45 }}>
                      Aun no hay validacion para esta version. Revisa cuota, total, intereses y metodo aplicado antes de activar.
                    </div>
                  )}

                  {testResult && (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div className="formula-impact-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        {[
                          ['Cuota', formatMoney(testResult?.summary?.installmentAmount)],
                          ['Total a pagar', formatMoney(testResult?.summary?.totalPayable)],
                          ['Intereses', formatMoney(testResult?.summary?.totalInterest)],
                          ['Metodo', getFormulaValueLabel(testResult?.calculationMethod, 'calculationMethod')],
                        ].map(([label, value]) => (
                          <div key={label} style={{ border: `1px solid ${MD3.outlineVariant}`, borderRadius: 10, padding: '10px 12px', backgroundColor: MD3.surface }}>
                            <div style={{ fontSize: 10, color: MD3.onSurfaceVariant, textTransform: 'uppercase', fontWeight: 900 }}>{label}</div>
                            <div style={{ fontSize: 15, color: MD3.onSurface, fontWeight: 900, marginTop: 5 }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {appliedImpactRules.length > 0 && (
                        <div style={{ border: '1px solid #bae6fd', backgroundColor: '#f0f9ff', borderRadius: 10, padding: '10px 12px', color: MD3.onSurface, fontSize: 12, lineHeight: 1.45 }}>
                          <div style={{ fontWeight: 900, marginBottom: 4 }}>Excepciones aplicadas en esta prueba</div>
                          {appliedImpactRules.map(({ container, block }) => (
                            <div key={block.id}>
                              {describeRule(container, block)}
                              {container.outputVar === 'installmentAmount' ? ' Esta cuota reemplaza el calculo de la formula base.' : ''}
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ border: `1px solid ${MD3.outlineVariant}`, borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '9px 12px', backgroundColor: MD3.surface, borderBottom: `1px solid ${MD3.outlineVariant}`, fontSize: 12, fontWeight: 900, color: MD3.onSurface }}>
                          Primeras cuotas del cronograma
                        </div>
                        {(testResult?.schedule || []).slice(0, 4).map((row: any) => (
                          <div key={row.installmentNumber} className="formula-schedule-row" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4, padding: '9px 12px', borderTop: `1px solid ${MD3.outlineVariant}`, fontSize: 12, color: MD3.onSurface }}>
                            <strong>Cuota {row.installmentNumber}</strong>
                            <span>Pago {formatMoney(row.scheduledPayment)}</span>
                            <span>Interes {formatMoney(row.interestComponent)}</span>
                            <span>Saldo {formatMoney(row.remainingBalance)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
            </div>
          </div>
        </section>

        {/* Right Panel: rule editor */}
        {shouldShowRightPanel && (
        <aside className="formula-editor-right-panel" style={sty.right}>
          {selectedBlock && (
            <div style={{ padding: 16, borderBottom: `1px solid ${MD3.outlineVariant}` }}>
              <div style={{ ...sty.heading, marginBottom: 12 }}>Editar excepcion</div>
              {selectedBlockContainer && isConditionalRule(selectedBlock.block) && (
                <div style={{ border: `1px solid ${MD3.outlineVariant}`, backgroundColor: MD3.surface, borderRadius: 12, padding: 12, color: MD3.onSurface, fontSize: 13, lineHeight: 1.45, marginBottom: 14 }}>
                  <strong>Lectura operativa:</strong> {describeRule(selectedBlockContainer, selectedBlock.block)}
                </div>
              )}
              {(selectedBlock.block.kind === 'if' || selectedBlock.block.kind === 'elseIf') && selectedBlock.block.condition && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedBlockContainer && (
                    <>
                      <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Que cambia esta excepcion</label>
                      <select style={sty.input} value={selectedBlockContainer.outputVar} onChange={e => handleUpdateContainerOutput(selectedBlockContainer, e.target.value)}>
                        {FORMULA_TARGET_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                      </select>
                      <span style={{ fontSize: 12, color: MD3.onSurfaceVariant, lineHeight: 1.4 }}>{getTargetHelp(selectedBlockContainer.outputVar)}</span>
                    </>
                  )}
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
                  ) : selectedOutputKind === 'formulaMethod' ? (
                    <select style={sty.input} value={normalizeMethodKey(selectedBlock.block.thenValue)}
                      onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { thenValue: e.target.value })}>
                      {methodTemplates.map((template) => (
                        <option key={template.key} value={getTemplateMethodKey(template)}>{template.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input style={sty.input} value={selectedBlock.block.thenValue || ''}
                      onChange={e => store.updateBlock(selectedBlock.containerId, selectedBlock.block.id, { thenValue: e.target.value })} />
                  )}
                  <button onClick={() => handleDeleteBlock(selectedBlock.containerId, selectedBlock.block.id)} style={{ ...sty.btn(MD3.error, '#fff'), justifyContent: 'center', marginTop: 8 }}>
                    <Trash2 size={14} /> Eliminar excepcion
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Selected container properties */}
          {selectedContainerForEdit && (() => {
            const targetOption = FORMULA_TARGET_OPTIONS.find((option) => option.key === selectedContainerForEdit.outputVar);
            return (
              <div style={{ padding: 16, borderBottom: `1px solid ${MD3.outlineVariant}` }}>
                <div style={{ ...sty.heading, marginBottom: 12 }}>Editar regla</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Nombre visible</label>
                  <input style={sty.input} value={selectedContainerForEdit.label} onChange={e => store.updateContainer(selectedContainerForEdit.id, { label: e.target.value })} />
                  <label style={{ fontSize: 11, fontWeight: 700, color: MD3.onSurfaceVariant, textTransform: 'uppercase' }}>Que define esta regla</label>
                  <select style={sty.input} value={selectedContainerForEdit.outputVar} onChange={e => handleUpdateContainerOutput(selectedContainerForEdit, e.target.value)}>
                    {FORMULA_TARGET_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 12, color: MD3.onSurfaceVariant, lineHeight: 1.4 }}>
                    {targetOption?.description || 'Define un valor usado al crear creditos.'}
                    {' '}Si una condicion no aplica, el sistema conserva el valor original de esa etapa.
                  </span>
                  <button onClick={() => store.removeContainer(selectedContainerForEdit.id)} style={{ ...sty.btn(MD3.error, '#fff'), justifyContent: 'center', marginTop: 8 }}>
                    <Trash2 size={14} /> Eliminar regla
                  </button>
                </div>
              </div>
            );
          })()}

        </aside>
        )}
      </div>
    </div>
  );
}
