# Proposal: CreditCore Engine — Frontend Workbench Transformation

**Change ID**: `dag-formula-system`  
**Type**: UI/UX Transformation (Frontend-Only)  
**Scope**: Frontend React Application — DAG Formula Workbench  
**Status**: Proposed  
**Author**: SDD Orchestrator / sdd-propose sub-agent  
**Date**: 2026-04-22  
**Target Version**: v2.0-CreditCore  

---

## 1. Executive Summary

This proposal outlines a comprehensive frontend transformation of the existing DAG (Directed Acyclic Graph) formula workbench from a functional-but-raw SVG-based editor into a polished, professional **CreditCore Engine** terminal interface. The backend DAG execution engine, mathjs BigNumber calculation layer, graph executor, and workbench service remain fully intact — this change is strictly a UI/UX modernization that aligns the visual experience with the user's reference design (CreditCore Engine).

**What this achieves**:
- Transforms the formula editor from "developer-oriented SVG nodes" to "business-user visual flow blocks"
- Introduces a professional three-panel layout (Toolbox | Canvas | Live Test) with Material Design 3 aesthetics
- Adds rich visual formula representation with IF/THEN/ELSE block diagrams, execution traces, and step-by-step evaluation paths
- Modernizes Dashboard, Variables Registry, and Audit History pages to match the CreditCore Engine design language
- Improves usability for non-technical admin users who configure credit calculation formulas

---

## 2. Problem Statement

The current system has the following deficiencies that prevent it from meeting the target "CreditCore Engine" professional standard:

### 2.1 Formula Editor — Visual Presentation (Critical)

| Current State | Deficiency |
|--------------|------------|
| SVG-based node cards with basic colored rectangles | Lacks the rich block-based visual flow of the reference design |
| Formula display uses inline chips (`[IF] [amount] [>] [5000]...`) within a card | Not the vertical flow diagram with connected logic blocks the user wants |
| No execution trace visualization | Users cannot see step-by-step logic evaluation path |
| Canvas shows generic node cards with drag handles | Missing the structured vertical logic block arrangement (IF → THEN → ELSE → output) |
| No "Logic Blocks" section in toolbox with visual block previews | Operations are simple draggable text buttons, not expressive visual blocks |

**Current formula visualization (in NodeCard)**:
```
┌─────────────┐
│ [IF] [amount] [>] [5000] [THEN] [A] [ELSE] [B] │  ← chips in a row inside card
└─────────────┘
```

**Target formula visualization**:
```
[IF] [Loan_Amount] [>] [5000]    ← horizontal condition block
   │
[THEN] [Result_A]                 ← vertical THEN branch with connector line
   │
[ELSE] [Result_B]                 ← vertical ELSE branch with connector line
   │
[OUTPUT] [Final_Result]           ← final assignment block at bottom
```

### 2.2 Dashboard Page (`/formulas`)

| Current | Target Gap |
|---------|------------|
| Stats cards exist but use generic Tailwind styling | Need stricter MD3 color system (surface/on-surface/secondary) |
| "Pending Reviews" stat exists but counts inactive versions | Should show a dedicated count requiring explicit admin review action |
| Table uses standard HTML `<table>` with hover actions | Missing the clean Material table with status badges and inline action consistency |

### 2.3 Variables Registry (`/formulas/variables`)

| Current | Target Gap |
|---------|------------|
| Basic filter dropdowns (Type, Source, Status) | Needs unified filter bar design with search |
| Type shown as plain text | Needs type badges (Integer, Currency, Boolean, Float) with distinct colors |
| No usage tracking / formula references | Missing "Used in X formulas" tags |
| Status shown as simple colored span | Needs status indicators (Active/Idle/Deprecated) with distinct visual treatments |
| Deprecated variables use opacity + strikethrough | Should show deprecated with red badge and strikethrough |
| Pagination exists but basic | Needs proper pagination controls |

### 2.4 Audit History (`/audit/:id`)

