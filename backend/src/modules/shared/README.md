# Shared Module

Cross-cutting infrastructure reused by all feature modules.

## Contents

| File | Purpose |
|------|---------|
| `money.js` | Currency rounding, formatting, precision checks |
| `validators.js` | Domain validation primitives (email, phone, amount, dates) |
| `transactions.js` | Sequelize transaction wrapper |
| `pagination.js` | Query pagination parsing and response meta |
| `auth.js` + `auth/` | Auth middleware factory and token service |
| `roles.js` | Administrative login role constants |
| `errors.js` | Application error mapping |
| `http.js` | Express response helpers (`respond`, `success`, `created`) |
| `contracts.js` | Module composition factory (`createModule`) |
| `loanAccessPolicy.js` | Row-level loan visibility rules |
| `requestContext.js` | AsyncLocalStorage-based request context |
| `documentOperations.js` | Shared document attachment operations |

## Invariants

- **No business logic here.** Only infrastructure and cross-cutting concerns.
- Modules import from `@/modules/shared/<file>` or `@/modules/shared` (barrel).
- If a utility is specific to ONE module, it belongs in that module's `domain/` or `application/` layer.
