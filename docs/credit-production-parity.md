# Credit, Payment And Report Production Parity

This matrix records the useful operational behavior reviewed from the original
credit system and the canonical implementation in the current React/Express
system. Legacy architecture and physical delete flows are intentionally not
ported.

| Original operation | Current canonical route or module | Production decision |
| --- | --- | --- |
| List credits with filters | `GET /api/loans`, `GET /api/loans/search`, `GET /api/reports/credits/excel` | Supported. Excel accepts `customerId`, `loanId`/`creditId`, `startDate`, `endDate`. |
| Create credit | `POST /api/loans` | Supported. Creation must resolve and persist active DAG version and formula/policy snapshot. |
| Simulate credit before creation | `POST /api/loans/calculations` | Supported. `/api/loans/simulations` remains out of the product path. |
| View credit detail | `GET /api/loans/:id`, detail tabs under `/api/loans/:id/*` | Supported. Detail exposes calendar, alerts, promises, history, payoff and payment context. |
| Payment schedule | `GET /api/loans/:id/calendar`, `GET /api/reports/payment-schedule/:loanId` | Supported. Used by operations and reports. |
| Installment quote | `GET /api/loans/:id/installments/:number/quote` | Supported. UI must quote before payment. |
| Installment payment | `POST /api/loans/payments/process` | Supported. Uses canonical waterfall, transaction, row lock and idempotency key. |
| Partial payment | `POST /api/payments/partial` | Supported. Uses canonical service, row lock and idempotency key. |
| Capital payment | `POST /api/payments/capital` | Supported. Guarded by mora/status/financial block; configurable payment method keys allowed. |
| Payoff / total debt | `POST /api/loans/:id/payoff-executions`, `POST /api/payments/pay-total-debt` | Supported for admin and customer. Stale quotes are rejected before closing the loan. |
| Annul installment/payment correction | `POST /api/loans/:loanId/installments/:number/annul`, `POST /api/payments/annul/:loanId` | Supported as audited correction. |
| Physical payment delete | None | Rejected. Production uses annulment/correction with audit trail. |
| Edit payment method/reference | `PATCH /api/loans/:loanId/payments/:paymentId`, `PATCH /api/payments/:paymentId/metadata` | Supported for admin when payment is not locked/reconciled. |
| Voucher PDF | `GET /api/payments/:paymentId/voucher/pdf` | Supported from backend. |
| Credit report PDF | `GET /api/reports/credit-history/loan/:loanId/export?format=pdf` | Supported from backend. |
| Credit Excel | `GET /api/reports/credits/excel` | Supported from backend with formula and policy traceability. |
| Payout Excel | `GET /api/reports/payouts/excel` | Supported from backend. Frontend CSV generation is no longer the source of truth. |
| Configuration payment methods | `GET /api/config/payment-methods` | Supported. Payment UIs consume configured method keys with safe fallback values. |

## Concurrency And Idempotency

- Payment mutations accept `Idempotency-Key`; if omitted, the service builds a stable key from loan, operation type, amount, date and operation details.
- Mutations run inside serializable transactions with retries for serialization/deadlock failures.
- Loan rows are locked while balances and schedules are mutated.
- Same-key retries return the cached result; different-key concurrent writes serialize through the loan row lock and stale payoff quotes are rejected.

## Removed Legacy Surface

- `/api/reports/file/reports/*` style aliases are not exposed by the current reports router.
- Physical payment deletion is intentionally not exposed.
- Frontend CSV assembly for payouts is replaced by backend Excel export.
