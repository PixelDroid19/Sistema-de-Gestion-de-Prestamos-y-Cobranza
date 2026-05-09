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
- Current authenticated roles are `admin`, `customer`, and `socio`; `agent` is roster data now, not a login role.

## Frontend Gotchas
- Vite is pinned to port `3000`; `setup.md` and `frontend/README.md` are stale here.
- Frontend alias `@/` resolves to the `frontend/` package root, not `frontend/src/`.
- Frontend API calls use relative `/api` in `frontend/src/api/client.ts`; Vite proxies that to `VITE_API_URL`, which should be the backend origin only (for example `http://localhost:5000`), not `.../api`.
- Auth state lives in `frontend/src/store/sessionStore.ts`: `refreshToken` and `user` persist in `sessionStorage` key `lendflow-session`; `accessToken` stays in memory and `api/client.ts` auto-refreshes once on `401`.
- Reuse `frontend/src/services/queryKeys.ts` for TanStack Query cache keys/invalidation instead of inventing ad-hoc string keys.
- `frontend/src/components/__tests__/bannedApis.test.ts` forbids `window.alert`, `window.confirm`, `window.prompt`, bare `confirm()/prompt()`, and `<dialog>`; use `frontend/src/lib/confirmModal.tsx` instead.

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
