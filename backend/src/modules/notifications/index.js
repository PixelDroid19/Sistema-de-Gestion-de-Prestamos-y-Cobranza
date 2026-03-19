const { createAuthMiddleware } = require('../shared/auth');
const { createJwtTokenService } = require('../shared/auth/tokenService');
const { createModule } = require('../shared');
const {
  createGetNotifications,
  createMarkAsRead,
  createMarkAllAsRead,
  createGetUnreadCount,
  createClearNotifications,
} = require('./application/useCases');
const { notificationRepository } = require('./infrastructure/repositories');
const { createNotificationsRouter } = require('./presentation/router');

/**
 * Compose the notifications module entrypoint and its router dependencies.
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createNotificationsModule = () => {
  const authMiddleware = createAuthMiddleware({ tokenService: createJwtTokenService() });
  const useCases = {
    getNotifications: createGetNotifications({ notificationRepository }),
    markAsRead: createMarkAsRead({ notificationRepository }),
    markAllAsRead: createMarkAllAsRead({ notificationRepository }),
    getUnreadCount: createGetUnreadCount({ notificationRepository }),
    clearNotifications: createClearNotifications({ notificationRepository }),
  };

  return createModule({
    name: 'notifications',
    basePath: '/api/notifications',
    router: createNotificationsRouter({ authMiddleware, useCases }),
  });
};

module.exports = {
  createNotificationsModule,
};
