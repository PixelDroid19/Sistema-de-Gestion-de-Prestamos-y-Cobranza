require('module-alias/register');
require('dotenv').config();

const { sequelize, User, Customer, Associate } = require('@/models');
const {
  resetDatabaseSchema,
  ensureAuditLogEnums,
  seedFinancialProductsAndProfiles,
} = require('@/bootstrap/schema');
const { passwordHasher } = require('@/modules/auth/infrastructure/repositories');

const CONFIRMATION_VALUE = 'RESET_RAILWAY_QA_DATASET';

const getRequiredEnv = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const buildSeedConfig = () => {
  const password = getRequiredEnv('QA_PASSWORD');

  return {
    password,
    users: {
      admin: {
        name: process.env.QA_ADMIN_NAME || 'QA Admin',
        email: process.env.QA_ADMIN_EMAIL || 'qa.admin.20260427@test.local',
      },
      customer: {
        name: process.env.QA_CUSTOMER_NAME || 'QA Customer',
        email: process.env.QA_CUSTOMER_EMAIL || 'qa.customer.20260427@test.local',
        phone: process.env.QA_CUSTOMER_PHONE || '+573001110001',
        documentNumber: process.env.QA_CUSTOMER_DOCUMENT || 'QA-CUSTOMER-20260511',
      },
      socio: {
        name: process.env.QA_SOCIO_NAME || 'QA Socio',
        email: process.env.QA_SOCIO_EMAIL || 'qa.socio.20260427@test.local',
        phone: process.env.QA_SOCIO_PHONE || '+573001110002',
      },
    },
  };
};

const assertConfirmed = () => {
  const confirmation = process.env.RESET_PRODUCTION_QA_DATASET_CONFIRM;
  if (confirmation !== CONFIRMATION_VALUE) {
    throw new Error(`Refusing to reset database. Set RESET_PRODUCTION_QA_DATASET_CONFIRM=${CONFIRMATION_VALUE}`);
  }
};

const createUser = async ({ name, email, password, role, associateId = null }) => {
  const hashedPassword = await passwordHasher.hash(password);
  return User.create({
    name,
    email,
    password: hashedPassword,
    role,
    associateId,
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
  });
};

const seedQaUsers = async ({ users, password }) => {
  const admin = await createUser({
    ...users.admin,
    password,
    role: 'admin',
  });

  const customerUser = await createUser({
    name: users.customer.name,
    email: users.customer.email,
    password,
    role: 'customer',
  });

  const customer = await Customer.create({
    id: customerUser.id,
    name: users.customer.name,
    email: users.customer.email,
    phone: users.customer.phone,
    documentNumber: users.customer.documentNumber,
    status: 'active',
    occupation: 'QA borrower',
    department: 'Bogota',
    city: 'Bogota',
    address: 'QA seeded customer address',
  });

  const associate = await Associate.create({
    name: users.socio.name,
    email: users.socio.email,
    phone: users.socio.phone,
    address: 'QA seeded associate address',
    status: 'active',
    participationPercentage: 100,
    notes: 'Seeded after Railway QA reset',
  });

  const socio = await createUser({
    name: users.socio.name,
    email: users.socio.email,
    password,
    role: 'socio',
    associateId: associate.id,
  });

  return {
    admin,
    customerUser,
    customer,
    associate,
    socio,
  };
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
  const seeded = await seedQaUsers(config);

  const summary = {
    reset: {
      mode: 'reset',
      tableCount: schema.tables.length,
    },
    users: {
      admin: { id: seeded.admin.id, email: seeded.admin.email, role: seeded.admin.role },
      customer: {
        id: seeded.customerUser.id,
        email: seeded.customerUser.email,
        role: seeded.customerUser.role,
        customerId: seeded.customer.id,
      },
      socio: {
        id: seeded.socio.id,
        email: seeded.socio.email,
        role: seeded.socio.role,
        associateId: seeded.associate.id,
      },
    },
  };

  console.log(JSON.stringify(summary, null, 2));
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
