# Design: Associate Participation Proportional Distribution

## Technical Approach

Keep ownership in the associates module. `participationPercentage` becomes an explicit associate attribute, while proportional allocation is a new admin-only associates use case that validates the active pool, computes deterministic per-associate amounts in cents, and persists multiple `ProfitDistribution` rows in one transaction. Reports and portal endpoints stay read-only and surface the new percentage plus structured `basis` metadata already supported by `ProfitDistribution.basis`.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Orchestration ownership | `associates` vs `reports` vs new module | `backend/src/modules/associates` | Distribution creation is a write workflow beside existing associate contribution/manual distribution logic; reports should keep read-only composition. |
| Distribution audit model | New batch table vs extra columns vs typed `basis` JSON | Reuse `ProfitDistribution.basis` with a batch identifier and add a small idempotency ledger | Preserves backward compatibility for manual entries, avoids schema sprawl on distributions, and lets retries safely replay or reject duplicate requests. |
| Percentage storage | Derived from contributions vs explicit persisted field | Nullable persisted `Associate.participationPercentage` | Proposal requires admin-controlled percentages and must not infer them from capital history. |
| Rounding policy | Naive `toFixed`, banker rounding, largest remainder | Integer-cents largest remainder with associate-id tie break | Ensures totals reconcile exactly and repeated runs stay deterministic. |

## Data Flow

Sequence diagram:

```text
Admin -> AssociatesRouter: POST /api/associates/distributions/proportional
AssociatesUseCase -> AssociateRepository: claim idempotency key
AssociatesUseCase -> AssociateRepository: list active associates with percentages
AssociatesUseCase -> AllocationEngine: validate totals + compute cents
AssociatesUseCase -> AssociateRepository: createProfitDistributionBatch(tx)
AssociateRepository -> ProfitDistribution: insert one row per associate
AssociatesUseCase -> AssociateRepository: persist idempotent response payload
AssociatesUseCase --> Admin: created rows + batch summary or replayed response

Socio/Admin -> ReportsRouter: GET /api/reports/associates/profitability/:associateId
ReportsUseCase -> AssociateRepository/ReportRepository: read associate + distributions
ReportsUseCase --> Client: participationPercentage + typed basis metadata
```

Validation rules:
- eligible set = associates with `status = 'active'`
- proportional execution MUST reject when no active associates exist, any eligible associate lacks percentage, any percentage is `<= 0`, or eligible total is not exactly `100.0000`
- manual `POST /:id/distributions` remains unchanged and MAY store arbitrary `basis`
- proportional `POST /distributions/proportional` SHOULD accept `Idempotency-Key` request header and MAY accept body `idempotencyKey` for backward-compatible clients; when present, the backend MUST hash the normalized request payload, replay an identical completed request, and reject mismatched or in-flight reuse

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/models/Associate.js` | Modify | Add nullable `participationPercentage` decimal field. |
| `backend/src/models/ProfitDistribution.js` | Modify | Keep `basis` JSONB, document proportional metadata contract in model comments/tests only. |
| `backend/src/models/IdempotencyKey.js` | Add | Persist proportional distribution request hash, status, and serialized response for safe replay. |
| `backend/src/bootstrap/schema.js` | Modify | Include `participationPercentage` in runtime schema verification. |
| `backend/src/middleware/validation.js` | Modify | Validate associate percentage on create/update and proportional distribution payloads. |
| `backend/src/modules/associates/application/useCases.js` | Modify | Add percentage normalization, pool validation, allocation helper, and proportional batch use case. |
| `backend/src/modules/associates/infrastructure/repositories.js` | Modify | Add active-associate listing and transactional batch insert helper. |
| `backend/src/modules/associates/presentation/router.js` | Modify | Add admin proportional distribution endpoint returning batch summary plus created rows. |
| `backend/src/modules/associates/index.js` | Modify | Wire new use case. |
| `backend/src/modules/reports/application/useCases.js` | Modify | Surface `participationPercentage` and normalized proportional metadata in report/export payloads. |
| `backend/src/modules/reports/infrastructure/repositories.js` | Modify | Include participation percentage in associate/report datasets. |
| `backend/tests/*.test.js` | Modify | Cover schema, validation, use-case, router, and report regressions. |

## Interfaces / Contracts

```js
// Associate
participationPercentage: string | null // decimal(7,4), e.g. '25.0000'

// Proportional distribution request
{
  amount: number,
  distributionDate?: 'YYYY-MM-DD' | ISO string,
  notes?: string,
  idempotencyKey?: string,
  basis?: { source?: string, reference?: string }
}

// Or via HTTP header
Idempotency-Key: <client-generated-key>

// ProfitDistribution.basis for proportional rows
{
  type: 'proportional-participation',
  version: 1,
  batchKey: string,
  idempotencyKey?: string,
  participationPercentage: '25.0000',
  sourceAmount: '1000.00',
  allocatedAmount: '250.00',
  roundingAdjustment: '0.00',
  eligibleAssociateCount: 4,
  manual: false
}
```

Allocation algorithm: convert declared amount to integer cents, compute each raw share from percentage, floor to cents, then distribute remaining cents by descending fractional remainder and ascending `associate.id` for ties.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Percentage validation, exact-100 rule, missing active percentages, non-admin rejection | Extend `backend/tests/associatesModule.test.js` with repository doubles. |
| Unit | Deterministic allocation and remainder assignment | Add table-driven cases around the allocation helper. |
| Unit | Idempotency replay, mismatched payload rejection, and near-concurrent duplicate prevention | Extend `backend/tests/associatesModule.test.js` with repository doubles that simulate ledger conflicts. |
| Integration | Router contract for proportional endpoint and associate percentage payloads | Extend `backend/tests/associatesRouter.test.js`. |
| Integration | Profitability/export payloads include percentage and proportional `basis` metadata while manual rows still serialize | Extend `backend/tests/reportsModule.test.js` and `backend/tests/reportsRouter.test.js`. |
| Regression | Schema contract includes `Associates.participationPercentage` and no new required table | Update `backend/tests/schema.test.js`. |

## Migration / Rollout

No destructive migration is required. `participationPercentage` starts nullable so existing associates and manual distributions continue working. Proportional execution is blocked until the active pool is fully configured; historical manual rows remain valid because report code branches on `basis.type === 'proportional-participation'` and otherwise treats entries as manual. The idempotency ledger is additive and only affects proportional submissions that send an idempotency key.

## Open Questions

- [ ] Confirm whether inactive associates with historical manual distributions should still expose `participationPercentage: null` unchanged in reports, or whether exports should snapshot the last configured percentage.
