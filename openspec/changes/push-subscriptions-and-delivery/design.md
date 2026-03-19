# Design: Push Subscriptions and Delivery

## Technical Approach

Keep `Notification` persistence unchanged as the source of truth, then add best-effort push fanout after a notification row is created successfully. Subscription lifecycle stays inside the existing `notifications` module, while provider adapters live behind a small registry so web push is concrete now and mobile channels can plug in later without changing notification creation callers.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Subscription ownership | Separate table vs embed on `Notification` | Separate `PushSubscription` model tied to `User` | One notification must target many devices; rows remain reusable and do not change notification read contracts. |
| Endpoint placement | New module vs existing notifications module | Add endpoints under `backend/src/modules/notifications` | Current API already owns authenticated notification state, so subscription management belongs beside inbox routes. |
| Delivery timing | Push first, persist later vs persist then fanout | Persist first, then dispatch | Satisfies source-of-truth constraint and keeps inbox behavior correct even if providers fail. |
| Provider seam | Hardcode web push vs registry interface | Registry with `webpush` implementation and optional mobile stubs | Ships web push now without blocking future FCM/APNS-style adapters such as Expo. |

## Data Flow

Sequence diagram:

```text
Caller -> NotificationService.sendNotification
NotificationService -> Notification.create
Notification.create --> NotificationService: persisted row
NotificationService -> PushSubscriptionRepository.listActiveByUser
PushSubscriptionRepository --> NotificationService: active subscriptions
NotificationService -> ProviderRegistry.resolve(providerKey)
ProviderRegistry --> NotificationService: provider
NotificationService -> Provider.send(notification, subscription)
Provider --> NotificationService: delivered | invalid | transient_failure
NotificationService -> PushSubscriptionRepository.recordResult
NotificationService --> Caller: serialized notification
```

Registration flow:
- `POST /api/notifications/subscriptions` validates an authenticated payload, enforces provider/channel compatibility (`webpush` -> `web`, `fcm`/`apns` -> `mobile`), and upserts by `userId + providerKey + endpointHash|tokenHash`.
- `DELETE /api/notifications/subscriptions` accepts provider identity plus the matching endpoint/token fingerprint for that provider family and succeeds even if no active row remains.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/models/PushSubscription.js` | Create | Sequelize model with status, provider, endpoint/token data, and delivery metadata. |
| `backend/src/models/index.js` | Modify | Add `User.hasMany(PushSubscription)` / `PushSubscription.belongsTo(User)`. |
| `backend/src/bootstrap/schema.js` | Modify | Include `PushSubscription` in required schema verification. |
| `backend/src/modules/notifications/application/useCases.js` | Modify | Add register/delete subscription use cases. |
| `backend/src/modules/notifications/infrastructure/repositories.js` | Modify | Add `pushSubscriptionRepository` and wire service dependencies. |
| `backend/src/modules/notifications/presentation/router.js` | Modify | Add authenticated `POST`/`DELETE` subscription routes. |
| `backend/src/modules/notifications/index.js` | Modify | Compose new use cases and repository dependencies. |
| `backend/src/services/NotificationService.js` | Modify | Inject subscription repo + provider registry; dispatch after persistence and mark invalid rows. |
| `backend/src/services/push/providerRegistry.js` | Create | Map provider keys to adapters and no-op unsupported channels. |
| `backend/src/services/push/providers/webPushProvider.js` | Create | Web Push adapter using VAPID config. |

## Interfaces / Contracts

```js
// PushSubscription fields
{
  id, userId,
  providerKey: 'webpush' | 'fcm' | 'apns',
  channel: 'web' | 'mobile',
  endpoint: string | null,
  deviceToken: string | null,
  subscription: JSONB,
  status: 'active' | 'inactive' | 'expired',
  lastDeliveredAt, lastFailureAt, invalidatedAt, failureReason, expiresAt
}
```

```js
provider.send({ notification, subscription })
// => { status: 'delivered' | 'invalid' | 'transient_failure', detail?: string }
```

`NotificationService.sendNotification()` keeps its current return contract. Fanout runs only after a newly persisted notification; dedupe hits return the existing unread row without re-sending.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Register/delete use cases, idempotent matching, invalidation result mapping | `node:test` with repository/provider doubles in `backend/tests/notificationsModule.test.js`. |
| Unit | `NotificationService` persist-then-fanout, dedupe no-resend, invalid subscription deactivation | Extend `backend/tests/notificationService.test.js` with fake provider registry and stub repo. |
| Integration | Router auth, request validation, subscription endpoint contracts | Extend `backend/tests/notificationsRouter.test.js`. |
| Integration | Schema contract includes `PushSubscription` and associations | Extend `backend/tests/schema.test.js` / bootstrap tests. |
| E2E | No automated browser/mobile flow in this phase | Manual API smoke only; frontend/service-worker work is out of scope, so OpenSpec records a checklist rather than a claimed run result. |

### Manual smoke-test procedure

Run these steps manually when validating the change outside the automated test suite:

1. Register a subscription by calling authenticated `POST /api/notifications/subscriptions` with a valid `webpush` + `web` payload and confirm a `201` response plus an active persisted subscription.
2. Delete that subscription by calling authenticated `DELETE /api/notifications/subscriptions` with `providerKey` plus the matching endpoint and confirm a `200` response plus idempotent repeated deletion.
3. Trigger a notification for a user whose push delivery will fail in a controlled way, then confirm the notification is still persisted and visible through the existing notification inbox flow.
4. Check subscription state after failure: permanent invalid/expired responses should deactivate the subscription, while transient failures should leave persistence intact without blocking notification creation.

## Migration / Rollout

No data migration required. `sequelize.sync({ alter: true })` creates the new table, push fanout remains best-effort, and rollout can be gated by configuring `webpush` env vars only where delivery is desired.

## Resolved Decisions

- `DELETE /api/notifications/subscriptions` matches the caller-owned row by provider plus hashed endpoint/token identity so removal stays idempotent without exposing internal identifiers; `webpush` deletes require an endpoint, while mobile deletes require a device token.
- Transient provider failures remain best-effort and update failure metadata only; no retry queue or counter is introduced in this phase.
- Web push uses `WEB_PUSH_VAPID_SUBJECT`, `WEB_PUSH_VAPID_PUBLIC_KEY`, and `WEB_PUSH_VAPID_PRIVATE_KEY`; mobile providers stay pluggable and may later use a concrete provider such as Expo, which will define its own env contract when that adapter lands.
