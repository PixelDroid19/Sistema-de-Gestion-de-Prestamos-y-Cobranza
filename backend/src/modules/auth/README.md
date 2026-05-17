# Auth Module

Authentication, token management, and session lifecycle.

## Architecture

```
auth/
├── application/
│   └── useCases.js      # Login, register, refresh, password reset
├── infrastructure/
│   └── repositories.js  # User/token persistence
└── presentation/
    └── router.js        # Express routes for /api/auth
```

## Key Invariants

- Only `admin` and `employee` roles can authenticate into the backoffice.
- JWT access tokens are short-lived; refresh tokens persist in `sessionStorage`.
- Login is rate-limited per IP and per account (brute-force protection).
- Password hashing uses bcrypt with configurable rounds.
- Admin user registration is admin-only (no public self-registration).
