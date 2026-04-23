# SDD Proposal: DAG Formula System Frontend Transformation

**Change ID**: `dag-formula-system`  
**Component**: Kioxia — Sistema de Gestión de Préstamos y Cobranza  
**Date**: 2025-01-13  
**Status**: PROPOSED  
**Artifact Store**: engram  
**Topic Key**: `sdd/dag-formula-system/proposal`

---

## 1. Executive Summary

This proposal outlines a comprehensive frontend UI/UX transformation of the DAG (Directed Acyclic Graph) formula workbench to achieve a professional "CreditCore Engine" terminal aesthetic. The goal is to evolve the current functional but visually basic formula editor, dashboard, variables registry, and audit history into a polished, intuitive, and visually cohesive experience that aligns with Material Design 3 principles and modern fintech standards.

The transformation focuses exclusively on the React frontend layer — refactoring page layouts, introducing new visual components, and enhancing user interactions — while preserving the existing robust backend graph execution engine, mathjs BigNumber calculations, security validations, and data models.

---

## 2. Problem Statement

The current DAG formula system, while functionally complete, suffers from several UX and visual deficiencies that hinder user productivity and fail to convey the professionalism expected of a credit calculation engine:

### 2.1 Formula Editor (Primary Pain Point)
| Deficiency | Impact |
|------------|--------|
| **Raw SVG node canvas** | Nodes are rendered as basic rectangles with simple badges; lacks the visual language of a professional workflow engine. The free-form 2D canvas does not enforce or suggest logical flow direction. |
| **Simplistic formula display** | Formulas inside nodes are shown as rows of flat "chips" (VisualChip components) — raw mathjs strings are parsed into token arrays but not presented as readable IF/THEN/ELSE block structures. |
| **No vertical flow diagram** | There is no structured vertical arrangement of logic blocks with connector lines that visually communicates execution order and conditional branching. |
| **No execution trace** | The Live Test panel shows only a JSON dump of the final result. Users cannot see the step-by-step evaluation path, which is critical for debugging complex credit formulas. |
| **Inconsistent property panel** | The inline node editor floats near selected nodes and competes with the canvas for attention, rather than being a dedicated, consistently-placed panel. |

### 2.2 Dashboard Overview
- Stats cards exist but styling is inconsistent (mixed Tailwind utility classes with inline MD3 tokens).
- The Active Formulas table is functional but lacks refined Material Design 3 surfacing, hover states, and action affordances.
- No visual differentiation between scopes or formula categories.

### 2.3 Variables Registry
- Table lacks **type badges** with distinct color coding (Integer, Currency, Boolean, Float).
- No **formula usage tracking** — users cannot see which formulas reference a given variable.
- **Source column** exists but is not visually distinguished (e.g., icons for bureau_api vs app_data vs system_core).
- Pagination works but lacks page size controls and total item context.

### 2.4 Audit Logs / History
- Timeline is present but visually underwhelming — no commit hash display, no author avatars, no timestamp relative formatting.
- Diff view exists but shows **raw JSON side-by-side** rather than a structured line-by-line diff with syntax highlighting and line numbers.
- No **Compare Selected** capability to diff arbitrary versions.
- Missing "Export Log" and "Compare Selected" action buttons at the header level.

---

## 3. Proposed Solution

### 3.1 High-Level Approach

Transform the frontend workbench into a **"CreditCore Engine" terminal** through a phased, page-by-page refactor. The approach is:

1. **Strengthen Design System** — Formalize MD3 color tokens, typography, spacing, and elevation into reusable Tailwind configuration and CSS custom properties. Introduce component primitives (Badge, Card, DataTable, Timeline, DiffViewer).

2. **Refactor Formula Editor Canvas** — Evolve from free-form SVG nodes to a **hybrid layout**:
   - **Retain the canvas** for node positioning and edge connections (proven, works well).
   - **Enhance node rendering** with structured block-based interiors: IF/THEN/ELSE blocks render as mini flowcharts within each node card.
   - **Add a "Flow View" toggle** that auto-arranges nodes vertically by topological sort, showing connector lines as a directed flow diagram.

