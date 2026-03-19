# Proposal: Associate Participation Proportional Distribution

## Intent

Close the socios gap by formalizing each associate's participation percentage and adding an admin-controlled proportional profit distribution flow that allocates a declared amount using those percentages.

## Scope

### In Scope
- Add `participationPercentage` to associates with explicit validation and admin-only create/update control.
- Add a proportional distribution backend flow that validates eligible associates and creates auditable `ProfitDistribution` records from one declared total amount.
- Preserve existing manual per-associate distribution endpoints and reporting behavior.
- Expose percentage and proportional-distribution results in associate profitability and portal/report export payloads.

### Out of Scope
- Changing loan yield calculation or deriving percentages automatically from contributions.
- Frontend UX redesign beyond backend contract support.

## Approach

Extend the associates module with an explicit participation field and a separate proportional-distribution use case instead of overloading the current manual flow. The new flow should require `admin`, validate that active eligible associates have configured percentages, reject invalid totals or inconsistent percentage sets, compute rounded allocations deterministically, reconcile any rounding remainder transparently, and persist the resulting records transactionally with machine-readable `basis` metadata. To harden against accidental duplicate submissions, the proportional endpoint SHOULD accept a client-provided idempotency key and safely replay the first successful result for exact retries while rejecting mismatched payload reuse.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/models/Associate.js` | Modified | Persist `participationPercentage` |
| `backend/src/middleware/validation.js` | Modified | Validate percentage and proportional request payloads |
| `backend/src/modules/associates/application/useCases.js` | Modified | Add percentage rules and proportional distribution use case |
| `backend/src/modules/associates/infrastructure/repositories.js` | Modified | Query eligible associates and persist grouped distributions transactionally |
| `backend/src/modules/associates/presentation/router.js` | Modified | Add admin proportional distribution endpoint |
| `backend/src/models/IdempotencyKey.js` | Added | Persist proportional distribution idempotency state and replay metadata |
| `backend/src/modules/reports/application/useCases.js` | Modified | Include percentage/allocation basis in profitability outputs |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Percentages do not sum to a valid total | High | Reject execution with explicit validation errors |
| Currency rounding creates allocation drift | Med | Define deterministic rounding and remainder assignment in specs/tests |
| Manual and proportional flows diverge semantically | Med | Keep separate endpoints and tag proportional records in `basis` |

## Rollback Plan

Disable the proportional endpoint/use case and ignore `participationPercentage` in application logic; manual distributions and existing reports continue operating unchanged.

## Dependencies

- Existing associates, profitability reporting, and `ProfitDistribution` persistence.
- Follow-up specs/design for eligibility, percentage-total rules, and response contracts.

## Success Criteria

- [ ] Admins can store validated participation percentages on associates.
- [ ] Admins can trigger a proportional distribution from one declared total amount.
- [ ] Existing manual distributions remain backward-compatible.
- [ ] Profitability/reporting surfaces percentage and proportional allocation audit details.
