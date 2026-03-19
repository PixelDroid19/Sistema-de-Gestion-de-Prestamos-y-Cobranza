const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createNotificationsRouter } = require('../src/modules/notifications/presentation/router');
const { globalErrorHandler } = require('../src/utils/errorHandler');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const authMiddleware = () => (req, res, next) => {
  if (!req.headers.authorization) {
    res.status(401).json({ success: false, error: { message: 'Authentication failed', statusCode: 401 } });
    return;
  }

  req.user = { id: Number(req.headers['x-test-user-id'] || 8), role: req.headers['x-test-role'] || 'agent' };
  next();
};

const passthroughValidation = {
  registerSubscription(req, res, next) {
    next();
  },
  deleteSubscription(req, res, next) {
    next();
  },
};

test('createNotificationsRouter serves notification contract responses', async () => {
  const calls = [];
  const router = createNotificationsRouter({
    authMiddleware,
    notificationValidation: passthroughValidation,
    useCases: {
      async getNotifications(input) {
        calls.push(['getNotifications', input.actor.id]);
        return {
          success: true,
          data: {
            notifications: [{ id: 5 }],
            unreadCount: 1,
            totalCount: 1,
          },
        };
      },
      async getUnreadCount(input) {
        calls.push(['getUnreadCount', input.actor.id]);
        return { success: true, data: { unreadCount: 1 } };
      },
      async markAsRead(input) {
        calls.push(['markAsRead', input.notificationId]);
        return {
          success: true,
          message: 'Notification marked as read',
          data: { notification: { id: Number(input.notificationId), isRead: true } },
        };
      },
      async markAllAsRead(input) {
        calls.push(['markAllAsRead', input.actor.id]);
        return {
          success: true,
          message: 'All notifications marked as read',
          data: { notifications: [{ id: 5, isRead: true }], count: 1 },
        };
      },
      async clearNotifications(input) {
        calls.push(['clearNotifications', input.actor.id]);
        return { success: true, message: 'All notifications cleared' };
      },
      async registerPushSubscription(input) {
        calls.push(['registerPushSubscription', input.payload.providerKey]);
        return {
          success: true,
          message: 'Push subscription registered',
          data: { subscription: { id: 10, providerKey: input.payload.providerKey } },
        };
      },
      async deletePushSubscription(input) {
        calls.push(['deletePushSubscription', input.payload.providerKey]);
        return {
          success: true,
          message: 'Push subscription removed',
          data: { removed: true },
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const listResponse = await requestJson(activeServer, {
    path: '/',
    headers: { authorization: 'Bearer valid-token', 'x-test-user-id': '8' },
  });
  const unreadResponse = await requestJson(activeServer, {
    path: '/unread-count',
    headers: { authorization: 'Bearer valid-token', 'x-test-user-id': '8' },
  });
  const markReadResponse = await requestJson(activeServer, {
    method: 'PUT',
    path: '/5/read',
    headers: { authorization: 'Bearer valid-token', 'x-test-user-id': '8' },
  });
  const markAllResponse = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/mark-all-read',
    headers: { authorization: 'Bearer valid-token', 'x-test-user-id': '8' },
  });
  const clearResponse = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/clear',
    headers: { authorization: 'Bearer valid-token', 'x-test-user-id': '8' },
  });
  const registerResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/subscriptions',
    headers: { authorization: 'Bearer valid-token', 'x-test-user-id': '8' },
    body: {
      providerKey: 'webpush',
      channel: 'web',
      endpoint: 'https://push.example/sub',
      subscription: { endpoint: 'https://push.example/sub' },
    },
  });
  const deleteResponse = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/subscriptions',
    headers: { authorization: 'Bearer valid-token', 'x-test-user-id': '8' },
    body: {
      providerKey: 'webpush',
      endpoint: 'https://push.example/sub',
    },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.body.data.totalCount, 1);
  assert.equal(unreadResponse.statusCode, 200);
  assert.equal(unreadResponse.body.data.unreadCount, 1);
  assert.equal(markReadResponse.statusCode, 200);
  assert.equal(markReadResponse.body.message, 'Notification marked as read');
  assert.equal(markAllResponse.statusCode, 200);
  assert.equal(markAllResponse.body.data.count, 1);
  assert.equal(clearResponse.statusCode, 200);
  assert.equal(clearResponse.body.message, 'All notifications cleared');
  assert.equal(registerResponse.statusCode, 201);
  assert.equal(registerResponse.body.message, 'Push subscription registered');
  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(deleteResponse.body.message, 'Push subscription removed');
  assert.deepEqual(calls, [
    ['getNotifications', 8],
    ['getUnreadCount', 8],
    ['markAsRead', '5'],
    ['markAllAsRead', 8],
    ['clearNotifications', 8],
    ['registerPushSubscription', 'webpush'],
    ['deletePushSubscription', 'webpush'],
  ]);
});

