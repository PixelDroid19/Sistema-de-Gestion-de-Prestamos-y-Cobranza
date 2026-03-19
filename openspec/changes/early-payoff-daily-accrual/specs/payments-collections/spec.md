# Delta for Payments And Collections

## ADDED Requirements

### Requirement: Full payoff quote contract

The system MUST expose a dedicated full-payoff quote path separate from regular payment posting. A quote request SHALL identify the loan and an effective date. The effective date MUST mean the date through which daily interest accrues, inclusive, using `actual/365`. The quote response MUST return the effective date, unpaid overdue due amounts, accrued interest, outstanding principal, each rounded to the currency minor unit, and the rounded total payoff. The system MUST NOT include future unearned scheduled interest and SHALL NOT mutate balances when quoting.

#### Scenario: Mid-cycle payoff quote

- GIVEN an active loan with no overdue installments and remaining principal
- WHEN an authorized actor requests a payoff quote for a mid-cycle effective date
- THEN the response SHALL include only outstanding principal plus accrued daily interest through that date

#### Scenario: Overdue payoff quote

- GIVEN a loan with unpaid overdue scheduled amounts
- WHEN an authorized actor requests a payoff quote
- THEN the response MUST include overdue unpaid due amounts and MUST NOT add future scheduled interest

#### Scenario: Invalid effective date

- GIVEN a payoff quote request with an effective date outside the payable life of the loan
- WHEN the system validates the request
- THEN the platform MUST reject the quote instead of returning a payoff total

### Requirement: Full payoff execution and allocation

The system MUST expose a dedicated payoff execution path that accepts only full liquidation in this batch. Execution SHALL use the quoted effective date and rounded payoff total; if the submitted payoff is stale or insufficient for that effective date, the system MUST reject execution and require a new quote. On successful execution, the payment allocation order SHALL be unpaid overdue due amounts, then accrued daily interest, then outstanding principal. The system MUST persist the payoff payment as auditable history, MUST close the loan when the quoted amount is satisfied, and MUST preserve current monthly servicing behavior for non-payoff payments.

#### Scenario: Same-day payoff execution

- GIVEN a valid same-day payoff quote and no additional elapsed accrual days
- WHEN the borrower pays the quoted amount through the payoff path
- THEN the platform SHALL apply the amount in payoff order and close the loan without charging extra future interest

#### Scenario: Already settled loan

- GIVEN a loan already closed or with zero payoff balance
- WHEN a quote or execution is requested
- THEN the platform MUST reject the request as not payable
