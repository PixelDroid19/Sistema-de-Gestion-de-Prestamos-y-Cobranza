const {
  Associate,
  Loan,
  Payment,
  DocumentAttachment,
  LoanAlert,
  PromiseToPay,
  AssociateContribution,
  ProfitDistribution,
  Notification,
  PushSubscription,
  User,
} = require('../models');

const REQUIRED_SCHEMA_MODELS = [
  Associate,
  Loan,
  Payment,
  DocumentAttachment,
  LoanAlert,
  PromiseToPay,
  AssociateContribution,
  ProfitDistribution,
  Notification,
  PushSubscription,
  User,
];

const normalizeTableNames = (tables) => tables.map((table) => {
  if (typeof table === 'string') {
    return table;
  }

  return table.tableName || table.name;
});

const resolveTableName = (model) => {
  const tableName = model.getTableName();
  return typeof tableName === 'string' ? tableName : tableName.tableName;
};

/**
 * Build the schema contract the runtime expects from the loaded Sequelize models.
 * @param {Array<object>} [models]
 * @returns {Array<{ modelName: string, tableName: string, columns: Array<string> }>}
 */
const buildRequiredSchema = (models = REQUIRED_SCHEMA_MODELS) => models.map((model) => ({
  modelName: model.name,
  tableName: resolveTableName(model),
  columns: Object.values(model.getAttributes()).map((attribute) => attribute.field || attribute.fieldName),
}));

/**
 * Create a structured schema verification error for missing tables or columns.
 * @param {Array<string>} issues
 * @returns {Error}
 */
const buildSchemaVerificationError = (issues) => {
  const error = new Error(`Schema verification failed: ${issues.join('; ')}`);
  error.code = 'SCHEMA_VERIFICATION_FAILED';
  error.details = issues;
  return error;
};

/**
 * Verify that the connected database satisfies the required runtime schema.
 * @param {{ database: object, requiredSchema?: Array<object> }} [options]
 * @returns {Promise<{ status: string, tables: Array<string> }>}
 */
const verifyRequiredSchema = async ({
  database,
  requiredSchema = buildRequiredSchema(),
} = {}) => {
  if (!database) {
    throw new Error('Database connection is required for schema verification');
  }

  const queryInterface = database.getQueryInterface();
  const existingTables = new Set(normalizeTableNames(await queryInterface.showAllTables()));
  const issues = [];

  for (const { modelName, tableName, columns } of requiredSchema) {
    if (!existingTables.has(tableName)) {
      issues.push(`Missing table "${tableName}" for model ${modelName}`);
      continue;
    }

    const describedTable = await queryInterface.describeTable(tableName);
    const missingColumns = columns.filter((column) => !Object.prototype.hasOwnProperty.call(describedTable, column));

    if (missingColumns.length > 0) {
      issues.push(`Missing columns on "${tableName}": ${missingColumns.join(', ')}`);
    }
  }

  if (issues.length > 0) {
    throw buildSchemaVerificationError(issues);
  }

  return {
    status: 'verified',
    tables: requiredSchema.map(({ tableName }) => tableName),
  };
};

/**
 * Rebuild the local database schema before verifying required tables and columns.
 * @param {{ database: object, env?: NodeJS.ProcessEnv|Record<string, string|undefined> }} [options]
 * @returns {Promise<{ status: string, tables: Array<string> }>}
 */
const resetDatabaseSchema = async ({
  database,
  env = process.env,
} = {}) => {
  if (!database) {
    throw new Error('Database connection is required for schema reset');
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('Local schema reset is disabled in production');
  }

  if (typeof database.getDialect === 'function' && database.getDialect() === 'postgres') {
    await database.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await database.query('CREATE SCHEMA public;');
  }

  await database.sync({ force: false });

  return verifyRequiredSchema({ database });
};

/**
 * Synchronize the database schema, optionally resetting local development state first.
 * @param {{ database: object, env?: NodeJS.ProcessEnv|Record<string, string|undefined>, forceReset?: boolean }} [options]
 * @returns {Promise<{ mode: string, status: string, tables: Array<string> }>}
 */
const syncDatabaseSchema = async ({
  database,
  env = process.env,
  forceReset = env.DB_RESET_ON_BOOT === 'true',
} = {}) => {
  if (!database) {
    throw new Error('Database connection is required for schema synchronization');
  }

  if (forceReset) {
    const verification = await resetDatabaseSchema({ database, env });

    return {
      mode: 'reset',
      ...verification,
    };
  }

  await database.sync({ alter: true });
  const verification = await verifyRequiredSchema({ database });

  return {
    mode: 'sync',
    ...verification,
  };
};

module.exports = {
  REQUIRED_SCHEMA_MODELS,
  buildRequiredSchema,
  buildSchemaVerificationError,
  normalizeTableNames,
  verifyRequiredSchema,
  resetDatabaseSchema,
  syncDatabaseSchema,
};