3. **Introduce Execution Trace Panel** — After simulation, display a step-by-step trace showing each node's evaluation order, intermediate values, and branch decisions.

4. **Redesign Supporting Pages** — Apply the same visual language to Dashboard, Variables Registry, and Audit History for consistency.

### 3.2 Page-by-Page Changes

#### A. Dashboard Overview (`/formulas`)
- **Stats Cards**: Unify MD3 surface/on-surface color system. Add micro-charts (sparklines) for trend visualization.
- **Active Formulas Table**: 
  - Material Design 3 data table with proper hover states, row selection.
  - Status badges: Active (green dot + container), Draft (amber dot + container).
  - Inline actions: Edit, Activate/Deactivate, History, Delete — consolidated into a kebab menu with hover-reveal for clean UI.
  - Last edited dates with relative time ("2 hours ago").

#### B. Variables Registry (`/formulas/variables`)
- **Filter Bar**: Pills/chips for Type, Source, Usage Status instead of dropdowns. Add text search by name.
- **Table Enhancements**:
  - Mono font for variable names.
  - Type badges with distinct colors: Integer (blue), Currency (green), Boolean (purple), Float (amber), Percent (teal).
  - Source icons: `Cloud` for bureau_api, `Database` for app_data, `Cog` for system_core.
  - **Formula usage tags**: Show count of formulas referencing each variable; click to expand list.
  - Status indicators: Active (solid), Idle (outline), Deprecated (strikethrough + red badge).
- **Pagination**: Enhanced with page size selector, total items count, first/last page jumps.

#### C. Visual Formula Editor (`/formulas/new`, `/formulas/:id`) — Main Piece
- **Three-Panel Layout Retained** but refined:
  - **Toolbox (Left, 280px)**: 
    - Sections: Variables (with colored dot indicators), Operations (draggable buttons), Logic Blocks (IF/THEN/ELSE, AND, OR — as rich colored blocks with icons).
    - Collapsible sections with persistence.
  - **Canvas (Center)**:
    - Grid background: radial dots (retained, improved contrast).
    - **Floating toolbar**: Formula name input + status badge (DRAFT / ACTIVE), undo/redo, zoom controls, toggle view (Freeform / Flow).
    - **Node Cards**: Richer rendering:
      - Formula nodes: Show parsed IF/THEN/ELSE as mini vertical blocks inside the card.
      - Conditional nodes: Highlight condition slots with drop zones.
      - Output nodes: Show assigned variable name prominently.
    - **Edge rendering**: Curved bezier connections with animated flow indicators (optional).
  - **Live Test Panel (Right, 360px)**:
    - Input values with type labels (Int, Decimal, Boolean, Date).
    - "Evaluate Formula" button with loading state.
    - **Execution Result Card**: SUCCESS/ERROR badge, large formatted result (currency formatting for monetary outputs).
    - **Execution Trace**: Step-by-step accordion showing each node's evaluation:
      - Node ID, formula snippet, computed value, branch taken (for conditionals).
      - Color-coded: green for success path, gray for skipped branches.
    - "Save Formula" button with validation pre-check.

#### D. Audit Logs / History (`/audit/:id`)
- **Header**: Formula ID (FRM-XXXX), name, description, Export Log button.
- **Version History Sidebar (Left, 320px)**:
  - Vertical timeline with active version highlighted (primary color ring).
  - Each entry: version number, commit hash (short), commit message, author avatar + name, timestamp (relative + absolute on hover).
  - Selection checkboxes for compare mode.
- **Details/Compare Area (Right)**:
  - Version header with "CURRENT ACTIVE" badge, full commit hash (copyable), commit message, author, timestamp.
  - **Side-by-Side Diff**: True line-by-line diff with line numbers, removed lines (red background), added lines (green background), unchanged lines (subtle). Syntax highlighting for formula strings.
  - **Impacted Variables Summary**: Tags showing affected variables at bottom.
  - **Compare Selected Button**: When two versions are selected, show diff between them (not just previous).

