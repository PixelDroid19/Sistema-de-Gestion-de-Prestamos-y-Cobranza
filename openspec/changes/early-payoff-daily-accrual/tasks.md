# Tasks: Early Payoff Daily Accrual

## Phase 1: Persistence And Financial Foundations

- [x] 1.1 Extend `backend/src/models/Loan.js` with nullable `closedAt` and `closureReason`, then update `backend/tests/schema.test.js` for the new loan columns.
- [x] 1.2 Extend `backend/src/models/Payment.js` with `paymentType` and `paymentMetadata`, then update `backend/tests/schema.test.js` for the new payment columns and default installment compatibility.
- [x] 1.3 Add payoff quote helpers to `backend/src/modules/credits/application/loanFinancials.js` for UTC date normalization, accrual-anchor selection, overdue bucket extraction, and rounded `actual/365` payoff totals.
- [x] 1.4 Add focused unit coverage in `backend/tests/creditDomain.test.js` or a new `backend/tests/loanFinancials.test.js` for mid-cycle, overdue, due-date, and invalid-date payoff quote scenarios.

## Phase 2: Payoff Application And Use Cases

- [x] 2.1 Add `applyPayoff()` to `backend/src/services/paymentApplicationService.js` to recompute the quote in-transaction, reject stale or insufficient totals, persist payoff metadata, and close the loan atomically.
- [x] 2.2 Keep `applyPayment()` behavior unchanged while sharing only safe helpers inside `backend/src/services/paymentApplicationService.js` so installment allocation remains the regular path.
- [x] 2.3 Add `getPayoffQuote` and `executePayoff` to `backend/src/modules/credits/application/useCases.js`, reusing loan visibility for quotes and mutation authority for execution.
- [x] 2.4 Extend `backend/tests/paymentApplicationService.test.js` for successful payoff closure, stale quote rejection, already-closed loan rejection, and no-regression regular payment behavior.
- [x] 2.5 Extend `backend/tests/creditsModule.test.js` for quote/execution authorization boundaries across customer, agent, and admin actors.

## Phase 3: HTTP Contracts And History Surfaces

- [x] 3.1 Add payoff request validators to `backend/src/middleware/validation.js` for `asOfDate`, `quotedTotal`, and positive loan identifiers with payable-life checks.
- [x] 3.2 Add `GET /:id/payoff-quote` and `POST /:id/payoff-executions` to `backend/src/modules/credits/presentation/router.js` with the existing success envelope and payoff payload shape.
- [x] 3.3 Update `backend/tests/creditsRouter.test.js` to cover quote and execution contract responses, validation failures, and auth failures.
- [x] 3.4 Update `backend/src/modules/reports/application/useCases.js` and `backend/src/modules/reports/infrastructure/repositories.js` so customer credit history and recovery views surface payoff-typed payments, effective-date breakdown, and loan closure facts without recording quote-only activity.
- [x] 3.5 Extend `backend/tests/reportsModule.test.js` and `backend/tests/reportsRouter.test.js` for payoff history visibility, closed-loan reporting, and quote-not-a-payment regression cases.

## Phase 4: End-To-End Verification

- [x] 4.1 Run `cd backend && npm test` after the payoff work lands and fix any schema, router, service, or report regressions exposed by the new path.
- [x] 4.2 Manually verify one active-loan and one overdue-loan payoff flow through the credits and reports APIs to confirm rounded totals, payoff allocation order, and `closed` lifecycle transition.
