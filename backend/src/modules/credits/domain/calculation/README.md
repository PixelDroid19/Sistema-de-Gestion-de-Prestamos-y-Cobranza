# Credit Calculation Domain

This folder is the single backend source of truth for credit formulas.

## Runtime Flow

1. The API receives `amount`, `interestRate`, `termMonths`, disbursement `startDate`, optional `firstDueDate`, and late-fee inputs. Without `firstDueDate`, the original one-month schedule remains unchanged. With it, monthly due dates are anchored to the selected first installment; amounts still use the same monthly interest formula.
   Corrections retain paid schedule rows and receipts; `firstDueDate` is the anchor used only to rebuild the unpaid tail. It is stored in the loan's financial snapshot, so existing rows require no schema migration.
2. The application resolves active rate and late-fee policies.
3. The calculation service loads the active `CalculationProfileVersion`.
4. `creditCalculationEngine.calculateCredit()` builds the schedule, summary, policy snapshot, and explanation.
5. Loan creation persists the schedule and `calculationProfileVersionId`.

The retired visual workbench is not part of the runtime calculation path.

## Formulas

### FRENCH

Fixed installment with amortization over outstanding balance. The configured
credit rate is treated as TNA 30/360 to match the client simulator
(`simulador.xlsx`: `Interés equivalente = TNA / pagos por año`).

```text
monthlyRate = TNA / 100 / 12
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

Interest is accumulated monthly from the same TNA 30/360 monthly equivalent and
distributed evenly.

```text
monthlyRate = TNA / 100 / 12
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
