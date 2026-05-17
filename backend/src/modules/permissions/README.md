# Permissions Module

Granular permission management for employee role access control.

## Architecture

```
permissions/
├── application/
│   └── useCases.js      # Grant, revoke, list permissions
├── infrastructure/
│   └── repositories.js  # Permission persistence
└── presentation/
    └── router.js        # Express routes for /api/permissions
```

## Key Invariants

- Admin has all permissions by default (seeded at bootstrap).
- Employees start with NO permissions; admins grant explicitly.
- Permission mutation (grant/revoke) is admin-only.
- `/api/permissions/me` is available to any authenticated user.
- Permission names match the catalog in `db/seeds/permissions_catalog.js`.
