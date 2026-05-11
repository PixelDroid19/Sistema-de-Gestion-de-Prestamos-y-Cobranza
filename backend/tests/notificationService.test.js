const test = require('node:test');
const assert = require('node:assert/strict');

const { SequelizeNotificationService } = require('@/modules/notifications/application/notificationService');

test('SequelizeNotificationService reuses unread notifications with the same dedupe key', async () => {
  const created = [];
  const notificationModel = {
    async findOne() {
      return {
        id: 4,
        userId: 8,
        payload: { loanId: 12 },
        isRead: false,
        createdAt: '2026-03-19T00:00:00.000Z',
        toJSON() {
          return this;
        },
      };
    },
    async create(payload) {
      created.push(payload);
      return payload;
    },
  };

  const service = new SequelizeNotificationService({ notificationModel });
  const notification = await service.sendNotification(8, 'Assigned', 'loan_assignment', { loanId: 12 }, { dedupeKey: 'loan-assignment:12:8' });

  assert.equal(notification.id, 4);
  assert.equal(created.length, 0);
  assert.equal(notification.data.loanId, 12);
});

test('SequelizeNotificationService persists first and then fans out push delivery', async () => {
  const calls = [];
  const notificationModel = {
    async findOne() {
      return null;
    },
    async create(payload) {
      calls.push(['create', payload.userId]);
      return {
        id: 15,
        ...payload,
        createdAt: '2026-03-19T00:00:00.000Z',
        toJSON() {
          return this;
        },
      };
    },
  };
  const pushSubscriptionRepository = {
    async listActiveByUser(userId) {
      calls.push(['listActiveByUser', userId]);
      return [{ id: 9, userId, providerKey: 'webpush', channel: 'web', subscription: { endpoint: 'https://push.example/1' } }];
    },
    async recordDeliveryResult(subscriptionId, result) {
      calls.push(['recordDeliveryResult', subscriptionId, result.status]);
    },
  };
  const providerRegistry = {
    resolve(subscription) {
      calls.push(['resolve', subscription.providerKey]);
      return {
        async send({ notification }) {
          calls.push(['send', notification.id]);
          return { status: 'delivered' };
        },
      };
    },
  };

  const service = new SequelizeNotificationService({ notificationModel, pushSubscriptionRepository, providerRegistry });
  const notification = await service.sendNotification(8, 'Assigned', 'loan_assignment', { loanId: 12 });

  assert.equal(notification.id, 15);
  assert.deepEqual(calls, [
    ['create', 8],
    ['listActiveByUser', 8],
    ['resolve', 'webpush'],
    ['send', 15],
    ['recordDeliveryResult', 9, 'delivered'],
  ]);
});

test('SequelizeNotificationService deactivates invalid subscriptions after provider feedback', async () => {
  const deliveryResults = [];
  const service = new SequelizeNotificationService({
    notificationModel: {
      async findOne() {
        return null;
      },
      async create(payload) {
        return {
          id: 21,
          ...payload,
          createdAt: '2026-03-19T00:00:00.000Z',
          toJSON() {
            return this;
          },
        };
      },
    },
    pushSubscriptionRepository: {
      async listActiveByUser(userId) {
        return [{ id: 12, userId, providerKey: 'webpush', channel: 'web', subscription: { endpoint: 'https://push.example/2' } }];
      },
      async recordDeliveryResult(subscriptionId, result) {
        deliveryResults.push([subscriptionId, result.status, result.detail]);
      },
    },
    providerRegistry: {
      resolve() {
        return {
          async send() {
            return { status: 'invalid', detail: 'subscription expired' };
          },
        };
      },
    },
  });

  await service.sendNotification(8, 'Assigned', 'loan_assignment', { loanId: 12 });

  assert.deepEqual(deliveryResults, [[12, 'invalid', 'subscription expired']]);
});

test('SequelizeNotificationService skips unsupported providers without failing persistence', async () => {
  let recordDeliveryCalled = false;
  const service = new SequelizeNotificationService({
    notificationModel: {
      async findOne() {
        return null;
      },
      async create(payload) {
        return {
          id: 30,
          ...payload,
          createdAt: '2026-03-19T00:00:00.000Z',
          toJSON() {
            return this;
          },
        };
      },
    },
    pushSubscriptionRepository: {
      async listActiveByUser(userId) {
        return [{ id: 18, userId, providerKey: 'fcm', channel: 'mobile', deviceToken: 'device-token' }];
      },
      async recordDeliveryResult() {
        recordDeliveryCalled = true;
      },
    },
    providerRegistry: {
      resolve() {
        return null;
      },
    },
  });

  const notification = await service.sendNotification(8, 'Assigned', 'loan_assignment', { loanId: 12 });

  assert.equal(notification.id, 30);
  assert.equal(recordDeliveryCalled, false);
});

