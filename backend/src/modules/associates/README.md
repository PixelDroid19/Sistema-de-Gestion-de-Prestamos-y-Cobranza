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
- New associate creation accepts contact data, capital, and interest schedule only; associate returns are tracked through capital, scheduled interest, manual profitability payments, and capital returns.
