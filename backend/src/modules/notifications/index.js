const { notificationValidation } = require('../../middleware/validation');
const { createModule, resolveAuthContext } = require('../shared');
const { createNotificationsPublicPorts } = require('./public');
const {
  createGetNotifications,
  createMarkAsRead,
  createMarkAllAsRead,
  createGetUnreadCount,
  createClearNotifications,
  createRegisterPushSubscription,
  createDeletePushSubscription,
} = require('./application/useCases');
const { notificationRepository, pushSubscriptionRepository } = require('./infrastructure/repositories');
const { createNotificationsRouter } = require('./presentation/router');

/**
 * Compose the notifications module entrypoint and its router dependencies.
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createNotificationsModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const useCases = {
    getNotifications: createGetNotifications({ notificationRepository }),
    markAsRead: createMarkAsRead({ notificationRepository }),
    markAllAsRead: createMarkAllAsRead({ notificationRepository }),
    getUnreadCount: createGetUnreadCount({ notificationRepository }),
    clearNotifications: createClearNotifications({ notificationRepository }),
    registerPushSubscription: createRegisterPushSubscription({ pushSubscriptionRepository }),
    deletePushSubscription: createDeletePushSubscription({ pushSubscriptionRepository }),
  };

  const moduleRegistration = createModule({
    name: 'notifications',
    basePath: '/api/notifications',
    router: createNotificationsRouter({ authMiddleware, notificationValidation, useCases }),
  });

  sharedRuntime?.registerModulePorts?.('notifications', createNotificationsPublicPorts({ sharedRuntime }));

  return moduleRegistration;
};

module.exports = {
  createNotificationsModule,
};
