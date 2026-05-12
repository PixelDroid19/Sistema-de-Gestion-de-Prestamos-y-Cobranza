# AGENTS.md

## Repo Shape
- There is no root workspace runner. Install and verify `backend/` and `frontend/` separately.
- Frontend entrypoints are `frontend/src/main.tsx` and `frontend/src/App.tsx`. Routing and role gates live in `App.tsx`; most screens still live in `frontend/src/components/`, not `src/pages/` or `src/features/`.
- Backend entrypoint is `backend/src/server.js`. Boot flow is `server.js -> bootstrap/index.js -> app.js`; API surfaces are mounted from `backend/src/modules/index.js`.
- Keep backend work inside `backend/src/modules/<domain>/...`; tests assert the old `src/controllers/*` and `src/routes/*` pattern stays removed.

## Commands
- Install deps separately: `cd backend && npm install`, `cd frontend && npm install`.
- Quick backend+Postgres stack: `cd backend && docker compose up --build`.
- Frontend dev: `npm run dev`.
- Frontend verification: `npm run lint` (this is `tsc --noEmit`, not ESLint), `npm test`, `npm run build`.
- Single frontend test: `npx vitest run src/components/__tests__/Credits.behavior.test.tsx`.
- Backend dev: `npm run dev`. Backend lint: `npm run lint`.
- Backend tests on POSIX: `NODE_ENV=test node --require module-alias/register --test`.
- Single backend test: `NODE_ENV=test node --require module-alias/register --test tests/schema.test.js`.
- Do not trust `backend/package.json` `npm test` on POSIX: it uses Windows `set NODE_ENV=test&& node --test`, which leaves `NODE_ENV` unset on Linux/macOS.

## Backend Import Aliases
- Backend uses `module-alias` with `@` resolving to `backend/src/`. Configured via `_moduleAliases` in `backend/package.json`.
- `require('module-alias/register')` is called at the top of `backend/src/server.js` (production entry point).
- For tests, use `--require module-alias/register`: `NODE_ENV=test node --require module-alias/register --test`.
- All `require()` calls that cross directory boundaries use `@/` (e.g., `require('@/models')`, `require('@/modules/shared/errors')`).
- Same-directory requires stay relative (e.g., `require('./router')`).
- The migration script `backend/scripts/migrateToAlias.js` can re-run to convert any new relative imports.
- Frontend `@/` is unrelated — it resolves to `frontend/` package root, not `frontend/src/`.

## Backend Gotchas
- Required boot env: `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `JWT_SECRET`.
- Current code reads `DB_*` and `ALLOWED_ORIGINS`; it does not read `DATABASE_URL` or `CORS_ORIGIN` from `render.yaml`.
- Without `ALLOWED_ORIGINS`, development only allows `http://localhost:3000` and `http://127.0.0.1:3000`.
- Startup does more than start Express: it authenticates Sequelize, verifies/syncs schema, seeds domain defaults, starts overdue-alert scheduling, and starts the outbox relay worker every 5 seconds.
- Schema mode defaults to `verify`. Use `DB_SCHEMA_MODE=alter|reset`; `DB_RESET_ON_BOOT=true` is an alias for `reset`.
- Reset is blocked outside `development`, `test`, and `local` unless `DB_SCHEMA_RESET_ALLOWED=true`.
- Migrations exist under `backend/src/db/migrations`, but the normal runtime source of truth is `backend/src/bootstrap/schema.js`.
- `.sequelizerc` points seeders to `backend/src/db/seeders`, but the repo currently has `backend/src/db/seeds`; do not assume Sequelize CLI seeding is wired correctly.
- Mounted APIs currently include `/api/audits` and `/api/permissions` in addition to `/api/auth`, `/api/customers`, `/api/associates`, `/api/loans`, `/api/payments`, `/api/reports`, `/api/notifications`, `/api/users`, and `/api/config`.
- Current administrative login roles are `admin` and `employee`. `customer` and `socio` can still exist as domain data or historical role values, but they must not enter the administrative platform. `agent` is roster data now, not a login role.

## Frontend Gotchas
- Vite is pinned to port `3000`; `setup.md` and `frontend/README.md` are stale here.
- Frontend alias `@/` resolves to the `frontend/` package root, not `frontend/src/`.
- Frontend API calls use relative `/api` in `frontend/src/api/client.ts`; Vite proxies that to `VITE_API_URL`, which should be the backend origin only (for example `http://localhost:5000`), not `.../api`.
- Auth state lives in `frontend/src/store/sessionStore.ts`: `refreshToken` and `user` persist in `sessionStorage` key `lendflow-session`; `accessToken` stays in memory and `api/client.ts` auto-refreshes once on `401`.
- Reuse `frontend/src/services/queryKeys.ts` for TanStack Query cache keys/invalidation instead of inventing ad-hoc string keys.
- `frontend/src/components/__tests__/bannedApis.test.ts` forbids `window.alert`, `window.confirm`, `window.prompt`, bare `confirm()/prompt()`, and `<dialog>`; use `frontend/src/lib/confirmModal.tsx` instead.

