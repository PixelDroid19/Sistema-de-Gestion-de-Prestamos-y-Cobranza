const { createAuthModule } = require('./auth');
const { createAssociatesModule } = require('./associates');
const { createCustomersModule } = require('./customers');
const { createCreditsModule } = require('./credits');
const { createPayoutsModule } = require('./payouts');
const { createReportsModule } = require('./reports');
const { createNotificationsModule } = require('./notifications');
const { createUsersModule } = require('./users');
const { createConfigModule } = require('./config');
const { createPermissionsModule } = require('./permissions');
const { createAuditModule } = require('./audit');
const { createSharedRuntime } = require('../bootstrap/sharedRuntime');
const { auditService } = require('./audit/domain/services');

/**
 * Build the backend module registry consumed by the HTTP app and bootstrap flow.
 * @param {{ sharedRuntime?: object }} [options]
 * @returns {Array<{ name: string, basePath: string, router: object }>}
 */
const buildModuleRegistry = ({ sharedRuntime = createSharedRuntime() } = {}) => ([
  // Audit module must be created first so its service can be passed to auth
  createAuditModule({ sharedRuntime }),
  createAuthModule({ sharedRuntime, auditService }),
  createAssociatesModule({ sharedRuntime, auditService }),
  createCustomersModule({ sharedRuntime, auditService }),
  createCreditsModule({ sharedRuntime, auditService }),
  createPayoutsModule({ sharedRuntime }),
  createReportsModule({ sharedRuntime }),
  createNotificationsModule({ sharedRuntime }),
  createUsersModule({ sharedRuntime }),
  createConfigModule({ sharedRuntime }),
  createPermissionsModule({ sharedRuntime }),
]);

module.exports = {
  buildModuleRegistry,
};
