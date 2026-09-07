# Associates Module

Investor/socio management — capital contributions, scheduled interest, manual profitability payments, capital returns, and movements.

## Architecture

```
associates/
├── application/
│   └── useCases.js           # CRUD, interest payments, manual profitability payments, movements
├── infrastructure/
│   └── repositories.js       # Sequelize queries for associates & related models
└── presentation/
    └── router.js             # Express routes for /api/associates
```

## Key Invariants

- Socios are investor records, NOT administrative login users.
- Interest calculations use `@/modules/shared/money.roundCurrency` for consistency.
- Monthly interest is summed across contribution rate snapshots before rounding the installment to cents; splitting capital across contributions must not increase or reduce the total through repeated rounding. Reprojection does not rewrite paid installments.
- Capital returns are allocated only to contributions available on the return's operational date. Same-day records use creation time to preserve ordering: a later reinvestment must not absorb an earlier return or resurrect capital carrying an old rate. Undated historical rows retain date-agnostic allocation because their order cannot be established.
- New associate creation records the agreed investment term (1–120 months) and its derived maturity date. With initial capital, the system schedules every monthly return through that maturity; it never creates an extra payment after the agreed term.
- The agreed term is immutable after creation. Historical associates without a term retain their pre-existing rolling-payment behavior instead of receiving an invented contract duration.
- Associate returns are tracked through capital, scheduled interest, manual profitability payments, and capital returns.
- A paid interest installment is terminal. The database status update excludes paid rows, so concurrent payments or stale overdue updates cannot replace its payment date, operator, or method. A payment that loses this race is rejected rather than reported as successful.
- Contribution requests can provide `Idempotency-Key` (8–160 characters). Within an associate, the same key and normalized payload return the original contribution; a changed payload or actor is rejected. The receipt, contribution, and projected interest calendar commit together under the associate row lock, including concurrent replays. An omitted date is resolved only for the first execution. Requests without a key represent independent contributions and do not receive replay protection.