## Administrative Access And Permissions
- The backoffice app is only for `admin` and `employee`. Do not add customer/socio administrative routes, sidebar entries, dashboards, or self-service payment surfaces back into this frontend unless a separate customer/socio portal is explicitly introduced.
- Backend authentication is centralized in `backend/src/modules/shared/auth.js`; it rejects non-administrative roles before module-level role or permission checks. `backend/src/modules/shared/roles.js` is the source of truth for `ADMINISTRATIVE_LOGIN_ROLES`.
- Frontend route gates live in `frontend/src/App.tsx` and `frontend/src/components/ProtectedRoute.tsx`. Main operational routes use `allowedRoles={['admin', 'employee']}` plus `requiredPermissions`. `/settings` is admin-only.
- `frontend/src/constants/appAccess.ts` sends `admin` to `/dashboard`, `employee` to `/profile`, and any other role to `/login`. Keep this behavior unless the product gets a separate non-admin portal.
- Employees start with no default permissions. Admins receive the full permission catalog from `backend/src/bootstrap/schema.js`. Permission names are seeded from `backend/src/db/seeds/permissions_catalog.js`.
- Employee access is permission-driven through `/api/permissions/me`. Sidebar/header visibility and route access should use the same permission names as backend middleware: for example `CREDITS_VIEW_ALL`, `CREDITS_CREATE`, `PAYMENTS_CREATE`, `REPORTS_VIEW_ALL`, `SOCIOS_VIEW_ALL`, `AUDIT_VIEW_ALL`.
- Sensitive configuration stays admin-only at both layers:
  - Backend: `backend/src/modules/config/presentation/router.js` applies `authMiddleware(['admin'])` after public `/roles`.
  - Frontend: `/settings` uses `allowedRoles={['admin']}`.
  - Employees must not create, update, delete, or resolve operational finance settings through `/api/config/rate-policies`, `/api/config/late-fee-policies`, `/api/config/payment-methods`, or `/api/config/settings`.
- Permission management is also admin-only for mutation routes. Listing/checking permissions can be permission-gated for employees, but grant/revoke/user provisioning flows stay admin-only.
- Keep tests aligned with this contract:
  - `backend/tests/permissionsAuthMiddleware.test.js` verifies customer/socio tokens are rejected at the administrative auth boundary.
  - `backend/tests/configRouter.test.js` verifies employees cannot access sensitive config routes.
  - `frontend/src/components/__tests__/ProtectedRoute.behavior.test.tsx` verifies employee redirect from `/settings` and customer/socio redirect away from admin routes.
  - `frontend/src/components/__tests__/Sidebar.terminology.test.tsx` verifies employee navigation is permission-scoped.

## Completed Financial Product Contracts
Treat these as implemented product contracts, not open goals. If a future change touches one of these areas, preserve the behavior unless the user explicitly asks to change the contract and add/adjust tests in the same patch.

### 1. Roles And Permissions
- The only administrative platform roles are `admin` and `employee`.
- `admin` is the owner/administrator role and has full access by default through seeded role permissions.
- `employee` is an internal operator role with no default permissions; admins grant explicit module permissions.
- `customer` and `socio` must be rejected from the administrative platform by backend auth and redirected away from admin routes in frontend.
- Employees cannot modify rates, late-fee policies, payment methods, business settings, users, or permission assignments.
- Backend source files: `backend/src/modules/shared/auth.js`, `backend/src/modules/shared/roles.js`, `backend/src/modules/permissions/`, `backend/src/modules/config/presentation/router.js`.
- Frontend source files: `frontend/src/App.tsx`, `frontend/src/components/ProtectedRoute.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/constants/appAccess.ts`.
- Guard tests: `backend/tests/permissionsAuthMiddleware.test.js`, `backend/tests/configRouter.test.js`, `backend/tests/permissionsRouter.test.js`, `frontend/src/components/__tests__/ProtectedRoute.behavior.test.tsx`, `frontend/src/components/__tests__/Sidebar.terminology.test.tsx`.

