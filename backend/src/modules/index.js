const { createAuthModule } = require('./auth');
const { createAgentsModule } = require('./agents');
const { createAssociatesModule } = require('./associates');
const { createCustomersModule } = require('./customers');
const { createCreditsModule } = require('./credits');
const { createPayoutsModule } = require('./payouts');
const { createReportsModule } = require('./reports');
const { createNotificationsModule } = require('./notifications');

/**
 * Build the backend module registry consumed by the HTTP app and bootstrap flow.
 * @returns {Array<{ name: string, basePath: string, router: object }>}
 */
const buildModuleRegistry = () => ([
  createAuthModule(),
  createAgentsModule(),
  createAssociatesModule(),
  createCustomersModule(),
  createCreditsModule(),
  createPayoutsModule(),
  createReportsModule(),
  createNotificationsModule(),
]);

module.exports = {
  buildModuleRegistry,
};
