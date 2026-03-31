const { test, describe } = require('node:test');
const assert = require('node:assert');
const { TopologicalSorter, TopologicalCycleException } = require('../../../../src/core/domain/calculation/TopologicalSorter');

describe('TopologicalSorter', () => {
  describe('sort', () => {
    test('returns empty array for empty graph', () => {
      const result = TopologicalSorter.sort([], []);
      assert.deepStrictEqual(result, []);
    });

    test('returns single node graph in any order', () => {
      const nodes = [{ id: 'a' }];
      const result = TopologicalSorter.sort(nodes, []);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], 'a');
    });

    test('returns topologically sorted order for linear graph', () => {
      const nodes = [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ];

      const result = TopologicalSorter.sort(nodes, edges);

      assert.strictEqual(result.indexOf('a') < result.indexOf('b'), true);
      assert.strictEqual(result.indexOf('b') < result.indexOf('c'), true);
    });

    test('handles diamond dependency graph', () => {
      const nodes = [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
        { id: 'd' },
      ];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' },
      ];

      const result = TopologicalSorter.sort(nodes, edges);

      assert.strictEqual(result.indexOf('a') < result.indexOf('b'), true);
      assert.strictEqual(result.indexOf('a') < result.indexOf('c'), true);
      assert.strictEqual(result.indexOf('b') < result.indexOf('d'), true);
      assert.strictEqual(result.indexOf('c') < result.indexOf('d'), true);
    });

    test('handles graph with multiple roots', () => {
      const nodes = [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
        { id: 'd' },
      ];
      const edges = [
        { from: 'a', to: 'c' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd' },
      ];

      const result = TopologicalSorter.sort(nodes, edges);

      assert.strictEqual(result.indexOf('c') < result.indexOf('d'), true);
    });

    test('throws TopologicalCycleException for self-loop', () => {
      const nodes = [{ id: 'a' }];
      const edges = [{ from: 'a', to: 'a' }];

      assert.throws(() => {
        TopologicalSorter.sort(nodes, edges);
      }, TopologicalCycleException);
    });

    test('throws TopologicalCycleException for simple cycle', () => {
      const nodes = [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ];

      assert.throws(() => {
        TopologicalSorter.sort(nodes, edges);
      }, TopologicalCycleException);
    });

    test('throws TopologicalCycleException with cycle path in error', () => {
      const nodes = [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ];

      try {
        TopologicalSorter.sort(nodes, edges);
        assert.fail('Expected TopologicalCycleException to be thrown');
      } catch (error) {
        assert.strictEqual(error instanceof TopologicalCycleException, true);
        assert.ok(Array.isArray(error.cyclePath));
      }
    });

    test('handles graph with source/target edge format', () => {
      const nodes = [
        { id: 'a' },
        { id: 'b' },
      ];
      const edges = [
        { source: 'a', target: 'b' },
      ];

      const result = TopologicalSorter.sort(nodes, edges);

      assert.strictEqual(result.indexOf('a') < result.indexOf('b'), true);
    });
  });

  describe('sortDFS', () => {
    test('returns empty array for empty graph', () => {
      const result = TopologicalSorter.sortDFS([], []);
      assert.deepStrictEqual(result, []);
    });

    test('returns valid topological order for linear graph', () => {
      const nodes = [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ];

      const result = TopologicalSorter.sortDFS(nodes, edges);

      assert.strictEqual(result.length, 3);
      assert.ok(result.includes('a'));
      assert.ok(result.includes('b'));
      assert.ok(result.includes('c'));
    });

    test('throws TopologicalCycleException for cycle', () => {
      const nodes = [
        { id: 'a' },
        { id: 'b' },
      ];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ];

      assert.throws(() => {
        TopologicalSorter.sortDFS(nodes, edges);
      }, TopologicalCycleException);
    });
  });

  describe('hasCycle', () => {
    test('returns false for acyclic graph', () => {
      const nodes = [
        { id: 'a' },
        { id: 'b' },
      ];
      const edges = [{ from: 'a', to: 'b' }];

      const result = TopologicalSorter.hasCycle(nodes, edges);
      assert.strictEqual(result, false);
    });

    test('returns true for cyclic graph', () => {
      const nodes = [
        { id: 'a' },
        { id: 'b' },
      ];
      const edges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ];

      const result = TopologicalSorter.hasCycle(nodes, edges);
      assert.strictEqual(result, true);
    });

    test('returns false for empty graph', () => {
      const result = TopologicalSorter.hasCycle([], []);
      assert.strictEqual(result, false);
    });
  });
});