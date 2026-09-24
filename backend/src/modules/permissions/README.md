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
- `PUT /api/permissions/user/:userId/direct` atomically grants the current catalog or revokes all direct assignments for one employee. It never changes role-inherited grants and reports only assignments that changed.
- `/api/permissions/me` is available to any authenticated user.
- Permission names match the catalog in `db/seeds/permissions_catalog.js`.
