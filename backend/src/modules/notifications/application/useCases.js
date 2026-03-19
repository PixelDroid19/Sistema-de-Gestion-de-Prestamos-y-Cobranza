const { AuthorizationError, NotFoundError } = require('../../../utils/errorHandler');

/**
 * Create the use case that returns notifications with unread and total counts.
 * @param {{ notificationRepository: object }} dependencies
 * @returns {Function}
 */
const createGetNotifications = ({ notificationRepository }) => async ({ actor }) => {
  const notifications = await notificationRepository.getNotifications(actor.id);
  const unreadCount = await notificationRepository.getUnreadCount(actor.id);

  return {
    success: true,
    data: {
      notifications,
      unreadCount,
      totalCount: notifications.length,
    },
  };
};

/**
 * Create the use case that marks a single owned notification as read.
 * @param {{ notificationRepository: object }} dependencies
 * @returns {Function}
 */
const createMarkAsRead = ({ notificationRepository }) => async ({ actor, notificationId }) => {
  const notification = await notificationRepository.findById(Number(notificationId));
  if (!notification) {
    throw new NotFoundError('Notification');
  }

  if (notification.userId !== actor.id) {
    throw new AuthorizationError('You can only mark your own notifications as read');
  }

  const updatedNotification = await notificationRepository.markAsRead(Number(notificationId));
  return {
    success: true,
    message: 'Notification marked as read',
    data: { notification: updatedNotification },
  };
};

/**
 * Create the use case that marks all notifications for the current actor as read.
 * @param {{ notificationRepository: object }} dependencies
 * @returns {Function}
 */
const createMarkAllAsRead = ({ notificationRepository }) => async ({ actor }) => {
  const notifications = await notificationRepository.markAllAsRead(actor.id);
  return {
    success: true,
    message: 'All notifications marked as read',
    data: {
      notifications,
      count: notifications.length,
    },
  };
};

/**
 * Create the use case that returns only the unread notification count.
 * @param {{ notificationRepository: object }} dependencies
 * @returns {Function}
 */
const createGetUnreadCount = ({ notificationRepository }) => async ({ actor }) => ({
  success: true,
  data: {
    unreadCount: await notificationRepository.getUnreadCount(actor.id),
  },
});

/**
 * Create the use case that clears all notifications for the current actor.
 * @param {{ notificationRepository: object }} dependencies
 * @returns {Function}
 */
const createClearNotifications = ({ notificationRepository }) => async ({ actor }) => {
  await notificationRepository.clearNotifications(actor.id);
  return {
    success: true,
    message: 'All notifications cleared',
  };
};

module.exports = {
  createGetNotifications,
  createMarkAsRead,
  createMarkAllAsRead,
  createGetUnreadCount,
  createClearNotifications,
};
