// frontend/src/lib/blockCompiler.ts
//
// Compiles visual BlockDefinition[] → DagGraph (nodes + edges + formula strings).
//
// The user sees ONLY their business logic blocks in the editor — never raw
// function calls or pipeline nodes. However, when saving to the backend,
// the compiler MUST inject the required pipeline nodes (schedule, summary,
// result) because the backend scopeRegistry validates their presence.
//
// Flow:
//   UI blocks → compileBlocksToGraph() → DagGraph with pipeline → POST /api
//   GET /api → DagGraph → decompileGraphToContainers() → UI blocks (no pipeline)

import type { BlockDefinition, FormulaContainer, DagGraph, DagNode, DagEdge } from '../types/dag';
import {
  FRENCH_INSTALLMENT_FORMULA,
  findCreditFormulaTemplate,
  getFormulaFromBlock,
} from './creditFormulaTemplates';

// ── Pipeline node IDs that are auto-generated (never shown in editor) ─────────
const PIPELINE_NODE_IDS = new Set([
  'input_amount', 'input_rate', 'input_term', 'input_startDate', 'input_lateFeeMode',
  'calculation_method', 'monthly_rate', 'installment_amount', 'total_payable', 'total_interest',
  'amortization_schedule', 'financial_summary', 'credit_result',
  'schedule_node', 'summary_node', 'result', 'schedule', 'summary',
]);

// Domain helper functions — never shown as editable formulas
const DOMAIN_HELPERS = new Set([
  'buildAmortizationSchedule', 'summarizeSchedule', 'buildCreditResult',
  'assertSupportedLateFeeMode', 'calculateLateFee', 'roundCurrency',
]);

/**
 * Compile a conditional chain (if/elseIf/else blocks) into a nested
 * mathjs-compatible formula string.
 */
function getFallbackExpressionForTarget(outputVar?: string): string {
  if (outputVar === 'interestRate') return 'interestRate';
  if (outputVar === 'termMonths') return 'termMonths';
  if (outputVar === 'lateFeeMode') return 'lateFeeMode';
  if (outputVar === 'calculationMethod') return 'calculationMethod';
  if (outputVar === 'installmentAmount') return '0';
  return '0';
}

function normalizeConditionalValue(value: string | undefined, outputVar?: string): string {
  const raw = String(value ?? '').trim();
  if (!['lateFeeMode', 'calculationMethod'].includes(String(outputVar || '').trim())) {
    return raw || '0';
  }

  if (raw === outputVar) {
    return raw;
  }

  const fallback = outputVar === 'calculationMethod' ? 'FRENCH' : 'NONE';
  const normalized = raw || fallback;
  const isQuoted = /^'.*'$/.test(normalized) || /^".*"$/.test(normalized);
  if (isQuoted) return normalized;

  return `'${normalized.replace(/'/g, "\\'")}'`;
}

function compileConditionalChain(blocks: BlockDefinition[], outputVar?: string): string {
  if (blocks.length === 0) return getFallbackExpressionForTarget(outputVar);
  const first = blocks[0];

  if (first.kind === 'else') return normalizeConditionalValue(first.elseValue, outputVar);

  if (first.kind === 'if' || first.kind === 'elseIf') {
    const cond = first.condition;
    if (!cond) return normalizeConditionalValue(first.thenValue, outputVar);
    const condStr = `${cond.variable} ${cond.operator} ${cond.value}`;
    return `(${condStr}) ? ${normalizeConditionalValue(first.thenValue, outputVar)} : ${compileConditionalChain(blocks.slice(1), outputVar)}`;
  }

  return compileConditionalChain(blocks.slice(1), outputVar);
}

/**
 * Compile a single FormulaContainer into DagGraph node(s).
 */