| Current | Target Gap |
|---------|------------|
| Timeline sidebar exists with vertical line | Missing commit hash display, professional commit message styling |
| Diff shows `NodeDelta` cards with formula changes | Missing side-by-side diff with line numbers, red/green highlighting |
| No "Compare Selected" functionality | Users cannot select two versions and compare them directly |
| Raw JSON diff panels at bottom | Should be collapsible or replaced with structured diff view |
| Missing "Impacted Variables" summary at bottom | Has it but styling needs alignment |

### 2.5 Live Test Panel

| Current | Target Gap |
|---------|------------|
| Input values shown with type labels (Decimal/Str) | Needs stronger Int/Decimal type distinction |
| "Evaluate Formula" button exists | Needs more prominent CTA styling |
| Result shown as JSON in `<pre>` block | Needs formatted result card with SUCCESS badge and large formatted number |
| No execution trace | **Critical**: Must show step-by-step evaluation path through each logic block |

---

## 3. Proposed Solution

### 3.1 High-Level Approach

We will refactor the **frontend presentation layer only**, keeping all backend APIs, data models, and the Zustand store structure intact. The key transformation layers are:

1. **Canvas Rendering Layer**: Replace the current SVG node/edge system with a hybrid DOM+SVG approach where logic blocks render as rich HTML components arranged in vertical flow patterns, while connections render as SVG Bézier curves between block anchors.

2. **Formula Visualizer Component**: Create a new `VisualFlowDiagram` component that takes a `DagNode` with conditional formula and renders:
   - IF block with condition slot (variable + operator + value)
   - THEN branch with result block
   - ELSE branch with result block (and optional ELSE IF nesting)
   - Output assignment block at bottom
   - SVG connector lines between blocks

3. **Live Test Execution Trace**: Extend the simulation response display to show a step-by-step trace of which conditions evaluated to true/false and which path was taken through the DAG.

4. **MD3 Theme System**: Formalize the existing ad-hoc MD3 color tokens into a proper theme object used consistently across all DAG pages.

5. **Component Reorganization**: Split the monolithic `FormulaEditorPage.tsx` (~1073 lines) into focused sub-components:
   - `EditorToolbar.tsx`
   - `ToolboxPanel.tsx`
   - `CanvasArea.tsx`
   - `LiveTestPanel.tsx`
   - `VisualFlowBlock.tsx`
   - `ExecutionTrace.tsx`

### 3.2 Detailed Component Changes

#### 3.2.1 FormulaEditorPage.tsx

**Current**: Single 1073-line component with inline NodeCard, VisualChip, toolbar, toolbox, canvas, and live test panel.

**Target**: Orchestrator component (~200 lines) that composes:
- `EditorToolbar` — formula name, status badge, undo/redo, zoom, save/test actions
- `ToolboxPanel` — reorganized in sections:
  - **Variables**: Draggable items with colored dots (blue for constants)
  - **Operations**: Draggable buttons (+, -, *, /, etc.) in grid
  - **Logic Blocks**: Rich visual blocks (IF/THEN/ELSE as colored blocks with preview)
  - **Helpers**: Function helpers with descriptions
- `CanvasArea` — grid background (radial dots), floating stats, node blocks arranged visually
- `LiveTestPanel` — inputs with type badges, evaluate button, result card, execution trace

#### 3.2.2 Visual Flow Blocks (NEW)

Create `VisualFlowBlock.tsx` to render different block types:

```typescript
type FlowBlockType = 'if' | 'then' | 'else' | 'elseif' | 'condition' | 'assignment' | 'operation';

interface FlowBlockProps {
  type: FlowBlockType;
  variable?: string;
  operator?: string;
  value?: string | number;
  result?: string;
  blocks?: FlowBlockProps[];  // nested blocks (for else-if chains)
  isActive?: boolean;         // highlight during execution trace
}
```

**Block Design**:
- Each block has a colored left border (IF = purple, THEN = green, ELSE = amber, OUTPUT = blue)
- Blocks are arranged vertically with 24px gap
- SVG connector lines connect the bottom of one block to the top of the next
- IF blocks show: `[IF] [Variable Chip] [Operator Chip] [Value Chip]`
- THEN/ELSE blocks show: `[THEN] → [Result Chip]`
- Output block shows: `[OUTPUT] [Variable Name] = [Value]`