### 3.3 Component Architecture Additions

New shared components to be created:
- `Badge` — MD3-compliant status/type badges.
- `DataTable` — Sortable, paginated, with row actions.
- `Timeline` — Vertical timeline with selectable items.
- `DiffViewer` — Line-by-line diff with syntax highlighting.
- `ExecutionTrace` — Step-by-step evaluation display.
- `BlockFormula` — Renders a formula string as visual IF/THEN/ELSE blocks.
- `FlowArrangementEngine` — Auto-layout nodes vertically by topological sort.

---

## 4. Scope & Boundaries

### In Scope (Frontend UI/UX Transformation)
1. All changes to React components in `/frontend/src/components/`:
   - `DashboardPage.tsx`
   - `FormulaEditorPage.tsx`
   - `VariablesRegistryPage.tsx`
   - `AuditHistoryPage.tsx`
2. New shared components in `/frontend/src/components/shared/`.
3. CSS/Tailwind refinements in `/frontend/src/index.css` and `tailwind.config.js` (if needed).
4. Store enhancements in `/frontend/src/store/blockEditorStore.ts` for flow view mode, execution trace state.
5. Type extensions in `/frontend/src/types/dag.ts` for execution trace structures.
6. Service additions in `/frontend/src/services/dagService.ts` for new API endpoints (execution trace, compare versions).

### Out of Scope (Backend Engine Changes)
1. **No changes to graph execution engine** (`graphExecutor.js`, `FormulaCompiler.js`, `CalculationEngine.js`).
2. **No changes to security layer** (formula whitelist, blocked patterns, cycle detection).
3. **No changes to data models** (`DagGraphVersion`, `DagVariable`, `DagSimulationSummary` schema remains unchanged).
4. **No changes to scope registry** (`scopeRegistry.js`, `workbenchService.js`).
5. **No new backend API routes** (existing endpoints suffice; frontend may request new payload shapes but backend contract stays).
6. **No changes to mathjs BigNumber integration**.
7. **No authentication/authorization changes**.

**Note**: If execution trace data is not currently returned by the simulation endpoint, a minimal backend adapter (in scope as a "backend contract extension") may be needed to expose intermediate evaluation steps. This is TBD during design.

---

## 5. Success Criteria

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | **Formula Editor Block Visualization** | IF/THEN/ELSE formulas render as visual blocks inside node cards; conditional nodes show branch structure. Verified by visual inspection and component tests. |
| 2 | **Execution Trace Display** | Live Test panel shows step-by-step evaluation trace with node names, intermediate values, and branch decisions. At least 80% of simulation runs display a readable trace. |
| 3 | **Dashboard Material Design 3 Compliance** | All color tokens use the formalized MD3 palette (surface, on-surface, secondary, error, etc.). Zero hardcoded hex values outside the design system. |
| 4 | **Variables Registry Filtering & Badges** | Users can filter by Type, Source, and Status simultaneously. Type badges have distinct colors. Deprecated variables show strikethrough + red badge. |
| 5 | **Audit History Diff Viewer** | Side-by-side diff shows line numbers, removed lines (red), added lines (green), and syntax-highlighted formulas. Diff is readable for formulas up to 50 lines. |
| 6 | **Zero Backend Regression** | All existing backend API tests pass without modification. Graph execution engine behavior unchanged. |
| 7 | **Frontend Test Coverage** | New components achieve ≥ 70% unit test coverage (Vitest + React Testing Library). E2E DAG behavior tests (`dagE2E.behavior.test.tsx`) continue to pass. |
| 8 | **Performance** | Formula editor canvas remains interactive with ≤ 50 nodes at 60fps. No perceptible lag on drag, zoom, or simulation. |

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Execution trace requires backend changes** | Medium | High | Mitigation: First verify if current simulation response already contains enough intermediate data. If not, negotiate a minimal backend contract extension (read-only, no engine changes). |
| **Canvas performance degrades with rich node rendering** | Medium | Medium | Mitigation: Use React.memo for node cards, virtualize if needed, and benchmark with 50+ nodes. Keep SVG layer separate from DOM node interiors. |
| **Flow view auto-layout conflicts with user positioning** | Low | Medium | Mitigation: Flow view is a toggle, not a replacement. User positions are preserved. Auto-layout is computed on-demand and not persisted unless explicitly saved. |
| **Design system refactor breaks existing pages** | Low | High | Mitigation: Introduce MD3 tokens incrementally. Maintain backward-compatible Tailwind utilities. Test all existing pages after token updates. |
| **Scope creep into backend** | Medium | High | Mitigation: Strictly enforce the boundary. Any backend need must go through a separate SDD change proposal. |
| **Test maintenance burden** | Low | Medium | Mitigation: Write tests alongside components (TDD style). Update existing behavior tests only when component contract changes. |

