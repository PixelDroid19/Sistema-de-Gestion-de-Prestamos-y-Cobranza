const crypto = require('node:crypto');
const { Op } = require('sequelize');

const { Notification, PushSubscription } = require('../../../models');
const { notificationService } = require('../application/notificationService');

const hashIdentifier = (value) => {
  if (!value) {
    return null;
  }

  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

const serialize = (entry) => (typeof entry?.toJSON === 'function' ? entry.toJSON() : entry);

const isExpiredResult = (detail) => String(detail || '').toLowerCase().includes('expired');

const createNotificationsInfrastructure = ({
  notificationModel = Notification,
  pushSubscriptionModel = PushSubscription,
  notifications = notificationService,
} = {}) => {
  const pushSubscriptionRepository = {
    async upsert({ userId, providerKey, channel, endpoint = null, deviceToken = null, subscription = {}, expiresAt = null }) {
      const endpointHash = hashIdentifier(endpoint);
      const tokenHash = hashIdentifier(deviceToken);
      const identifierClauses = [endpointHash && { endpointHash }, tokenHash && { tokenHash }].filter(Boolean);

      let record = null;
      if (identifierClauses.length > 0) {
        record = await pushSubscriptionModel.findOne({
          where: {
            userId,
            providerKey,
            [Op.or]: identifierClauses,
          },
        });
      }

      const payload = {
        userId,
        providerKey,
        channel,
        endpoint,
        endpointHash,
        deviceToken,
        tokenHash,
        subscription,
        status: 'active',
        expiresAt,
        invalidatedAt: null,
        failureReason: null,
      };

      if (record) {
        await record.update(payload);
        return serialize(record);
      }

      return serialize(await pushSubscriptionModel.create(payload));
    },
    async deactivate({ userId, providerKey, endpoint = null, deviceToken = null }) {
      const endpointHash = hashIdentifier(endpoint);
      const tokenHash = hashIdentifier(deviceToken);
      const identifierClauses = [endpointHash && { endpointHash }, tokenHash && { tokenHash }].filter(Boolean);

      if (identifierClauses.length === 0) {
        return false;
      }

      const [count] = await pushSubscriptionModel.update({
        status: 'inactive',
        invalidatedAt: new Date(),
      }, {
        where: {
          userId,
          providerKey,
          [Op.or]: identifierClauses,
        },
      });

      return count > 0;
    },
    async listActiveByUser(userId) {
      const now = new Date();
      const records = await pushSubscriptionModel.findAll({
        where: {
          userId,
          status: 'active',
          [Op.or]: [
            { expiresAt: null },
            { expiresAt: { [Op.gt]: now } },
          ],
        },
        order: [['updatedAt', 'DESC']],
      });

      return records.map(serialize);
    },
    async recordDeliveryResult(subscriptionId, result = {}) {
      const record = await pushSubscriptionModel.findByPk(subscriptionId);
      if (!record) {
        return null;
      }

      const now = new Date();
      if (result.status === 'delivered') {
        await record.update({
          lastDeliveredAt: now,
          lastFailureAt: null,
          failureReason: null,
        });
        return serialize(record);
      }

      if (result.status === 'invalid') {
        await record.update({
          status: isExpiredResult(result.detail) ? 'expired' : 'inactive',
          invalidatedAt: now,
          lastFailureAt: now,
          failureReason: result.detail || 'subscription_invalid',
        });
        return serialize(record);
      }

      await record.update({
        lastFailureAt: now,
        failureReason: result.detail || 'push_delivery_failed',
      });

      return serialize(record);
    },
  };

  const notificationRepository = {
    getNotifications(userId) {
      return notifications.getNotifications(userId);
    },
    getUnreadCount(userId) {
      return notifications.getUnreadCount(userId);
    },
    async findById(notificationId) {
      const notification = await notificationModel.findByPk(notificationId);
      return notifications.serialize(notification);
    },
    markAsRead(notificationId) {
      return notifications.markAsRead(notificationId);
    },
    markAllAsRead(userId) {
      return notifications.markAllAsRead(userId);
    },
    clearNotifications(userId) {
      return notifications.clearNotifications(userId);
    },
  };

  return {
    notificationRepository,
    pushSubscriptionRepository,
  };
};

const {
  notificationRepository,
  pushSubscriptionRepository,
} = createNotificationsInfrastructure();

notificationService.setPushDeliveryDependencies({ pushSubscriptionRepository });

module.exports = {
  createNotificationsInfrastructure,
  notificationRepository,
  pushSubscriptionRepository,
};
