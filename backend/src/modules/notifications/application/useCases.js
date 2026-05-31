const { AuthorizationError, NotFoundError, ValidationError } = require('@/utils/errorHandler');

const ensureSubscriptionIdentifier = ({ endpoint, deviceToken }) => {
  if (!endpoint && !deviceToken) {
    throw new ValidationError('Debe indicar el identificador de la suscripción o el token del dispositivo');
  }
};

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
    throw new AuthorizationError('Solo puede marcar sus propias notificaciones como leídas');
  }

  const updatedNotification = await notificationRepository.markAsRead(Number(notificationId));
  return {
    success: true,
    message: 'Notificación marcada como leída',
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
    message: 'Todas las notificaciones fueron marcadas como leídas',
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
    message: 'Notificaciones eliminadas correctamente',
  };
};

/**
 * Create the use case that registers or reactivates a push subscription for the actor.
 * @param {{ pushSubscriptionRepository: object }} dependencies
 * @returns {Function}
 */
const createRegisterPushSubscription = ({ pushSubscriptionRepository }) => async ({ actor, payload }) => {
  ensureSubscriptionIdentifier(payload);

  const subscription = await pushSubscriptionRepository.upsert({
    userId: actor.id,
    ...payload,
  });

  return {
    success: true,
    message: 'Suscripción de notificaciones registrada correctamente',
    data: { subscription },
  };
};

/**
 * Create the use case that idempotently deactivates a push subscription for the actor.
 * @param {{ pushSubscriptionRepository: object }} dependencies
 * @returns {Function}
 */
const createDeletePushSubscription = ({ pushSubscriptionRepository }) => async ({ actor, payload }) => {
  ensureSubscriptionIdentifier(payload);

  const removed = await pushSubscriptionRepository.deactivate({
    userId: actor.id,
    providerKey: payload.providerKey,
    endpoint: payload.endpoint || null,
    deviceToken: payload.deviceToken || null,
  });

  return {
    success: true,
    message: 'Suscripción de notificaciones eliminada correctamente',
    data: { removed },
  };
};

module.exports = {
  createGetNotifications,
  createMarkAsRead,
  createMarkAllAsRead,
  createGetUnreadCount,
  createClearNotifications,
  createRegisterPushSubscription,
  createDeletePushSubscription,
};
