# Customers Module

Customer record management for the lending platform.

## Architecture

```
customers/
├── application/
│   └── useCases.js      # CRUD, soft-delete, status management
├── infrastructure/
│   └── repositories.js  # Customer persistence with paranoid delete
└── presentation/
    └── router.js        # Express routes for /api/customers
```

## Key Invariants

- Customers use soft-delete (paranoid mode) — `deletedAt` timestamp.
- Customer status: `active`, `inactive`, `blacklisted`.
- Email uniqueness is enforced at DB level.
- Customers are financial domain records, NOT login users.
