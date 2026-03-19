/**
 * Contract for notification providers used by backend infrastructure seams.
 */
class NotificationService {
  /**
   * Send a notification to a user.
   * @param {number} userId
   * @param {string} message
   * @param {string} type
   * @param {object} [data={}]
   */
  async sendNotification(userId, message, type, data = {}) {
    throw new Error('sendNotification method must be implemented');
  }

  /**
   * Retrieve all notifications for a user.
   * @param {number} userId
   */
  async getNotifications(userId) {
    throw new Error('getNotifications method must be implemented');
  }

  /**
   * Mark a single notification as read.
   * @param {number} notificationId
   */
  async markAsRead(notificationId) {
    throw new Error('markAsRead method must be implemented');
  }

  /**
   * Mark all notifications for a user as read.
   * @param {number} userId
   */
  async markAllAsRead(userId) {
    throw new Error('markAllAsRead method must be implemented');
  }
}

/**
 * In-memory notification provider used by the current backend infrastructure.
 */
class MockNotificationService extends NotificationService {
  constructor() {
    super();
    this.notifications = new Map();
    this.notificationId = 1;
  }

  /** @inheritdoc */
  async sendNotification(userId, message, type, data = {}) {
    const notification = {
      id: this.notificationId++,
      userId,
      message,
      type,
      data,
      isRead: false,
      createdAt: new Date(),
      timestamp: Date.now()
    };

    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }
    this.notifications.get(userId).unshift(notification);

    console.log('🔔 NOTIFICATION SENT:', {
      userId,
      message,
      type,
      timestamp: new Date().toISOString(),
      data
    });

    return notification;
  }

  /** @inheritdoc */
  async getNotifications(userId) {
    const userNotifications = this.notifications.get(userId) || [];
    return userNotifications.sort((a, b) => b.timestamp - a.timestamp);
  }

  /** @inheritdoc */
  async markAsRead(notificationId) {
    for (const [userId, notifications] of this.notifications.entries()) {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification) {
        notification.isRead = true;
        console.log('✅ NOTIFICATION MARKED AS READ:', {
          notificationId,
          userId,
          message: notification.message
        });
        return notification;
      }
    }
    throw new Error('Notification not found');
  }

  /** @inheritdoc */
  async markAllAsRead(userId) {
    const userNotifications = this.notifications.get(userId) || [];
    userNotifications.forEach(notification => {
      notification.isRead = true;
    });
    
    console.log('✅ ALL NOTIFICATIONS MARKED AS READ:', {
      userId,
      count: userNotifications.length
    });
    
    return userNotifications;
  }

  /**
   * Return the unread notification count for a user.
   * @param {number} userId
   */
  async getUnreadCount(userId) {
    const userNotifications = this.notifications.get(userId) || [];
    return userNotifications.filter(n => !n.isRead).length;
  }

  /**
   * Clear notifications for a user, mainly to support tests and local resets.
   * @param {number} userId
   */
  async clearNotifications(userId) {
    this.notifications.delete(userId);
    console.log('🗑️ NOTIFICATIONS CLEARED:', { userId });
  }
}

const notificationService = new MockNotificationService();

module.exports = {
  NotificationService,
  MockNotificationService,
  notificationService,
};
