# Clean Operational Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/reports` a low-friction desktop surface where the selected report and its data appear before optional filters and export-format choices.

**Architecture:** Keep all report queries and backend contracts intact. Consolidate each report's heading, filter trigger, and download trigger through `ReportTabPanel` and a reusable `ReportDownloadControl`; simplify the cashflow presentation without removing financial values.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing shared Surfaces controls and i18n dictionaries.

## Global Constraints

- Desktop viewports 1280x900 and 1440x1000 are the acceptance surfaces.
- Keep all six current reports, permissions, datasets, pagination, and export parameters.
- Do not add dependencies, routes, backend fields, metrics, charts, or a second styling system.
- Filters are optional UI and remain closed by default unless an optional filter is active.
- Only one `Descargar` trigger is visible per report; Excel and PDF are selected inside the existing modal.
- Preserve semantic tabs, keyboard operation, focus visibility, empty/error/loading states, and i18n.

---

### Task 1: One report header with optional filters

**Files:**
- Create: `frontend/src/components/reports/__tests__/ReportTabPanel.behavior.test.tsx`
- Modify: `frontend/src/components/reports/ReportTabPanel.tsx`
- Modify: `frontend/src/i18n/dictionaries/terms-es/reports.ts`
- Modify: `frontend/src/i18n/dictionaries/terms-en/reports.ts`

**Interfaces:**
- Produces: `ReportTabPanel` props `activeFilterCount?: number`, `filtersDefaultOpen?: boolean`, and the existing `filters`, `filterColumns`, `title`, `subtitle`, `headerActions` contract.
- Consumes: `ActionButton`, `SlidersHorizontal`, `useId`, and internal open state.

- [ ] **Step 1: Write failing behavior tests**

```tsx
render(
  <ReportTabPanel title="Cierre contable" subtitle="Caja del período" filters={<label>Año<input /></label>}>
    <p>Datos</p>
  </ReportTabPanel>,
);
expect(screen.getByRole('heading', { name: 'Cierre contable' })).toBeInTheDocument();
expect(screen.getByText('Datos')).toBeVisible();
expect(screen.queryByLabelText('Año')).not.toBeInTheDocument();
const filters = screen.getByRole('button', { name: 'Filtros' });
fireEvent.click(filters);
expect(filters).toHaveAttribute('aria-expanded', 'true');
expect(screen.getByLabelText('Año')).toBeVisible();
```

Add a second test with `activeFilterCount={2}` that expects the panel open and the button named `Filtros (2)`.

- [ ] **Step 2: Run the test and verify RED**

Run: `cd frontend && npm test -- --run src/components/reports/__tests__/ReportTabPanel.behavior.test.tsx`

Expected: FAIL because current filters render immediately and no `Filtros` button exists.

- [ ] **Step 3: Implement the accessible toolbar and panel**

Use `useId` and `useState(filtersDefaultOpen || activeFilterCount > 0)`. Render the filter trigger in the same header action group before `headerActions`, set `aria-expanded` and `aria-controls`, and only mount the filter grid while open. Keep children rendered after the toolbar.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `cd frontend && npm test -- --run src/components/reports/__tests__/ReportTabPanel.behavior.test.tsx`

Expected: both tests pass with no warnings.

### Task 2: A single download entry point

**Files:**
- Modify: `frontend/src/components/reports/ReportDownloadModal.tsx`
- Create: `frontend/src/components/reports/__tests__/ReportDownloadControl.behavior.test.tsx`

**Interfaces:**
- Produces: `ReportDownloadControl({ title, subtitle, isExporting, disabled, formats, onDownload })`.
- Consumes: existing `ReportDownloadTrigger` and `ReportDownloadModal`.

- [ ] **Step 1: Write the failing control test**

