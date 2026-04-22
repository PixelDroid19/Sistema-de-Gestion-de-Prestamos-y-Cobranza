import { describe, it, expect, beforeEach } from 'vitest';
import { useBlockEditorStore } from '../../store/blockEditorStore';
import type { DagGraph, DagNode, DagEdge } from '../../types/dag';

describe('blockEditorStore', () => {
  const sampleGraph: DagGraph = {
    nodes: [
      { id: 'input_amount', kind: 'constant', label: 'Monto', outputVar: 'amount' },
      { id: 'schedule', kind: 'formula', label: 'Cronograma', formula: 'buildAmortizationSchedule(amount, interestRate, termMonths, startDate, lateFeeMode)', outputVar: 'schedule' },
    ],
    edges: [
      { source: 'input_amount', target: 'schedule' },
    ],
  };

  beforeEach(() => {
    useBlockEditorStore.getState().reset();
  });

  it('has null graph by default', () => {
    const { graph } = useBlockEditorStore.getState();
    expect(graph).toBeNull();
  });

  it('sets a graph', () => {
    const store = useBlockEditorStore.getState();
    store.setGraph(sampleGraph);
    expect(useBlockEditorStore.getState().graph).toEqual(sampleGraph);
  });

  it('updates a node formula', () => {
    const store = useBlockEditorStore.getState();
    store.setGraph(sampleGraph);
    store.updateNodeFormula('schedule', 'buildAmortizationSchedule(amount, interestRate, 24, startDate, lateFeeMode)');
    const node = useBlockEditorStore.getState().graph?.nodes.find((n) => n.id === 'schedule');
    expect(node?.formula).toBe('buildAmortizationSchedule(amount, interestRate, 24, startDate, lateFeeMode)');
  });

  it('removes a node and its edges', () => {
    const store = useBlockEditorStore.getState();
    store.setGraph(sampleGraph);
    store.removeNode('schedule');
    expect(useBlockEditorStore.getState().graph?.nodes).toHaveLength(1);
    expect(useBlockEditorStore.getState().graph?.edges).toHaveLength(0);
  });

  it('selects a node', () => {
    const store = useBlockEditorStore.getState();
    store.setGraph(sampleGraph);
    store.selectNode('schedule');
    expect(useBlockEditorStore.getState().selectedNodeId).toBe('schedule');
  });

  it('undo restores previous graph', () => {
    const store = useBlockEditorStore.getState();
    store.setGraph(sampleGraph);
    store.updateNodeFormula('schedule', 'new formula');
    expect(useBlockEditorStore.getState().graph?.nodes[1].formula).toBe('new formula');
    store.undo();
    expect(useBlockEditorStore.getState().graph?.nodes[1].formula).toBe('buildAmortizationSchedule(amount, interestRate, termMonths, startDate, lateFeeMode)');
  });

  it('redo restores undone graph', () => {
    const store = useBlockEditorStore.getState();
    store.setGraph(sampleGraph);
    store.updateNodeFormula('schedule', 'new formula');
    store.undo();
    store.redo();
    expect(useBlockEditorStore.getState().graph?.nodes[1].formula).toBe('new formula');
  });

  it('clears redo stack on new action', () => {
    const store = useBlockEditorStore.getState();
    store.setGraph(sampleGraph);
    store.updateNodeFormula('schedule', 'v2');
    store.undo();
    store.updateNodeFormula('schedule', 'v3');
    store.redo();
    // redo should do nothing because stack was cleared
    expect(useBlockEditorStore.getState().graph?.nodes[1].formula).toBe('v3');
  });

  it('updates zoom level', () => {
    const store = useBlockEditorStore.getState();
    store.setZoom(1.5);
    expect(useBlockEditorStore.getState().zoom).toBe(1.5);
  });

  it('clamps zoom to valid range', () => {
    const store = useBlockEditorStore.getState();
    store.setZoom(3);
    expect(useBlockEditorStore.getState().zoom).toBe(2);
    store.setZoom(0.3);
    expect(useBlockEditorStore.getState().zoom).toBe(0.5);
  });

  it('updates formula name', () => {
    const store = useBlockEditorStore.getState();
    store.setFormulaName('Risk Tier Formula');
    expect(useBlockEditorStore.getState().formulaName).toBe('Risk Tier Formula');
  });

  it('sets status badge', () => {
    const store = useBlockEditorStore.getState();
    store.setStatus('draft');
    expect(useBlockEditorStore.getState().status).toBe('draft');
  });
});
