# AGENTS.md

## Purpose

This file is the canonical project guidance for Codex and other development agents working in this repository.

OpenAI Codex discovers `AGENTS.md` files by layering global guidance with repository and directory-level instructions. Keep durable repository rules here. If a subdirectory ever needs different rules, add a closer `AGENTS.md` or `AGENTS.override.md` there instead of overloading this file.

Reference: https://developers.openai.com/codex/guides/agents-md

## Product Identity

CrediCobranza is an administrative credit-management backoffice. It manages clients, credit origination, payment collection, investor associates, monthly cash flow, reports, exports, users, permissions, alerts, calendars, and operational history.

The product is not a customer portal. The backoffice is only for internal administrative users.

Current administrative roles:

- `admin`: owner/administrator with full access.
- `employee`: internal operator with explicit permissions.

Domain records that must not enter the administrative platform:

- `customer`: borrower/client record.
- `socio`: investor associate record.
- `agent`: roster/assignment data, not an authenticated login role.

## Current Repo Shape

- Root `package.json` provides convenience scripts for local development, linting and tests.
- `frontend/` and `backend/` are still separate packages. Install and verify each when needed.
- Frontend entrypoints:
  - `frontend/src/main.tsx`
  - `frontend/src/App.tsx`
- Routing and role gates live mainly in:
  - `frontend/src/App.tsx`
  - `frontend/src/components/ProtectedRoute.tsx`
- Most frontend screens still live in `frontend/src/components/`, not `src/pages/`.
- Backend entrypoint:
  - `backend/src/server.js`
- Backend boot flow:
  - `server.js -> bootstrap/index.js -> app.js -> modules/index.js`
- Backend API surfaces are mounted from `backend/src/modules/index.js`.
- Keep backend domain work inside `backend/src/modules/<domain>/...`.
- Do not create root-level controller, service, or route folders outside the modular backend architecture.

## Source Of Truth

Use these as the current source of truth before changing behavior:

- `AGENTS.md`
- `README.md`
- `package.json`
- `backend/package.json`
- `frontend/package.json`
- `frontend/vite.config.ts`
- `backend/src/modules/*`
- `frontend/src/components/*`
- existing tests around the touched module

Do not introduce UI flows, calculation flows, route families, report formats, or generated document formats that are not present in the active codebase unless the user explicitly asks for a migration or new feature.

Keep user-facing naming consistent with nearby UI, i18n keys, tests, generated documents, and Spanish product language.

## Commands

Root convenience commands:

```bash
npm run dev:local        # Docker Postgres + backend + frontend
npm run docker:db        # local Postgres only
npm run docker:stop
npm run db:reset-local   # destructive local reset
npm run seed:local-users
npm run lint
npm run test
```

Backend:

```bash
cd backend
npm run dev
npm run lint
NODE_ENV=test node --require module-alias/register --test
NODE_ENV=test node --require module-alias/register --test tests/schema.test.js
```

Frontend:

```bash
cd frontend
npm run dev
npm run lint
npm test -- --run
npm run build
npx vitest run src/components/__tests__/Credits.behavior.test.tsx
```

Important:

- Frontend `npm run lint` is TypeScript checking through `tsc --noEmit`, not ESLint.
- Backend tests on POSIX must use `NODE_ENV=test node --require module-alias/register --test`.
- Do not rely on a Windows-style `set NODE_ENV=test&& ...` command on Linux/macOS.
- For meaningful product changes, run focused tests plus the relevant full backend/frontend checks before claiming completion.

## Local Runtime

Recommended local stack:

```bash
npm install
npm run install:all
npm run dev:local
```

Local services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- PostgreSQL: `localhost:5433`

Local QA users can be created or refreshed with:

```bash
npm run seed:local-users
```

Local credentials:

- Admin: `qa.admin.20260427@test.local` / `Admin123!`
- Employee: `qa.employee.20260427@test.local` / `Admin123!`

The employee starts without broad permissions. Grant permissions from the admin UI when testing employee flows.

## Railway Context

Known deployed services:

- Frontend: `https://frontend-production-3058.up.railway.app`
- Backend API: `https://backend-production-4d24.up.railway.app/api`

Before treating a Railway issue as a code regression:

1. Confirm the current branch and latest commit.
2. Confirm the relevant Railway deployment is fresh.
3. Check build/deploy logs.
4. Validate the flow from the deployed frontend.