```tsx
const onDownload = vi.fn().mockResolvedValue(true);
render(<ReportDownloadControl title="Descargar cierre" isExporting={false} onDownload={onDownload} />);
expect(screen.getAllByRole('button')).toHaveLength(1);
fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
expect(screen.getByRole('dialog')).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: 'Excel (xlsx)' }));
await waitFor(() => expect(onDownload).toHaveBeenCalledWith('xlsx'));
```

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && npm test -- --run src/components/reports/__tests__/ReportDownloadControl.behavior.test.tsx`

Expected: FAIL because `ReportDownloadControl` is not exported.

- [ ] **Step 3: Implement the local open/close composition**

Add a component that owns only `open`, renders one trigger, and mounts the modal when open. Close after `onDownload` resolves `true`; retain the modal when it resolves `false`.

- [ ] **Step 4: Run and verify GREEN**

Run: `cd frontend && npm test -- --run src/components/reports/__tests__/ReportDownloadControl.behavior.test.tsx`

Expected: all control tests pass.

### Task 3: Compact the accounting close without losing figures

**Files:**
- Modify: `frontend/src/components/__tests__/Reports.behavior.test.tsx`
- Modify: `frontend/src/components/reports/CashflowTab.tsx`
- Modify: `frontend/src/components/reports/ReportValueStack.tsx`

**Interfaces:**
- Produces: a compact metadata line for cashflow breakdowns and a totals row without repeated breakdown.
- Consumes: normalized cashflow rows and existing currency formatting.

- [ ] **Step 1: Add failing cashflow assertions**

```tsx
renderReports();
expect(screen.getByRole('button', { name: 'Filtros' })).toHaveAttribute('aria-expanded', 'false');
expect(screen.queryByLabelText('Año')).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Descargar' })).toBeInTheDocument();
expect(screen.queryByRole('button', { name: 'Excel' })).not.toBeInTheDocument();
expect(screen.getByText(/Cuotas COP .* · Aportes COP/)).toBeInTheDocument();
```

Assert that the total row contains totals but no nested meta pairs.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && npm test -- --run src/components/__tests__/Reports.behavior.test.tsx -t "uses cashflow data"`

Expected: FAIL on visible filters, separate exports, and stacked metadata.

- [ ] **Step 3: Implement the compact report**

Give `CashflowTab` the active report title/subtitle, place its filter controls inside the new collapsed panel, use `ReportDownloadControl`, render breakdown labels in one wrapping line, and render totals without metadata.

- [ ] **Step 4: Run cashflow behavior tests and verify GREEN**

Run: `cd frontend && npm test -- --run src/components/__tests__/Reports.behavior.test.tsx -t "cashflow|accounting close|Cierre contable"`

Expected: cashflow tests pass.

### Task 4: Apply the same grammar to every report

**Files:**
- Modify: `frontend/src/components/Reports.tsx`
- Modify: `frontend/src/components/reports/CreditHistoryMonthlyTab.tsx`
- Modify: `frontend/src/components/reports/PayoutsTab.tsx`
- Modify: `frontend/src/components/reports/OutstandingTab.tsx`
- Modify: `frontend/src/components/reports/AssociateMovementsTab.tsx`
- Modify: `frontend/src/components/reports/OperatingExpensesTab.tsx`
- Modify: `frontend/src/components/__tests__/Reports.behavior.test.tsx`

**Interfaces:**
- Consumes: `ReportTabPanel` filter behavior and `ReportDownloadControl`.
- Produces: one title, one optional filter trigger, and one download trigger per active report.

- [ ] **Step 1: Add failing cross-report assertions**

For each report tab, click it and assert there is one active report heading, no visible filter fields before opening `Filtros`, at most one `Descargar` trigger, and no standalone Excel/PDF buttons. For permissions, keep expenses absent for employees without finance access.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && npm test -- --run src/components/__tests__/Reports.behavior.test.tsx`

Expected: failures identify reports that still expose filters or multiple export buttons.

- [ ] **Step 3: Integrate common controls**

Remove `reports-module-intro` from `Reports.tsx`. Pass titles/subtitles into each report's `ReportTabPanel`, merge secondary filters into the same hidden panel, and replace direct export button pairs with `ReportDownloadControl`. Keep the operating-expense create action alongside filters/download.

- [ ] **Step 4: Run report and component suites**

Run:

```bash
cd frontend
npm test -- --run src/components/__tests__/Reports.behavior.test.tsx src/components/__tests__/CreditHistoryMonthlyTab.behavior.test.tsx src/components/reports/__tests__
```

Expected: all selected tests pass.

### Task 5: Reduce visual weight and verify the real workflow

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: existing `.reports-module-nav`, `.report-tab-panel`, and `.report-value-stack` semantic classes.
- Produces: compact textual tabs, a single toolbar, hidden filter panel until requested, and a denser financial table.

- [ ] **Step 1: Add scoped desktop styles**

Change report navigation to a border-bottom text tab bar without card shadow, use content-width tabs instead of equal columns, make the active state an underline, keep toolbar actions on one row at desktop, and reduce table metadata spacing. Preserve visible focus and horizontal overflow.

- [ ] **Step 2: Run automated verification**

Run:

```bash
npm run lint
npm test
cd frontend && npm run build
git diff --check
```

Expected: backend and frontend suites, type checking, lint, build, and whitespace checks all exit 0.

- [ ] **Step 3: Validate in the browser**

At `/reports`, 1440x1000 and 1280x900, verify all six reports, keyboard tab selection, filter open/close and active count, download modal formats, empty/error states, no horizontal page overflow, and console/network health.

- [ ] **Step 4: Review, commit, and push master**

Stage only the report implementation, tests, i18n, CSS, spec, and plan. Confirm `tmp/` remains untracked. Commit with a scoped Conventional Commit message and push `master`; verify `HEAD` equals `origin/master`.