### 2. Amount-Based Rate Parameterization
- Credit rates are operational configuration, not free-form per-credit edits.
- Rate policies are configured by amount ranges under `/api/config/rate-policies`.
- Active rate policies with the same priority cannot overlap; both frontend and backend validate duplicate labels, invalid ranges, invalid percentages, and ambiguous overlaps.
- Credit creation resolves the applicable policy automatically and freezes the resulting rate/policy snapshot in the created loan.
- Existing loans must not be recalculated when future rate policies change.
- Do not reintroduce manual rate mutation for an already-created loan. Admin-only late-fee rate changes are separate operational actions and must remain guarded.
- Backend source files: `backend/src/modules/config/application/useCases.js`, `backend/src/modules/config/presentation/router.js`, `backend/src/modules/credits/application/creditPolicyResolver.js`, `backend/src/modules/credits/infrastructure/loanCreation.js`.
- Frontend source files: `frontend/src/components/Settings.tsx`, `frontend/src/components/NewCredit.tsx`, `frontend/src/services/configService.ts`.
- Guard tests: `backend/tests/configModule.test.js`, `backend/tests/configRouter.test.js`, `backend/tests/credits/loanLifecycle.test.js`, `frontend/src/components/__tests__/Settings.behavior.test.tsx`, `frontend/src/components/__tests__/NewCredit.behavior.test.tsx`.

### 3. Capital Prepayment Rules
- "Abono a capital" means reducing outstanding principal and rebuilding the future schedule. It must not mark future installments as paid or partial by itself.
- Capital prepayment is blocked until at least the first installment has been paid.
- Capital prepayment is also blocked when there are overdue installments, payable interest, partial operative installments, closed loans, financial locks, or no remaining principal.
- Supported strategies are `reduce_term` and `reduce_payment`; both must be real backend behavior, not UI-only labels.
- Invalid attempts should return clear operational errors and remain auditable where the calling flow records audit context.
- Backend source files: `backend/src/modules/credits/application/paymentApplicationService.js`, `backend/src/modules/credits/presentation/router.js`, `backend/src/modules/payouts/presentation/router.js`.
- Frontend source files: `frontend/src/components/CreditDetails.tsx`, `frontend/src/components/shared/CreditSimulationWorkspace.tsx`, `frontend/src/services/paymentService.ts`, `frontend/src/services/loanService.ts`.
- Guard tests: `backend/tests/paymentApplicationService.test.js`, `backend/tests/creditsModule.test.js`, `backend/tests/creditsRouter.test.js`, `frontend/src/components/__tests__/CreditDetails.behavior.test.tsx`.

### 4. Investor Associates
- Socios are investor records, not administrative login users.
- The associates module tracks contributed capital, monthly or annual interest terms, interest payment dates, movements, installment obligations, distributions, reinvestments, and debt status.
- Socio portal-style data can exist as domain reporting, but socios must not enter the administrative frontend or execute backoffice credit/payment operations.
- Backend source files: `backend/src/modules/associates/`, `backend/src/modules/reports/`.
- Frontend source files: `frontend/src/components/Associates.tsx`, `frontend/src/components/AssociateDetails.tsx`, `frontend/src/components/NewAssociate.tsx`.
- Guard tests: `backend/tests/associatesModule.test.js`, `backend/tests/associatesRouter.test.js`, `backend/tests/reportsExcelExport.test.js`, `frontend/src/components/__tests__/Associates.behavior.test.tsx`, `frontend/src/components/__tests__/AssociateDetails.behavior.test.tsx`.

### 5. Monthly Cash Flow And Financial Control
- Monthly cash flow reconciles incoming installment/payment money against outgoing originated loan capital.
- Reports must expose monthly income, loan disbursements, available cash, loss/profit indicators, monthly history, and exportable evidence.
- Report totals must be derived from canonical loan/payment data, not duplicated frontend calculations.
- Backend source files: `backend/src/modules/reports/`, especially monthly cash-flow use cases and report helpers.
- Frontend source files: `frontend/src/components/Reports.tsx`, `frontend/src/services/reportService.ts`.
- Guard tests: `backend/tests/monthlyCashFlowReport.test.js`, `backend/tests/reportsExcelExport.test.js`, `backend/tests/reports/financialAnalyticsRouter.test.js`, `frontend/src/components/__tests__/Reports.behavior.test.tsx`.

### 6. Credit History Exports
- Credit history exports are operational audit artifacts, not technical dumps.
- Exports must include user-facing Spanish headers, formatted money/dates/percentages, created credits, installments received, interest collected/generated, recovered principal, overdue/defaulted credits, losses, profits, and available cash where the selected report supports them.
- Main credit Excel exports should follow the previous backend workbook style: `Resumen General`, `Detalle de Créditos`, and per-credit sheets with amortization and payment history.
- Do not expose internal fields such as DAG versions, raw policy ids, JavaScript object keys, or implementation labels in user-facing Excel headers.
- Backend source files: `backend/src/modules/reports/application/`, `backend/src/modules/reports/presentation/router.js`.
- Frontend source files: `frontend/src/components/Reports.tsx`, `frontend/src/services/reportService.ts`, download helpers.
- Guard tests: `backend/tests/reportsExcelExport.test.js`, `backend/tests/monthlyCashFlowReport.test.js`.

