require('module-alias/register');
require('dotenv').config({ quiet: true });

const { sequelize } = require('@/models');

const CONFIRMATION_VALUE = 'CLEAR_AUTH_RATE_LIMIT';

const assertConfirmed = (env = process.env) => {
  if (env.CLEAR_AUTH_RATE_LIMIT_CONFIRM !== CONFIRMATION_VALUE) {
    throw new Error(`Refusing to clear auth rate limits. Set CLEAR_AUTH_RATE_LIMIT_CONFIRM=${CONFIRMATION_VALUE}`);
  }
};

const clearAuthRateLimitEntries = async ({ database = sequelize } = {}) => {
  assertConfirmed();
  const [result] = await database.query('DELETE FROM rate_limit_entries WHERE "keyPrefix" = :keyPrefix', {
    replacements: { keyPrefix: 'auth' },
    type: database.QueryTypes.DELETE,
  });

  return result?.rowCount ?? result;
};

const main = async () => {
  try {
    const deleted = await clearAuthRateLimitEntries();
    console.log('DELETED', deleted);
  } catch (err) {
    console.error('ERROR', err?.message || err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

if (require.main === module) {
  main();
}

module.exports = {
  CONFIRMATION_VALUE,
  assertConfirmed,
  clearAuthRateLimitEntries,
};