Do not reset remote data unless the user explicitly asks for a Railway reset and the target environment is confirmed as disposable QA/development data.

## Backend Rules

Required boot env:

- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `JWT_SECRET`

Backend behavior:

- Reads `DB_*` and `ALLOWED_ORIGINS`.
- Does not use `DATABASE_URL` as the normal runtime contract.
- Without `ALLOWED_ORIGINS`, development allows only `http://localhost:3000` and `http://127.0.0.1:3000`.
- Startup authenticates Sequelize, verifies/syncs schema, seeds domain defaults, starts overdue-alert scheduling and starts the outbox relay worker.
- Schema mode defaults to `verify`.
- `DB_SCHEMA_MODE=alter|reset` controls schema behavior.
- `DB_RESET_ON_BOOT=true` aliases reset.
- Reset is blocked outside `development`, `test`, and `local` unless `DB_SCHEMA_RESET_ALLOWED=true`.
- Migrations live under `backend/src/db/migrations`.
- Runtime schema source of truth is still `backend/src/bootstrap/schema.js`.
- `.sequelizerc` points seeders to `backend/src/db/seeders`, but the repo currently has `backend/src/db/seeds`; do not assume Sequelize CLI seeding is wired correctly.

Mounted APIs include:

- `/api/auth`
- `/api/customers`
- `/api/associates`
- `/api/loans`
- `/api/payments`
- `/api/reports`
- `/api/notifications`
- `/api/users`
- `/api/permissions`
- `/api/audits`
- `/api/config`

## Backend Import Aliases

- Backend uses `module-alias`.
- `@` resolves to `backend/src/`.
- Config lives in `_moduleAliases` in `backend/package.json`.
- `require('module-alias/register')` is called in `backend/src/server.js`.
- Tests must use `--require module-alias/register`.
- Cross-directory requires use `@/`, for example `require('@/models')`.
- Same-directory requires stay relative, for example `require('./router')`.
- `backend/scripts/migrateToAlias.js` can convert new relative imports if needed.
- Frontend `@/` is unrelated and resolves to the `frontend/` package root.

## Frontend Rules

- Vite is pinned to port `3000`.
- Frontend API calls use relative `/api` in `frontend/src/api/client.ts`.
- Vite proxies `/api` to `VITE_API_URL`.
- `VITE_API_URL` must be the backend origin only, for example `http://localhost:5000`, not `http://localhost:5000/api`.
- Auth state lives in `frontend/src/store/sessionStore.ts`.
- `refreshToken` and `user` persist in `sessionStorage`.
- `accessToken` stays in memory.
- `api/client.ts` auto-refreshes once on `401`.
- Reuse `frontend/src/services/queryKeys.ts` for TanStack Query cache keys and invalidation.
- `frontend/src/components/__tests__/bannedApis.test.ts` forbids `window.alert`, `window.confirm`, `window.prompt`, bare `confirm()/prompt()`, and `<dialog>`.
- Use `frontend/src/lib/confirmModal.tsx` for confirmations.

## Frontend Tables And Row Actions

All backoffice tables must go through `frontend/src/components/shared/tables/`. **Do not add raw `<table>` markup in screens** (enforced by `tableMarkupContract.test.ts`).

### Entry point: `AppTable`

Use `AppTable` as the **only** import in screens when adding or touching a table (enforced by `tableMarkupContract.test.ts`).

| Prop | Variants | Purpose |
|------|----------|---------|
| `variant` | `"financial"` \| `"operational"` | Dense schedule vs admin list |
| `pagination` | optional `TablePaginationConfig` | Integrates `TableShell` footer; omit when not paginated |
| `shell` | `"auto"` (default) \| `"on"` \| `"off"` | `auto`: shell when pagination or state slots exist; `off`: scroll + table only |
| `statePresentation` | `"inline"` (default) \| `"shell"` | `shell`: loading/error/empty replace table; `inline`: tbody rows in parent |
| `footer` | optional `ReactNode` | Content below the table (outside `<table>`), e.g. custom pagination |
| `visibleFrom` | financial only: `lg` \| `md` \| `"always"` | Responsive visibility |

`FinancialScheduleTable` / `OperationalTable` are internal; do not import them in `components/` screens.

Shared types: `tableTypes.ts` (`TablePaginationConfig`, `TableShellMode`, `TableStatePresentation`, etc.).

