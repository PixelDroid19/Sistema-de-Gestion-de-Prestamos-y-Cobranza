require('module-alias/register');
require('dotenv').config({ quiet: true });

const { sequelize, User } = require('@/models');
const { passwordHasher } = require('@/modules/auth/infrastructure/repositories');

const CONFIRMATION_VALUE = 'RESET_RAILWAY_QA_CREDENTIALS';

const getRequiredEnv = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const assertConfirmed = () => {
  if (process.env.RESET_QA_CREDENTIALS_CONFIRM !== CONFIRMATION_VALUE) {
    throw new Error(`Refusing to update QA credentials. Set RESET_QA_CREDENTIALS_CONFIRM=${CONFIRMATION_VALUE}`);
  }
};

const getQaAccounts = () => [
  {
    email: process.env.QA_ADMIN_EMAIL || 'qa.admin.20260427@test.local',
    role: 'admin',
  },
  {
    email: process.env.QA_EMPLOYEE_EMAIL || 'qa.employee.20260427@test.local',
    role: 'employee',
  },
];

const getRetiredPortalAccounts = () => [
  process.env.QA_CUSTOMER_EMAIL || 'qa.customer.20260427@test.local',
  process.env.QA_SOCIO_EMAIL || 'qa.socio.20260427@test.local',
];

/**
 * Reset only administrative QA account credentials and lockout state.
 * This is intentionally non-destructive: it does not reset schema, loans,
 * payments, customers, associates, reports, or any operational records.
 *
 * Customers and investor associates are financial domain records, not
 * administrative login accounts. Historical customer/socio QA users are
 * deactivated here so they cannot enter the backoffice.
 */
const main = async () => {
  assertConfirmed();
  const password = getRequiredEnv('QA_PASSWORD');
  const hashedPassword = await passwordHasher.hash(password);
  const accounts = getQaAccounts();

  await sequelize.authenticate();

  const results = [];
  for (const account of accounts) {
    const user = await User.findOne({ where: { email: account.email } });
    if (!user) {
      const createdUser = await User.create({
        name: account.role === 'admin' ? 'QA Admin' : 'QA Employee',
        email: account.email,
        password: hashedPassword,
        role: account.role,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      results.push({ id: createdUser.id, email: createdUser.email, role: createdUser.role, status: 'created' });
      continue;
    }

    await user.update({
      password: hashedPassword,
      role: account.role,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      associateId: null,
    });

    results.push({
      id: user.id,
      email: user.email,
      role: user.role,
      status: 'reset',
    });
  }

  for (const email of getRetiredPortalAccounts()) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      results.push({ email, role: null, status: 'not-present' });
      continue;
    }

    await user.update({
      isActive: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    results.push({
      id: user.id,
      email: user.email,
      role: user.role,
      status: 'deactivated-domain-only',
    });
  }

  console.log(JSON.stringify({ success: true, results }, null, 2));
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
  getQaAccounts,
  getRetiredPortalAccounts,
  main,
};
