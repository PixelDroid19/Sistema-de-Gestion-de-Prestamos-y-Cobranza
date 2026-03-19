# Design: Early Payoff Daily Accrual

## Technical Approach

Keep the existing amortization schedule and `financialSnapshot` as the canonical state for normal servicing. Add a dedicated payoff quote/execute path under the credits module because payoff is a loan-servicing and closure operation, while regular installment posting stays in payouts. Reuse the shared transactional seam in `backend/src/services/paymentApplicationService.js` for payoff execution so loan mutation and payment persistence remain atomic.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Endpoint ownership | `payouts` vs `credits` | Quote and execute in `backend/src/modules/credits` | Payoff changes loan lifecycle and closure state; payouts should stay focused on regular customer installment payments. |
| Accrual strategy | Replace monthly schedule vs payoff-only overlay | Keep schedule canonical; add payoff helpers in `loanFinancials` | Preserves existing installment behavior, reports, and overdue logic. |
| Quote consistency | Persist quotes vs recompute on execution | Stateless quote plus in-transaction recompute | Avoids a new quote table while rejecting stale or mismatched executions safely. |
| Audit model | Root payment totals only vs typed metadata | Add typed payoff metadata on `Payment` plus closure fields on `Loan` | Reports keep using current numeric columns, while payoff-specific facts stay inspectable. |

## Data Flow

Sequence diagram:

```text
Client -> CreditsRouter: GET /api/loans/:id/payoff-quote?asOfDate=YYYY-MM-DD
CreditsUseCase -> LoanAccessPolicy: authorize
CreditsUseCase -> LoanViewService: canonical schedule + snapshot
CreditsUseCase -> loanFinancials: buildPayoffQuote()
loanFinancials --> Client: breakdown + total

Client -> CreditsRouter: POST /api/loans/:id/payoff-executions
CreditsUseCase -> PaymentApplicationService: applyPayoff(asOfDate, quotedTotal)
PaymentApplicationService -> Loan + Payment: transaction + recompute
PaymentApplicationService --> CreditsUseCase: payment + closed loan + payoff metadata
```

Quote rules:
- overdue scheduled bucket = unpaid `remainingPrincipal` + `remainingInterest` for schedule rows with `dueDate <= asOfDate`
- future principal bucket = `snapshot.outstandingPrincipal - overdueScheduledPrincipal`
- accrual anchor = latest row `dueDate <= asOfDate`; otherwise `loan.startDate`
- daily accrued interest = `snapshot.outstandingPrincipal * annualRate / 100 * elapsedDays / 365`
- elapsed days use UTC calendar dates, start exclusive and payoff date inclusive; if `asOfDate` equals a due date, extra daily accrual is `0`

This keeps earned scheduled interest in overdue buckets and charges only incremental interest after the last earned schedule boundary.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/modules/credits/presentation/router.js` | Modify | Add payoff quote and payoff execution endpoints under `/api/loans/:id`. |
| `backend/src/modules/credits/application/useCases.js` | Modify | Add `getPayoffQuote` and `executePayoff` use cases using existing loan access policy. |
| `backend/src/modules/credits/application/loanFinancials.js` | Modify | Add payoff quote builder, UTC date helpers, and actual/365 accrual logic. |
| `backend/src/services/paymentApplicationService.js` | Modify | Add `applyPayoff()` transaction path separate from `applyPayment()`. |
| `backend/src/middleware/validation.js` | Modify | Add payoff quote/execution payload validation for `asOfDate` and `quotedTotal`. |
| `backend/src/models/Payment.js` | Modify | Add `paymentType` and `paymentMetadata` for payoff quote/execution details. |
| `backend/src/models/Loan.js` | Modify | Add `closedAt` and `closureReason` so payoff closure does not overload contractual `endDate`. |
| `backend/tests/paymentApplicationService.test.js` | Modify | Add payoff execution and mismatch/date-math cases. |

## Interfaces / Contracts

```js
// Payment additions
paymentType: 'installment' | 'payoff'
paymentMetadata: {
  payoff?: {
    asOfDate: 'YYYY-MM-DD',
    accrualMethod: 'actual/365',
    accruedDays: number,
    breakdown: {
      overduePrincipal: number,
      overdueInterest: number,
      accruedInterest: number,
      futurePrincipal: number,
    },
    quotedTotal: number,
    executedTotal: number,
  }
}

// Loan additions
closedAt: Date | null
closureReason: 'payoff' | 'schedule_completion' | null
```

Execution response should keep current `payment`, `loan`, and `allocation` shape, with `allocation.payoff` holding the server-recomputed quote so history and UI can explain the liquidation.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Actual/365 accrual math, due-date inclusivity, before-first-due-date and overdue cases | Add table-driven tests for `loanFinancials` with fixed UTC dates. |
| Unit | `applyPayoff()` closes loan, persists typed metadata, rejects stale totals, and leaves `applyPayment()` unchanged | Extend `backend/tests/paymentApplicationService.test.js` with model doubles. |
| Integration | Credits router auth, validation, and response contracts for quote/execute | Extend credits router/module tests with mocked services. |
| Integration | Schema contract includes new `Loan` and `Payment` columns | Update `backend/tests/schema.test.js`. |
| Regression | Reports/history still classify closed loans and include payoff payments | Add report/history cases using a payoff-typed payment row. |

## Migration / Rollout

No backfill is required. `sequelize.sync({ alter: true })` can add nullable loan fields and payment metadata columns. Existing payments default to `paymentType = 'installment'`; existing closed loans keep `closedAt`/`closureReason` null until touched again.

## Open Questions

- [ ] Confirm whether payoff execution is customer-only or also allowed for `admin`/`agent` acting on behalf of the customer; the design supports either policy at the credits use-case layer.
