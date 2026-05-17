# Credits Module

Core financial domain — loan lifecycle, payments, capital prepayment, and amortization.

## Architecture

```
credits/
├── domain/
│   ├── calculation/       # Amortization engine, late fees, policy snapshots
│   ├── loanInvariants.js  # Business rules for valid loan states
│   └── paymentInvariants.js # Allocation integrity constraints
├── application/
│   ├── useCases.js        # Loan CRUD, status transitions
│   ├── paymentApplicationService.js # Payment routing & allocation
│   ├── creditFormulaHelpers.js      # Re-export of calculation module
│   ├── creditPolicyResolver.js      # Rate policy selection at origination
│   ├── creditCalculationService.js  # Service API for /api/loans/calculations
│   ├── loanFinancials.js            # Snapshot & view service
│   └── paymentEligibility.js        # Capital prepayment guards
├── infrastructure/
│   ├── repositories.js    # Sequelize queries
│   └── loanCreation.js    # Orchestrates loan persistence + policy freeze
└── presentation/
    └── router.js          # Express routes for /api/loans
```

## Key Invariants

- Loans freeze `calculationProfileVersionId` + `policySnapshot` at creation.
- Capital prepayment is blocked until first installment is paid and no overdue exists.
- Payment allocation follows: penalty → interest → principal → overpayment.
- All monetary rounding uses `@/modules/shared/money.roundCurrency`.
