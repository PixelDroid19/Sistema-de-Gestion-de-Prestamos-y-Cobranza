# Reports Module

Read-only operational reporting and export generation for the credit business.
This module is intentionally scoped to credit operations: portfolio, payments,
disbursements, cashflow, expenses, movements, and payment schedules.

## Architecture

```
reports/
├── application/
│   ├── useCases.js         # Portfolio, cashflow, payouts, schedule, and export use cases
│   ├── useCases/           # Extracted report/export use cases
│   ├── reportHelpers.js    # Authorization & date range utilities
│   ├── reportInternals.js  # PDF/CSV builders, credit timelines, row helpers
│   └── workbookBuilder.js  # Excel workbook generation (ExcelJS)
├── infrastructure/         # Report-specific DB queries
└── presentation/
    └── router.js           # Express routes for /api/reports
```

## Key Invariants

- Reports never mutate data — all use cases are read-only.
- Report totals derive from canonical loan/payment data, never frontend calculations.
- Exports use Spanish operational headers for user-facing output.
- Only `admin` and `employee` roles can access reports (enforced by `ensureAdmin`).
- Investor-associate reporting stays in the associates module. Do not add
  socio capital, obligations, manual profitability payments, or interest-payment
  tracking to `/api/reports`; use `/api/associates` report/export routes instead.
