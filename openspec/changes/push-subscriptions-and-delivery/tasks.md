# Tasks: Push Subscriptions and Delivery

## Phase 1: Foundation and config

- [x] 1.1 Create `backend/src/models/PushSubscription.js`, add associations in `backend/src/models/index.js`, and register the model in `backend/src/bootstrap/schema.js`.
- [x] 1.2 Add push provider scaffolding in `backend/src/services/push/providerRegistry.js` and `backend/src/services/push/providers/webPushProvider.js` with stable `delivered | invalid | transient_failure` results.
- [x] 1.3 Add runtime config for web push by updating `backend/package.json` dependencies and documenting required VAPID env vars in `backend/.env.example`.

## Phase 2: Subscription management API

- [x] 2.1 Extend `backend/src/modules/notifications/infrastructure/repositories.js` with `pushSubscriptionRepository` methods for upsert, deactivate, listActiveByUser, and delivery result recording.
- [x] 2.2 Add register/delete subscription use cases in `backend/src/modules/notifications/application/useCases.js`, including idempotent matching by provider and endpoint/token fingerprint.
- [x] 2.3 Update `backend/src/modules/notifications/presentation/router.js` and `backend/src/modules/notifications/index.js` to expose authenticated `POST` and `DELETE /api/notifications/subscriptions` endpoints.

## Phase 3: Notification delivery fanout

- [x] 3.1 Update `backend/src/services/NotificationService.js` to inject the subscription repo and provider registry, persist notifications first, and skip push fanout on dedupe hits.
- [x] 3.2 Implement delivery result handling in `backend/src/services/NotificationService.js` and `backend/src/modules/notifications/infrastructure/repositories.js` to mark invalid/expired subscriptions inactive and keep transient failures best-effort.
- [x] 3.3 Finalize unresolved delivery contract details in `openspec/changes/push-subscriptions-and-delivery/design.md` for delete matching and env var naming before closing implementation.

## Phase 4: Tests and verification

- [x] 4.1 Extend `backend/tests/notificationsModule.test.js` and `backend/tests/notificationsRouter.test.js` for authenticated register/delete flows, validation failures, and idempotent removal.
- [x] 4.2 Extend `backend/tests/notificationService.test.js` for persist-then-fanout, web push delivery, unsupported mobile skip, invalidation, and transient failure scenarios.
- [x] 4.3 Extend `backend/tests/schema.test.js` and/or `backend/tests/bootstrap.test.js` to verify `PushSubscription` schema registration, user associations, and bootstrap readiness.
- [ ] 4.4 Run `cd backend && npm test` and a manual API smoke check for subscription register/delete plus persisted-notification delivery fallback.

## Manual smoke-test checklist

Use this checklist when a person is ready to validate the change in a non-test environment. This documents the procedure only; it does not claim the smoke test already ran.

### Preconditions

- Start the backend with authentication enabled and a reachable database.
- Use a real authenticated user that can call `/api/notifications/subscriptions`.
- For web push registration, prepare a valid browser `PushSubscription` JSON payload and its `endpoint`.
- For fallback validation, ensure the chosen user can also receive persistent notifications through the existing inbox/read endpoints.

### 1. Register a push subscription

- Send `POST /api/notifications/subscriptions` with an authenticated user and a valid payload such as `providerKey: webpush`, `channel: web`, `endpoint`, and `subscription`.
- Confirm the API returns `201` with `Push subscription registered`.
- Confirm the subscription is persisted as active for that user.
- Optional negative check: send `providerKey: webpush` with `channel: mobile` and confirm the API rejects it with a validation error.

### 2. Delete a push subscription

- Send `DELETE /api/notifications/subscriptions` with the same authenticated user, `providerKey: webpush`, and the registered `endpoint`.
- Confirm the API returns `200` with `Push subscription removed`.
- Confirm the matching subscription is no longer active for that user.
- Repeat the same delete request and confirm it still succeeds idempotently instead of failing because the row is already inactive or absent.

### 3. Confirm persistent notifications survive push failure

- Register at least one push subscription for a test user, then force push delivery to fail in a controlled way (for example, use an invalid/expired web push subscription, disable the web push provider config, or point the test at a subscription that the provider rejects).
- Trigger any backend flow that creates a notification for that same user.
- Confirm the notification still appears through the existing persistent notifications API/inbox flow even though push delivery fails.
- If the provider reports a permanent invalid/expired subscription, confirm the subscription is marked inactive; if the failure is transient, confirm the notification is still persisted without blocking the request.

> Status note: repository tests cover the implemented backend behavior and prior verification recorded `cd backend && npm test` as passing, but this change set does not yet include evidence that the manual smoke checklist above was executed, so task `4.4` remains open until someone records that run.
