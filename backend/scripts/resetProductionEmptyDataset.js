require('module-alias/register');
require('dotenv').config({ quiet: true });

const { sequelize, User } = require('@/models');
const {
  resetDatabaseSchema,
  ensureAuditLogEnums,
  seedFinancialProductsAndProfiles,
} = require('@/bootstrap/schema');
const { passwordHasher } = require('@/modules/auth/infrastructure/repositories');

const CONFIRMATION_VALUE = 'RESET_PRODUCTION_EMPTY_DATASET';

const getRequiredEnv = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const assertConfirmed = () => {
  if (process.env.RESET_PRODUCTION_EMPTY_DATASET_CONFIRM !== CONFIRMATION_VALUE) {
    throw new Error(`Refusing to reset database. Set RESET_PRODUCTION_EMPTY_DATASET_CONFIRM=${CONFIRMATION_VALUE}`);
  }
};

const buildSeedConfig = () => ({
  password: getRequiredEnv('QA_PASSWORD'),
  users: [
    {
      name: process.env.QA_ADMIN_NAME || 'QA Admin',
      email: process.env.QA_ADMIN_EMAIL || 'qa.admin.20260519@test.local',
      role: 'admin',
    },
    {
      name: process.env.QA_EMPLOYEE_NAME || 'QA Employee',
      email: process.env.QA_EMPLOYEE_EMAIL || 'qa.employee.20260519@test.local',
      role: 'employee',
    },
  ],
});

const seedAdministrativeUsers = async ({ users, password }) => {
  const hashedPassword = await passwordHasher.hash(password);
  return Promise.all(users.map((user) => User.create({
    ...user,
    password: hashedPassword,
    associateId: null,
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
  })));
};

const main = async () => {
  assertConfirmed();
  const config = buildSeedConfig();

  await sequelize.authenticate();
  const schema = await resetDatabaseSchema({
    database: sequelize,
    env: {
      ...process.env,
      DB_SCHEMA_RESET_ALLOWED: 'true',
    },
  });
  await ensureAuditLogEnums({ database: sequelize });
  await seedFinancialProductsAndProfiles();
  const users = await seedAdministrativeUsers(config);

  console.log(JSON.stringify({
    reset: { mode: 'empty-operational-dataset', tableCount: schema.tables.length },
    users: users.map(({ id, email, role }) => ({ id, email, role })),
  }, null, 2));
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = {
  CONFIRMATION_VALUE,
  assertConfirmed,
  buildSeedConfig,
  getRequiredEnv,
  main,
  seedAdministrativeUsers,
};
