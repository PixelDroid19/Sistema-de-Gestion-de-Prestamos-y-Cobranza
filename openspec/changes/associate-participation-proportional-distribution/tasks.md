# Tasks: Associate Participation Proportional Distribution

## Phase 1: Schema And Validation Foundations

- [x] 1.1 Add nullable `participationPercentage` to `backend/src/models/Associate.js` and update `backend/src/bootstrap/schema.js` to verify the column without making it required.
- [x] 1.2 Update `backend/src/middleware/validation.js` so admin associate create/update accepts `participationPercentage` from `0` to `100` with max four decimals while socio mutations cannot set it.
- [x] 1.3 Extend `backend/tests/schema.test.js` and `backend/tests/associatesRouter.test.js` for schema coverage plus valid/invalid percentage payload scenarios.

## Phase 2: Deterministic Proportional Distribution Core

- [x] 2.1 Add active-pool query and transactional batch insert helpers in `backend/src/modules/associates/infrastructure/repositories.js` for eligible associates and grouped `ProfitDistribution` creation.
- [x] 2.2 Extend `backend/src/modules/associates/application/useCases.js` with percentage normalization, exact-`100.00` pool validation, declared-amount validation, and the integer-cents largest-remainder allocator.
- [x] 2.3 Implement the proportional distribution use case in `backend/src/modules/associates/application/useCases.js` so it rejects partial execution, stamps `basis.type`, `batchKey`, declared total, percentage, allocation, and rounding metadata, and preserves manual distribution behavior.
- [x] 2.4 Extend `backend/tests/associatesModule.test.js` with table-driven cases for no active associates, missing percentages, invalid total amount, exact-100 enforcement, deterministic remainder assignment, and successful transactional batch output.

## Phase 3: Route Wiring And Reporting Surfaces

- [x] 3.1 Add the admin-only proportional distribution validator and `POST /api/associates/distributions/proportional` handler in `backend/src/modules/associates/presentation/router.js`, then wire it through `backend/src/modules/associates/index.js`.
- [x] 3.2 Extend `backend/tests/associatesRouter.test.js` for admin success, socio rejection, validation failures, and response payload shape with batch summary plus created rows.
- [x] 3.3 Update `backend/src/modules/reports/infrastructure/repositories.js` and `backend/src/modules/reports/application/useCases.js` so profitability and portal/export datasets include `participationPercentage`, distribution type, declared proportional total, allocation amount, and manual fallback serialization.
- [x] 3.4 Extend `backend/tests/reportsModule.test.js` and `backend/tests/reportsRouter.test.js` for admin profitability/export traceability and socio no-cross-visibility on grouped proportional distributions.

## Phase 4: Regression Verification

- [x] 4.1 Document the proportional `basis` metadata contract in `backend/src/models/ProfitDistribution.js` tests or nearby assertions so manual and proportional records remain distinguishable without schema sprawl.
- [x] 4.2 Run `cd backend && npm test` and fix any regressions in associates, reports, schema, or routing coverage exposed by the new participation/distribution flow.

## Phase 5: Idempotency Hardening

- [x] 5.1 Update this change's proposal, design, and delta specs to document the proportional distribution idempotency-key contract, replay behavior, and conflict cases.
- [x] 5.2 Add an additive backend idempotency ledger plus schema wiring so proportional distributions can safely claim a client-provided key and persist replay metadata.
- [x] 5.3 Harden `backend/src/modules/associates/application/useCases.js` and `backend/src/modules/associates/presentation/router.js` to accept `Idempotency-Key` or body `idempotencyKey`, replay exact retries, reject mismatched payload reuse, and prevent near-concurrent duplicate submissions as far as the current transaction model allows.
- [x] 5.4 Extend `backend/tests/associatesModule.test.js`, `backend/tests/associatesRouter.test.js`, and `backend/tests/schema.test.js` for first success, exact retry replay, mismatched payload conflict, and duplicate-submit protection coverage.
- [x] 5.5 Run targeted proportional-distribution backend tests and the full `cd backend && npm test` suite, then capture the hardening decision in Engram.