test('SequelizeNotificationService records transient provider failures without throwing', async () => {
  const deliveryResults = [];
  const service = new SequelizeNotificationService({
    notificationModel: {
      async findOne() {
        return null;
      },
      async create(payload) {
        return {
          id: 31,
          ...payload,
          createdAt: '2026-03-19T00:00:00.000Z',
          toJSON() {
            return this;
          },
        };
      },
    },
    pushSubscriptionRepository: {
      async listActiveByUser(userId) {
        return [{ id: 19, userId, providerKey: 'webpush', channel: 'web', subscription: { endpoint: 'https://push.example/3' } }];
      },
      async recordDeliveryResult(subscriptionId, result) {
        deliveryResults.push([subscriptionId, result.status, result.detail]);
      },
    },
    providerRegistry: {
      resolve() {
        return {
          async send() {
            throw new Error('network timeout');
          },
        };
      },
    },
  });

  const notification = await service.sendNotification(8, 'Assigned', 'loan_assignment', { loanId: 12 });

  assert.equal(notification.id, 31);
  assert.deepEqual(deliveryResults, [[19, 'transient_failure', 'network timeout']]);
});

test('SequelizeNotificationService sends configured email notifications after persistence', async () => {
  const calls = [];
  const service = new SequelizeNotificationService({
    notificationModel: {
      async findOne() {
        return null;
      },
      async create(payload) {
        calls.push(['create', payload.userId]);
        return {
          id: 41,
          ...payload,
          createdAt: '2026-03-19T00:00:00.000Z',
          toJSON() {
            return this;
          },
        };
      },
    },
    userModel: {
      async findByPk(userId) {
        calls.push(['findUser', userId]);
        return { id: userId, email: 'customer@test.local', name: 'Customer', isActive: true };
      },
    },
    emailProvider: {
      isConfigured: true,
      async send({ notification, recipient }) {
        calls.push(['sendEmail', notification.id, recipient.email]);
        return { status: 'delivered', providerMessageId: 'email_123' };
      },
    },
  });

  const notification = await service.sendNotification(8, 'Payment received', 'payment_registered', { loanId: 12 });

  assert.equal(notification.id, 41);
  assert.deepEqual(calls, [
    ['create', 8],
    ['findUser', 8],
    ['sendEmail', 41, 'customer@test.local'],
  ]);
});

test('SequelizeNotificationService skips email lookup when email provider is disabled', async () => {
  let userLookupCalled = false;
  const service = new SequelizeNotificationService({
    notificationModel: {
      async findOne() {
        return null;
      },
      async create(payload) {
        return {
          id: 42,
          ...payload,
          createdAt: '2026-03-19T00:00:00.000Z',
          toJSON() {
            return this;
          },
        };
      },
    },
    userModel: {
      async findByPk() {
        userLookupCalled = true;
        return { email: 'customer@test.local' };
      },
    },
    emailProvider: {
      isConfigured: false,
      async send() {
        throw new Error('send should not be called');
      },
    },
  });

  await service.sendNotification(8, 'Payment received', 'payment_registered', { loanId: 12 });

  assert.equal(userLookupCalled, false);
});

test('SequelizeNotificationService skips email for notification types that do not need email', async () => {
  let userLookupCalled = false;
  let emailSendCalled = false;
  const service = new SequelizeNotificationService({
    notificationModel: {
      async findOne() {
        return null;
      },
      async create(payload) {
        return {
          id: 44,
          ...payload,
          createdAt: '2026-03-19T00:00:00.000Z',
          toJSON() {
            return this;
          },
        };
      },
    },
    userModel: {
      async findByPk() {
        userLookupCalled = true;
        return { email: 'customer@test.local' };
      },
    },
    emailProvider: {
      isConfigured: true,
      supportsNotification(notification) {
        return notification.type === 'payment_registered';
      },
      async send() {
        emailSendCalled = true;
        throw new Error('send should not be called');
      },
    },
  });

  const notification = await service.sendNotification(8, 'Config changed', 'config_changed', { section: 'payments' });

  assert.equal(notification.id, 44);
  assert.equal(userLookupCalled, false);
  assert.equal(emailSendCalled, false);
});

test('SequelizeNotificationService never fails persistence when email delivery fails', async () => {
  const service = new SequelizeNotificationService({
    notificationModel: {
      async findOne() {
        return null;
      },
      async create(payload) {
        return {
          id: 43,
          ...payload,
          createdAt: '2026-03-19T00:00:00.000Z',
          toJSON() {
            return this;
          },
        };
      },
    },
    userModel: {
      async findByPk(userId) {
        return { id: userId, email: 'customer@test.local', isActive: true };
      },
    },
    emailProvider: {
      isConfigured: true,
      async send() {
        throw new Error('resend timeout');
      },
    },
  });

  const notification = await service.sendNotification(8, 'Payment received', 'payment_registered', { loanId: 12 });

  assert.equal(notification.id, 43);
});