**Visual contract (all variants):** tables live inside `.data-table-surface` (outer border, radius, shadow). Rows use horizontal separators only — **no vertical grid lines** between columns. Financial/calendar tables share the same cell padding and header treatment as operational lists; they may use `table-layout: fixed` + `colgroup` and sticky `thead` when scrolling long schedules.

### Row actions and presentation

- **Actions column**: always use `TableActionsHeader` / `TableActionsCell` (applies `table-cell-actions`: centered header, narrow column, centered toolbar). Do not use loose `text-right` on action `th`/`td`.
- **Default row actions**: `RowActionsWithOverflow` with `DEFAULT_MAX_INLINE_ACTIONS` (2). Shows up to two bordered icon buttons inline; additional actions go in the ⋯ menu with icon + Spanish label. Use `maxInline={2}` unless a screen needs a different split.
- **Credit calendar / installment rows**: `variant="installment"` + `InstallmentActionButton` styling via `buttonClassName` / `installmentActionClass`.
- **Operational list rows**: `variant="icon"` + `iconVariant` (`ghost` | `danger`).
- **Single action only**: `RowActionsWithOverflow` with one item is fine (no ⋯ menu).
- **Section headers**: `TableSectionIntro`.
- **Status cells**: `TableStatusPill`.
- **Do not** use fixed `position: fixed` row menus, `MoreVertical` one-offs, or four-plus icon buttons in a single table cell.
- `RowActionToolbar` is internal to `RowActionsWithOverflow`; do not import it in screens.

### Reports

`ReportDataTableSection` wraps `AppTable` (default `operational`; pass `tableVariant="financial"` only for dense schedule grids). Supports operational props (`pagination`, `shell`, `footer`, loading/empty). Children must be `<thead>` / `<tbody>` only — never place pagination `<div>`s inside `children`.

## Frontend UX Rules

- Avoid overloaded interfaces.
- Do not put cards inside cards or containers inside containers without a real layout reason.
- Use shared inputs, buttons, tables, modals, surfaces and formatting helpers.
- Do not create one-off input styles for each screen.
- Money inputs must display normalized amounts in a user-readable way.
- Date fields must use consistent formatting and avoid off-by-one timezone bugs.
- Buttons in shared action rows must be aligned, equal-height and icon-centered.
- Tooltip behavior must not block normal input interactions.
- Use responsive layouts that reduce scroll without hiding required information.
- Avoid repeated section names and duplicate financial values in the same view.
- All new or changed user-facing text should go through i18n.
- Use Spanish operational language; do not expose English implementation labels.
- Do not show backend field names, raw enum keys, ids, calculation version ids, policy ids or implementation terms in user-facing UI unless the user explicitly asks for technical diagnostics.

## Administrative Access And Permissions

- Backoffice access is only for `admin` and `employee`.
- Do not add customer/socio admin routes, sidebar entries, dashboards or self-service payment surfaces.
- Backend authentication is centralized in `backend/src/modules/shared/auth.js`.
- `backend/src/modules/shared/auth.js` rejects non-administrative roles before module-level permission checks.
- `backend/src/modules/shared/roles.js` is the source of truth for `ADMINISTRATIVE_LOGIN_ROLES`.
- Main frontend routes use `allowedRoles={['admin', 'employee']}` plus `requiredPermissions`.
- `/settings` is admin-only.
- `frontend/src/constants/appAccess.ts` sends:
  - `admin` to `/dashboard`
  - `employee` to `/profile`
  - anything else to `/login`
- Employees start with no default permissions.
- Admins receive the full permission catalog through seeded role permissions.
- Permission names are seeded from `backend/src/db/seeds/permissions_catalog.js`.
- Employee access is permission-driven through `/api/permissions/me`.
- Sidebar/header visibility and route access should use the same permission names as backend middleware.

Sensitive configuration is admin-only at both layers:

- Rate policies.
- Late-fee policies.
- Payment methods.
- Business settings.
- Users.
- Permission assignments.

Guard tests:

- `backend/tests/permissionsAuthMiddleware.test.js`
- `backend/tests/configRouter.test.js`
- `backend/tests/permissionsRouter.test.js`
- `frontend/src/components/__tests__/ProtectedRoute.behavior.test.tsx`
- `frontend/src/components/__tests__/Sidebar.terminology.test.tsx`

## Financial Product Contracts

