import { describe, it, expect, beforeEach } from 'vitest';
import { useBlockEditorStore } from '../../store/blockEditorStore';
import { generateBlockId } from '../../lib/blockCompiler';
import type { FormulaContainer, BlockDefinition } from '../../types/dag';

describe('blockEditorStore', () => {
  const sampleContainer: FormulaContainer = {
    id: 'rate_calc',
    label: 'Rate Calculation',
    outputVar: 'custom_rate',
    blocks: [
      { id: 'if_1', kind: 'if', condition: { variable: 'amount', operator: '>', value: '1000000' }, thenValue: '0.035' },
      { id: 'else_1', kind: 'else', elseValue: '0.05' },
    ],
  };

  beforeEach(() => {
    useBlockEditorStore.getState().reset();
  });

  it('has empty containers by default', () => {
    const { containers } = useBlockEditorStore.getState();
    expect(containers).toEqual([]);
  });

  it('adds a container', () => {
    const store = useBlockEditorStore.getState();
    store.addContainer(sampleContainer);
    expect(useBlockEditorStore.getState().containers).toHaveLength(1);
    expect(useBlockEditorStore.getState().containers[0].id).toBe('rate_calc');
  });

  it('removes a container', () => {
    const store = useBlockEditorStore.getState();
    store.addContainer(sampleContainer);
    store.removeContainer('rate_calc');
    expect(useBlockEditorStore.getState().containers).toHaveLength(0);
  });

  it('adds a block to a container', () => {
    const store = useBlockEditorStore.getState();
    store.addContainer(sampleContainer);
    const newBlock: BlockDefinition = { id: 'elseIf_1', kind: 'elseIf', condition: { variable: 'Credit_Score', operator: '>', value: '680' }, thenValue: '0.042' };
    store.addBlock('rate_calc', newBlock, 1); // insert between if and else
    const blocks = useBlockEditorStore.getState().containers[0].blocks;
    expect(blocks).toHaveLength(3);
    expect(blocks[1].id).toBe('elseIf_1');
  });

  it('removes a block from a container', () => {
    const store = useBlockEditorStore.getState();
    store.addContainer(sampleContainer);
    store.removeBlock('rate_calc', 'else_1');
    expect(useBlockEditorStore.getState().containers[0].blocks).toHaveLength(1);
  });

  it('updates a block', () => {
    const store = useBlockEditorStore.getState();
    store.addContainer(sampleContainer);
    store.updateBlock('rate_calc', 'if_1', { thenValue: '0.025' });
    const block = useBlockEditorStore.getState().containers[0].blocks[0];
    expect(block.thenValue).toBe('0.025');
  });

  it('selects a block', () => {
    const store = useBlockEditorStore.getState();
    store.selectBlock('if_1');
    expect(useBlockEditorStore.getState().selectedBlockId).toBe('if_1');
  });

  it('undo restores previous containers', () => {
    const store = useBlockEditorStore.getState();
    store.addContainer(sampleContainer);
    store.removeBlock('rate_calc', 'else_1');
    expect(useBlockEditorStore.getState().containers[0].blocks).toHaveLength(1);
    store.undo();
    expect(useBlockEditorStore.getState().containers[0].blocks).toHaveLength(2);
  });

  it('redo restores undone state', () => {
    const store = useBlockEditorStore.getState();
    store.addContainer(sampleContainer);
    store.removeBlock('rate_calc', 'else_1');
    store.undo();
    store.redo();
    expect(useBlockEditorStore.getState().containers[0].blocks).toHaveLength(1);
  });

  it('clears redo stack on new action', () => {
    const store = useBlockEditorStore.getState();
    store.addContainer(sampleContainer);
    store.removeBlock('rate_calc', 'else_1');
    store.undo();
    store.updateBlock('rate_calc', 'if_1', { thenValue: '0.01' });
    store.redo();
    // redo should do nothing because stack was cleared
    expect(useBlockEditorStore.getState().containers[0].blocks[0].thenValue).toBe('0.01');
  });

  it('compiles graph from containers', () => {
    const store = useBlockEditorStore.getState();
    store.addContainer(sampleContainer);
    const graph = store.compileGraph();
    expect(graph.nodes.length).toBeGreaterThan(0);
    // Compiler injects pipeline nodes + edges for backend compatibility
    expect(graph.edges.length).toBeGreaterThan(0);
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
