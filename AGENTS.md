# AGENTS.md

## Purpose

This file is the canonical repository guidance for Codex while working in this project.

Codex resolves instructions by combining global guidance with repository and directory-level `AGENTS.md` files. Keep durable repository rules here. If a subdirectory ever needs different behavior, add a closer `AGENTS.md` or `AGENTS.override.md` instead of overloading this file.

Reference: https://developers.openai.com/codex/guides/agents-md

## Product Identity

CrediCobranza is an internal administrative backoffice for credit management. It handles clients, credit origination, payment collection, socios aportantes, monthly cash flow, reports, exports, users, permissions, alerts, calendars, and operational history.

The product is not a customer portal. The UI and API are only for internal administrative users.

Administrative login roles:

- `admin`: owner/administrator with full access.
- `employee`: internal operator with explicit permissions.

Domain records that must never become administrative login roles:

- `customer`: borrower/client record.
- `socio`: person who contributes money to the business and receives profitability for that capital.

## Repo Map

- Root `package.json` exposes convenience scripts for install, dev, lint, and test flows.
- `frontend/` and `backend/` remain separate packages. Install and verify each package when needed.
- Frontend entrypoints:
  - `frontend/src/main.tsx`
  - `frontend/src/App.tsx`
- Main frontend route gating lives in:
  - `frontend/src/App.tsx`
  - `frontend/src/components/ProtectedRoute.tsx`
- Most frontend screens still live in `frontend/src/components/`, not `src/pages/`.
- Backend entrypoint: `backend/src/server.js`
- Backend boot flow:
  - `server.js -> bootstrap/index.js -> app.js -> modules/index.js`
- Backend API surfaces are mounted from `backend/src/modules/index.js`.
- Keep backend domain work inside `backend/src/modules/<domain>/...`.
- Do not create root-level controller, service, or route folders outside the modular backend structure.

## Source Of Truth

Read these first before changing behavior:

- `AGENTS.md`
- `README.md`
- `package.json`
- `backend/package.json`
- `frontend/package.json`
- `frontend/vite.config.ts`
- `backend/src/modules/*`
- `frontend/src/components/*`
- existing tests around the touched area

Behavioral rules:

- Do not invent new route families, report formats, generated document formats, UI flows, or calculation flows unless the user explicitly asks for a migration or new feature.
- Keep user-facing naming consistent with nearby UI, i18n keys, tests, exports, and Spanish product language.

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
- Do not rely on Windows-style `set NODE_ENV=test&& ...` commands on Linux or macOS.
- For meaningful product changes, run focused tests plus the relevant full backend/frontend checks before claiming completion.

## Local Runtime

Recommended local setup:

```bash
npm install
npm run install:all
npm run dev:local
```

Local services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- PostgreSQL: `localhost:5433`

Seed or refresh local QA users with:

```bash
npm run seed:local-users
```

Local QA credentials:

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
3. Check build logs.
4. Check deploy logs.
5. Validate the flow from the deployed frontend.

Do not reset remote data unless the user explicitly asks for a Railway reset and the target environment is confirmed as disposable QA or development data.

## Backend Rules

Required boot environment variables:

- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `JWT_SECRET`

Runtime behavior:

- Backend reads `DB_*` and `ALLOWED_ORIGINS`.
- Do not treat `DATABASE_URL` as the primary runtime contract.
- Without `ALLOWED_ORIGINS`, development only allows `http://localhost:3000` and `http://127.0.0.1:3000`.
- Startup authenticates Sequelize, verifies or syncs schema, seeds domain defaults, starts overdue alert scheduling, and starts the outbox relay worker.
- Schema mode defaults to `verify`.
- `DB_SCHEMA_MODE=alter|reset` controls schema behavior.
- `DB_RESET_ON_BOOT=true` aliases reset.
- Reset is blocked outside `development`, `test`, and `local` unless `DB_SCHEMA_RESET_ALLOWED=true`.
- Migrations live in `backend/src/db/migrations`.
- Runtime schema source of truth is still `backend/src/bootstrap/schema.js`.
- `.sequelizerc` points seeders to `backend/src/db/seeders`, but the repo currently has `backend/src/db/seeds`; do not assume Sequelize CLI seeding is wired correctly.

Mounted APIs:

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
- Alias config lives in `_moduleAliases` in `backend/package.json`.
- `require('module-alias/register')` is called in `backend/src/server.js`.
- Tests must use `--require module-alias/register`.
- Cross-directory backend imports should use `@/`, for example `require('@/models')`.
- Same-directory imports stay relative, for example `require('./router')`.
- `backend/scripts/migrateToAlias.js` can help convert new relative imports.
- Frontend `@/` is unrelated and resolves to the `frontend/` package root.

## Frontend Rules

