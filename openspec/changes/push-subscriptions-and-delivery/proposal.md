# Proposal: Push Subscriptions and Delivery

## Intent

Extend persistent notifications with optional push delivery so authenticated users can receive timely alerts without changing `Notification` as the source of truth.

## Scope

### In Scope
- Add a `PushSubscription` persistence model/table tied to users, provider kind, endpoint/token, capabilities, and delivery status metadata.
- Add authenticated notifications endpoints to register and delete subscriptions.
- Extend `NotificationService` so stored notifications can fan out to push providers after persistence succeeds.
- Handle invalid, expired, or rejected subscriptions by marking them inactive and avoiding repeated failed sends.
- Introduce an extensible provider seam that supports web push now and mobile push providers later, including a future Expo-backed mobile adapter if desired.

### Out of Scope
- Client-side permission prompts, service worker UX, or mobile SDK integration.
- Replacing the current in-app notifications API or making push delivery required for notification creation.

## Approach

Keep notification creation unchanged at the domain boundary: persist first, then dispatch best-effort push through a provider registry. Model subscriptions separately from notifications so one notification can target many user devices. Start with a web push provider adapter and a provider contract for future mobile implementations, including an Expo-style provider if mobile delivery is added later.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/models/PushSubscription.js` | New | Subscription persistence model and status fields |
| `backend/src/models/index.js` | Modified | User associations for push subscriptions |
| `backend/src/modules/notifications/presentation/router.js` | Modified | Authenticated register/delete endpoints |
| `backend/src/modules/notifications/application/useCases.js` | Modified | Subscription management use cases |
| `backend/src/modules/notifications/infrastructure/repositories.js` | Modified | Subscription repository and delivery wiring |
| `backend/src/services/NotificationService.js` | Modified | Persist-then-dispatch orchestration and provider seam |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Push failures slow notification writes | Med | Keep delivery best-effort and decouple from persistence result |
| Stale subscriptions cause noisy retries | High | Record failures and deactivate invalid subscriptions |
| Mobile design blocks backend rollout | Med | Keep provider contract generic; ship web push first |

## Rollback Plan

Disable push dispatch in `NotificationService`, stop exposing subscription endpoints, and ignore `PushSubscription` records while retaining persisted notifications unchanged.

## Dependencies

- Web push library/config for VAPID-based delivery.
- Existing authenticated notifications module and `User` relationships.

## Success Criteria

- [ ] Backend can register and delete authenticated push subscriptions without changing notification reads.
- [ ] New notifications persist even when push delivery fails.
- [ ] Invalid subscriptions are marked inactive after provider rejection.
- [ ] Provider abstraction supports web push immediately and mobile adapters later.
