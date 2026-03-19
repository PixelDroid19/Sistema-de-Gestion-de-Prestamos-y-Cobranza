const { sequelize } = require('../models');
const { buildModuleRegistry } = require('../modules');
const { syncDatabaseSchema } = require('./schema');
const { loanRepository, alertRepository } = require('../modules/credits/infrastructure/repositories');
const { createLoanViewService } = require('../modules/credits/application/loanFinancials');
const { createOverdueAlertSyncService } = require('../modules/credits/application/overdueAlertSyncService');
const { createOverdueAlertScheduler } = require('../modules/credits/application/overdueAlertScheduler');

const REQUIRED_ENV_VARS = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'JWT_SECRET'];

let sharedOverdueAlertScheduler = null;

/**
 * Ensure the backend has the environment required to boot safely.
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>} [env]
 */
const validateEnvironment = (env = process.env) => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

/**
 * Authenticate infrastructure, synchronize schema requirements, and build the module registry.
 * @param {{ env?: NodeJS.ProcessEnv|Record<string, string|undefined>, sequelize?: object, syncSchema?: Function, buildModuleRegistry?: Function }} [options]
 * @returns {Promise<{ ready: true, schema: object, modules: Array<object>, readyAt: string }>}
 */
const bootstrap = async ({
  env = process.env,
  sequelize: database = sequelize,
  syncSchema = syncDatabaseSchema,
  buildModuleRegistry: getModuleRegistry = buildModuleRegistry,
  scheduler = sharedOverdueAlertScheduler,
  createScheduler = () => {
    const loanViewService = createLoanViewService();
    const syncService = createOverdueAlertSyncService({ loanRepository, alertRepository, loanViewService });
    return createOverdueAlertScheduler({ syncService });
  },
} = {}) => {
  validateEnvironment(env);
  await database.authenticate();

  const schema = await syncSchema({ database, env });

  if (!scheduler) {
    sharedOverdueAlertScheduler = createScheduler();
    scheduler = sharedOverdueAlertScheduler;
  }

  const overdueAlerts = await scheduler.start();
  const modules = getModuleRegistry();

  return {
    ready: true,
    schema,
    overdueAlerts,
    modules,
    readyAt: new Date().toISOString(),
  };
};

module.exports = {
  REQUIRED_ENV_VARS,
  validateEnvironment,
  bootstrap,
  createSharedOverdueAlertScheduler: () => sharedOverdueAlertScheduler,
};
