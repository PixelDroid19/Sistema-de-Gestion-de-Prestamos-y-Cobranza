# Client Meeting Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove and complete the financial behavior requested in the client meeting, expose every canonical report directly, and validate the resulting desktop workflow end to end.

**Architecture:** Preserve the canonical backend calculations and report read models that already cover the meeting cases. Make one focused information-architecture correction in `Reports`: finance-authorized users receive `Gastos operativos` as the sixth report tab instead of a detached page-header action. Verification then crosses backend contracts, rendered UI, exports, and the real desktop workflow.

**Tech Stack:** Node.js 16+, Express, Sequelize, Node test runner, React 19, TypeScript, Vite, Vitest, Testing Library, Tailwind v4 plus existing semantic CSS, PostgreSQL, ExcelJS, PDFKit.

## Global Constraints

- Damien is the developer in the transcript; client requests define acceptance behavior.
- `Cierre contable` is a query/export read model and does not lock a period.
- The six canonical reports are `Cierre contable`, `Créditos del período`, `Pago de cuotas`, `Cartera por cobrar`, `Movimientos de socios`, and `Gastos operativos`.
- Capital, income, interest, late fees, and profit remain distinct financial concepts.
- Associates use contributed capital and agreed profitability; no profit-sharing participation or artificial accumulated-return cap.
- Desktop is the supported design target for this work. Validate 1280x800, 1440x900, 1920x1080, and 200% zoom; do not redesign mobile.
- Do not add dependencies, compatibility aliases, silent fallbacks, decorative UI, or a second styling system.
- Production behavior changes follow red-green-refactor.

---

## File Map

- `frontend/src/components/Reports.tsx`: owns report catalog composition, permission-aware report destinations, and active report rendering.
- `frontend/src/components/reports/ReportsNavigation.tsx`: renders the report catalog as accessible tabs.
- `frontend/src/index.css`: controls desktop report-catalog density and wrapping.
- `frontend/src/components/__tests__/Reports.behavior.test.tsx`: verifies report discoverability, permissions, navigation, filters, and export behavior.
- `backend/tests/paymentApplicationService.test.js`: contains the transcript-derived capital-prepayment regression and related schedule invariants.
- `backend/tests/monthlyCashFlowReport.test.js`: verifies accounting-close values and Excel/PDF generation.
- `backend/tests/reportsModule.test.js`: verifies report contracts and financial definitions.
- `backend/tests/reportsExcelExport.test.js`: verifies exported associate and operational movement data.
- `frontend/src/components/__tests__/Dashboard.behavior.test.tsx`: verifies financial labels and dashboard sections.
- `frontend/src/components/__tests__/CreditDetails.behavior.test.tsx`: verifies the capital-prepayment form and backend preview contract.

---

### Task 1: Put operating expenses inside the canonical report catalog

**Files:**
- Modify: `frontend/src/components/__tests__/Reports.behavior.test.tsx`
- Modify: `frontend/src/components/Reports.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `canViewOperatingExpensesTab: boolean`, `PrimaryReportTab`, `ReportGroup[]`, `ReportsNavigation`.
- Produces: a permission-aware sixth `ReportLeaf` with id `expenses`; `activeTab === 'expenses'` continues to render `OperatingExpensesTab` with the existing mutation and export contracts.

- [ ] **Step 1: Write the failing catalog and permission tests**

Replace the admin catalog expectations with:

```tsx
it('renders one operational catalog including associates and authorized expenses', () => {
  renderReports();

  const reportSelector = screen.getByRole('region', { name: 'Secciones de reportes' });
  expect(within(reportSelector).getAllByRole('tab')).toHaveLength(6);
  expect(within(reportSelector).getByRole('tab', { name: 'Cierre contable' })).toHaveAttribute('aria-selected', 'true');
  expect(within(reportSelector).getByRole('tab', { name: 'Créditos del período' })).toBeInTheDocument();
  expect(within(reportSelector).getByRole('tab', { name: 'Pago de cuotas' })).toBeInTheDocument();
  expect(within(reportSelector).getByRole('tab', { name: 'Cartera por cobrar' })).toBeInTheDocument();
  expect(within(reportSelector).getByRole('tab', { name: 'Movimientos de socios' })).toBeInTheDocument();
  expect(within(reportSelector).getByRole('tab', { name: 'Gastos operativos' })).toBeInTheDocument();
});