function compileContainer(container: FormulaContainer): DagNode[] {
  const conditionals = container.blocks.filter(
    (b) => b.kind === 'if' || b.kind === 'elseIf' || b.kind === 'else'
  );
  const expressions = container.blocks.filter((b) => b.kind === 'expression');

  if (conditionals.length > 0) {
    return [{
      id: `conditional_${container.id}`,
      kind: 'conditional',
      label: container.label,
      formula: compileConditionalChain(conditionals, container.outputVar),
      outputVar: container.outputVar,
    }];
  }

  if (expressions.length > 0) {
    return [{
      id: `formula_${container.id}`,
      kind: 'formula',
      label: container.label,
      formula: expressions.map((b) => getFormulaFromBlock(b)).filter(Boolean).join(' ') || '0',
      outputVar: container.outputVar,
    }];
  }

  return [];
}

/**
 * The standard credit calculation nodes required by the backend contract.
 * These are injected automatically when compiling — the user never sees them.
 */
function getCreditCalculationPipeline(): { nodes: DagNode[]; edges: DagEdge[] } {
  const nodes: DagNode[] = [
    { id: 'input_amount', kind: 'constant', label: 'Monto del credito', outputVar: 'amount' },
    { id: 'input_rate', kind: 'constant', label: 'Tasa nominal', outputVar: 'interestRate' },
    { id: 'input_term', kind: 'constant', label: 'Plazo', outputVar: 'termMonths' },
    { id: 'input_startDate', kind: 'constant', label: 'Fecha inicio', outputVar: 'startDate' },
    { id: 'input_lateFeeMode', kind: 'constant', label: 'Modo de mora', outputVar: 'lateFeeMode' },
    { id: 'calculation_method', kind: 'formula', label: 'Metodo de calculo', formula: "'FRENCH'", outputVar: 'calculationMethod' },
    { id: 'monthly_rate', kind: 'formula', label: 'Tasa mensual', formula: 'interestRate / 100 / 12', outputVar: 'monthlyRate' },
    { id: 'installment_amount', kind: 'formula', label: 'Cuota mensual', formula: FRENCH_INSTALLMENT_FORMULA, outputVar: 'installmentAmount' },
    { id: 'total_payable', kind: 'formula', label: 'Total a pagar', formula: 'round(installmentAmount * termMonths, 2)', outputVar: 'totalPayable' },
    { id: 'total_interest', kind: 'formula', label: 'Total intereses', formula: 'round(totalPayable - amount, 2)', outputVar: 'totalInterest' },
    { id: 'amortization_schedule', kind: 'formula', label: 'Cronograma', formula: 'buildAmortizationSchedule(amount, interestRate, termMonths, startDate, lateFeeMode, installmentAmount, calculationMethod)', outputVar: 'schedule' },
    { id: 'financial_summary', kind: 'formula', label: 'Resumen financiero', formula: 'summarizeSchedule(schedule)', outputVar: 'summary' },
    { id: 'credit_result', kind: 'output', label: 'Resultado del credito', formula: 'buildCreditResult(lateFeeMode, schedule, summary, calculationMethod)', outputVar: 'result' },
  ];

  const edges: DagEdge[] = [
    { source: 'input_rate', target: 'monthly_rate' },
    { source: 'input_amount', target: 'installment_amount' },
    { source: 'input_term', target: 'installment_amount' },
    { source: 'monthly_rate', target: 'installment_amount' },
    { source: 'installment_amount', target: 'total_payable' },
    { source: 'input_term', target: 'total_payable' },
    { source: 'total_payable', target: 'total_interest' },
    { source: 'input_amount', target: 'total_interest' },
    { source: 'input_amount', target: 'amortization_schedule' },
    { source: 'input_rate', target: 'amortization_schedule' },
    { source: 'input_term', target: 'amortization_schedule' },
    { source: 'input_startDate', target: 'amortization_schedule' },
    { source: 'input_lateFeeMode', target: 'amortization_schedule' },
    { source: 'calculation_method', target: 'amortization_schedule' },
    { source: 'installment_amount', target: 'amortization_schedule' },
    { source: 'amortization_schedule', target: 'financial_summary' },
    { source: 'input_lateFeeMode', target: 'credit_result' },
    { source: 'calculation_method', target: 'credit_result' },
    { source: 'amortization_schedule', target: 'credit_result' },
    { source: 'financial_summary', target: 'credit_result' },
  ];

  return { nodes, edges };
}

