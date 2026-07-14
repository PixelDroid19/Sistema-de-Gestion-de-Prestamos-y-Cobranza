# Aligned Report Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the report navigation and collapse the report heading controls into a compact desktop toolbar, then publish and reset the production dataset to the two requested QA users.

**Architecture:** Keep report selection in `ReportsNavigation`. Make filter disclosure state controllable by `ReportTabPanel`, allowing the trigger to share the heading action cluster while the expanded panel remains a full-width sibling. Use the existing production reset script for the destructive database operation.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Node.js, Express, Sequelize, PostgreSQL, Railway CLI.

## Global Constraints

- Desktop is the primary experience; preserve the existing stacked fallback.
- Do not add dependencies or change financial/report API contracts.
- Keep `tmp/` untracked and unstaged.
- Publish directly to `master` as explicitly requested.
- Reset only Railway `production` PostgreSQL after the deployments succeed.
- Seed only the requested admin and employee accounts.

---

### Task 1: Lock the compact toolbar behavior with tests

**Files:**
- Modify: `frontend/src/components/__tests__/Reports.behavior.test.tsx`
- Modify: `frontend/src/components/reports/__tests__/ReportTabPanel.behavior.test.tsx`

**Interfaces:**
- Consumes: `ReportsNavigation`, `ReportTabPanel`
- Produces: regression expectations for `reports-module-nav--single-row` and `report-tab-panel__toolbar`

- [ ] Add assertions that the category group and report select live in one navigation row.
- [ ] Add assertions that the filter trigger and export actions share one report toolbar while the filter panel remains absent when collapsed.
- [ ] Run the focused tests and confirm they fail because the new structure does not exist.

Run:

```bash
cd frontend && npm test -- src/components/__tests__/Reports.behavior.test.tsx src/components/reports/__tests__/ReportTabPanel.behavior.test.tsx
```

Expected: failures naming the missing compact toolbar structure.

### Task 2: Implement the controlled filter disclosure and aligned layout

**Files:**
- Modify: `frontend/src/components/reports/ReportCollapsibleFilters.tsx`
- Modify: `frontend/src/components/reports/ReportTabPanel.tsx`
- Modify: `frontend/src/components/reports/ReportsNavigation.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- `ReportCollapsibleFilters` consumes optional `isOpen`, `onToggle`, and `showToggle` props.
- `ReportTabPanel` owns disclosure state and renders the filter trigger beside `headerActions`.
- `ReportsNavigation` retains the semantic label with the shared visually-hidden utility.

- [ ] Implement the minimal controlled disclosure API.
- [ ] Render one desktop toolbar containing filter and export actions.
- [ ] Keep the expanded filter panel and active chips as full-width rows.
- [ ] Equalize category/select height and baseline.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Verify the complete repository and browser workflow

**Files:**
- No production file changes expected.

- [ ] Run `npm run lint`.
- [ ] Run `npm run test`.
- [ ] Run `cd frontend && npm run build`.
- [ ] Start the local app and validate `/reports` in Chrome at a desktop viewport.
- [ ] Compare the supplied screenshots with the corrected rendered state.
- [ ] Inspect console, network, keyboard focus, filter open/close, active chips, and clear-all.

### Task 4: Publish and deploy

**Files:**
- Stage only the intended documentation, tests, components, and CSS.

- [ ] Commit with `fix(reports): align compact report toolbar`.
- [ ] Push `master` to `origin`.
- [ ] Deploy frontend and backend from the pushed revision.
- [ ] Verify both deployments reach `SUCCESS`.

### Task 5: Reset and verify the production dataset

**Files:**
- Execute existing `backend/scripts/resetProductionEmptyDataset.js`; do not modify it unless its focused tests expose a defect.

- [ ] Resolve and verify the linked Railway project, `production` environment, backend service, and PostgreSQL service.
- [ ] Execute the reset script inside the production backend environment with the explicit confirmation value and requested QA credentials.
- [ ] Read back user count, roles, and operational table counts.
- [ ] Verify admin and employee login against the production API.
- [ ] Open production `/reports` and confirm the empty state and compact toolbar.