---

## 7. Alternatives Considered

### Alternative 1: Replace Canvas with a Third-Party Diagram Library (e.g., React Flow, GoJS)
- **Rejected**: React Flow is excellent but would require rewriting the entire editor interaction model (drag, zoom, edge drawing, node selection) which already works well. GoJS is proprietary and costly. The current SVG canvas is performant and gives us full control. We will enhance the existing canvas rather than replace it.

### Alternative 2: Full Page Redesign (Including Backend)
- **Rejected**: The backend engine is stable, tested, and handles complex financial calculations correctly. A frontend-only transformation delivers 90% of the user-visible value with 20% of the effort. Backend changes would introduce regression risk and delay delivery by weeks.

### Alternative 3: Keep Current Chip-Based Formula Display, Only Polish Colors
- **Rejected**: The user's primary complaint is the lack of visual block representation for IF/THEN/ELSE logic. Simply changing colors would not address the core usability issue. The step-by-step execution trace is also a critical feature for formula debugging.

### Alternative 4: Implement a Separate "Read-Only Flow View" Page
- **Rejected**: Users need the flow visualization in the context of editing. A separate page would fragment the workflow. Instead, we add a toggle within the existing editor.

---

## 8. Implementation Phases (Suggested)

| Phase | Deliverables | Duration |
|-------|-------------|----------|
| **1. Design System & Primitives** | MD3 token formalization, Badge, Card, DataTable, Timeline components | 2-3 days |
| **2. Dashboard & Variables Registry** | Refactor DashboardPage and VariablesRegistryPage with new components | 2-3 days |
| **3. Formula Editor — Canvas Enhancement** | Rich node cards, block formula rendering, flow view toggle | 4-5 days |
| **4. Live Test — Execution Trace** | Execution trace panel, step-by-step display | 2-3 days |
| **5. Audit History — Diff Viewer** | Timeline redesign, side-by-side diff, compare selected | 3-4 days |
| **6. Testing & Polish** | Unit tests, E2E validation, performance check, bug fixes | 3-4 days |

**Estimated Total**: ~16-22 days (frontend-only, one senior React developer)

---

## 9. Appendices

### A. Current Technology Stack
- **Frontend**: React 19, Vite, Tailwind CSS, TanStack Query, Zustand, mathjs (BigNumber), Lucide React icons
- **Backend**: Node.js, Express, Sequelize, PostgreSQL, mathjs BigNumber

### B. Key Files Involved
- `/frontend/src/components/DashboardPage.tsx`
- `/frontend/src/components/FormulaEditorPage.tsx`
- `/frontend/src/components/VariablesRegistryPage.tsx`
- `/frontend/src/components/AuditHistoryPage.tsx`
- `/frontend/src/store/blockEditorStore.ts`
- `/frontend/src/types/dag.ts`
- `/frontend/src/services/dagService.ts`
- `/frontend/src/services/variableService.ts`

### C. References
- Current system documentation: `DAG_SYSTEM.md` (implied)
- User reference: CreditCore Engine terminal design (HTML reference provided)
- Material Design 3 guidelines: https://m3.material.io/

---

*End of Proposal*
