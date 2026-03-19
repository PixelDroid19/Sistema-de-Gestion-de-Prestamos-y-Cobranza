const { createAuthModule } = require('./auth');
const { createAgentsModule } = require('./agents');
const { createAssociatesModule } = require('./associates');
const { createCustomersModule } = require('./customers');
const { createCreditsModule } = require('./credits');
const { createPayoutsModule } = require('./payouts');
const { createReportsModule } = require('./reports');
const { createNotificationsModule } = require('./notifications');

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
