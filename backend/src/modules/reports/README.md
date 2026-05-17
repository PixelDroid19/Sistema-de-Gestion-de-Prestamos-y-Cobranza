# Reports Module

Read-only reporting, analytics, and export generation.

## Architecture

```
reports/
├── application/
│   ├── useCases.js         # Legacy portfolio/recovery/customer reports
│   ├── useCases/           # Extracted analytics & export use cases
│   ├── reportHelpers.js    # Authorization & date range utilities
│   ├── reportInternals.js  # PDF/CSV builders, profitability helpers, timeline
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
