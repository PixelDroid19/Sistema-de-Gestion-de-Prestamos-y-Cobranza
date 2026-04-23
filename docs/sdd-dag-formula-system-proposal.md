# Proposal: CreditCore Engine — DAG Formula Workbench UI/UX Transformation

**Change ID:** `dag-formula-system`  
**Artifact Type:** Proposal  
**Date:** 2025-01-21  
**Author:** SDD Orchestrator (sdd-propose sub-agent)  
**Topic Key:** `sdd/dag-formula-system/proposal`

---

## 1. Executive Summary

This proposal outlines a comprehensive frontend UI/UX transformation of the existing DAG (Directed Acyclic Graph) formula system workbench for the Kioxia loan management platform. The goal is to evolve the current functional but visually basic SVG-node editor into a polished, professional "CreditCore Engine" terminal that aligns with Material Design 3 principles and provides an intuitive, block-based visual flow for formula authoring, testing, and audit.

The transformation focuses exclusively on the **frontend presentation layer** — all existing backend calculation engines, security validations, and data models remain untouched. The result will be a workbench that financial analysts and admins can navigate with confidence, featuring rich visual logic blocks, execution traceability, professional audit diffs, and a cohesive design language across Dashboard, Variables Registry, Formula Editor, and Audit History pages.

---

## 2. Problem Statement

The current DAG formula workbench, while functionally complete, suffers from several UI/UX deficiencies that limit its professional presentation and usability:

### 2.1 Formula Editor — Visual Presentation Gap
- **Raw SVG node canvas**: Nodes are rendered as basic colored rectangles with minimal styling. The canvas lacks the polished, block-based visual flow of a professional formula engine.
- **No vertical flow diagram**: Conditional logic (IF/THEN/ELSE) is shown as inline chips within a node card, not as vertically arranged, connected logic blocks that visually communicate control flow.
- **Limited formula visualization**: Complex conditional expressions are compressed into chip rows. There is no visual separation of conditions, branches, and outputs as distinct interconnected blocks.
- **No execution trace**: The Live Test panel shows only the final JSON result. Users cannot see step-by-step which branches were evaluated, which conditions were true/false, and how the result was reached.

### 2.2 Dashboard — Aesthetic Misalignment
- The Dashboard page (`/formulas`) is functional but does not fully embody the Material Design 3 surface/on-surface/secondary color system requested by stakeholders.
- Stats cards and table styling are inconsistent with the target "CreditCore Engine" terminal aesthetic.

### 2.3 Variables Registry — Incomplete Visualization
- The Variables Registry (`/formulas/variables`) lacks the rich type badge system (Integer, Currency, Boolean, Float with distinct colors) requested.
- Formula usage tags showing which formulas reference each variable are missing.
- Deprecated variables are grayed out but lack the strikethrough + red badge treatment specified.

### 2.4 Audit History — Diff & Timeline Limitations
- The Audit History page (`/audit/:id`) has a timeline sidebar but lacks the professional commit-hash header, side-by-side diff with line numbers, and explicit red/green added/removed line highlighting requested.
- Impacted Variables summary exists but is not visually prominent.
- Export Log and Compare Selected actions are present but not integrated into a cohesive diff-review workflow.

### 2.5 Overall Design Language
- No unified "CreditCore Engine" terminal identity across pages.
- Floating toolbars, grid backgrounds, and block connectors lack the refined spacing, shadow, and color treatment of the reference design.

---

## 3. Proposed Solution

### 3.1 High-Level Approach
Transform the frontend workbench through a **component-level restyling and structural enhancement** campaign, reusing all existing backend APIs, data models, and calculation logic. The approach is:

1. **Design System Alignment**: Unify all DAG-related pages under a strict Material Design 3 color token system (surface, on-surface, secondary, secondary-container, error, outline, outline-variant) already partially introduced in `DashboardPage.tsx` and `FormulaEditorPage.tsx`.

2. **Block-Based Canvas Rewrite**: Replace the current SVG-node rendering with a hybrid SVG+DOM canvas that supports:
   - **Vertical flow layout** for logic blocks (IF/THEN/ELSE arranged top-to-bottom with connector lines)
   - **Draggable block nodes** with richer visual treatment (shadow, rounded corners, color-coded headers, inline editable fields)
   - **Bezier connector lines** with animated data-flow indicators
   - **Grid background** with radial dot pattern (already exists, refine opacity and spacing)

3. **Rich Formula Visualization**:
   - Parse `ifThenElse(...)` formulas into visual logic blocks: `[IF] [Variable] [Operator] [Value] [THEN] [Result] [ELSE] [Result]`
   - Support nested ELSE IF blocks with visual indentation
   - Final output assignment shown as a distinct bottom block

4. **Execution Trace Panel**:
   - Extend the Live Test panel to show a step-by-step execution trace
   - Each trace entry shows: node evaluated, formula snippet, result value, time taken
   - Conditional branches highlight the taken path in green, skipped paths in gray

