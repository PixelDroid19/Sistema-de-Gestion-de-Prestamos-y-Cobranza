# Associates Module

Investor/socio management — capital contributions, interest, distributions, and movements.

## Architecture

```
associates/
├── application/
│   └── useCases.js           # CRUD, interest payments, distributions, movements
├── infrastructure/
│   └── repositories.js       # Sequelize queries for associates & related models
└── presentation/
    └── router.js             # Express routes for /api/associates
```

## Key Invariants

- Socios are investor records, NOT administrative login users.
- Interest calculations use `@/modules/shared/money.roundCurrency` for consistency.
- Proportional distributions enforce idempotency via `idempotencyKey`.
- Participation percentages have 4-decimal precision (0-100 range).
- Only `admin` can set `participationPercentage`.
