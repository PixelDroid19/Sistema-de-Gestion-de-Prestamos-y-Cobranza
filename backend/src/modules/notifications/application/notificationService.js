const { Notification, User } = require('@/models');
const { createPushProviderRegistry } = require('../infrastructure/push/providerRegistry');
const { createResendEmailProvider } = require('../infrastructure/email/providers/resendEmailProvider');

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
    userModel = User,
    pushSubscriptionRepository = null,
    providerRegistry = createPushProviderRegistry(),
    emailProvider = createResendEmailProvider(),
  } = {}) {
    super();
    this.notificationModel = notificationModel;
    this.userModel = userModel;
    this.pushSubscriptionRepository = pushSubscriptionRepository;
    this.providerRegistry = providerRegistry;
    this.emailProvider = emailProvider;
  }

  setPushDeliveryDependencies({ pushSubscriptionRepository, providerRegistry } = {}) {
    if (pushSubscriptionRepository) {
      this.pushSubscriptionRepository = pushSubscriptionRepository;
    }

    if (providerRegistry) {
      this.providerRegistry = providerRegistry;
    }
  }

  setEmailDeliveryDependencies({ emailProvider, userModel } = {}) {
    if (emailProvider) {
      this.emailProvider = emailProvider;
    }

    if (userModel) {
      this.userModel = userModel;
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

    const serialized = this.serialize(notification);
    await this.dispatchPushFanout(serialized);
    await this.dispatchEmailFanout(serialized);

    return serialized;
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

  async dispatchEmailFanout(notification) {
    if (!this.emailProvider?.isConfigured || !this.userModel) {
      return;
    }

    if (
      typeof this.emailProvider.supportsNotification === 'function'
      && !this.emailProvider.supportsNotification(notification)
    ) {
      return;
    }

    try {
      const recipient = await this.userModel.findByPk(notification.userId, {
        attributes: ['id', 'name', 'email', 'isActive'],
      });

      if (!recipient || recipient.isActive === false) {
        return;
      }

      await this.emailProvider.send({ notification, recipient });
    } catch (_error) {
      // Notification persistence must not fail because an external email provider is unavailable.
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
