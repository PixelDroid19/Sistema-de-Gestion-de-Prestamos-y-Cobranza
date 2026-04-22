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
- Frontend `@/` is unrelated — it resolves to `frontend/` package root via Vite, not `frontend/src/`.

## Backend Gotchas
- Required boot env: `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `JWT_SECRET`.
- Current code reads `DB_*` and `ALLOWED_ORIGINS`; it does not read `DATABASE_URL` or `CORS_ORIGIN` from `render.yaml`.
- Without `ALLOWED_ORIGINS`, development only allows `http://localhost:3000` and `http://127.0.0.1:3000`.
- Startup does more than start Express: it authenticates Sequelize, verifies/syncs schema, seeds financial products, starts overdue-alert scheduling, and starts the outbox relay worker every 5 seconds.
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

## DAG Formula System Architecture
The system uses persisted, editable DAG graphs (`DagGraphVersion` model) as the single source of truth for credit simulation and loan origination math. A visual workbench (admin-only) lets users edit formulas, and the same formula version drives both the simulator and credit creation.

### Execution chain
1. **`graphExecutor.js`** — loads the active `DagGraphVersion` from DB by scope key and executes it via `CalculationEngine`. Returns `{ ok, source, graphVersionId, result, executionMetrics }`. Also has `executeDraft()` for workbench previews.
2. **`calculationAdapter.js`** — wraps `graphExecutor` with rollout modes (`off`/`shadow`/`primary`). Always runs legacy `simulateCredit()` alongside and compares via `parity.js`. Returns `{ mode, selectedSource, result, parity, fallbackReason, graphVersionId }`.
3. **`creditSimulationService.js`** — exposes `simulate(input)` (returns result + graphVersionId) and `simulateDetailed(input)` (returns full execution metadata). Used by the `/loans/simulations` route and by `loanCreation.js`.
4. **`loanCreation.js`** — persists the loan and records `dagGraphVersionId` from the execution result. No separate query to `DagGraphVersion`.

### Scope & contracts
- Only one scope exists: `credit-simulation` (defined in `scopeRegistry.js`).
- Required inputs: `amount`, `interestRate`, `termMonths`. Optional: `startDate`, `lateFeeMode`.
- Required outputs: `lateFeeMode`, `schedule`, `summary` (on the `result` outputVar).
- `graphExecutor` validates both input and output contracts on every execution.

### Formula engine
- Formulas are compiled and evaluated by `CalculationEngine` -> `FormulaCompiler` -> `BigNumberEngine` (mathjs BigNumber mode).
- mathjs **cannot parse** JavaScript object literals (`{ key: value }` or shorthand `{ key }`). All graph formulas must use function calls with positional args.
- Helpers injected into the evaluation scope by `scopeBuilder.js`: `buildAmortizationSchedule(amount, rate, term, startDate, lateFeeMode)`, `summarizeSchedule(schedule)`, `assertSupportedLateFeeMode(mode)`, `calculateLateFee(...)`, `roundCurrency(value)`, `buildSimulationResult(lateFeeMode, schedule, summary)`.
- `BigNumberEngine` maintains a function whitelist; any new helper must be added to both `scopeBuilder.js` and `BigNumberEngine.ALLOWED_FUNCTIONS`.

### Workbench
- Admin-only visual editor at `DAGWorkbench.tsx`. API routes under `/api/loans/workbench/*`.
- `workbenchService.js` handles save/load/validate/simulate via `graphExecutor.executeDraft()`.
- Validation: `validateDagWorkbenchGraph()` checks cycles, duplicate IDs, formula safety, and scope output requirements.

### Rollout config
- `config.js` reads `DAG_ROLLOUT_MODE` env (default `off`). Modes: `off` = legacy only, `shadow` = run both / return legacy / log parity, `primary` = use DAG when parity passes.
- **CRITICAL**: In production, `DAG_ROLLOUT_MODE` MUST be set to `primary`. Without it, the system runs in legacy-only mode, `graphVersionId` is always `null`, and `dagGraphVersionId` is not persisted on loans — breaking formula traceability completely.
- Composition wired in `repositories.js` -> `composition.js`.

### Seeding
- On first boot, `bootstrap/schema.js` seeds a `DagGraphVersion` v1 from `scopeRegistry.defaultGraph` if no version exists for the scope.

### Key files
- `backend/src/modules/credits/application/dag/graphExecutor.js` — unified execution
- `backend/src/modules/credits/application/dag/calculationAdapter.js` — rollout adapter
- `backend/src/modules/credits/application/dag/scopeRegistry.js` — scope contracts + default graph
- `backend/src/modules/credits/application/dag/workbenchService.js` — workbench CRUD + simulate
- `backend/src/core/domain/calculation/CalculationEngine.js` — 6-phase engine
- `backend/src/core/domain/calculation/scopeBuilder.js` — scope init + helper injection
- `backend/src/core/domain/calculation/BigNumberEngine.js` — mathjs wrapper + whitelist
- `frontend/src/components/DAGWorkbench.tsx` — visual editor
- `frontend/src/types/dag.ts` — TypeScript types + constants
