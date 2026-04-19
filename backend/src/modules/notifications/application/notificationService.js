const { Notification } = require('@/models');
const { createPushProviderRegistry } = require('@/services/push/providerRegistry');

/**
 * Contract for notification providers used by backend infrastructure seams.
 */
class NotificationService {
  async sendNotification(userId, message, type, data = {}, options = {}) {
    throw new Error('sendNotification method must be implemented');
  }

  async getNotifications(userId) {
    throw new Error('getNotifications method must be implemented');
  }

  async markAsRead(notificationId) {
    throw new Error('markAsRead method must be implemented');
  }

  async markAllAsRead(userId) {
    throw new Error('markAllAsRead method must be implemented');
  }

  async getUnreadCount(userId) {
    throw new Error('getUnreadCount method must be implemented');
  }

  async clearNotifications(userId) {
    throw new Error('clearNotifications method must be implemented');
  }
}

class SequelizeNotificationService extends NotificationService {
  constructor({
    notificationModel = Notification,
    pushSubscriptionRepository = null,
    providerRegistry = createPushProviderRegistry(),
  } = {}) {
    super();
    this.notificationModel = notificationModel;
    this.pushSubscriptionRepository = pushSubscriptionRepository;
    this.providerRegistry = providerRegistry;
  }

  setPushDeliveryDependencies({ pushSubscriptionRepository, providerRegistry } = {}) {
    if (pushSubscriptionRepository) {
      this.pushSubscriptionRepository = pushSubscriptionRepository;
    }

    if (providerRegistry) {
      this.providerRegistry = providerRegistry;
    }
  }

  serialize(notification) {
    const record = typeof notification?.toJSON === 'function' ? notification.toJSON() : notification;

    if (!record) {
      return record;
    }

    return {
      ...record,
      data: record.payload || {},
      timestamp: new Date(record.createdAt || Date.now()).getTime(),
    };
  }

  async sendNotification(userId, message, type, data = {}, options = {}) {
    const dedupeKey = options?.dedupeKey || null;

    if (dedupeKey) {
      const existing = await this.notificationModel.findOne({
        where: {
          userId,
          dedupeKey,
          isRead: false,
        },
        order: [['createdAt', 'DESC']],
      });

      if (existing) {
        return this.serialize(existing);
      }
    }

    const notification = await this.notificationModel.create({
      userId,
      message,
      type,
      payload: data || {},
      isRead: false,
      dedupeKey,
    });

    await this.dispatchPushFanout(this.serialize(notification));

    return this.serialize(notification);
  }

  async dispatchPushFanout(notification) {
    if (!this.pushSubscriptionRepository) {
      return;
    }

    const subscriptions = await this.pushSubscriptionRepository.listActiveByUser(notification.userId);

    for (const subscription of subscriptions) {
      try {
        const provider = this.providerRegistry.resolve(subscription);

        if (!provider) {
          continue;
        }

        const result = await provider.send({ notification, subscription });
        await this.pushSubscriptionRepository.recordDeliveryResult(subscription.id, result);
      } catch (error) {
        await this.pushSubscriptionRepository.recordDeliveryResult(subscription.id, {
          status: 'transient_failure',
          detail: error.message || 'push_delivery_failed',
        });
      }
    }
  }

  async getNotifications(userId) {
    const notifications = await this.notificationModel.findAll({
      where: { userId },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });

    return notifications.map((notification) => this.serialize(notification));
  }

  async markAsRead(notificationId) {
    const notification = await this.notificationModel.findByPk(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    await notification.update({ isRead: true });
    return this.serialize(notification);
  }

  async markAllAsRead(userId) {
    await this.notificationModel.update({ isRead: true }, { where: { userId, isRead: false } });
    return this.getNotifications(userId);
  }

  async getUnreadCount(userId) {
    return this.notificationModel.count({ where: { userId, isRead: false } });
  }

  async clearNotifications(userId) {
    await this.notificationModel.destroy({ where: { userId } });
  }
}

const notificationService = new SequelizeNotificationService();

module.exports = {
  NotificationService,
  SequelizeNotificationService,
  notificationService,
};
