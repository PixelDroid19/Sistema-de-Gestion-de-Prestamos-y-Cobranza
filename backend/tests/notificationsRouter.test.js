const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createNotificationsRouter } = require('@/modules/notifications/presentation/router');
const { globalErrorHandler } = require('@/utils/errorHandler');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const authMiddleware = () => (req, res, next) => {
  if (!req.headers.authorization) {
    res.status(401).json({ success: false, error: { message: 'La autenticación es requerida.', statusCode: 401 } });
    return;
  }

  req.user = { id: Number(req.headers['x-test-user-id'] || 8), role: req.headers['x-test-role'] || 'admin' };
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
          message: 'Notificación marcada como leída',
          data: { notification: { id: Number(input.notificationId), isRead: true } },
        };
      },
      async markAllAsRead(input) {
        calls.push(['markAllAsRead', input.actor.id]);
        return {
          success: true,
          message: 'Todas las notificaciones fueron marcadas como leídas',
          data: { notifications: [{ id: 5, isRead: true }], count: 1 },
        };
      },
      async clearNotifications(input) {
        calls.push(['clearNotifications', input.actor.id]);
        return { success: true, message: 'Notificaciones eliminadas correctamente' };
      },
      async registerPushSubscription(input) {
        calls.push(['registerPushSubscription', input.payload.providerKey]);
        return {
          success: true,
          message: 'Suscripción de notificaciones registrada correctamente',
          data: { subscription: { id: 10, providerKey: input.payload.providerKey } },
        };
      },
      async deletePushSubscription(input) {
        calls.push(['deletePushSubscription', input.payload.providerKey]);
        return {
          success: true,
          message: 'Suscripción de notificaciones eliminada correctamente',
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
  assert.equal(markReadResponse.body.message, 'Notificación marcada como leída');
  assert.equal(markAllResponse.statusCode, 200);
  assert.equal(markAllResponse.body.data.count, 1);
  assert.equal(clearResponse.statusCode, 200);
  assert.equal(clearResponse.body.message, 'Notificaciones eliminadas correctamente');
  assert.equal(registerResponse.statusCode, 201);
  assert.equal(registerResponse.body.message, 'Suscripción de notificaciones registrada correctamente');
  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(deleteResponse.body.message, 'Suscripción de notificaciones eliminada correctamente');
  assert.deepEqual(calls, [
    ['getNotifications', 8],
    ['getUnreadCount', 8],
    ['markAsRead', 5],
    ['markAllAsRead', 8],
    ['clearNotifications', 8],
    ['registerPushSubscription', 'webpush'],
    ['deletePushSubscription', 'webpush'],
  ]);
});

test('createNotificationsRouter rejects malformed notification identifiers before marking read', async () => {
  const calls = [];
  const router = createNotificationsRouter({
    authMiddleware,
    notificationValidation: passthroughValidation,
    useCases: {
      async markAsRead(input) {
        calls.push(['markAsRead', input.notificationId]);
        return {
          success: true,
          data: { notification: { id: Number(input.notificationId), isRead: true } },
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message },
    });
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'PUT',
    path: '/1e2/read',
    headers: { authorization: 'Bearer valid-token', 'x-test-user-id': '8' },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error.message, /número de la notificación/i);
  assert.deepEqual(calls, []);
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
        const error = new Error('La validación falló');
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
  const { notificationValidation } = require('@/middleware/validation');

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
  assert.match(JSON.stringify(response.body.error.validationErrors), /deben usar el canal web/);
});

test('createNotificationsRouter rejects unsupported mobile providers during subscription registration', async () => {
  const { notificationValidation } = require('@/middleware/validation');

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
  assert.match(JSON.stringify(response.body.error.validationErrors), /no está soportado por el sistema/);
});

test('createNotificationsRouter rejects webpush deletion without endpoint identifier', async () => {
  const { notificationValidation } = require('@/middleware/validation');

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
  assert.match(
    response.body.error.validationErrors.map((entry) => entry.message).join(' '),
    /Las suscripciones web requieren el identificador web de la suscripción/,
  );
});

test('createNotificationsRouter rejects unsupported mobile providers during subscription deletion', async () => {
  const { notificationValidation } = require('@/middleware/validation');

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
      providerKey: 'fcm',
      endpoint: 'https://push.example/sub',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(
    response.body.error.validationErrors.map((entry) => entry.message).join(' '),
    /no está soportado por el sistema/,
  );
});