5. **Dashboard Polish**:
   - Refine stats cards with consistent MD3 color application
   - Add inline action tooltips and hover states
   - Ensure status badges (Active/Draft) use the correct surface/on-surface contrast

6. **Variables Registry Enhancement**:
   - Add colored type badges (Integer=blue, Currency=green, Boolean=amber, Float=purple)
   - Add formula usage tags (chips linking to formulas that reference the variable)
   - Implement strikethrough + red "Deprecated" badge for deprecated variables
   - Ensure pagination controls match MD3 aesthetic

7. **Audit History Professionalization**:
   - Add commit hash display in version header
   - Implement side-by-side diff with line numbers, red removed lines, green added lines
   - Move Impacted Variables to a prominent summary card at the bottom of the diff view
   - Add "Compare Selected" functionality for comparing any two versions (not just consecutive)

### 3.2 Technology & Architecture
- **Frontend Stack** (unchanged): React 19 + TypeScript + Vite + Tailwind CSS + Zustand + TanStack Query + Lucide React
- **Canvas Rendering**: Hybrid SVG (for edges/connections) + HTML DOM (for nodes/blocks) to enable rich interactivity without sacrificing connection precision
- **State Management**: Continue using `blockEditorStore.ts` for local editor state; no backend state changes required
- **APIs**: Reuse all existing `dagService.ts` endpoints without modification

---

## 4. Scope & Boundaries

### 4.1 In Scope (Frontend UI/UX Transformation)
| Page/Component | Changes |
|----------------|---------|
| `DashboardPage.tsx` (`/formulas`) | MD3 color alignment, stats card polish, table hover states, badge consistency |
| `FormulaEditorPage.tsx` (`/formulas/new`, `/formulas/:id`) | Block-based canvas, vertical logic flow, rich formula visualization, execution trace, floating toolbar refinement |
| `VariablesRegistryPage.tsx` (`/formulas/variables`) | Type badges, usage tags, deprecated styling, filter bar polish, pagination styling |
| `AuditHistoryPage.tsx` (`/audit/:id`) | Side-by-side diff with line numbers, commit hash header, impacted variables summary, compare selected versions |
| `blockEditorStore.ts` | Add execution trace state, block layout state (no backend API changes) |
| `types/dag.ts` | Add execution trace types, block layout types (no backend model changes) |
| Shared components | New `VisualLogicBlock`, `ExecutionTracePanel`, `DiffViewer`, `TypeBadge` components |

### 4.2 Out of Scope (Backend & Engine)
- **Backend API changes**: All `/api/loans/workbench/*` endpoints remain unchanged
- **CalculationEngine.js**: No modifications to mathjs BigNumber execution, topological sort, or formula compilation
- **Security validations**: Whitelist, blocked patterns regex, cycle detection, contract validation remain untouched
- **Database models**: `DagGraphVersion`, `DagSimulationSummary`, `DagVariable` schemas unchanged
- **DAG execution logic**: Scope builder, result types, node kinds, edge compatibility rules unchanged
- **CreditSimulator.tsx** (`/simulator`): Standalone simulator route remains unchanged (it uses the shared workspace)
- **NewCredit.tsx** (`/credits-new`): Loan creation form remains unchanged

### 4.3 Explicit Non-Goals
- No migration to a visual programming library (e.g., React Flow, Rete.js) — custom canvas implementation is retained for full control
- No backend formula execution trace logging — trace is computed client-side from simulation response
- No real-time collaborative editing
- No mobile-responsive editor canvas (desktop-focused admin tool)

---

## 5. Success Criteria

### 5.1 Measurable Outcomes
| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | **Visual block rendering** | All formula nodes render as styled blocks with header, body, and connection handles; no raw SVG rectangles visible |
| 2 | **Vertical logic flow** | Conditional formulas (`ifThenElse`) render as vertically stacked IF/THEN/ELSE blocks with connector lines; nested ELSE IF visually indented |
| 3 | **Execution trace** | Live Test panel shows ≥5 step execution trace entries for a typical credit simulation; trace displays node ID, evaluated formula fragment, and result |
| 4 | **Dashboard MD3 compliance** | All colors on Dashboard page use MD3 token constants (`surface`, `onSurface`, `secondary`, etc.); zero hardcoded hex values outside token object |
| 5 | **Variables registry badges** | Type badges render with distinct colors; deprecated variables show strikethrough name + red badge; usage tags show referencing formula count |
| 6 | **Audit diff viewer** | Side-by-side diff shows line numbers, red removed lines, green added lines; commit hash visible; impacted variables in summary card |
| 7 | **Zero backend regressions** | All 598 backend tests pass without modification; all 71 frontend tests pass or are updated to match new component structure |
| 8 | **Performance** | Canvas renders ≤50 nodes at 60fps; formula editor initial load <2s on localhost |

