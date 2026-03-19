# Proposal: Early Payoff Daily Accrual

## Intent

Correct loan liquidation so full early payoff charges only amounts actually owed on the effective date, instead of collecting future scheduled interest from the static amortization schedule.

## Scope

### In Scope
- Add a dedicated backend payoff quote and execution path for full early payoff/liquidation.
- Compute payoff as unpaid overdue scheduled principal/interest, plus daily accrued interest through the payoff effective date, plus outstanding principal.
- Preserve the monthly amortization schedule for regular servicing while preventing future unearned interest from being charged on payoff.
- Persist payoff allocations and close the loan atomically when the quoted payoff is executed.

### Out of Scope
- Partial principal curtailments or generic unscheduled principal-only payments.
- Replacing the existing monthly schedule engine for normal installments.

## Approach

Introduce a payoff calculation seam in the credits/payments backend that derives a payoff quote from the loan snapshot, schedule state, and an `actual/365` daily accrual rule. Expose quote and execute use cases separately from regular payment posting so normal installment allocation remains unchanged. Execution should use a transaction, store a payoff-specific payment/allocation record, update loan balances, and transition the loan to `closed` only when the quoted amount is satisfied.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/modules/credits/presentation/router.js` | Modified | Add payoff quote/execution endpoints |
| `backend/src/modules/credits/application/useCases.js` | Modified | Add dedicated payoff use cases |
| `backend/src/services/paymentApplicationService.js` | Modified | Keep regular path separate from payoff execution path |
| `backend/src/modules/credits/application/loanFinancials.js` | Modified | Add payoff and accrued-interest calculation helpers |
| `backend/src/models/Loan.js` | Modified | Persist payoff-relevant fields if required for accrual baselines/audit |
| `backend/src/models/Payment.js` | Modified | Capture payoff-specific allocation metadata |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Accrual baseline is ambiguous after late or partial payments | High | Define quote inputs from last satisfied schedule state and effective date in specs/design |
| Payoff logic diverges from existing balances | Med | Reuse canonical loan snapshot and transactionally update loan/payment together |
| Date math causes off-by-one interest errors | Med | Lock `actual/365` and effective-date inclusion rules in specs/tests |

## Rollback Plan

Disable the payoff endpoints/use cases and continue using the current installment-payment flow; existing schedules and payment history remain unchanged.

## Dependencies

- Existing credits module, canonical loan snapshot logic, and payment persistence.
- Follow-up specs/design to define accrual baseline, quote expiry, and response contract.

## Success Criteria

- [ ] Backend can quote full payoff for any active/defaulted loan using `actual/365` accrued interest.
- [ ] Payoff execution charges overdue amounts, accrued interest, and outstanding principal, but not future unearned interest.
- [ ] Regular monthly payment behavior remains unchanged for non-payoff flows.
- [ ] Successful payoff closes the loan and leaves an auditable payment/allocation record.
