# Late-fee policy and overdue payoff design

## Objective

Allow administrators to maintain the operational late-fee policy without hidden conflicts, and allow a credit with overdue installments to be paid in full with every earned amount included in the quote and payment record.

## Late-fee policy

The product has one operational late-fee policy for new credits. Existing credits retain the policy snapshot and annual rate captured when they were created.

- The active policy can be edited from Configuration: name, annual rate and calculation mode.
- Creating a policy while another is active is an intentional replacement: the previous policy is archived in the same database transaction and the new policy becomes active.
- Historical policies remain available for traceability and for foreign-key references from existing credits.
- The interface does not expose priority because policies have no scope where competing priorities would be meaningful.
- Rate validation remains between 0 and 100 and modes remain `SIMPLE`, `COMPOUND` or `NONE`.

## Overdue payoff

Overdue installments do not make a credit ineligible for total payoff. They continue to block capital-only prepayments.

The payoff quote contains:

1. Late-fee penalties calculated for every overdue unpaid installment as of the payoff date.
2. Earned interest from overdue installments.
3. Overdue principal.
4. Interest accrued on future principal up to the payoff date.
5. Remaining future principal.

The executed payment must persist the same breakdown, including `penaltyApplied`, satisfy the payment allocation invariant, settle the amortization schedule, close the credit, and keep stale-quote protection.

## User experience

- Configuration shows an explicit Edit action for each policy.
- The same modal supports create and edit with clear titles and submit labels.
- Creating a replacement explains that the current active policy will be archived for new credits; existing credits are not recalculated.
- On an overdue credit, Pago total becomes available once its quote loads. The confirmation displays the late-fee amount as a distinct concept when it is greater than zero.

## Error handling and consistency

- Policy replacement is atomic; a failed create leaves the previous policy active.
- Payoff execution recomputes the quote inside the transaction and rejects any quoted total that no longer matches.
- Closed, paid, cancelled, rejected or financially blocked credits remain ineligible.
- No production data migration is required.

## Verification

- Backend unit and integration tests cover policy replacement, policy editing, overdue eligibility, quote penalty calculation, allocation integrity and payoff closure.
- Frontend behavior tests cover editing and replacing policies plus an overdue credit with an enabled payoff action and visible penalty.
- Full lint, test and production builds run before deployment.
- Browser QA covers Configuration and the overdue-credit payoff flow locally and after Railway deployment.
