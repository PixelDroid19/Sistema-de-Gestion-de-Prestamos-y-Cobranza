# Core Production Parity Matrix

This matrix records useful operational behavior from the original Coop BYD
systems and the canonical implementation in the current React/Express system.
Legacy architecture, DAG runtime, formula-builder UI, and physical delete flows
are intentionally not ported.

| Original operation | Current canonical route or module | Production decision |
| --- | --- | --- |
| List credits with filters | `GET /api/loans`, `GET /api/loans/search`, `GET /api/reports/credits/excel` | Supported. Excel accepts `customerId`, `loanId`/`creditId`, `startDate`, `endDate`. |
| Create credit | `POST /api/loans` | Supported. Creation resolves the active calculation profile version and persists a policy snapshot. |
| Simulate credit before creation | `POST /api/loans/calculations` | Supported. `/api/loans/simulations` remains out of the product path. |
| View credit detail | `GET /api/loans/:id`, detail tabs under `/api/loans/:id/*` | Supported. Detail exposes calendar, alerts, promises, history, payoff and payment context. |
| Payment schedule | `GET /api/loans/:id/calendar`, `GET /api/reports/payment-schedule/:loanId` | Supported. Used by operations and reports. |
| Installment quote | `GET /api/loans/:id/installments/:number/quote` | Supported. UI must quote before payment. |
| Installment payment | `POST /api/loans/payments/process` | Supported. Uses canonical waterfall, transaction, row lock and idempotency key. |
| Partial payment | `POST /api/payments/partial` | Supported. Uses canonical service, row lock and idempotency key. |
| Capital payment | `POST /api/payments/capital` | Supported. Guarded by mora/status/financial block; configurable payment method keys allowed. |
| Payoff / total debt | `POST /api/loans/:id/payoff-executions`, `POST /api/payments/pay-total-debt` | Supported for authorized backoffice users. Stale quotes are rejected before closing the loan. |
| Annul installment/payment correction | `POST /api/loans/:loanId/installments/:number/annul`, `POST /api/payments/annul/:loanId` | Supported as audited correction. |
| Physical payment delete | None | Rejected. Production uses annulment/correction with audit trail. |
| Edit payment method/reference | `PATCH /api/loans/:loanId/payments/:paymentId`, `PATCH /api/payments/:paymentId/metadata` | Supported for admin when payment is not locked/reconciled. |
| Voucher PDF | `GET /api/payments/:paymentId/voucher/pdf` | Supported from backend. |
| Credit report PDF | `GET /api/reports/credit-history/loan/:loanId/export?format=pdf` | Supported from backend. |
| Credit Excel | `GET /api/reports/credits/excel` | Supported from backend with formula and policy traceability. |
| Payout Excel | `GET /api/reports/payouts/excel` | Supported from backend. Frontend CSV generation is no longer the source of truth. |
| Configuration payment methods | `GET /api/config/payment-methods` | Supported. Payment UIs consume configured method keys with safe fallback values. |
| Customers CRUD and documents | `GET/POST/PATCH/DELETE /api/customers`, `/api/customers/:id/documents` | Supported for admin; customer document reads are scoped by authorization. |
| Associates and investor tracking | `GET/POST/PATCH/DELETE /api/associates`, `/api/associates/:id/*` | Supported for the backoffice. Socios are investor records with capital, interest schedule and payment history; they are not administrative login users. |
| Associate contributions/distributions | `/api/associates/:id/contributions`, `/api/associates/:id/distributions`, `/api/associates/distributions/proportional` | Supported. Proportional distributions use idempotency and validate 100% participation pools. |
| Rate and late-fee policy configuration | `/api/config/rate-policies`, `/api/config/late-fee-policies` | Supported. Credit calculation may resolve policy-backed rates/mora without legacy formula graphs. |
| Users and permissions | `/api/users`, `/api/auth/users`, `/api/permissions/*` | Supported. Admin-only provisioning and permission grants are tested. |
| Audit trail | `/api/audits`, `/api/audits/stats` | Supported. Use case decorators log auditable operations without blocking success if audit logging fails. |
| Notifications | `/api/notifications/*` | Supported. Web push subscription validation is canonical and role-neutral. |

## Concurrency And Idempotency

- HTTP financial mutations require `Idempotency-Key`; lower-level services also protect repeated operations with stable idempotency semantics.
- Mutations run inside serializable transactions with retries for serialization/deadlock failures.
- Loan rows are locked while balances and schedules are mutated.
- Same-key retries return the cached result; different-key concurrent writes serialize through the loan row lock and stale payoff quotes are rejected.

## Removed Legacy Surface

- `/api/reports/file/reports/*` style aliases are not exposed by the current reports router.
- Physical payment deletion is intentionally not exposed.
- Frontend CSV assembly for payouts is replaced by backend Excel export.
- Runtime DAG models, graph execution, graph version FKs, and formula-builder UI are removed from the product path.

## Local Smoke Coverage

- `backend/scripts/localSmokeTest.js` validates public health/OpenAPI and refuses non-local URLs unless `SMOKE_ALLOW_REMOTE=true`.
- With `SMOKE_ADMIN_EMAIL` and `SMOKE_ADMIN_PASSWORD`, it validates admin login, calculation contract, loans, customers, associates, config, permissions, audit stats, reports, and payments list without writing data.
- With `SMOKE_EMPLOYEE_EMAIL` and `SMOKE_EMPLOYEE_PASSWORD`, it validates employee login and permissions lookup.
- With `SMOKE_CUSTOMER_EMAIL`/`SMOKE_CUSTOMER_PASSWORD` and `SMOKE_SOCIO_EMAIL`/`SMOKE_SOCIO_PASSWORD`, it validates those historical login accounts are rejected because customer and socio are domain records, not backoffice users.