- Vite is pinned to port `3000`.
- Frontend API calls use relative `/api` in `frontend/src/api/client.ts`.
- Vite proxies `/api` to `VITE_API_URL`.
- `VITE_API_URL` must be the backend origin only, for example `http://localhost:5000`, never `http://localhost:5000/api`.
- Auth state lives in `frontend/src/store/sessionStore.ts`.
- `refreshToken` and `user` persist in `sessionStorage`.
- `accessToken` stays in memory.
- `api/client.ts` auto-refreshes once on `401`.
- Reuse `frontend/src/services/queryKeys.ts` for TanStack Query cache keys and invalidation.
- `frontend/src/components/__tests__/bannedApis.test.ts` forbids `window.alert`, `window.confirm`, `window.prompt`, bare `confirm()/prompt()`, and `<dialog>`.
- Use `frontend/src/lib/confirmModal.tsx` for confirmations.

## Frontend Tables And Row Actions

All backoffice tables must go through `frontend/src/components/shared/tables/`. Do not add raw `<table>` markup in screens. This is enforced by `tableMarkupContract.test.ts`.

### AppTable Entry Point

Use `AppTable` as the only table import in screens when adding or touching a table.

Supported props:

- `variant`: `"financial"` or `"operational"`.
- `pagination`: optional `TablePaginationConfig`.
- `shell`: `"auto"` (default), `"on"`, or `"off"`.
- `statePresentation`: `"inline"` (default) or `"shell"`.
- `footer`: optional `ReactNode` rendered below the table, outside `<table>`.
- `visibleFrom`: financial only, `lg`, `md`, or `"always"`.

Rules:

- `FinancialScheduleTable` and `OperationalTable` are internal. Do not import them in screens.
- Shared types live in `tableTypes.ts`.
- Visual contract: tables live inside `.data-table-surface`.
- Use horizontal separators only. No vertical grid lines between columns.
- Financial and calendar tables must keep the same header and cell treatment as operational lists, even when they need `table-layout: fixed`, `colgroup`, or sticky headers.

### Row Actions

- Always use `TableActionsHeader` and `TableActionsCell` for the actions column.
- Default row actions must use `RowActionsWithOverflow` with `DEFAULT_MAX_INLINE_ACTIONS` (`2`) unless a screen explicitly needs a different split.
- Additional actions must go in the overflow menu with icon plus Spanish label.
- Credit installment rows use `variant="installment"` plus `InstallmentActionButton` styling.
- Operational list rows use `variant="icon"` plus `iconVariant`.
- A single action can still use `RowActionsWithOverflow`.
- `TableSectionIntro` is the shared section header helper.
- `TableStatusPill` is the shared status helper.
- Do not reintroduce fixed-position row menus, one-off `MoreVertical` menus, or crowded action cells with four or more inline buttons.
- `RowActionToolbar` is internal to `RowActionsWithOverflow` and should not be imported in screens.

### Reports

`ReportDataTableSection` wraps `AppTable`.

- Default `tableVariant` is `operational`.
- Use `tableVariant="financial"` only for dense schedule-style grids.
- Pass loading, empty, pagination, shell, and footer through the wrapper instead of composing ad-hoc table shells.
- Children must stay as `<thead>` and `<tbody>` only.

## Frontend UX Rules

- Avoid overloaded interfaces.
- Do not nest cards inside cards or containers inside containers without a real layout reason.
- Reuse shared inputs, buttons, tables, modals, surfaces, and formatting helpers.
- Do not create one-off input styles for each screen.
- Use `CurrencyInput` plus `FormField` from `frontend/src/components/shared/inputs/` for money fields.
- Use `allowCents` for payments and payouts. Operator display must look like `120.554,50`; canonical state must remain `120554.50`.
- Use whole pesos without cents for policy ranges and capital contributions.
- Use `AppInput` directly only when `CurrencyInput` is not enough.
- Prefer canonical string state plus `onValueChange`. Do not use ad-hoc `replace(/\D/g)` handlers in screens.
- Money inputs must normalize through `moneyInput.ts`, including `formatDecimalMoneyInput` and `formatWholeMoneyInput`.
- Date fields must use consistent formatting and avoid timezone off-by-one bugs.
- Shared action buttons must align, keep equal height, and center icons correctly.
- Tooltip behavior must not block normal input interaction.
- Use responsive layouts that reduce scrolling without hiding required information.
- Avoid repeated section names and duplicate financial values in the same view.
- All new or changed user-facing text must go through i18n.
- Use natural Spanish operational language.
- Do not expose backend field names, raw enum keys, ids, calculation version ids, policy ids, or implementation terminology in user-facing UI unless the user explicitly asks for diagnostics.

## Administrative Access And Permissions

