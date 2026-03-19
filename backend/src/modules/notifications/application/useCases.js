const { AuthorizationError, NotFoundError } = require('../../../utils/errorHandler');

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

const createGetUnreadCount = ({ notificationRepository }) => async ({ actor }) => ({
  success: true,
  data: {
    unreadCount: await notificationRepository.getUnreadCount(actor.id),
  },
});

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