#### 3.2.3 Canvas Grid & Layout

- **Background**: Radial dot grid (CSS `radial-gradient`) with dot size responsive to zoom
- **Node positioning**: Keep current x/y coordinates but add auto-layout for new visual blocks:
  - Constants → left column
  - Formulas/Conditionals → center columns with vertical flow blocks
  - Outputs → right column
- **Zoom**: Continue current 0.5x–2.0x with CSS transform scale
- **Floating toolbar**: Show formula name + DRAFT badge + node/edge count

#### 3.2.4 Live Test Panel Enhancement

**Current**: JSON `<pre>` dump of simulation result.

**Target**:
```
┌─────────────────────────────┐
│  Live Test                  │
├─────────────────────────────┤
│  Input Values               │
│  ┌─────────────────────┐    │
│  │ Loan_Amount    [Int]│    │
│  │ [        5000      ]│    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ Credit_Score [Dec]  │    │
│  │ [        720.5     ]│    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│  [  Evaluate Formula  ]     │
├─────────────────────────────┤
│  Execution Result           │
│  ┌─────────────────────┐    │
│  │ Result: $4,250.00   │    │
│  │ [SUCCESS]           │    │
│  └─────────────────────┘    │
│                             │
│  Execution Trace            │
│  ┌─────────────────────┐    │
│  │ ✓ IF amount > 5000  │    │
│  │   → FALSE           │    │
│  │ ✓ ELSE path taken   │    │
│  │ ✓ OUTPUT = 4250     │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│  [   Save Formula    ]      │
└─────────────────────────────┘
```

#### 3.2.5 DashboardPage.tsx

- Formalize MD3 color tokens into imported theme object
- Stats cards: stricter adherence to surface/on-surface/secondary palette
- Active Formulas table: cleaner status badges with dot indicators
- Add "Pending Reviews" count to require explicit action (not just inactive count)

#### 3.2.6 VariablesRegistryPage.tsx

- Add type badges with distinct colors:
  - Integer: `bg-blue-50 text-blue-700`
  - Currency: `bg-emerald-50 text-emerald-700`
  - Boolean: `bg-purple-50 text-purple-700`
  - Float: `bg-amber-50 text-amber-700`
- Add formula usage tags ("Used in 3 formulas")
- Add status indicators with icons:
  - Active: green dot
  - Idle: gray dot
  - Deprecated: red strikethrough + red badge
- Unified filter bar with search input

#### 3.2.7 AuditHistoryPage.tsx

- Add commit hash display (short SHA style)
- Side-by-side diff with line numbers and syntax highlighting
- Red/green color coding for removed/added lines
- "Compare Selected" button to compare any two versions
- Collapsible raw JSON panels
- Impacted Variables summary with better styling

### 3.3 Store & Service Changes

**No changes to `blockEditorStore.ts`** — the graph data model (`DagNode`, `DagEdge`, `DagGraph`) remains identical. The visual transformation is purely presentational.

**Minor additions to `dagService.ts`**:
- Add `getExecutionTrace(graphId, simulationInput)` endpoint if backend supports trace output (otherwise, derive trace from simulation result client-side).

**Type additions to `types/dag.ts`**:
- Add `ExecutionTraceStep` interface for frontend trace display
- Add `FlowBlock` interfaces for visual block rendering

---

## 4. Scope & Boundaries

### 4.1 In Scope (Frontend UI/UX Transformation)

| Area | In Scope |
|------|----------|
| `FormulaEditorPage.tsx` refactor | ✅ Complete visual redesign, component split |
| `DashboardPage.tsx` styling | ✅ MD3 theme alignment |
| `VariablesRegistryPage.tsx` enhancements | ✅ Badges, filters, usage tracking |
| `AuditHistoryPage.tsx` diff viewer | ✅ Side-by-side diff, compare selected |
| New visual components | ✅ VisualFlowBlock, ExecutionTrace, EditorToolbar, etc. |
| CSS/styling | ✅ MD3 color system formalization |
| `blockEditorStore.ts` | ❌ No structural changes (presentational only) |
| `dagService.ts` | ⚠️ Minor additions for trace API if needed |