- Backoffice access is only for `admin` and `employee`.
- Do not add customer or socio admin routes, sidebar entries, dashboards, or self-service payment surfaces.
- Backend authentication is centralized in `backend/src/modules/shared/auth.js`.
- `backend/src/modules/shared/auth.js` rejects non-administrative roles before module-level permission checks.
- `backend/src/modules/shared/roles.js` is the source of truth for `ADMINISTRATIVE_LOGIN_ROLES`.
- Main frontend routes use `allowedRoles={['admin', 'employee']}` plus `requiredPermissions`.
- `/settings` is admin-only.
- `frontend/src/constants/appAccess.ts` routes:
  - `admin` -> `/dashboard`
  - `employee` -> `/profile`
  - everyone else -> `/login`
- Employees start with no default permissions.
- Admins receive the full permission catalog through seeded role permissions.
- Permission names are seeded from `backend/src/db/seeds/permissions_catalog.js`.
- Employee access is resolved through `/api/permissions/me`.
- Sidebar visibility, header affordances, and route access must use the same permission names as backend middleware.

Sensitive configuration is admin-only in both layers:

- rate policies
- late-fee policies
- payment methods
- business settings
- users
- permission assignments

Guard tests:

- `backend/tests/permissionsAuthMiddleware.test.js`
- `backend/tests/configRouter.test.js`
- `backend/tests/permissionsRouter.test.js`
- `frontend/src/components/__tests__/ProtectedRoute.behavior.test.tsx`
- `frontend/src/components/__tests__/Sidebar.terminology.test.tsx`

## Financial Product Contracts

Treat the following as implemented contracts, not aspirational goals. If you touch any of these areas, preserve the behavior unless the user explicitly asks to change it and you update tests in the same patch.

### 1. Roles And Permissions

- Only `admin` and `employee` can enter the administrative platform.
- `admin` has full access by default.
- `employee` is an internal operator with explicit module permissions.
- `customer` and `socio` must be rejected by backend auth and redirected away from admin routes in frontend.
- Employees cannot mutate rates, late-fee policies, payment methods, business settings, users, or permission assignments.

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
- A policy has a label, minimum amount, optional maximum amount, annual effective rate, and active/inactive state.
- Active policies must never overlap.
- Duplicate active catch-all ranges such as `$0 - Sin tope` are invalid because they create ambiguity.
- The seeded base policy can be replaced by explicit ranges, but UI and backend must never allow two applicable active policies for the same amount.
- Gaps are allowed only as an incomplete configuration state.
- If a credit amount falls into a gap, credit creation must be blocked until an active range covers it.
- Credit creation resolves the policy automatically.
- The resolved rate and policy snapshot are frozen in the created loan.
- Existing loans must not recalculate when policies change later.
- Do not reintroduce manual rate edits on existing loans.
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
- Only backend-supported late-fee methods should appear in the UI.
- Configuration should use modals or actions, not always-visible dense forms.
- Labels must stay understandable for non-technical operators.
- Employees cannot mutate late-fee policies.

### 4. Capital Prepayment

- `Abono a capital` reduces outstanding principal and rebuilds the future schedule.
- It must not mark future installments as paid or partial by itself.
- It is blocked until at least the first installment is paid.
- It is also blocked when there are overdue installments, payable interest, partial operative installments, closed loans, financial locks, or no remaining principal.
- Supported strategies:
  - `reduce_term`: keep payment amount and reduce term.
  - `reduce_payment`: subtract the capital payment, then redistribute remaining principal across the selected new installment structure.
- `reduce_payment` must request the new term needed to rebuild the schedule. It cannot be label-only.
- Invalid attempts need clear operator-facing messages and auditability.

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

### 5. Socios Aportantes

- Socios are people who contribute capital to the business and receive profitability or interest for that capital.
- Socios are financial records, not administrative login users.
- The system must record how much capital each socio has contributed.
- The system must record or derive how much must be paid to each socio for the contributed capital.
- Each socio can be configured with monthly or annual interest/profitability payments.
- The system must generate interest payment dates according to each socio's configured periodicity.
- The system must keep a history of interest/profitability payments made to each socio.
- The associates module may also track movements, installment obligations, distributions, reinvestments, and debt status where the existing backend supports them.
- Reporting can expose contributed capital, interest/profitability payments, payment schedule status, movements, distributions, reinvestments, and debt status.
- Socios must not execute backoffice credit or payment operations.

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
- Totals must come from canonical loan and payment data.
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
- Money must be normalized into Excel-friendly numeric or currency cells.
- Dates must be readable and timezone-safe.
- Main credit Excel exports should use this workbook structure:
  - `Resumen General`
  - `Detalle de Créditos`
  - per-credit sheets with amortization and payment history when applicable