Treat these as implemented product contracts, not open goals. If future work touches these areas, preserve the behavior unless the user explicitly asks to change it and update tests in the same patch.

### 1. Roles And Permissions

- Only `admin` and `employee` can enter the administrative platform.
- `admin` has full access by default.
- `employee` is an internal operator with explicit module permissions.
- `customer` and `socio` must be rejected by backend auth and redirected away from admin routes in frontend.
- Employees cannot modify rates, late-fee policies, payment methods, business settings, users or permission assignments.

Key backend files:

- `backend/src/modules/shared/auth.js`
- `backend/src/modules/shared/roles.js`
- `backend/src/modules/permissions/`
- `backend/src/modules/config/presentation/router.js`

Key frontend files:

- `frontend/src/App.tsx`
- `frontend/src/components/ProtectedRoute.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/constants/appAccess.ts`

### 2. Amount-Based Rate Parameterization

- Credit rates are operational configuration, not free-form per-credit edits.
- Rate policies are configured under `/api/config/rate-policies`.
- A policy has a label, minimum amount, optional maximum amount, annual effective rate and active/inactive state.
- Active policies must not overlap.
- Duplicate active catch-all ranges such as `$0 - Sin tope` are invalid because they create ambiguity.
- The seeded base policy can be replaced by explicit ranges, but the UI and backend must not allow two applicable active policies for the same amount.
- Gaps are allowed only as an incomplete configuration state.
- If a credit amount falls in an uncovered gap, credit creation must be blocked until an active range covers it.
- Credit creation resolves the applicable policy automatically.
- The resolved rate and policy snapshot are frozen in the created loan.
- Existing loans must not recalculate when policies change later.
- Do not reintroduce manual rate mutation for an existing loan.
- Late-fee policies are separate from credit rate policies.

Key backend files:

- `backend/src/modules/config/application/useCases.js`
- `backend/src/modules/config/presentation/router.js`
- `backend/src/modules/credits/application/creditPolicyResolver.js`
- `backend/src/modules/credits/infrastructure/loanCreation.js`

Key frontend files:

- `frontend/src/components/Settings.tsx`
- `frontend/src/components/NewCredit.tsx`
- `frontend/src/services/configService.ts`

Guard tests:

- `backend/tests/configModule.test.js`
- `backend/tests/configRouter.test.js`
- `backend/tests/credits/loanLifecycle.test.js`
- `frontend/src/components/__tests__/Settings.behavior.test.tsx`
- `frontend/src/components/__tests__/NewCredit.behavior.test.tsx`

### 3. Late-Fee Policies

- Mora is an operational late-fee policy, not the credit rate.
- The UI must clearly separate "tasa del crédito" from "mora".
- Only real backend-supported late-fee methods should appear in the UI.
- Configuration should use modals/actions, not always-visible dense forms.
- Labels must be understandable for non-technical operators.
- Employees cannot mutate late-fee policies.

### 4. Capital Prepayment

- "Abono a capital" reduces outstanding principal and rebuilds the future schedule.
- It must not mark future installments as paid or partial by itself.
- It is blocked until at least the first installment is paid.
- It is also blocked when there are overdue installments, payable interest, partial operative installments, closed loans, financial locks, or no remaining principal.
- Supported strategies:
  - `reduce_term`: keeps payment amount and reduces term.
  - `reduce_payment`: subtracts the capital payment, then redistributes remaining principal across the selected new number of installments.
- `reduce_payment` must ask for the new term/installment structure needed to rebuild the schedule. It is not a label-only option.
- Invalid attempts need clear operator-facing messages and auditability where the calling flow records audit context.

Key backend files:

- `backend/src/modules/credits/application/paymentApplicationService.js`
- `backend/src/modules/credits/presentation/router.js`
- `backend/src/modules/payouts/presentation/router.js`

Key frontend files:

- `frontend/src/components/CreditDetails.tsx`
- `frontend/src/components/shared/CreditSimulationWorkspace.tsx`
- `frontend/src/services/paymentService.ts`
- `frontend/src/services/loanService.ts`

Guard tests:

- `backend/tests/paymentApplicationService.test.js`
- `backend/tests/creditsModule.test.js`
- `backend/tests/creditsRouter.test.js`
- `frontend/src/components/__tests__/CreditDetails.behavior.test.tsx`

### 5. Investor Associates

