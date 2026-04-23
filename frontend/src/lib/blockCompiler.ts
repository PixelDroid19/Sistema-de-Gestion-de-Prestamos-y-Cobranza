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

// ── Pipeline node IDs that are auto-generated (never shown in editor) ─────────
const PIPELINE_NODE_IDS = new Set([
  'input_amount', 'input_rate', 'input_term', 'input_startDate', 'input_lateFeeMode',
  'monthly_rate', 'installment_amount', 'total_payable', 'total_interest',
  'amortization_schedule', 'financial_summary', 'simulation_result',
  // Legacy aliases
  'schedule_node', 'summary_node', 'result', 'schedule', 'summary',
]);

// Domain helper functions — never shown as editable formulas
const DOMAIN_HELPERS = new Set([
  'buildAmortizationSchedule', 'summarizeSchedule', 'buildSimulationResult',
  'assertSupportedLateFeeMode', 'calculateLateFee', 'roundCurrency',
]);

/**
 * Compile a conditional chain (if/elseIf/else blocks) into a nested
 * mathjs-compatible formula string.
 */
function compileConditionalChain(blocks: BlockDefinition[]): string {
  if (blocks.length === 0) return '0';
  const first = blocks[0];

  if (first.kind === 'else') return first.elseValue ?? '0';

  if (first.kind === 'if' || first.kind === 'elseIf') {
    const cond = first.condition;
    if (!cond) return first.thenValue ?? '0';
    const condStr = `${cond.variable} ${cond.operator} ${cond.value}`;
    return `if(${condStr}, ${first.thenValue ?? '0'}, ${compileConditionalChain(blocks.slice(1))})`;
  }

  return compileConditionalChain(blocks.slice(1));
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
      formula: compileConditionalChain(conditionals),
      outputVar: container.outputVar,
    }];
  }

  if (expressions.length > 0) {
    return [{
      id: `formula_${container.id}`,
      kind: 'formula',
      label: container.label,
      formula: expressions.map((b) => b.label || '').filter(Boolean).join(' ') || '0',
      outputVar: container.outputVar,
    }];
  }

  return [];
}

/**
 * The standard pipeline nodes required by the backend for credit-simulation scope.
 * These are injected automatically when compiling — the user never sees them.
 */
function getCreditSimulationPipeline(): { nodes: DagNode[]; edges: DagEdge[] } {
  const nodes: DagNode[] = [
    { id: 'input_amount', kind: 'constant', label: 'Monto del credito', outputVar: 'amount' },
    { id: 'input_rate', kind: 'constant', label: 'Tasa nominal', outputVar: 'interestRate' },
    { id: 'input_term', kind: 'constant', label: 'Plazo', outputVar: 'termMonths' },
    { id: 'input_startDate', kind: 'constant', label: 'Fecha inicio', outputVar: 'startDate' },
    { id: 'input_lateFeeMode', kind: 'constant', label: 'Modo de mora', outputVar: 'lateFeeMode' },
    { id: 'monthly_rate', kind: 'formula', label: 'Tasa mensual', formula: 'interestRate / 100 / 12', outputVar: 'monthlyRate' },
    { id: 'installment_amount', kind: 'formula', label: 'Cuota mensual', formula: 'ifThenElse(monthlyRate == 0, round(amount / termMonths, 2), round(amount * monthlyRate * pow(1 + monthlyRate, termMonths) / (pow(1 + monthlyRate, termMonths) - 1), 2))', outputVar: 'installmentAmount' },
    { id: 'total_payable', kind: 'formula', label: 'Total a pagar', formula: 'round(installmentAmount * termMonths, 2)', outputVar: 'totalPayable' },
    { id: 'total_interest', kind: 'formula', label: 'Total intereses', formula: 'round(totalPayable - amount, 2)', outputVar: 'totalInterest' },
    { id: 'amortization_schedule', kind: 'formula', label: 'Cronograma', formula: 'buildAmortizationSchedule(amount, interestRate, termMonths, startDate, lateFeeMode)', outputVar: 'schedule' },
    { id: 'financial_summary', kind: 'formula', label: 'Resumen financiero', formula: 'summarizeSchedule(schedule)', outputVar: 'summary' },
    { id: 'simulation_result', kind: 'output', label: 'Resultado final', formula: 'buildSimulationResult(lateFeeMode, schedule, summary)', outputVar: 'result' },
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
    { source: 'amortization_schedule', target: 'financial_summary' },
    { source: 'input_lateFeeMode', target: 'simulation_result' },
    { source: 'amortization_schedule', target: 'simulation_result' },
    { source: 'financial_summary', target: 'simulation_result' },
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
  const pipeline = getCreditSimulationPipeline();

  // 3. Merge: user nodes first, then pipeline (avoiding ID collisions)
  const userNodeIds = new Set(userNodes.map((n) => n.id));
  const pipelineNodes = pipeline.nodes.filter((n) => !userNodeIds.has(n.id));
  const pipelineEdges = pipeline.edges.filter(
    (e) => !userNodeIds.has(e.source) || PIPELINE_NODE_IDS.has(e.source)
  );

  // 4. Wire user nodes into the pipeline: last user node → first formula pipeline node
  const allEdges = [...pipelineEdges];
  if (userNodes.length > 0) {
    // Wire user nodes sequentially
    for (let i = 0; i < userNodes.length - 1; i++) {
      allEdges.push({ source: userNodes[i].id, target: userNodes[i + 1].id });
    }
  }

  return {
    nodes: [...userNodes, ...pipelineNodes],
    edges: allEdges,
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
    const blocks = parseFormulaToBlocks(formula);

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

function parseFormulaToBlocks(formula: string): BlockDefinition[] {
  if (!formula) return [];

  const ifMatch = formula.match(/^if\((.+)\)$/);
  if (!ifMatch) {
    return [{ id: generateBlockId('expr'), kind: 'expression', label: formula }];
  }

  const blocks: BlockDefinition[] = [];
  parseIfChain(formula, blocks, true);
  return blocks;
}

function parseIfChain(formula: string, blocks: BlockDefinition[], isFirst: boolean): void {
  const ifMatch = formula.match(/^if\((.+)\)$/);
  if (!ifMatch) {
    if (formula.trim() && formula.trim() !== '0') {
      blocks.push({ id: generateBlockId('else'), kind: 'else', elseValue: formula.trim() });
    }
    return;
  }

  const parts = splitTopLevelCommas(ifMatch[1]);
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
  if (elseStr.startsWith('if(')) {
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
