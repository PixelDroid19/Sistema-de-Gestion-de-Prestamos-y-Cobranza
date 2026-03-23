const { createAuthModule } = require('./auth');
const { createAssociatesModule } = require('./associates');
const { createCustomersModule } = require('./customers');
const { createCreditsModule } = require('./credits');
const { createPayoutsModule } = require('./payouts');
const { createReportsModule } = require('./reports');
const { createNotificationsModule } = require('./notifications');
const { createUsersModule } = require('./users');
const { createConfigModule } = require('./config');
const { createSharedRuntime } = require('../bootstrap/sharedRuntime');

/**
 * Build the backend module registry consumed by the HTTP app and bootstrap flow.
 * @param {{ sharedRuntime?: object }} [options]
 * @returns {Array<{ name: string, basePath: string, router: object }>}
 */
const buildModuleRegistry = ({ sharedRuntime = createSharedRuntime() } = {}) => ([
  createAuthModule({ sharedRuntime }),
  createAssociatesModule({ sharedRuntime }),
  createCustomersModule({ sharedRuntime }),
  createCreditsModule({ sharedRuntime }),
  createPayoutsModule({ sharedRuntime }),
  createReportsModule({ sharedRuntime }),
  createNotificationsModule({ sharedRuntime }),
  createUsersModule({ sharedRuntime }),
  createConfigModule({ sharedRuntime }),
]);

module.exports = {
  buildModuleRegistry,
};