- Socios are investor records, not administrative login users.
- The associates module tracks:
  - contributed capital
  - monthly or annual interest type
  - interest payment dates
  - movements
  - installment obligations
  - distributions
  - reinvestments
  - debt status
- Reporting can expose capital, interest, installments, distributions, reinvestments, movements and debt status.
- Socios must not execute backoffice credit/payment operations.

Key files:

- `backend/src/modules/associates/`
- `backend/src/modules/reports/`
- `frontend/src/components/Associates.tsx`
- `frontend/src/components/AssociateDetails.tsx`
- `frontend/src/components/NewAssociate.tsx`

Guard tests:

- `backend/tests/associatesModule.test.js`
- `backend/tests/associatesRouter.test.js`
- `backend/tests/reportsExcelExport.test.js`
- `frontend/src/components/__tests__/Associates.behavior.test.tsx`
- `frontend/src/components/__tests__/AssociateDetails.behavior.test.tsx`

### 6. Monthly Cash Flow And Financial Control

- Monthly cash flow reconciles incoming installment/payment money against outgoing originated loan capital.
- Reports must expose:
  - monthly income
  - loan disbursements
  - available cash
  - losses and profit indicators
  - monthly history
  - exportable evidence
- Totals must be derived from canonical loan/payment data.
- Do not duplicate report calculations in frontend when backend already owns them.

Key files:

- `backend/src/modules/reports/`
- `frontend/src/components/Reports.tsx`
- `frontend/src/services/reportService.ts`

Guard tests:

- `backend/tests/monthlyCashFlowReport.test.js`
- `backend/tests/reportsExcelExport.test.js`
- `backend/tests/reports/financialAnalyticsRouter.test.js`
- `frontend/src/components/__tests__/Reports.behavior.test.tsx`

### 7. Credit History Exports

- Credit history exports are operational audit artifacts, not technical dumps.
- Exports must include Spanish headers and user-readable formats.
- Money must be normalized as currency/number formats appropriate for Excel.
- Dates must be readable and timezone-safe.
- Main credit Excel exports should use the approved operational workbook structure:
  - `Resumen General`
  - `Detalle de Créditos`
  - per-credit sheets with amortization and payment history when applicable
- Include created credits, installments received, generated/collected interest, recovered principal, overdue/defaulted credits, losses, profits, available cash and capital vivo where supported.
- Do not expose internal fields such as calculation version ids, raw policy ids, JavaScript object keys, or implementation labels in user-facing Excel headers.
- Customer profitability export must match the values shown in the UI.

Key files:

- `backend/src/modules/reports/application/`
- `backend/src/modules/reports/presentation/router.js`
- `frontend/src/components/Reports.tsx`
- `frontend/src/services/reportService.ts`

Guard tests:

- `backend/tests/reportsExcelExport.test.js`
- `backend/tests/monthlyCashFlowReport.test.js`

### 8. Financial Action UI Structure

- In credit detail screens, critical money actions are grouped together:
  - `Registrar pago`
  - `Abono a capital`
  - `Pago total`
- Informational/navigation actions stay separate:
  - `Excel`
  - `Plan de pagos`
  - `Estado`
  - `Guía rápida`
- Do not put operational money actions into tabs.
- Tabs are for sections such as calendar, alerts, promises, payment history, payoff information and operational history.
- Disabled critical actions should explain why through clear inline affordance or tooltip attached to that action, not through detached noisy banners.

Key files:

- `frontend/src/components/CreditDetails.tsx`
- `frontend/src/components/shared/Surfaces.tsx`
- `frontend/src/components/shared/HelpSupport.tsx`

Guard tests:

- `frontend/src/components/__tests__/CreditDetails.behavior.test.tsx`

### 9. Calendar And Follow-Up

- The credit calendar is an operational tracking surface, not a static decoration.
- It should support due, paid, pending, overdue and user/client-filtered views where the backend data supports it.
- Calendar items must have readable contrast, clear status labels and predictable filtering.
- Date rendering must be timezone-safe and Spanish-friendly.

### 10. Payment Voucher

- After recording an installment payment, the operator must be able to open/download a payment voucher.
- PDF layout must be readable and professional.
- The voucher must include client data, credit data, payment date, installment number, subtotal, total paid, capital, interest, mora if present, method of payment and resulting balance.
- Do not let title text, icons or labels overlap in the PDF.

## Credit Calculation Engine