/**
 * Compile visual blocks into a COMPLETE DagGraph ready for the backend.
 * Includes both user-defined blocks AND the required pipeline nodes.
 * The pipeline is invisible in the UI but required by backend validation.
 */
export function compileBlocksToGraph(containers: FormulaContainer[]): DagGraph {
  // 1. Compile user containers into nodes
  const userNodes: DagNode[] = [];
  for (const container of containers) {
    userNodes.push(...compileContainer(container));
  }

  // 2. Get the pipeline that the backend requires
  const pipeline = getCreditCalculationPipeline();

  // 3. Allow user blocks to override pipeline calculations by outputVar.
  //    Example: if a container outputs "lateFeeMode", that node replaces
  //    the default input_lateFeeMode step and drives downstream nodes.
  const replacementByPipelineNodeId = new Map<string, string>();
  const replacementByOutputVar = new Map<string, DagNode>();

  userNodes.forEach((node) => {
    const outputVar = String(node.outputVar || '').trim();
    if (outputVar) {
      replacementByOutputVar.set(outputVar, node);
    }
  });

  pipeline.nodes.forEach((pipelineNode) => {
    const outputVar = String(pipelineNode.outputVar || '').trim();
    if (!outputVar) return;
    const replacementNode = replacementByOutputVar.get(outputVar);
    if (replacementNode) {
      replacementByPipelineNodeId.set(pipelineNode.id, replacementNode.id);
    }
  });

  const pipelineNodes = pipeline.nodes.filter((node) => !replacementByPipelineNodeId.has(node.id));

  // 4. Rewire pipeline edges through replacements.
  const rewiredPipelineEdges: DagEdge[] = [];
  for (const edge of pipeline.edges) {
    const source = replacementByPipelineNodeId.get(edge.source) || edge.source;
    const target = replacementByPipelineNodeId.get(edge.target) || edge.target;
    if (!source || !target || source === target) continue;
    rewiredPipelineEdges.push({ source, target });
  }

  // 5. Connect user containers only when a later formula references an earlier
  //    output variable. Blindly chaining all user nodes can introduce false
  //    cycles when independent business rules override pipeline values.
  const userEdges: DagEdge[] = [];
  for (let targetIndex = 0; targetIndex < userNodes.length; targetIndex += 1) {
    const targetNode = userNodes[targetIndex];
    const formula = String(targetNode.formula || '');
    for (let sourceIndex = 0; sourceIndex < targetIndex; sourceIndex += 1) {
      const sourceNode = userNodes[sourceIndex];
      const outputVar = String(sourceNode.outputVar || '').trim();
      if (!outputVar) continue;
      const referencesOutput = new RegExp(`\\b${outputVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(formula);
      if (referencesOutput) {
        userEdges.push({ source: sourceNode.id, target: targetNode.id });
      }
    }
  }

  const allNodes = [...pipelineNodes, ...userNodes];
  const validNodeIds = new Set(allNodes.map((node) => node.id));
  const uniqueEdges = new Map<string, DagEdge>();

  [...rewiredPipelineEdges, ...userEdges].forEach((edge) => {
    if (!validNodeIds.has(edge.source) || !validNodeIds.has(edge.target)) return;
    const key = `${edge.source}->${edge.target}`;
    if (!uniqueEdges.has(key)) {
      uniqueEdges.set(key, edge);
    }
  });

  return {
    nodes: allNodes,
    edges: Array.from(uniqueEdges.values()),
  };
}

/**
 * Decompile a DagGraph back into FormulaContainer[] for the visual editor.
 * Filters out ALL pipeline/backend nodes — only user-defined logic is shown.
 */
export function decompileGraphToContainers(graph: DagGraph): FormulaContainer[] {
  const containers: FormulaContainer[] = [];

  for (const node of graph.nodes) {
    // Skip pipeline nodes
    if (PIPELINE_NODE_IDS.has(node.id)) continue;

    // Skip constant (input) nodes
    if (node.kind === 'constant') continue;

    // Skip output nodes (result assembler)
    if (node.kind === 'output') continue;

    // Skip domain helper formulas
    const formula = node.formula || '';
    const helperMatch = formula.match(/^(\w+)\s*\(/);
    if (helperMatch && DOMAIN_HELPERS.has(helperMatch[1])) continue;

    // Parse the formula back into visual blocks
    const blocks = parseFormulaToBlocks(formula, node.outputVar, node.label);

    containers.push({
      id: node.id.replace(/^(conditional_|formula_)/, ''),
      label: node.label || node.id,
      blocks,
      outputVar: node.outputVar || node.id,
    });
  }

  return containers;
}

// ── Formula → Blocks parser ───────────────────────────────────────────────────

function parseFormulaToBlocks(formula: string, outputVar?: string, nodeLabel?: string): BlockDefinition[] {
  if (!formula) return [];

  const trimmed = formula.trim();
  const blocks: BlockDefinition[] = [];

  if (parseConditionalFormula(trimmed, blocks, true)) {
    return blocks;
  }

  const template = outputVar === 'calculationMethod' || outputVar === 'installmentAmount'
    ? findCreditFormulaTemplate(trimmed)
    : null;

  return [{
    id: generateBlockId('expr'),
    kind: 'expression',
    label: template?.name || nodeLabel || formula,
    formula,
    templateKey: template?.key,
  }];
}

function parseConditionalFormula(formula: string, blocks: BlockDefinition[], isFirst: boolean): boolean {
  const normalized = stripBalancedOuterParens(formula.trim());
  const functionBody = getConditionalFunctionBody(normalized);

  if (functionBody) {
    parseFunctionConditionalChain(functionBody, blocks, isFirst);
    return true;
  }

  const ternaryParts = splitTopLevelTernary(normalized);
  if (!ternaryParts) {
    return false;
  }

  const condParsed = parseCondition(stripBalancedOuterParens(ternaryParts.condition.trim()));
  blocks.push({
    id: generateBlockId(isFirst ? 'if' : 'elseIf'),
    kind: isFirst ? 'if' : 'elseIf',
    condition: condParsed,
    thenValue: stripBalancedOuterParens(ternaryParts.thenValue.trim()),
  });

  const elseStr = stripBalancedOuterParens(ternaryParts.elseValue.trim());
  if (!parseConditionalFormula(elseStr, blocks, false) && elseStr && elseStr !== '0') {
    blocks.push({ id: generateBlockId('else'), kind: 'else', elseValue: elseStr });
  }

  return true;
}

function parseFunctionConditionalChain(functionBody: string, blocks: BlockDefinition[], isFirst: boolean): void {
  const parts = splitTopLevelCommas(functionBody);
  if (parts.length < 3) {
    blocks.push({ id: generateBlockId('expr'), kind: 'expression', label: functionBody });
    return;
  }

  const condParsed = parseCondition(parts[0].trim());
  blocks.push({
    id: generateBlockId(isFirst ? 'if' : 'elseIf'),
    kind: isFirst ? 'if' : 'elseIf',
    condition: condParsed,
    thenValue: parts[1].trim(),
  });

  const elseStr = parts.slice(2).join(',').trim();
  if (!parseConditionalFormula(elseStr, blocks, false) && elseStr && elseStr !== '0') {
    blocks.push({ id: generateBlockId('else'), kind: 'else', elseValue: elseStr });
  }
}

function getConditionalFunctionBody(formula: string): string | null {
  const candidates = ['ifThenElse', 'if'];
  for (const name of candidates) {
    const prefix = `${name}(`;
    if (!formula.startsWith(prefix) || !formula.endsWith(')')) {
      continue;
    }

    const body = formula.slice(prefix.length, -1);
    if (hasBalancedParens(body)) {
      return body;
    }
  }

  return null;
}

function stripBalancedOuterParens(value: string): string {
  let result = value.trim();

  while (result.startsWith('(') && result.endsWith(')')) {
    const inner = result.slice(1, -1);
    if (!hasBalancedParens(inner)) {
      break;
    }

    let depth = 0;
    let wrapsWholeExpression = true;
    for (let index = 0; index < result.length; index += 1) {
      const char = result[index];
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      if (depth === 0 && index < result.length - 1) {
        wrapsWholeExpression = false;
        break;
      }
    }

    if (!wrapsWholeExpression) {
      break;
    }

    result = inner.trim();
  }

  return result;
}

function hasBalancedParens(value: string): boolean {
  let depth = 0;
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function splitTopLevelTernary(str: string): { condition: string; thenValue: string; elseValue: string } | null {
  let depth = 0;
  let questionIndex = -1;

  for (let index = 0; index < str.length; index += 1) {
    const char = str[index];
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === '?' && depth === 0) {
      questionIndex = index;
      break;
    }
  }

  if (questionIndex === -1) {
    return null;
  }

  depth = 0;
  let nestedTernaries = 0;
  let colonIndex = -1;

  for (let index = questionIndex + 1; index < str.length; index += 1) {
    const char = str[index];
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth !== 0) continue;

    if (char === '?') {
      nestedTernaries += 1;
      continue;
    }

    if (char === ':') {
      if (nestedTernaries === 0) {
        colonIndex = index;
        break;
      }
      nestedTernaries -= 1;
    }
  }

  if (colonIndex === -1) {
    return null;
  }

  return {
    condition: str.slice(0, questionIndex),
    thenValue: str.slice(questionIndex + 1, colonIndex),
    elseValue: str.slice(colonIndex + 1),
  };
}

function parseIfChain(formula: string, blocks: BlockDefinition[], isFirst: boolean): void {
  const functionBody = getConditionalFunctionBody(formula.trim());
  if (!functionBody) {
    if (formula.trim() && formula.trim() !== '0') {
      blocks.push({ id: generateBlockId('else'), kind: 'else', elseValue: formula.trim() });
    }
    return;
  }

  const parts = splitTopLevelCommas(functionBody);
  if (parts.length < 3) {
    blocks.push({ id: generateBlockId('expr'), kind: 'expression', label: formula });
    return;
  }

  const condParsed = parseCondition(parts[0].trim());
  blocks.push({
    id: generateBlockId(isFirst ? 'if' : 'elseIf'),
    kind: isFirst ? 'if' : 'elseIf',
    condition: condParsed,
    thenValue: parts[1].trim(),
  });

  const elseStr = parts.slice(2).join(',').trim();
  if (getConditionalFunctionBody(elseStr)) {
    parseIfChain(elseStr, blocks, false);
  } else if (elseStr && elseStr !== '0') {
    blocks.push({ id: generateBlockId('else'), kind: 'else', elseValue: elseStr });
  }
}

function parseCondition(s: string): { variable: string; operator: '>' | '<' | '>=' | '<=' | '==' | '!='; value: string } {
  for (const op of ['>=', '<=', '!=', '==', '>', '<'] as const) {
    const idx = s.indexOf(op);
    if (idx !== -1) return { variable: s.slice(0, idx).trim(), operator: op, value: s.slice(idx + op.length).trim() };
  }
  return { variable: s, operator: '>', value: '0' };
}

function splitTopLevelCommas(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of str) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) { parts.push(current); current = ''; }
    else current += char;
  }
  if (current) parts.push(current);
  return parts;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

let blockCounter = 0;
export function generateBlockId(prefix: string = 'block'): string {
  blockCounter++;
  return `${prefix}_${Date.now()}_${blockCounter}`;
}