it('opens expense management from the report catalog', () => {
  renderReports();

  fireEvent.click(screen.getByRole('tab', { name: 'Gastos operativos' }));

  expect(screen.getByRole('tab', { name: 'Gastos operativos' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('heading', { name: 'Control de gastos operativos' })).toBeInTheDocument();
});
```

Update the restricted employee assertion to prove the permission boundary remains visible in the catalog:

```tsx
const reportSelector = screen.getByRole('region', { name: 'Secciones de reportes' });
expect(within(reportSelector).queryByRole('tab', { name: 'Gastos operativos' })).not.toBeInTheDocument();
expect(within(reportSelector).getAllByRole('tab')).toHaveLength(5);
```

- [ ] **Step 2: Run the report tests and verify RED**

Run:

```bash
cd frontend
npm run test -- --run src/components/__tests__/Reports.behavior.test.tsx
```

Expected: FAIL because `Gastos operativos` is a page-header button and is not a tab inside `Secciones de reportes`.

- [ ] **Step 3: Add the permission-aware expense leaf and remove the detached action**

In `frontend/src/components/Reports.tsx`, build the leaves from the permission state:

```tsx
const reportGroups = useMemo<ReportGroup[]>(() => [{
  id: 'operational',
  label: tTerm('reports.group.operational'),
  title: tTerm('reports.group.operational.title'),
  leaves: [
    { id: 'cashflow', label: tTerm('reports.tab.cashflow'), title: tTerm('reports.tab.cashflow.title') },
    { id: 'creditHistory', label: tTerm('reports.tab.creditHistory'), title: tTerm('reports.tab.creditHistory.title') },
    { id: 'payouts', label: tTerm('reports.tab.payouts'), title: tTerm('reports.tab.payouts.title') },
    { id: 'outstanding', label: tTerm('reports.tab.outstanding'), title: tTerm('reports.tab.outstanding.title') },
    { id: 'associates', label: tTerm('reports.tab.associates'), title: tTerm('reports.tab.associates.title') },
    ...(canViewOperatingExpensesTab
      ? [{ id: 'expenses', label: tTerm('reports.tab.expenses'), title: tTerm('reports.expenses.subtitle') }]
      : []),
  ],
}], [canViewOperatingExpensesTab]);
```

Delete `operatingExpensesAction` and render the header without `actions`:

```tsx
<PageHeader
  title={tTerm('reports.module.title')}
  subtitle={tTerm('reports.module.subtitle')}
  tourId="reports-header"
/>
```

Allow the standard report intro for `expenses`; `OperatingExpensesTab` remains the only owner of expense forms, filters, mutations, and exports.

- [ ] **Step 4: Make all report destinations visible and dense on desktop**

Replace the desktop-only flex rule for `.reports-module-nav__tabs` with a wrapping grid:

```css
@media (min-width: 768px) {
  .reports-module-nav__tabs {
    display: grid;
    width: 100%;
    min-height: 3.25rem;
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    overflow: visible;
  }

  .reports-module-nav__tabs .view-tab {
    width: 100%;
    min-width: 0;
    padding: 0.65rem 0.8rem;
    white-space: normal;
  }
}
```

This keeps all reports visible at 1280-1920 px and permits normal wrapping under 200% zoom without an overflow-only discovery path.

- [ ] **Step 5: Run report tests and verify GREEN**

Run:

```bash
cd frontend
npm run test -- --run src/components/__tests__/Reports.behavior.test.tsx
```

Expected: the file passes with the authorized six-tab catalog, the restricted five-tab catalog, and existing expense operations unchanged.

- [ ] **Step 6: Review the focused diff**

Run:

```bash
git diff --check
git diff -- frontend/src/components/Reports.tsx frontend/src/components/__tests__/Reports.behavior.test.tsx frontend/src/index.css
```

Expected: no whitespace errors; no new report implementation, fallback, duplicated expense state, or unrelated visual change.

---

### Task 2: Prove the transcript-derived credit behavior and report definitions

**Files:**
- Verify: `backend/tests/paymentApplicationService.test.js`
- Verify: `backend/tests/monthlyCashFlowReport.test.js`
- Verify: `backend/tests/reportsModule.test.js`
- Verify: `backend/tests/reportsExcelExport.test.js`
- Verify: `frontend/src/components/__tests__/CreditDetails.behavior.test.tsx`
- Verify: `frontend/src/components/__tests__/Dashboard.behavior.test.tsx`

**Interfaces:**
- Consumes: `previewCapitalPayment`, `applyCapitalPayment`, canonical loan view, installment quote, monthly close read model, Excel/PDF exporters, dashboard read model.
- Produces: fresh evidence that the current implementation satisfies the meeting without redundant production changes.

- [ ] **Step 1: Run the exact capital-prepayment regression**

Run:

```bash
cd backend
NODE_ENV=test node --require module-alias/register --test \
  --test-name-pattern='capital payment preview, applied schedule and next quote stay aligned|applyCapitalPayment reduce_payment|applyCapitalPayment reduce_term' \
  tests/paymentApplicationService.test.js
```

Expected: 7 tests pass. The transcript case proves COP 824.349 - COP 324.349 = COP 500.000 and rounds the new five-installment quote to COP 115.487 in preview, saved schedule, and next quote.

- [ ] **Step 2: Run backend report and export contracts**

Run:

```bash
cd backend
NODE_ENV=test node --require module-alias/register --test \
  tests/monthlyCashFlowReport.test.js \
  tests/reportsModule.test.js \
  tests/reportsExcelExport.test.js
```

Expected: all tests pass, including accounting-close reconciliation and Excel/PDF generation.

- [ ] **Step 3: Run frontend financial behavior tests**

Run:

```bash
cd frontend
npm run test -- --run \
  src/components/__tests__/CreditDetails.behavior.test.tsx \
  src/components/__tests__/Dashboard.behavior.test.tsx \
  src/components/__tests__/Reports.behavior.test.tsx
```

Expected: all tests pass. Dashboard uses position/operation/risk/trend labels; capital-prepayment UI uses the backend preview; reports expose the canonical catalog.

- [ ] **Step 4: Search production-facing terminology**

Run:

```bash
rg -n -i 'ganancia total|participaci[oó]n sobre utilidades|total proporcional|monto asignado|m[aá]s indicadores' \
  frontend/src backend/src \
  -g '!**/__tests__/**' -g '!**/tests/**'
```

Expected: no user-facing legacy label. Explicit backend rejection lists may contain retired field identifiers only when they return validation errors.

---

### Task 3: Validate the complete desktop workflow in the real application

**Files:**
- Verify: running frontend and backend
- Inspect: downloaded `.xlsx` and `.pdf` artifacts
- Record: screenshots under `tmp/visual-smoke/` without staging them

**Interfaces:**
- Consumes: local PostgreSQL, admin QA account, browser UI, network and console inspection.
- Produces: workflow evidence at 1280x800, 1440x900, 1920x1080, and 200% zoom.

- [ ] **Step 1: Start the local stack without resetting data**

Run:

```bash
npm run dev:local
```

Expected: PostgreSQL becomes healthy, backend listens on `http://localhost:5000`, and frontend listens on `http://localhost:3000`.

- [ ] **Step 2: Recover only the local QA account if login returns 401**

Run only when the local admin login fails:

```bash
npm run seed:local-users
```

Then verify `POST http://localhost:5000/api/auth/login` succeeds. Do not reset the database.

- [ ] **Step 3: Exercise the transcript credit flow**

In the browser:

1. Create a COP 2.000.000, 12-month credit using the configured rate profile matching the meeting case.
2. Pay the first installment.
3. Register a capital prepayment with `Reducir plazo`; capture preview amount and remaining count, then verify the saved calendar and next payment quote.
4. Pay the next due installment.
5. Register the second capital prepayment so live principal becomes COP 500.000, choose `Reducir cuota` and 5 installments.
6. Verify the preview, every new schedule row, and the next collection quote use the same installment amount (approximately COP 115.487 for the transcript inputs).
7. Reload the credit and repeat the final comparison to prove persistence.

Expected: no COP 40.000 interest-only quote, no duplicate movement, and no difference between preview, persisted schedule, and collection quote.

- [ ] **Step 4: Exercise all six reports**

For each report, use a populated date range and an empty range:

- Cierre contable
- Créditos del período
- Pago de cuotas
- Cartera por cobrar
- Movimientos de socios
- Gastos operativos

Expected: every destination is directly visible to an authorized administrator; filters affect the visible rows; empty ranges show an explicit empty state; invalid ranges do not send an export request.

- [ ] **Step 5: Inspect Excel and PDF output**

Download at least Cierre contable, Créditos del período, Pago de cuotas, Movimientos de socios, and Gastos operativos in the available formats. Inspect:

- requested period;
- report title and column labels;
- visible records;
- capital, interest, late-fee, expense, and net totals;
- absence of participation/proportional terminology.

Expected: exported rows and totals match the filtered screen data.

- [ ] **Step 6: Audit desktop layout and accessibility**

At 1280x800, 1440x900, and 1920x1080:

- confirm all six report tabs are visible without a hidden menu or horizontal-only discovery;
- confirm tables use available width and actions remain visible;
- confirm the active tab is visually and semantically selected;
- navigate report tabs, filters, export buttons, modal controls, and close actions using the keyboard;
- inspect visible focus and accessible names.

At 200% zoom, repeat the report catalog and capital-prepayment modal workflow. Expected: normal wrapping/scrolling, no clipped controls, and no page-level horizontal overflow that prevents operation.

- [ ] **Step 7: Inspect console and network**

Expected:

- no new application errors or warnings;
- no failed requests in completed happy paths;
- one preview request per settled input state;
- one mutation request per submitted operation;
- no duplicate report requests caused by navigation;
- export responses use the expected MIME types and filenames.

---

### Task 4: Run release-level verification and completion audit

**Files:**
- Verify: complete repository
- Review: `docs/superpowers/specs/2026-07-13-client-meeting-corrections-design.md`
- Review: current git diff and status

**Interfaces:**
- Consumes: all project tests, type checking, linting, production build, browser evidence.
- Produces: requirement-by-requirement completion evidence.

- [ ] **Step 1: Run lint and TypeScript validation**

Run:

```bash
npm run lint
```

Expected: backend ESLint and frontend `tsc --noEmit` exit 0.

- [ ] **Step 2: Run full backend and frontend suites**

Run:

```bash
npm run test
```

Expected: both complete suites exit 0 with no failed tests.

- [ ] **Step 3: Build the production frontend**

Run:

```bash
cd frontend
npm run build
```

Expected: Vite exits 0 and writes the production bundle to `frontend/dist`.

- [ ] **Step 4: Review the final diff and worktree**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~1..HEAD
git diff
```

Expected: only intentional source/test/spec/plan changes plus pre-existing untracked `tmp/` visual artifacts; no secrets, generated bundles, database data, or unrelated edits.

- [ ] **Step 5: Audit every specification criterion**

Re-read `docs/superpowers/specs/2026-07-13-client-meeting-corrections-design.md` and map each acceptance criterion to fresh command, browser, export, console, or network evidence. Missing or indirect evidence means the task remains incomplete.