All credit calculation behavior is centralized in:

```text
backend/src/modules/credits/domain/calculation/
```

It owns:

- input normalization
- amortization methods (`FRENCH`, `SIMPLE`, `COMPOUND`)
- late-fee policies (`NONE`, `SIMPLE`, `COMPOUND`, `FLAT`, `TIERED`)
- policy resolution through `calculationProfileVersionId`
- deterministic schedule generation
- summary generation
- policy snapshots
- explainable breakdown through `calculation.explanation`

Service API:

- `backend/src/modules/credits/application/creditCalculationService.js`

Loan creation:

- `backend/src/modules/credits/infrastructure/loanCreation.js`
- Must recalculate through `creditCalculationService`.
- Must persist `calculationProfileVersionId`.
- Must persist `policySnapshot` with method, inputs and summary metadata.

API contract for `/api/loans/calculations`:

- `data.calculation.calculationVersionId`
- `data.calculation.calculationProfileVersionId`
- `data.calculation.method`
- `data.calculation.inputs`
- `data.calculation.schedule`
- `data.calculation.summary`
- `data.calculation.policySnapshot`
- `data.calculation.explanation`

New operations must use this contract. Do not add parallel calculation contracts.

Migration/model references:

- `backend/src/db/migrations/20260507000001_add_calculation_profile_versions.js`
- `backend/src/models/Loan.js`

Key files:

- `backend/src/modules/credits/domain/calculation/index.js`
- `backend/src/modules/credits/domain/calculation/creditCalculationEngine.js`
- `backend/src/modules/credits/application/creditPolicyResolver.js`
- `backend/src/modules/credits/domain/calculation/amortizationMethods.js`
- `backend/src/modules/credits/domain/calculation/lateFeeCalculator.js`
- `backend/src/modules/credits/domain/calculation/calculationExplainer.js`
- `backend/src/modules/credits/domain/calculation/policySnapshotBuilder.js`
- `backend/src/modules/credits/application/creditCalculationService.js`
- `backend/src/modules/credits/domain/calculation/README.md`

## Documentation And i18n

- Keep `README.md` for human onboarding and operations.
- Keep `AGENTS.md` for agent/developer behavior contracts.
- `agent.md` is only a compatibility pointer.
- User-facing text must not be hardcoded in new or modified UI.
- Add or update i18n keys when changing visible frontend text.
- Spanish labels should be natural and operational, not literal translations of internal code.

## Testing And QA Expectations

Use tests for behavior that matters:

- business logic
- permissions
- credit calculations
- payment applications
- capital prepayment edge cases
- report/export integrity
- API validation
- critical frontend flows
- error handling

Avoid low-value tests for placeholders, CSS class names, trivial buttons or static superficial details.

When touching product-critical flows, validation should include:

1. Focused backend tests for the affected module.
2. Focused frontend tests for the affected UI flow.
3. Full backend test command when financial logic changes.
4. Frontend lint/test/build when UI or services change.
5. Real browser QA for the affected flow.
6. Railway validation when the change is deployed or production-only behavior is suspected.

Do not claim completion after only static inspection when the request is about real functionality.

## Delivery Discipline

- Keep changes scoped to the user request.
- Preserve user changes already present in the working tree.
- Do not revert unrelated work.
- Do not use destructive git or database commands unless explicitly requested.
- Do not reset production data as a shortcut.
- Prefer status changes, annulment, correction flows, audit logs and traceable history over physical deletion of financial operations.
- Keep migrations safe and compatible with existing data.
- Do not add unnecessary compatibility fallbacks for behavior that is not in production yet; clean the model when the user asks for cleanup.
- If a decision has multiple viable approaches, compare real options and choose the cleanest maintainable path.

## Deployment Checklist

Before pushing/deploying meaningful product changes:

```bash
git status --short
cd backend && npm run lint
cd backend && NODE_ENV=test node --require module-alias/register --test
cd frontend && npm run lint
cd frontend && npm test -- --run
cd frontend && npm run build
```

If deploying to Railway:

1. Push `master` or the requested branch.
2. Trigger or verify Railway deployments for backend and frontend.
3. Check build logs.
4. Check deploy logs.
5. Open the deployed frontend.
6. Log in with an appropriate admin/employee QA user.
7. Validate the touched flow end to end.

For documentation-only changes, `git diff --check` is usually sufficient unless docs include executable examples that changed.
