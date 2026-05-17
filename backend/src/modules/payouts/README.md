# Payouts Module

Payment disbursement management and voucher generation.

## Architecture

```
payouts/
├── domain/
│   └── services/
│       └── VoucherService.js  # PDF voucher generation
├── application/
│   └── useCases.js            # Payout CRUD and workflow
├── infrastructure/
│   └── repositories.js        # Payout persistence
└── presentation/
    └── router.js              # Express routes for /api/payouts (capital payments)
```

## Key Invariants

- Payouts route through the payment application service for allocation.
- Vouchers are user-facing documents (Spanish labels are intentional).
- Capital prepayment eligibility is enforced before execution.
