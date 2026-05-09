# Credit Calculation Domain

This folder is the single backend source of truth for credit formulas.

## Runtime Flow

1. The API receives `amount`, `interestRate`, `termMonths`, `startDate`, and late-fee inputs.
2. The application resolves active rate and late-fee policies.
3. The calculation service loads the active `CalculationProfileVersion`.
4. `creditCalculationEngine.calculateCredit()` builds the schedule, summary, policy snapshot, and explanation.
5. Loan creation persists the schedule and `calculationProfileVersionId`.

The retired visual workbench is not part of the runtime calculation path.

## Formulas

### FRENCH

Fixed installment with amortization over outstanding balance.

```text
monthlyRate = annualRate / 100 / 12
installment = principal * monthlyRate * (1 + monthlyRate)^term / ((1 + monthlyRate)^term - 1)
```

If `monthlyRate` is zero:

```text
installment = principal / term
```

### SIMPLE

Interest is calculated over the initial principal and distributed evenly.

```text
totalInterest = principal * annualRate * (termMonths / 12)
installment = (principal + totalInterest) / termMonths
```

### COMPOUND

Interest is accumulated monthly and distributed evenly.

```text
monthlyRate = annualRate / 100 / 12
totalInterest = principal * ((1 + monthlyRate)^termMonths - 1)
installment = (principal + totalInterest) / termMonths
```

## Late Fees

`NONE` returns zero. `SIMPLE`, `COMPOUND`, `FLAT`, and `TIERED` are implemented in `lateFeeCalculator.js`.

## How To Change A Formula

1. Change the formula implementation in this folder.
2. Add or update a `CalculationProfileVersion` seed if the behavior changes for new credits.
3. Update unit tests with expected numeric examples.
4. Update this README with the client-facing explanation.
5. Run backend tests and frontend typecheck before deployment.

Existing loans keep their persisted schedule and policy snapshot. Do not recalculate old loans unless a dedicated migration is approved.
