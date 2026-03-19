require('dotenv').config();

const { sequelize } = require('../src/models');
const { resetDatabaseSchema } = require('../src/bootstrap/schema');

const main = async () => {
  await sequelize.authenticate();

  const result = await resetDatabaseSchema({
    database: sequelize,
    env: process.env,
  });

  console.log(`Local database reset complete (${result.tables.join(', ')})`);
};

main()
  .catch((error) => {
    console.error('Failed to reset local database schema:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