### 7. Financial Action UI Structure
- In credit detail screens, critical money actions must be grouped together: `Registrar pago`, `Abono a capital`, and `Pago total`.
- Informational/navigation actions must stay separate: `Excel`, `Plan de pagos`, `Estado`, and `Guía rápida`.
- Avoid putting operational actions into tabs. Tabs are for sections such as calendar, alerts, promises, payment history, payoff information, and operational history.
- Preserve responsive behavior and accessible tooltips/labels when adjusting the UI.
- Frontend source files: `frontend/src/components/CreditDetails.tsx`, `frontend/src/components/shared/Surfaces.tsx`, `frontend/src/components/shared/HelpSupport.tsx`.
- Guard tests: `frontend/src/components/__tests__/CreditDetails.behavior.test.tsx`.

### Master Modernization Contract
- The current product modernization includes roles/permissions, amount-based rate policies, capital-prepayment restrictions, investor associates, monthly financial control, report exports, and financial UI action hierarchy.
- Preserve compatibility with existing production data. Add migrations safely and never reset production data as a shortcut.
- Do not reintroduce DAG runtime behavior. The current credit calculation engine is versioned calculation profiles plus frozen policy snapshots.
- Do not reintroduce legacy physical deletion for financial operations. Prefer status changes, annulment/correction, audit logs, and traceable history.
- Before claiming completion after touching these flows, run relevant focused tests plus:
  - `cd backend && npm run lint`
  - `cd backend && NODE_ENV=test node --require module-alias/register --test`
  - `cd frontend && npm run lint`
  - `cd frontend && npm test -- --run`
  - `cd frontend && npm run build`

## Stale Docs And Naming
- `frontend/README.md` is leftover AI Studio/Gemini boilerplate and is not the current source of truth.
- `setup.md` is stale for frontend port and `VITE_API_URL`; prefer `frontend/package.json` and `frontend/vite.config.ts`.
- Branding is mid-migration: both `CrediCobranza` and legacy `LendFlow` still appear in UI, tests, storage keys, and generated documents. Inspect nearby usage before doing brand-wide replacements.

## Credit Calculation Engine (No DAG)
The system no longer uses DAG graphs at runtime. All credit calculation behavior is centralized in a dedicated domain module and persisted via versioned calculation profiles.

### Current architecture
- `backend/src/modules/credits/domain/calculation/` contains the financial source of truth for:
  - input normalization
  - amortization methods (`FRENCH`, `SIMPLE`, `COMPOUND`)
  - late fee policies (`NONE`, `SIMPLE`, `COMPOUND`, `FLAT`, `TIERED`)
  - policy resolution (`calculationProfileVersionId`)
  - deterministic schedule + summary generation
  - policy snapshots and explainable breakdown (`calculation.explanation`).
- `backend/src/modules/credits/application/creditCalculationService.js` is the service API used by `/api/loans/calculations` and loan creation.
- `backend/src/modules/credits/infrastructure/loanCreation.js` always recalculates through `creditCalculationService` and persists:
  - `calculationProfileVersionId`
  - `policySnapshot` with method/inputs/summary metadata.

### API contract
- `/api/loans/calculations` returns only:
  - `data.calculation.calculationVersionId`
  - `data.calculation.calculationProfileVersionId`
  - `data.calculation.method`
  - `data.calculation.inputs`
  - `data.calculation.schedule`
  - `data.calculation.summary`
  - `data.calculation.policySnapshot`
  - `data.calculation.explanation`
- Legacy `simulation` or `graphVersionId` contracts are not supported for new operations.

### Migration model
- `backend/src/db/migrations/20260507000001_add_calculation_profile_versions.js` introduces `CalculationProfileVersion`.
- `backend/src/db/migrations/20260507000002_remove_dag_artifacts.js` removes old DAG runtime artifacts and moves any historical trace data into `Loan.policySnapshot.retiredCalculationTrace`.
- `backend/src/models/Loan.js` includes `calculationProfileVersionId` and no longer stores DAG runtime FK.
- For historical compatibility, old DAG columns/routes are not required by new workflows and are validated as absent where applicable.

### Key files
- `backend/src/modules/credits/domain/calculation/index.js`
- `backend/src/modules/credits/domain/calculation/creditCalculationEngine.js`
- `backend/src/modules/credits/application/creditPolicyResolver.js`
- `backend/src/modules/credits/domain/calculation/amortizationMethods.js`
- `backend/src/modules/credits/domain/calculation/lateFeeCalculator.js`
- `backend/src/modules/credits/domain/calculation/calculationExplainer.js`
- `backend/src/modules/credits/domain/calculation/policySnapshotBuilder.js`
- `backend/src/modules/credits/application/creditCalculationService.js`
- `backend/src/modules/credits/domain/calculation/README.md`
