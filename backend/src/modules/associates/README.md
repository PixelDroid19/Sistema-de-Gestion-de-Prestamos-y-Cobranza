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
- New associate creation records the agreed investment term (1–120 months) and its derived maturity date. With initial capital, the system schedules every monthly return through that maturity; it never creates an extra payment after the agreed term.
- The agreed term is immutable after creation. Historical associates without a term retain their pre-existing rolling-payment behavior instead of receiving an invented contract duration.
- Associate returns are tracked through capital, scheduled interest, manual profitability payments, and capital returns.