test('createNotificationsRouter requires authentication', async () => {
  const router = createNotificationsRouter({
    authMiddleware,
    notificationValidation: passthroughValidation,
    useCases: {
      async getNotifications() {
        throw new Error('getNotifications should not be called');
      },
      async getUnreadCount() {
        throw new Error('getUnreadCount should not be called');
      },
      async markAsRead() {
        throw new Error('markAsRead should not be called');
      },
      async markAllAsRead() {
        throw new Error('markAllAsRead should not be called');
      },
      async clearNotifications() {
        throw new Error('clearNotifications should not be called');
      },
      async registerPushSubscription() {
        throw new Error('registerPushSubscription should not be called');
      },
      async deletePushSubscription() {
        throw new Error('deletePushSubscription should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/',
  });

  assert.equal(response.statusCode, 401);
});

test('createNotificationsRouter returns validation failures for malformed subscription payloads', async () => {
  const router = createNotificationsRouter({
    authMiddleware,
    notificationValidation: {
      registerSubscription(req, res, next) {
        const error = new Error('Validation failed');
        error.statusCode = 400;
        next(error);
      },
      deleteSubscription(req, res, next) {
        next();
      },
    },
    useCases: {
      async getNotifications() {
        throw new Error('getNotifications should not be called');
      },
      async getUnreadCount() {
        throw new Error('getUnreadCount should not be called');
      },
      async markAsRead() {
        throw new Error('markAsRead should not be called');
      },
      async markAllAsRead() {
        throw new Error('markAllAsRead should not be called');
      },
      async clearNotifications() {
        throw new Error('clearNotifications should not be called');
      },
      async registerPushSubscription() {
        throw new Error('registerPushSubscription should not be called');
      },
      async deletePushSubscription() {
        throw new Error('deletePushSubscription should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/subscriptions',
    headers: { authorization: 'Bearer valid-token', 'x-test-user-id': '8' },
    body: { providerKey: 'webpush' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
});

test('createNotificationsRouter rejects mismatched provider and channel combinations', async () => {
  const { notificationValidation } = require('../src/middleware/validation');

  const router = createNotificationsRouter({
    authMiddleware,
    notificationValidation,
    useCases: {
      async getNotifications() {
        throw new Error('getNotifications should not be called');
      },
      async getUnreadCount() {
        throw new Error('getUnreadCount should not be called');
      },
      async markAsRead() {
        throw new Error('markAsRead should not be called');
      },
      async markAllAsRead() {
        throw new Error('markAllAsRead should not be called');
      },
      async clearNotifications() {
        throw new Error('clearNotifications should not be called');
      },
      async registerPushSubscription() {
        throw new Error('registerPushSubscription should not be called');
      },
      async deletePushSubscription() {
        throw new Error('deletePushSubscription should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/subscriptions',
    headers: { authorization: 'Bearer valid-token', 'x-test-user-id': '8' },
    body: {
      providerKey: 'webpush',
      channel: 'mobile',
      deviceToken: 'device-token',
      subscription: {},
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(JSON.stringify(response.body.error.validationErrors), /webpush subscriptions must use the web channel/);
});

test('createNotificationsRouter rejects mobile subscription registration without deviceToken', async () => {
  const { notificationValidation } = require('../src/middleware/validation');

  const router = createNotificationsRouter({
    authMiddleware,
    notificationValidation,
    useCases: {
      async getNotifications() {
        throw new Error('getNotifications should not be called');
      },
      async getUnreadCount() {
        throw new Error('getUnreadCount should not be called');
      },
      async markAsRead() {
        throw new Error('markAsRead should not be called');
      },
      async markAllAsRead() {
        throw new Error('markAllAsRead should not be called');
      },
      async clearNotifications() {
        throw new Error('clearNotifications should not be called');
      },
      async registerPushSubscription() {
        throw new Error('registerPushSubscription should not be called');
      },
      async deletePushSubscription() {
        throw new Error('deletePushSubscription should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/subscriptions',
    headers: { authorization: 'Bearer valid-token', 'x-test-user-id': '8' },
    body: {
      providerKey: 'fcm',
      channel: 'mobile',
      subscription: {},
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(JSON.stringify(response.body.error.validationErrors), /Mobile subscriptions require a deviceToken/);
});

test('createNotificationsRouter rejects webpush deletion without endpoint identifier', async () => {
  const { notificationValidation } = require('../src/middleware/validation');

  const router = createNotificationsRouter({
    authMiddleware,
    notificationValidation,
    useCases: {
      async getNotifications() {
        throw new Error('getNotifications should not be called');
      },
      async getUnreadCount() {
        throw new Error('getUnreadCount should not be called');
      },
      async markAsRead() {
        throw new Error('markAsRead should not be called');
      },
      async markAllAsRead() {
        throw new Error('markAllAsRead should not be called');
      },
      async clearNotifications() {
        throw new Error('clearNotifications should not be called');
      },
      async registerPushSubscription() {
        throw new Error('registerPushSubscription should not be called');
      },
      async deletePushSubscription() {
        throw new Error('deletePushSubscription should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/subscriptions',
    headers: { authorization: 'Bearer valid-token', 'x-test-user-id': '8' },
    body: {
      providerKey: 'webpush',
      deviceToken: 'device-token',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(JSON.stringify(response.body.error.validationErrors), /webpush subscriptions require an endpoint identifier/);
});