### 4.2 Out of Scope (Backend Unchanged)

| Area | Out of Scope |
|------|-------------|
| `CalculationEngine.js` | ❌ No changes — mathjs BigNumber engine stays |
| `graphExecutor.js` | ❌ No changes — execution logic stays |
| `workbenchService.js` | ❌ No changes — save/load/validate stays |
| `BigNumberEngine.js` | ❌ No changes — whitelist/regex stays |
| `DagGraphVersion` model | ❌ No schema changes |
| API routes | ❌ No new backend endpoints (unless trace endpoint needed) |
| Auth/roles | ❌ No changes — admin-only stays |
| `scopeRegistry.js` | ❌ No changes — contracts stay |

### 4.3 Scope Rationale

The backend DAG engine is already robust (598 tests), handles formula validation, cycle detection, contract validation, and execution correctly. The deficiency is **entirely in the visual presentation layer**. Changing the backend would introduce unnecessary risk to a working system. The frontend transformation can be built on top of the existing data model without any backend modifications.

---

## 5. Success Criteria

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | Formula editor shows visual flow blocks | QA verifies IF/THEN/ELSE blocks render vertically with connector lines |
| 2 | Execution trace displays step-by-step evaluation | QA verifies trace shows condition evaluations and path taken |
| 3 | Dashboard uses consistent MD3 palette | Design review confirms color token usage |
| 4 | Variables registry shows type badges and usage | QA verifies each variable row has type badge and usage count |
| 5 | Audit history shows side-by-side diff | QA verifies red/green diff with line numbers |
| 6 | All existing tests pass | `npm test -- --run` in frontend passes (71 tests + new tests) |
| 7 | No backend test regressions | `NODE_ENV=test node --test` in backend passes (598 tests) |
| 8 | Component bundle size | FormulaEditorPage chunk ≤ 150KB gzipped (measure with `npm run build`) |
| 9 | Accessibility | All interactive elements keyboard-navigable (tabindex, aria-labels) |

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Complex canvas rendering** | Medium | High | Use hybrid DOM+SVG instead of pure SVG. Keep existing node position data model. Use React refs for SVG lines, not state-driven re-renders. |
| **Performance with many nodes** | Medium | Medium | Virtualize off-canvas nodes. Use CSS transforms for zoom instead of re-rendering. Benchmark with 50+ nodes. |
| **Formula parser for visual blocks** | Medium | High | Extend existing `parseFormulaVisual()` logic. Add unit tests for all conditional patterns (`ifThenElse`, nested `ifThenElse`). |
| **Mobile/tablet usability** | Low | Medium | Canvas is desktop-first by design. Ensure minimum 1024px width. Touch events not required for v1. |
| **User confusion with new UI** | Medium | Medium | Provide onboarding tooltip tour on first visit. Keep "raw formula" view toggle for power users. |
| **Scope creep to backend** | Low | High | Strict code review enforcing "no backend changes" policy. Document boundary in PR template. |
| **Build size increase** | Low | Medium | Tree-shake new components. Lazy-load AuditHistory diff viewer. Monitor with each PR. |

---

## 7. Alternatives Considered

### 7.1 Alternative: Integrate React Flow / XYFlow Library

**Approach**: Replace custom canvas with `reactflow` library.

**Rejected because**:
- Adds ~150KB dependency for functionality we already have (drag, zoom, edges)
- React Flow's node system is still graph-oriented, not the vertical "logic block flow" the user wants
- Customizing React Flow to show IF/THEN/ELSE vertical blocks would require more override work than building custom components
- Our current undo/redo Zustand store integrates tightly with our data model; adapting to React Flow's internal state would be complex

### 7.2 Alternative: Build Full Visual Scratch-like Block Editor

**Approach**: Blockly-style drag-and-drop blocks that snap together.

**Rejected because**:
- The user's reference shows a "terminal/professional" aesthetic, not a "visual programming" aesthetic
- Current formula system uses raw mathjs strings; converting to a full block AST would require backend changes
- Our existing `DagNode` model with `formula: string` is incompatible with block-based AST without a translation layer
- Would require extensive backend validation changes

