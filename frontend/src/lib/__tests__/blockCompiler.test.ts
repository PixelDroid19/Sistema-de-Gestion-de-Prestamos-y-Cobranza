import { describe, it, expect } from 'vitest';
import {
  compileBlocksToGraph,
  decompileGraphToContainers,
  generateBlockId,
} from '../../lib/blockCompiler';
import type { FormulaContainer, BlockDefinition, DagGraph } from '../../types/dag';
import { CREDIT_FORMULA_TEMPLATES } from '../creditFormulaTemplates';

// ── Required backend contract (from scopeRegistry.js) ─────────────────────────
const REQUIRED_OUTPUT_VARS = ['lateFeeMode', 'schedule', 'summary', 'result'];
const REQUIRED_PIPELINE_IDS = [
  'input_amount', 'input_rate', 'input_term', 'input_startDate', 'input_lateFeeMode',
  'calculation_method', 'monthly_rate', 'installment_amount', 'total_payable', 'total_interest',
  'amortization_schedule', 'financial_summary', 'credit_result',
];

describe('blockCompiler', () => {
  // ── compileBlocksToGraph ──────────────────────────────────────────────────

  describe('compileBlocksToGraph', () => {
    it('compiles empty containers with full pipeline', () => {
      const graph = compileBlocksToGraph([]);
      expect(graph.nodes.length).toBe(REQUIRED_PIPELINE_IDS.length);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('injects ALL required pipeline node IDs', () => {
      const graph = compileBlocksToGraph([]);
      const nodeIds = new Set(graph.nodes.map((n) => n.id));
      for (const id of REQUIRED_PIPELINE_IDS) {
        expect(nodeIds.has(id), `Missing pipeline node: ${id}`).toBe(true);
      }
    });

    it('produces all required outputVar values for backend contract', () => {
      const graph = compileBlocksToGraph([]);
      const outputVars = new Set(graph.nodes.map((n) => n.outputVar).filter(Boolean));
      for (const v of REQUIRED_OUTPUT_VARS) {
        expect(outputVars.has(v), `Missing required outputVar: ${v}`).toBe(true);
      }
    });

    it('includes user container nodes alongside pipeline', () => {
      const containers: FormulaContainer[] = [{
        id: 'risk',
        label: 'Risk Rate',
        outputVar: 'riskRate',
        blocks: [
          { id: 'if1', kind: 'if', condition: { variable: 'amount', operator: '>', value: '5000000' }, thenValue: '0.02' },
          { id: 'else1', kind: 'else', elseValue: '0.05' },
        ],
      }];

      const graph = compileBlocksToGraph(containers);
      const userNode = graph.nodes.find((n) => n.id === 'conditional_risk');
      expect(userNode).toBeDefined();
      expect(userNode!.outputVar).toBe('riskRate');
      expect(userNode!.formula).toBe('(amount > 5000000) ? 0.02 : 0.05');
      // Pipeline nodes still present
      expect(graph.nodes.find((n) => n.id === 'credit_result')).toBeDefined();
    });

    it('replaces matching pipeline nodes when outputVar is overridden', () => {
      const containers: FormulaContainer[] = [{
        id: 'custom_late_fee',
        label: 'Custom Late Fee Mode',
        outputVar: 'lateFeeMode',
        blocks: [
          { id: 'if1', kind: 'if', condition: { variable: 'amount', operator: '>', value: '1000000' }, thenValue: "'COMPOUND'" },
          { id: 'else1', kind: 'else', elseValue: "'SIMPLE'" },
        ],
      }];

      const graph = compileBlocksToGraph(containers);
      const userNode = graph.nodes.find((n) => n.id === 'conditional_custom_late_fee');
      const pipelineNode = graph.nodes.find((n) => n.id === 'input_lateFeeMode');

      expect(userNode).toBeDefined();
      expect(pipelineNode).toBeUndefined();
      expect(graph.edges.some((e) => e.source === 'conditional_custom_late_fee' && e.target === 'amortization_schedule')).toBe(true);
      expect(graph.edges.some((e) => e.source === 'conditional_custom_late_fee' && e.target === 'credit_result')).toBe(true);
    });

    it('auto-quotes lateFeeMode values in conditional formulas', () => {
      const containers: FormulaContainer[] = [{
        id: 'late_fee_modes',
        label: 'Late Fee Modes',
        outputVar: 'lateFeeMode',
        blocks: [
          { id: 'if1', kind: 'if', condition: { variable: 'amount', operator: '>', value: '1000000' }, thenValue: 'COMPOUND' },
          { id: 'else1', kind: 'else', elseValue: 'SIMPLE' },
        ],
      }];

      const graph = compileBlocksToGraph(containers);
      const node = graph.nodes.find((n) => n.id === 'conditional_late_fee_modes');

      expect(node).toBeDefined();
      expect(node!.formula).toBe("(amount > 1000000) ? 'COMPOUND' : 'SIMPLE'");
    });

    it('keeps original system values when editable credit rules have no fallback branch', () => {
      const containers: FormulaContainer[] = [
        {
          id: 'rate_policy',
          label: 'Tasa aplicada',
          outputVar: 'interestRate',
          blocks: [
            { id: 'if1', kind: 'if', condition: { variable: 'amount', operator: '>', value: '1000000' }, thenValue: '55' },
          ],
        },
        {
          id: 'late_policy',
          label: 'Politica de mora',
          outputVar: 'lateFeeMode',
          blocks: [
            { id: 'if2', kind: 'if', condition: { variable: 'amount', operator: '>', value: '1000000' }, thenValue: 'COMPOUND' },
          ],
        },
      ];

      const graph = compileBlocksToGraph(containers);
      const rateNode = graph.nodes.find((n) => n.id === 'conditional_rate_policy');
      const lateFeeNode = graph.nodes.find((n) => n.id === 'conditional_late_policy');

      expect(rateNode!.formula).toBe('(amount > 1000000) ? 55 : interestRate');
      expect(lateFeeNode!.formula).toBe("(amount > 1000000) ? 'COMPOUND' : lateFeeMode");
    });

    it('compiles nested if/elseIf/else chain correctly', () => {
      const containers: FormulaContainer[] = [{
        id: 'tier',
        label: 'Tier Rate',
        outputVar: 'tierRate',
        blocks: [
          { id: 'if1', kind: 'if', condition: { variable: 'amount', operator: '>', value: '10000000' }, thenValue: '0.03' },
          { id: 'elif1', kind: 'elseIf', condition: { variable: 'amount', operator: '>', value: '5000000' }, thenValue: '0.04' },
          { id: 'elif2', kind: 'elseIf', condition: { variable: 'amount', operator: '>', value: '1000000' }, thenValue: '0.05' },
          { id: 'else1', kind: 'else', elseValue: '0.06' },
        ],
      }];

      const graph = compileBlocksToGraph(containers);
      const node = graph.nodes.find((n) => n.id === 'conditional_tier');
      expect(node!.formula).toBe(
        '(amount > 10000000) ? 0.03 : (amount > 5000000) ? 0.04 : (amount > 1000000) ? 0.05 : 0.06'
      );
    });

    it('compiles expression blocks', () => {
      const containers: FormulaContainer[] = [{
        id: 'calc',
        label: 'Custom Calc',
        outputVar: 'customVal',
        blocks: [
          { id: 'e1', kind: 'expression', label: 'amount * 0.1' },
        ],
      }];

      const graph = compileBlocksToGraph(containers);
      const node = graph.nodes.find((n) => n.id === 'formula_calc');
      expect(node).toBeDefined();
      expect(node!.formula).toBe('amount * 0.1');
    });

    it('compiles financial template formulas from executable formula fields', () => {
      const template = CREDIT_FORMULA_TEMPLATES.find((item) => item.key === 'simple_interest')!;
      const containers: FormulaContainer[] = [{
        id: 'simple_interest',
        label: template.name,
        outputVar: 'calculationMethod',
        blocks: [
          { id: 'e1', kind: 'expression', label: template.name, formula: template.formula, templateKey: template.key },
        ],
      }];

      const graph = compileBlocksToGraph(containers);
      const node = graph.nodes.find((n) => n.id === 'formula_simple_interest');
      expect(node).toBeDefined();
      expect(node!.formula).toBe(template.formula);
      expect(graph.nodes.find((n) => n.id === 'calculation_method')).toBeUndefined();
      expect(graph.edges.some((edge) => edge.source === 'formula_simple_interest' && edge.target === 'amortization_schedule')).toBe(true);
    });

    it('wires user containers only when a later rule references an earlier output', () => {
      const containers: FormulaContainer[] = [
        { id: 'a', label: 'Step A', outputVar: 'stepA', blocks: [{ id: 'e1', kind: 'expression', label: 'amount * 2' }] },
        { id: 'b', label: 'Step B', outputVar: 'stepB', blocks: [{ id: 'e2', kind: 'expression', label: 'stepA + 100' }] },
        { id: 'c', label: 'Step C', outputVar: 'stepC', blocks: [{ id: 'e3', kind: 'expression', label: 'amount + 100' }] },
      ];

      const graph = compileBlocksToGraph(containers);
      const edgeBetween = graph.edges.find(
        (e) => e.source === 'formula_a' && e.target === 'formula_b'
      );
      const unrelatedEdge = graph.edges.find(
        (e) => e.source === 'formula_b' && e.target === 'formula_c'
      );
      expect(edgeBetween).toBeDefined();
      expect(unrelatedEdge).toBeUndefined();
    });

    it('does not duplicate pipeline nodes when user node IDs collide', () => {
      // Edge case: user container ID that matches a pipeline ID prefix
      const containers: FormulaContainer[] = [{
        id: 'input_amount', // collides with pipeline
        label: 'Override',
        outputVar: 'custom',
        blocks: [{ id: 'e1', kind: 'expression', label: '42' }],
      }];

      const graph = compileBlocksToGraph(containers);
      const amountNodes = graph.nodes.filter((n) => n.id === 'input_amount');
      // Pipeline uses 'input_amount', user generates 'formula_input_amount' — no collision
      expect(amountNodes.length).toBe(1);
    });

    it('produces valid graph structure (all edge references exist)', () => {
      const containers: FormulaContainer[] = [{
        id: 'test',
        label: 'Test',
        outputVar: 'testVar',
        blocks: [
          { id: 'if1', kind: 'if', condition: { variable: 'termMonths', operator: '>=', value: '24' }, thenValue: '0.01' },
          { id: 'else1', kind: 'else', elseValue: '0.02' },
        ],
      }];

      const graph = compileBlocksToGraph(containers);
      const nodeIds = new Set(graph.nodes.map((n) => n.id));

      for (const edge of graph.edges) {
        expect(nodeIds.has(edge.source), `Edge source '${edge.source}' missing from nodes`).toBe(true);
        expect(nodeIds.has(edge.target), `Edge target '${edge.target}' missing from nodes`).toBe(true);
      }
    });

    it('has no duplicate node IDs', () => {
      const containers: FormulaContainer[] = [{
        id: 'dup_test',
        label: 'Dup Test',
        outputVar: 'dupVar',
        blocks: [{ id: 'e1', kind: 'expression', label: 'amount' }],
      }];

      const graph = compileBlocksToGraph(containers);
      const ids = graph.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ── decompileGraphToContainers ────────────────────────────────────────────

  describe('decompileGraphToContainers', () => {
    it('strips ALL pipeline nodes from decompiled output', () => {
      const graph = compileBlocksToGraph([]);
      const containers = decompileGraphToContainers(graph);
      expect(containers.length).toBe(0);
    });

    it('preserves user-defined conditional blocks after round-trip', () => {
      const original: FormulaContainer[] = [{
        id: 'mylogic',
        label: 'My Logic',
        outputVar: 'myRate',
        blocks: [
          { id: 'if1', kind: 'if', condition: { variable: 'amount', operator: '>', value: '2000000' }, thenValue: '0.03' },
          { id: 'else1', kind: 'else', elseValue: '0.06' },
        ],
      }];

      const graph = compileBlocksToGraph(original);
      const restored = decompileGraphToContainers(graph);

      expect(restored.length).toBe(1);
      expect(restored[0].outputVar).toBe('myRate');
      expect(restored[0].blocks.length).toBe(2);
      expect(restored[0].blocks[0].kind).toBe('if');
      expect(restored[0].blocks[0].condition?.variable).toBe('amount');
      expect(restored[0].blocks[0].condition?.operator).toBe('>');
      expect(restored[0].blocks[0].condition?.value).toBe('2000000');
      expect(restored[0].blocks[0].thenValue).toBe('0.03');
      expect(restored[0].blocks[1].kind).toBe('else');
      expect(restored[0].blocks[1].elseValue).toBe('0.06');
    });

    it('preserves multi-level elseIf chains after round-trip', () => {
      const original: FormulaContainer[] = [{
        id: 'chain',
        label: 'Chain',
        outputVar: 'chainResult',
        blocks: [
          { id: 'if1', kind: 'if', condition: { variable: 'termMonths', operator: '>=', value: '36' }, thenValue: '0.01' },
          { id: 'elif1', kind: 'elseIf', condition: { variable: 'termMonths', operator: '>=', value: '24' }, thenValue: '0.02' },
          { id: 'elif2', kind: 'elseIf', condition: { variable: 'termMonths', operator: '>=', value: '12' }, thenValue: '0.03' },
          { id: 'else1', kind: 'else', elseValue: '0.04' },
        ],
      }];

      const graph = compileBlocksToGraph(original);
      const restored = decompileGraphToContainers(graph);

      expect(restored.length).toBe(1);
      expect(restored[0].blocks.length).toBe(4);
      expect(restored[0].blocks[0].kind).toBe('if');
      expect(restored[0].blocks[1].kind).toBe('elseIf');
      expect(restored[0].blocks[2].kind).toBe('elseIf');
      expect(restored[0].blocks[3].kind).toBe('else');
    });

    it('filters out nodes with domain helper formulas', () => {
      const graph: DagGraph = {
        nodes: [
          { id: 'user_node', kind: 'formula', label: 'User calc', formula: 'amount * 0.1', outputVar: 'userCalc' },
          { id: 'helper_node', kind: 'formula', label: 'Schedule', formula: 'buildAmortizationSchedule(amount, interestRate, termMonths, startDate, lateFeeMode, installmentAmount)', outputVar: 'schedule' },
          { id: 'helper_node2', kind: 'formula', label: 'Summary', formula: 'summarizeSchedule(schedule)', outputVar: 'summary' },
          { id: 'result_node', kind: 'output', label: 'Result', formula: 'buildCreditResult(lateFeeMode, schedule, summary)', outputVar: 'result' },
        ],
        edges: [],
      };

      const containers = decompileGraphToContainers(graph);
      expect(containers.length).toBe(1);
      expect(containers[0].label).toBe('User calc');
    });

    it('filters constant (input) nodes', () => {
      const graph: DagGraph = {
        nodes: [
          { id: 'const1', kind: 'constant', label: 'Amount', outputVar: 'amount' },
          { id: 'user1', kind: 'formula', label: 'Calc', formula: 'amount * 2', outputVar: 'calc' },
        ],
        edges: [],
      };

      const containers = decompileGraphToContainers(graph);
      expect(containers.length).toBe(1);
      expect(containers[0].label).toBe('Calc');
    });

    it('restores known financial formulas as readable template blocks', () => {
      const template = CREDIT_FORMULA_TEMPLATES.find((item) => item.key === 'compound_interest')!;
      const graph: DagGraph = {
        nodes: [
          { id: 'formula_credit_compound', kind: 'formula', label: template.name, formula: template.formula, outputVar: 'calculationMethod' },
        ],
        edges: [],
      };

      const containers = decompileGraphToContainers(graph);
      expect(containers).toHaveLength(1);
      expect(containers[0].blocks[0]).toMatchObject({
        kind: 'expression',
        label: template.name,
        formula: template.formula,
        templateKey: template.key,
      });
    });
  });

  // ── generateBlockId ───────────────────────────────────────────────────────

  describe('generateBlockId', () => {
    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateBlockId('test')));
      expect(ids.size).toBe(100);
    });

    it('includes prefix in generated ID', () => {
      const id = generateBlockId('if');
      expect(id.startsWith('if_')).toBe(true);
    });
  });
});
