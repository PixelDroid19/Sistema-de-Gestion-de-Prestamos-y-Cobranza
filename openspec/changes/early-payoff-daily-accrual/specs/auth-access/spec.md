# Delta for Auth And Access

## ADDED Requirements

### Requirement: Payoff quote and execution authorization

The system MUST authorize payoff quote requests only for actors already allowed to view the target loan. The system MUST authorize payoff execution only for actors already allowed to create a borrower payment for that loan. Actors outside loan scope or payment authority SHALL NOT quote or execute payoff.

#### Scenario: Authorized payoff quote

- GIVEN an authenticated actor with visibility over a loan
- WHEN the actor requests a payoff quote
- THEN the platform SHALL return the quote for that loan only

#### Scenario: Unauthorized payoff execution

- GIVEN an authenticated actor without payment authority for the loan
- WHEN the actor attempts payoff execution
- THEN the platform MUST reject the request
