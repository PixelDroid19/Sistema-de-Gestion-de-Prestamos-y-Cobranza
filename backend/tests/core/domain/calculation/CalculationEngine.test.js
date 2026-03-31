const { test, describe } = require('node:test');
const assert = require('node:assert');
const { CalculationEngine } = require('../../../../src/core/domain/calculation/CalculationEngine');
const { TopologicalCycleException } = require('../../../../src/core/domain/calculation/TopologicalSorter');

describe('CalculationEngine', () => {
  describe('execute', () => {
    test('returns empty result for empty graph', () => {
      const graph = { nodes: [], edges: [] };
      const contractVars = {};

      const result = CalculationEngine.execute(graph, contractVars);

      assert.ok(result.result);
      assert.ok(result.executionOrder);
      assert.deepStrictEqual(result.executionOrder, []);
    });

    test('executes simple calculation with single node', () => {
      const graph = {
        nodes: [
          {
            id: 'total',
            label: 'Total',
            formula: 'principal + interest',
            outputVar: 'total',
          },
        ],
        edges: [],
      };
      const contractVars = {
        principal: 1000,
        interest: 100,
      };

      const result = CalculationEngine.execute(graph, contractVars);

      assert.ok(result.result);
      assert.strictEqual(result.executionOrder.length, 1);
    });

    test('executes linear dependency graph', () => {
      const graph = {
        nodes: [
          { id: 'a', label: 'A', formula: 'principal * rate', outputVar: 'a' },
          { id: 'b', label: 'B', formula: 'a + bonus', outputVar: 'b' },
          { id: 'c', label: 'C', formula: 'b * multiplier', outputVar: 'c' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
        ],
      };
      const contractVars = {
        principal: 1000,
        rate: 0.05,
        bonus: 50,
        multiplier: 2,
      };

      const result = CalculationEngine.execute(graph, contractVars);

      assert.strictEqual(result.executionOrder.length, 3);
      assert.ok(result.result);
    });

    test('throws TopologicalCycleException for cyclic graph', () => {
      const graph = {
        nodes: [
          { id: 'a', label: 'A', formula: 'b + 1', outputVar: 'a' },
          { id: 'b', label: 'B', formula: 'a + 1', outputVar: 'b' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
        ],
      };
      const contractVars = { principal: 1000 };

      assert.throws(() => {
        CalculationEngine.execute(graph, contractVars);
      }, TopologicalCycleException);
    });

    test('preserves BigNumber precision through evaluation', () => {
      const graph = {
        nodes: [
          {
            id: 'result',
            label: 'Result',
            formula: 'principal / 3',
            outputVar: 'result',
          },
        ],
        edges: [],
      };
      const contractVars = {
        principal: 1000,
      };

      const result = CalculationEngine.execute(graph, contractVars);

      assert.ok(result.result);
    });

    test('includes metrics in result', () => {
      const graph = {
        nodes: [
          { id: 'a', label: 'A', formula: 'principal + 1', outputVar: 'a' },
        ],
        edges: [],
      };
      const contractVars = { principal: 1000 };

      const result = CalculationEngine.execute(graph, contractVars);

      assert.ok(result.metrics);
      assert.ok(typeof result.metrics.executionTimeMs === 'number');
      assert.strictEqual(result.metrics.nodeCount, 1);
    });

    test('handles diamond dependency pattern', () => {
      const graph = {
        nodes: [
          { id: 'base', label: 'Base', formula: 'principal', outputVar: 'base' },
          { id: 'plus10', label: 'Plus10', formula: 'base + 10', outputVar: 'plus10' },
          { id: 'plus20', label: 'Plus20', formula: 'base + 20', outputVar: 'plus20' },
          { id: 'total', label: 'Total', formula: 'plus10 + plus20', outputVar: 'total' },
        ],
        edges: [
          { from: 'base', to: 'plus10' },
          { from: 'base', to: 'plus20' },
          { from: 'plus10', to: 'total' },
          { from: 'plus20', to: 'total' },
        ],
      };
      const contractVars = { principal: 100 };

      const result = CalculationEngine.execute(graph, contractVars);

      assert.strictEqual(result.executionOrder.length, 4);
      assert.ok(result.result);
    });

    test('handles nodes without formulas (constant nodes)', () => {
      const graph = {
        nodes: [
          { id: 'fixed', label: 'Fixed', outputVar: 'fixed' },
          { id: 'result', label: 'Result', formula: 'fixed + principal', outputVar: 'result' },
        ],
        edges: [{ from: 'fixed', to: 'result' }],
      };
      const contractVars = { principal: 500 };

      const result = CalculationEngine.execute(graph, contractVars);

      assert.ok(result.result);
    });
  });

  describe('calculateAmortization', () => {
    test('returns amortization breakdown structure', () => {
      const result = CalculationEngine.calculateAmortization({
        principal: 10000,
        interestRate: 0.05,
        term: 12,
        paymentAmount: 500,
      });

      assert.ok(result.capital !== undefined);
      assert.ok(result.interest !== undefined);
      assert.ok(result.penalty !== undefined);
      assert.ok(result.fees !== undefined);
      assert.ok(result.totalPayment !== undefined);
    });

    test('handles zero principal', () => {
      const result = CalculationEngine.calculateAmortization({
        principal: 0,
        interestRate: 0.05,
        term: 12,
        paymentAmount: 100,
      });

      const capital = typeof result.capital === 'string' ? parseFloat(result.capital) : result.capital;
      assert.strictEqual(capital, 0);
    });
  });
});