### 5.2 Qualitative Outcomes
- Users report the editor "looks like a professional financial engine" rather than a developer tool
- Formula authoring time decreases due to clearer visual logic representation
- Audit review time decreases due to readable side-by-side diffs

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Canvas complexity** — Block-based rendering with DOM+SVG hybrid may introduce z-index, hit-testing, or coordinate-sync bugs | Medium | High | Isolate canvas in a dedicated `FormulaCanvas.tsx` component with extensive unit tests; use React refs for SVG overlay; test edge cases (zoom, drag, 50+ nodes) |
| **Performance degradation** — Rich DOM nodes may slow canvas with many formulas | Low | Medium | Implement virtualization for off-screen nodes; benchmark with 50/100/200 nodes; fallback to simplified rendering at zoom <0.5 |
| **Visual formula parser edge cases** — Complex nested `ifThenElse` or custom helpers may not parse cleanly into blocks | Medium | Medium | Build parser incrementally; fallback to current chip display for unparsable formulas; add parser unit tests for all whitelist functions |
| **Frontend test breakage** — 71 existing tests may fail due to DOM structure changes | High | Low | Update test selectors to use data-testid attributes; run full test suite after each page refactor; prioritize behavior tests over snapshot tests |
| **Accessibility (a11y) regression** — Rich visual blocks may reduce screen-reader usability | Medium | Medium | Add ARIA labels to all blocks, buttons, and connection handles; ensure keyboard navigation for toolbox and canvas |
| **Scope creep into backend** — Stakeholders may request execution trace from backend | Low | High | Explicitly document out-of-scope boundary; if requested, create separate change proposal for backend trace logging |

---

## 7. Alternatives Considered

### 7.1 Adopt React Flow or Rete.js
- **Description**: Migrate the entire canvas to a mature visual programming library.
- **Rejected**: The existing custom canvas already handles edge compatibility rules, undo/redo, zoom, and drag-and-drop. Migrating would require rewriting significant logic for marginal gain in connection routing. The target design is specific enough that a custom implementation provides better control over the "CreditCore Engine" aesthetic.

### 7.2 Backend-Generated Execution Trace
- **Description**: Modify `CalculationEngine.js` to log each evaluation step and return it in the simulation response.
- **Rejected**: Out of scope for this frontend-focused change. The backend engine is stable and heavily tested (598 tests). Adding trace logging would require schema changes and careful performance analysis. Client-side trace reconstruction from the existing simulation result is sufficient for the target UX.

### 7.3 Full Page Rewrite (Greenfield)
- **Description**: Discard existing pages and rebuild from scratch.
- **Rejected**: The existing pages contain substantial business logic (API calls, mutations, form handling, validation) that would be expensive to recreate. The proposal instead opts for surgical component-level refactoring, preserving all data flow and state management.

### 7.4 SVG-Only Canvas Enhancement
- **Description**: Keep pure SVG rendering but add more styling.
- **Rejected**: SVG is excellent for edges and connectors but poor for rich interactive content (inline editing, dropdowns, scrollable formula blocks). The hybrid SVG+DOM approach provides the best of both worlds.

---

## 8. Implementation Phases (Suggested)

While this proposal does not mandate implementation order, the following phased approach minimizes risk:

1. **Phase 1 — Design System Foundation** (Dashboard + Variables Registry polish)
   - Unify MD3 tokens across all DAG pages
   - Update Dashboard stats cards and table styling
   - Update Variables Registry badges, filters, and pagination

2. **Phase 2 — Formula Editor Canvas** (Core transformation)
   - Build `VisualLogicBlock` component with IF/THEN/ELSE layout
   - Implement hybrid SVG+DOM canvas with block nodes
   - Add vertical flow layout algorithm for conditional chains
   - Preserve all existing drag/drop/zoom/undo functionality

3. **Phase 3 — Live Test Enhancement**
   - Add client-side execution trace reconstruction
   - Build `ExecutionTracePanel` component
   - Integrate into Live Test sidebar

4. **Phase 4 — Audit History Professionalization**
   - Build `DiffViewer` component with side-by-side layout
   - Add line numbers, red/green highlighting
   - Add "Compare Selected" version selector
   - Promote Impacted Variables to summary card

5. **Phase 5 — QA & Polish**
   - Full test suite pass (backend + frontend)
   - Performance benchmarking
   - Accessibility audit
   - Cross-browser verification

---

## 9. Acceptance Criteria Summary

- [ ] All four DAG pages (Dashboard, Editor, Variables, Audit) render with unified MD3 design language
- [ ] Formula Editor displays logic blocks in vertical flow with connected lines
- [ ] Live Test panel shows step-by-step execution trace
- [ ] Audit History shows side-by-side diff with line numbers and color-coded changes
- [ ] Variables Registry shows type badges, usage tags, and deprecated styling
- [ ] Zero backend API or engine changes required
- [ ] All existing tests pass; new tests added for canvas, trace, and diff components
- [ ] Performance benchmarks met (60fps for ≤50 nodes, <2s initial load)

---

*End of Proposal*
