const test = require('node:test');
const assert = require('node:assert/strict');

const { createNotificationsInfrastructure } = require('@/modules/notifications/infrastructure/repositories');

test('pushSubscriptionRepository.recordDeliveryResult deactivates invalid subscriptions', async () => {
  const updates = [];
  const record = {
    id: 14,
    status: 'active',
    async update(payload) {
      updates.push(payload);
      Object.assign(this, payload);
    },
    toJSON() {
      return this;
    },
  };

  const { pushSubscriptionRepository } = createNotificationsInfrastructure({
    pushSubscriptionModel: {
      async findByPk(subscriptionId) {
        assert.equal(subscriptionId, 14);
        return record;
      },
    },
  });

  const updated = await pushSubscriptionRepository.recordDeliveryResult(14, {
    status: 'invalid',
    detail: 'subscription invalid',
  });

  assert.equal(updated.status, 'inactive');
  assert.equal(updated.failureReason, 'subscription invalid');
  assert.ok(updated.invalidatedAt instanceof Date);
  assert.ok(updated.lastFailureAt instanceof Date);
  assert.equal(updates.length, 1);
});

test('pushSubscriptionRepository.recordDeliveryResult marks expired subscriptions explicitly', async () => {
  const record = {
    id: 15,
    status: 'active',
    async update(payload) {
      Object.assign(this, payload);
    },
    toJSON() {
      return this;
    },
  };

  const { pushSubscriptionRepository } = createNotificationsInfrastructure({
    pushSubscriptionModel: {
      async findByPk(subscriptionId) {
        assert.equal(subscriptionId, 15);
        return record;
      },
    },
  });

  const updated = await pushSubscriptionRepository.recordDeliveryResult(15, {
    status: 'invalid',
    detail: 'subscription expired',
  });

  assert.equal(updated.status, 'expired');
  assert.equal(updated.failureReason, 'subscription expired');
  assert.ok(updated.invalidatedAt instanceof Date);
});
