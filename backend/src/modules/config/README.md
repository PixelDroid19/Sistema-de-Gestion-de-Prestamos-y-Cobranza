# Config Module

Operational configuration — rate policies, late-fee policies, payment methods, and system settings.

## Architecture

```
config/
├── application/
│   └── useCases.js      # CRUD for policies and settings
├── infrastructure/
│   └── repositories.js  # Config persistence
└── presentation/
    └── router.js        # Express routes for /api/config
```

## Key Invariants

- Rate policies are admin-only. Employees cannot create/update/delete.
- Active rate policies cannot have overlapping amount ranges.
- If a loan amount falls in an uncovered gap, origination fails until an active rate policy covers that amount.
- Policy changes do NOT retroactively affect existing loans (snapshot-at-origination).
- Public `/roles` endpoint is unauthenticated; all other routes require admin.
