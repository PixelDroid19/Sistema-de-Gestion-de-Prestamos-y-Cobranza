const { Associate, Loan, Payment } = require('../models');

const REQUIRED_SCHEMA_MODELS = [Associate, Loan, Payment];

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

const buildRequiredSchema = (models = REQUIRED_SCHEMA_MODELS) => models.map((model) => ({
  modelName: model.name,
  tableName: resolveTableName(model),
  columns: Object.values(model.getAttributes()).map((attribute) => attribute.field || attribute.fieldName),
}));

const buildSchemaVerificationError = (issues) => {
  const error = new Error(`Schema verification failed: ${issues.join('; ')}`);
  error.code = 'SCHEMA_VERIFICATION_FAILED';
  error.details = issues;
  return error;
};

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

  await database.sync();
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
