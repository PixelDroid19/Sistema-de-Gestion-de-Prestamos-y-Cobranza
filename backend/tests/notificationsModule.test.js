const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthorizationError, NotFoundError } = require('../src/utils/errorHandler');
const {
  createGetNotifications,
  createMarkAsRead,
  createMarkAllAsRead,
  createGetUnreadCount,
  createClearNotifications,
  createRegisterPushSubscription,
  createDeletePushSubscription,
} = require('../src/modules/notifications/application/useCases');
const { createNotificationsModule } = require('../src/modules/notifications');

test('createGetNotifications aggregates unread and total counts', async () => {
  const getNotifications = createGetNotifications({
    notificationRepository: {
      async getNotifications() {
        return [{ id: 4 }, { id: 5 }];
      },
      async getUnreadCount() {
        return 1;
      },
    },
  });

  const result = await getNotifications({ actor: { id: 8, role: 'admin' } });

  assert.equal(result.data.totalCount, 2);
  assert.equal(result.data.unreadCount, 1);
});

test('createMarkAsRead verifies ownership before mutation', async () => {
  let markAsReadCalled = false;
  const markAsRead = createMarkAsRead({
    notificationRepository: {
      async findById() {
        return { id: 9, userId: 77, isRead: false };
      },
      async markAsRead() {
        markAsReadCalled = true;
        return { id: 9, userId: 77, isRead: true };
      },
    },
  });

  await assert.rejects(() => markAsRead({ actor: { id: 8, role: 'admin' }, notificationId: '9' }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    return true;
  });
  assert.equal(markAsReadCalled, false);
});

test('createMarkAsRead rejects when the notification does not exist', async () => {
  const markAsRead = createMarkAsRead({
    notificationRepository: {
      async findById() {
        return null;
      },
      async markAsRead() {
        throw new Error('markAsRead should not be called');
      },
    },
  });

  await assert.rejects(() => markAsRead({ actor: { id: 8, role: 'admin' }, notificationId: '88' }), (error) => {
    assert.ok(error instanceof NotFoundError);
    return true;
  });
});

test('notification use cases preserve count-based contracts', async () => {
  const notifications = [{ id: 1 }, { id: 2 }];
  const markAllAsRead = createMarkAllAsRead({
    notificationRepository: {
      async markAllAsRead() {
        return notifications;
      },
    },
  });
  const getUnreadCount = createGetUnreadCount({
    notificationRepository: {
      async getUnreadCount() {
        return 4;
      },
    },
  });
  const clearNotifications = createClearNotifications({
    notificationRepository: {
      async clearNotifications(userId) {
        return userId;
      },
    },
  });

  const marked = await markAllAsRead({ actor: { id: 8, role: 'admin' } });
  const unread = await getUnreadCount({ actor: { id: 8, role: 'admin' } });
  const cleared = await clearNotifications({ actor: { id: 8, role: 'admin' } });

  assert.equal(marked.data.count, 2);
  assert.equal(unread.data.unreadCount, 4);
  assert.deepEqual(cleared, { success: true, message: 'All notifications cleared' });
});

test('createGetNotifications preserves persisted payload fields for frontend compatibility', async () => {
  const getNotifications = createGetNotifications({
    notificationRepository: {
      async getNotifications() {
        return [{ id: 4, payload: { loanId: 12 }, data: { loanId: 12 }, isRead: false }];
      },
      async getUnreadCount() {
        return 1;
      },
    },
  });

  const result = await getNotifications({ actor: { id: 8, role: 'admin' } });

  assert.equal(result.data.notifications[0].data.loanId, 12);
  assert.equal(result.data.notifications[0].payload.loanId, 12);
});

test('createRegisterPushSubscription upserts an actor-owned subscription', async () => {
  const registerPushSubscription = createRegisterPushSubscription({
    pushSubscriptionRepository: {
      async upsert(payload) {
        return { id: 4, ...payload, status: 'active' };
      },
    },
  });

  const result = await registerPushSubscription({
    actor: { id: 8, role: 'admin' },
    payload: {
      providerKey: 'webpush',
      channel: 'web',
      endpoint: 'https://push.example/sub',
      subscription: { endpoint: 'https://push.example/sub' },
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.subscription.userId, 8);
  assert.equal(result.data.subscription.providerKey, 'webpush');
});

test('createDeletePushSubscription is idempotent when a subscription is already gone', async () => {
  const deletePushSubscription = createDeletePushSubscription({
    pushSubscriptionRepository: {
      async deactivate(payload) {
        assert.equal(payload.userId, 8);
        return false;
      },
    },
  });

  const result = await deletePushSubscription({
    actor: { id: 8, role: 'admin' },
    payload: {
      providerKey: 'webpush',
      endpoint: 'https://push.example/sub',
    },
  });

  assert.deepEqual(result, {
    success: true,
    message: 'Push subscription removed',
    data: { removed: false },
  });
});

test('push subscription use cases reject payloads without endpoint or device token', async () => {
  const registerPushSubscription = createRegisterPushSubscription({
    pushSubscriptionRepository: {
      async upsert() {
        throw new Error('upsert should not be called');
      },
    },
  });

  await assert.rejects(() => registerPushSubscription({
    actor: { id: 8, role: 'admin' },
    payload: {
      providerKey: 'fcm',
      channel: 'mobile',
    },
  }), /Subscription endpoint or device token is required/);
});

test('createNotificationsModule publishes notification ports to the shared runtime', () => {
  let registeredName;
  let registeredPorts;

  const moduleRegistration = createNotificationsModule({
    sharedRuntime: {
      authContext: {
        tokenService: { sign() {}, verify() {} },
        authMiddleware() {
          return (req, res, next) => next();
        },
      },
      notificationService: { sendNotification() {} },
      registerModulePorts(name, ports) {
        registeredName = name;
        registeredPorts = ports;
      },
      getModulePorts() {
        return null;
      },
    },
  });

  assert.equal(moduleRegistration.basePath, '/api/notifications');
  assert.equal(registeredName, 'notifications');
  assert.equal(typeof registeredPorts.notificationService.sendNotification, 'function');
});
