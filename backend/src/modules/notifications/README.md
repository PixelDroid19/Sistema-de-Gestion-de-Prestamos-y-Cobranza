# Notifications Module

Push notifications, email delivery, and in-app notification management.

## Architecture

```
notifications/
├── application/
│   ├── useCases.js           # CRUD for notifications, push subscriptions
│   └── notificationService.js # Delivery orchestration (push + email)
├── infrastructure/
│   ├── repositories.js       # Notification & subscription persistence
│   ├── email/providers/      # Resend email provider
│   └── push/
│       ├── providerRegistry.js  # Multi-provider dispatch
│       └── providers/           # WebPush, FCM, APNs providers
├── presentation/
│   └── router.js             # Express routes for /api/notifications
└── public.js                 # Public ports for other modules
```

## Key Invariants

- Notification delivery is best-effort (transient failures are logged, not thrown).
- Push subscriptions are per-user, per-device, per-provider.
- Email eligibility is gated by notification type (not all types send email).
- Provider configuration is environment-driven (VAPID keys, Resend API key).
