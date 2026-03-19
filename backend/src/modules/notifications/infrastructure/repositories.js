const { notificationService } = require('../../../services/NotificationService');

/**
 * Find an in-memory notification record by identifier across all user queues.
 * @param {number} notificationId
 * @returns {object|null}
 */
const findNotificationRecord = (notificationId) => {
  for (const notifications of notificationService.notifications.values()) {
    const notification = notifications.find((entry) => entry.id === notificationId);
    if (notification) {
      return notification;
    }
  }

  return null;
};

/**
 * Repository adapter that exposes the notification service through persistence-style methods.
 */
const notificationRepository = {
  getNotifications(userId) {
    return notificationService.getNotifications(userId);
  },
  getUnreadCount(userId) {
    return notificationService.getUnreadCount(userId);
  },
  findById(notificationId) {
    return Promise.resolve(findNotificationRecord(notificationId));
  },
  markAsRead(notificationId) {
    return notificationService.markAsRead(notificationId);
  },
  markAllAsRead(userId) {
    return notificationService.markAllAsRead(userId);
  },
  clearNotifications(userId) {
    return notificationService.clearNotifications(userId);
  },
};

module.exports = {
  notificationRepository,
};