### 7.3 Alternative: Backend-First with Trace Endpoint

**Approach**: Build execution trace generation in backend first, then consume in frontend.

**Rejected because**:
- Extends scope to backend when the problem is primarily visual
- Frontend can derive trace from existing `simulateGraph` response (shows result of each node evaluation)
- Can add backend trace endpoint later if client-side derivation proves insufficient

### 7.4 Alternative: Incremental Page-by-Page Rollout

**Approach**: Transform Dashboard first, then Editor, then Audit.

**Rejected because**:
- The Editor is the centerpiece; partial transformation would leave jarring UX inconsistencies
- All three pages share the same MD3 theme tokens; defining tokens once and applying everywhere is more efficient
- User's reference implies a cohesive redesign, not incremental patches

---

## 8. Implementation Phases

### Phase 1: Theme & Foundation (Week 1)
- Formalize MD3 tokens into `theme.ts`
- Create shared layout components (`PageShell`, `Card`, `Badge`, `DataTable`)
- Refactor `DashboardPage.tsx` with new theme

### Phase 2: Editor Core (Weeks 2–3)
- Split `FormulaEditorPage.tsx` into sub-components
- Build `VisualFlowBlock` system with vertical layout
- Implement hybrid DOM+SVG canvas rendering
- Add formula parser extensions for conditional blocks

### Phase 3: Live Test & Trace (Week 4)
- Enhance `LiveTestPanel` with execution trace display
- Add formatted result cards
- Connect trace visualization to simulation results

### Phase 4: Registry & Audit (Week 5)
- Enhance `VariablesRegistryPage` with badges and usage
- Enhance `AuditHistoryPage` with side-by-side diff
- Add "Compare Selected" functionality

### Phase 5: Polish & Testing (Week 6)
- Accessibility audit (keyboard nav, ARIA labels)
- Performance audit (React DevTools profiler)
- Cross-browser testing
- Full regression test suite

---

## 9. Appendix: Reference Design Alignment

| User Request (from HTML reference) | Proposed Implementation |
|-----------------------------------|------------------------|
| Three-panel layout (Toolbox/Canvas/Live Test) | ✅ Keep existing layout, restyle panels |
| Toolbox with Variables (colored dots) | ✅ Reorganize toolbox with dot indicators |
| Operations as draggable buttons | ✅ Grid layout with hover states |
| Logic Blocks (IF/THEN/ELSE as colored blocks) | ✅ New `VisualFlowBlock` component |
| Canvas with radial dot grid | ✅ CSS `radial-gradient` background |
| Floating toolbar with formula name + DRAFT badge | ✅ `EditorToolbar` component |
| IF/THEN/ELSE vertical flow with connector lines | ✅ DOM blocks + SVG Bézier curves |
| Live Test with Execution Trace | ✅ `ExecutionTrace` component |
| Dashboard stats cards (Total/Active/Pending) | ✅ Restyled with MD3 tokens |
| Variables table with type badges | ✅ `Badge` component with type colors |
| Audit timeline + side-by-side diff | ✅ Enhanced `AuditHistoryPage` |
| Export Log / Compare Selected buttons | ✅ Add to audit page |

---

## 10. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-22 | Frontend-only scope | Backend engine is proven (598 tests); risk of destabilizing working system outweighs benefits |
| 2026-04-22 | Hybrid DOM+SVG canvas | DOM blocks allow rich HTML styling; SVG handles connection lines; best of both approaches |
| 2026-04-22 | Keep existing data model | `DagNode`/`DagEdge` model supports new visual representation without schema changes |
| 2026-04-22 | No React Flow library | Our custom needs (vertical logic blocks) don't match graph library assumptions |
| 2026-04-22 | Client-side execution trace | Can derive from existing simulation response; avoids backend scope creep |

---

*This proposal is ready for review by the SDD orchestrator. Upon approval, implementation will proceed via the `sdd-design` → `sdd-code` → `sdd-verify` workflow stages.*