- Include created credits, received installments, generated and collected interest, recovered principal, overdue/defaulted credits, losses, profits, available cash, and capital vivo where supported.
- Do not expose internal fields such as calculation version ids, raw policy ids, JavaScript object keys, or implementation labels in user-facing Excel headers.
- Customer profitability export must match the UI values.

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
- Informational or navigation actions stay separate:
  - `Excel`
  - `Plan de pagos`
  - `Estado`
  - `Guía rápida`
- Do not put operational money actions inside tabs.
- Tabs are for sections like calendar, alerts, promises, payment history, payoff information, and operational history.
- Disabled critical actions should explain why through inline affordance or a tooltip attached to the action, not detached banners.

Key files:

- `frontend/src/components/CreditDetails.tsx`
- `frontend/src/components/shared/Surfaces.tsx`
- `frontend/src/components/shared/HelpSupport.tsx`

Guard tests:

- `frontend/src/components/__tests__/CreditDetails.behavior.test.tsx`

### 9. Calendar And Follow-Up

- The credit calendar is an operational tracking surface, not decoration.
- It should support due, paid, pending, overdue, and user or client-filtered views when backend data supports them.
- Calendar items must keep readable contrast, clear status labels, and predictable filtering.
- Date rendering must be timezone-safe and Spanish-friendly.

### 10. Payment Voucher

- After recording an installment payment, the operator must be able to open or download a payment voucher.
- PDF layout must be readable and professional.
- The voucher must include client data, credit data, payment date, installment number, subtotal, total paid, capital, interest, mora when present, payment method, and resulting balance.
- Title text, icons, and labels must never overlap in the PDF.

## Credit Calculation Engine

All credit calculation behavior is centralized in:

```text
backend/src/modules/credits/domain/calculation/
```

This engine owns:

- input normalization
- amortization methods: `FRENCH`, `SIMPLE`, `COMPOUND`
- late-fee policies: `NONE`, `SIMPLE`, `COMPOUND`, `FLAT`, `TIERED`
- policy resolution through `calculationProfileVersionId`
- deterministic schedule generation
- summary generation
- policy snapshots
- explainable breakdown in `calculation.explanation`

Service API:

- `backend/src/modules/credits/application/creditCalculationService.js`

Loan creation rules:

- `backend/src/modules/credits/infrastructure/loanCreation.js` must recalculate through `creditCalculationService`.
- It must persist `calculationProfileVersionId`.
- It must persist `policySnapshot` with method, inputs, and summary metadata.

`/api/loans/calculations` contract:

- `data.calculation.calculationVersionId`
- `data.calculation.calculationProfileVersionId`
- `data.calculation.method`
- `data.calculation.inputs`
- `data.calculation.schedule`
- `data.calculation.summary`
- `data.calculation.policySnapshot`
- `data.calculation.explanation`

Rules:

- New operations must use this contract.
- Do not introduce parallel calculation contracts.

Migration and model references:

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
- Keep `AGENTS.md` as the operational development contract for this repository.
- `agent.md`, if present, is only a compatibility pointer.
- User-facing text must not be hardcoded in new or modified UI.
- Add or update i18n keys whenever visible frontend text changes.
- Spanish labels should sound operational and natural, not like literal translations of internal code.

## Testing And QA Expectations

Use tests for behavior that matters:

- business logic
- permissions
- credit calculations
- payment applications
- capital prepayment edge cases
- report and export integrity
- API validation
- critical frontend flows
- error handling

Avoid low-value tests for placeholders, CSS class names, trivial buttons, or superficial static details.

When touching product-critical flows, validation should include:

1. Focused backend tests for the affected module.
2. Focused frontend tests for the affected UI flow.
3. Full backend test command when financial logic changes.
4. Frontend lint, test, and build when UI or services change.
5. Real browser QA for the affected flow.
6. Railway validation when the change is deployed or when production-only behavior is suspected.

Do not claim completion after static inspection alone when the request is about real functionality.

## Delivery Discipline

- Keep changes scoped to the user request.
- Preserve existing user changes in the working tree.
- Do not revert unrelated work.
- Do not use destructive git or database commands unless explicitly requested.
- Do not reset production data as a shortcut.
- Prefer status changes, annulment, correction flows, audit logs, and traceable history over physical deletion of financial operations.
- Keep migrations safe and compatible with existing data.
- Do not add unnecessary compatibility fallbacks for behavior that is not in production yet.
- If multiple viable approaches exist, compare real options and choose the cleanest maintainable path.

## Deployment Checklist

Before pushing or deploying meaningful product changes:

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
6. Log in with an appropriate admin or employee QA user.
7. Validate the touched flow end to end.

For documentation-only changes, `git diff --check` is usually sufficient unless executable examples changed.
