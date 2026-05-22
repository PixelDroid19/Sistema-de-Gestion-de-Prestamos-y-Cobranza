require('module-alias/register');

const { sequelize } = require('@/models');

(async () => {
  try {
    const [result] = await sequelize.query('DELETE FROM rate_limit_entries WHERE "keyPrefix" = :keyPrefix', {
      replacements: { keyPrefix: 'auth' },
      type: sequelize.QueryTypes.DELETE,
    });
    console.log('DELETED', result?.rowCount ?? result);
  } catch (err) {
    console.error('ERROR', err?.message || err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
