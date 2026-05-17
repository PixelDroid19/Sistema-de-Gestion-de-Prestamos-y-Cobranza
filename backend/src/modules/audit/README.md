# Audit Module

Immutable audit trail for all significant business operations.

## Architecture

```
audit/
├── domain/
│   └── auditEvent.js       # Audit event schema and creation
├── application/
│   ├── auditService.js     # Audit logging service
│   └── auditDecorator.js   # `withAudit` higher-order function
├── infrastructure/
│   └── repositories.js     # AuditLog persistence
└── presentation/
    └── router.js           # Express routes for /api/audits
```

## Key Invariants

- Audit logs are append-only — never updated or deleted.
- The `withAudit` decorator wraps use cases to auto-log operations.
- Audit entries capture: actor, action, entity, before/after state, metadata.
- Only `admin` can view the audit trail via API.
