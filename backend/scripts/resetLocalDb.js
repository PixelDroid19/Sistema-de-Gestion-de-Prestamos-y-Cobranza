require('module-alias/register');
require('dotenv').config({ quiet: true });

const { sequelize } = require('../src/models');
const { resetDatabaseSchema } = require('../src/bootstrap/schema');

const NONLOCAL_CONFIRMATION_VALUE = 'RESET_LOCAL_DB_NONLOCAL';
const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const assertLocalDatabaseTarget = (env = process.env) => {
  const databaseHost = String(env.DB_HOST || 'localhost').trim().toLowerCase();
  if (LOCAL_DATABASE_HOSTS.has(databaseHost)) return;

  if (
    env.RESET_LOCAL_DB_ALLOW_NONLOCAL === 'true'
    && env.RESET_LOCAL_DB_CONFIRM === NONLOCAL_CONFIRMATION_VALUE
  ) {
    return;
  }

  throw new Error(
    `Refusing to reset non-local database host "${databaseHost}". `
      + `Set RESET_LOCAL_DB_ALLOW_NONLOCAL=true and RESET_LOCAL_DB_CONFIRM=${NONLOCAL_CONFIRMATION_VALUE} if this is intentional.`,
  );
};

const main = async () => {
  assertLocalDatabaseTarget();
  await sequelize.authenticate();

  const result = await resetDatabaseSchema({
    database: sequelize,
    env: process.env,
  });

  console.log(`Local database reset complete (${result.tables.join(', ')})`);
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Failed to reset local database schema:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = {
  LOCAL_DATABASE_HOSTS,
  NONLOCAL_CONFIRMATION_VALUE,
  assertLocalDatabaseTarget,
  main,
};
