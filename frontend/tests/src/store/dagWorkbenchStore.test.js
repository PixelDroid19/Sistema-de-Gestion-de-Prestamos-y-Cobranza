import { describe, expect, it, beforeEach } from 'vitest'

import { useDagWorkbenchStore } from '@/store/dagWorkbenchStore'

describe('dagWorkbenchStore', () => {
  beforeEach(() => {
    useDagWorkbenchStore.getState().resetWorkbenchDraft({ preserveMode: false })
  })

  it('hydrates backend graph snapshots into the local editor state', () => {
    useDagWorkbenchStore.getState().hydrateGraph({
      id: 42,
      scopeKey: 'personal-loan',
      version: 7,
      name: 'Personal Loan DAG',
      graph: {
        nodes: [{ id: 'principal', kind: 'input' }],
        edges: [],
      },
      validation: {
        valid: true,
        errors: [],
        warnings: [],
        summary: { nodeCount: 1, edgeCount: 0 },
      },
    })

    const state = useDagWorkbenchStore.getState()

    expect(state.scopeKey).toBe('personal-loan')
    expect(state.graphName).toBe('Personal Loan DAG')
    expect(state.draftGraphText).toContain('"principal"')
    expect(state.validation?.summary).toEqual({ nodeCount: 1, edgeCount: 0 })
    expect(state.hasUnsavedChanges).toBe(false)
    expect(state.lastLoadedVersion).toBe(7)
  })

  it('tracks dirty draft edits and save completion separately', () => {
    const store = useDagWorkbenchStore.getState()

    store.setDraftGraphText('{"nodes":[],"edges":[]}')
    expect(useDagWorkbenchStore.getState().hasUnsavedChanges).toBe(true)

    store.markGraphSaved({
      graphVersion: { id: 5, scopeKey: 'personal-loan', version: 2, name: 'Personal Loan DAG' },
      validation: { valid: true, errors: [], warnings: [], summary: { nodeCount: 0, edgeCount: 0 } },
    })

    const state = useDagWorkbenchStore.getState()
    expect(state.hasUnsavedChanges).toBe(false)
    expect(state.lastLoadedVersion).toBe(2)
    expect(state.validation?.valid).toBe(true)
  })

  it('adds nodes, variables, and connections inside the editor graph state', () => {
    const store = useDagWorkbenchStore.getState()

    store.addNode('input')
    store.addNode('output')
    store.upsertVariable({ key: 'commission_rate', value: '0.12' })
    store.connectNodes({ sourceNodeId: 'input-1', targetNodeId: 'output-2' })

    const state = useDagWorkbenchStore.getState()

    expect(state.graph.nodes).toHaveLength(2)
    expect(state.graph.variables.some((variable) => variable.key === 'commission_rate')).toBe(true)
    expect(state.graph.edges).toEqual([
      { id: 'edge-input-1-output-2', source: 'input-1', target: 'output-2' },
    ])
    expect(state.hasUnsavedChanges).toBe(true)
  })
})
