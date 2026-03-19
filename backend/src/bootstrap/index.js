const { sequelize } = require('../models');
const { buildModuleRegistry } = require('../modules');
const { syncDatabaseSchema } = require('./schema');

const REQUIRED_ENV_VARS = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'JWT_SECRET'];

const validateEnvironment = (env = process.env) => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

const bootstrap = async ({
  env = process.env,
  sequelize: database = sequelize,
  syncSchema = syncDatabaseSchema,
  buildModuleRegistry: getModuleRegistry = buildModuleRegistry,
} = {}) => {
  validateEnvironment(env);
  await database.authenticate();

  const schema = await syncSchema({ database, env });
  const modules = getModuleRegistry();

  return {
    ready: true,
    schema,
    modules,
    readyAt: new Date().toISOString(),
  };
};

module.exports = {
  REQUIRED_ENV_VARS,
  validateEnvironment,
  bootstrap,
};
