const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthorizationError, NotFoundError } = require('../src/utils/errorHandler');
const {
  createGetNotifications,
  createMarkAsRead,
  createMarkAllAsRead,
  createGetUnreadCount,
  createClearNotifications,
} = require('../src/modules/notifications/application/useCases');

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

  const result = await getNotifications({ actor: { id: 8, role: 'agent' } });

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

  await assert.rejects(() => markAsRead({ actor: { id: 8, role: 'agent' }, notificationId: '9' }), (error) => {
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

  await assert.rejects(() => markAsRead({ actor: { id: 8, role: 'agent' }, notificationId: '88' }), (error) => {
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

  const marked = await markAllAsRead({ actor: { id: 8, role: 'agent' } });
  const unread = await getUnreadCount({ actor: { id: 8, role: 'agent' } });
  const cleared = await clearNotifications({ actor: { id: 8, role: 'agent' } });

  assert.equal(marked.data.count, 2);
  assert.equal(unread.data.unreadCount, 4);
  assert.deepEqual(cleared, { success: true, message: 'All notifications cleared' });
});
