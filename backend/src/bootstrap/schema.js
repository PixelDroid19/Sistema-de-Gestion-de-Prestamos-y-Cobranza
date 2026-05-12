const {
  Customer,
  Associate,
  Loan,
  Payment,
  DocumentAttachment,
  LoanAlert,
  PromiseToPay,
  AssociateContribution,
  ProfitDistribution,
  IdempotencyKey,
  Notification,
  PushSubscription,
  User,
  CalculationProfileVersion,
  FinancialProduct,
  OutboxEvent,
  ConfigEntry,
  Permission,
  RolePermission,
  UserPermission,
  AuditLog,
  RefreshToken,
  AssociateInstallment,
  RateLimitEntry,
} = require('@/models');
const { AUDIT_ACTIONS, AUDIT_MODULES } = require('@/models/AuditLog');
const { permissionsCatalog } = require('@/db/seeds/permissions_catalog');
const { APPLICATION_ROLES } = require('@/modules/shared/roles');

// The required schema models are ordered to respect foreign-key dependencies
// (e.g. Customers must exist before Loans which reference them).
const REQUIRED_SCHEMA_MODELS = [
  Customer,
  Associate,
  FinancialProduct,
  OutboxEvent,
  ConfigEntry,
  Permission,
  RolePermission,
  UserPermission,
  User,
  CalculationProfileVersion,
  Loan,
  Payment,
  LoanAlert,
  PromiseToPay,
  AssociateContribution,
  AssociateInstallment,
  ProfitDistribution,
  IdempotencyKey,
  Notification,
  PushSubscription,
  AuditLog,
  RefreshToken,
  RateLimitEntry,
  DocumentAttachment,
];

const SAFE_RESET_ENVIRONMENTS = new Set(['development', 'test', 'local']);
const SCHEMA_MODES = {
  VERIFY: 'verify',
  ALTER: 'alter',
  RESET: 'reset',
};

const OPERATIONAL_CONFIG_SEEDS = Object.freeze([
  {
    category: 'payment_method',
    key: 'transfer',
    label: 'Transferencia',
    isActive: true,
    value: {
      description: 'Pago por transferencia bancaria o billetera digital con soporte verificable.',
      requiresReference: true,
      metadata: { type: 'bank_transfer', seeded: true },
    },
  },
  {
    category: 'payment_method',
    key: 'cash',
    label: 'Efectivo',
    isActive: true,
    value: {
      description: 'Pago recibido en caja o recaudo físico.',
      requiresReference: false,
      metadata: { type: 'cash', seeded: true },
    },
  },
  {
    category: 'payment_method',
    key: 'card',
    label: 'Tarjeta',
    isActive: true,
    value: {
      description: 'Pago por datáfono o pasarela con comprobante transaccional.',
      requiresReference: true,
      metadata: { type: 'card', seeded: true },
    },
  },
  {
    category: 'payment_method',
    key: 'check',
    label: 'Cheque',
    isActive: true,
    value: {
      description: 'Pago con cheque sujeto a validación administrativa.',
      requiresReference: true,
      metadata: { type: 'other', seeded: true },
    },
  },
  {
    category: 'payment_method',
    key: 'other',
    label: 'Otro',
    isActive: true,
    value: {
      description: 'Método excepcional documentado por el operador.',
      requiresReference: true,
      metadata: { type: 'other', seeded: true },
    },
  },
  {
    category: 'rate_policy',
    key: 'standard-credit',
    label: 'Crédito estándar',
    isActive: true,
    value: {
      minAmount: 0,
      maxAmount: null,
      annualEffectiveRate: 36,
      priority: 100,
      description: 'Tasa base usada cuando el crédito toma tasa desde configuración.',
      metadata: { seeded: true },
    },
  },
  {
    category: 'late_fee_policy',
    key: 'standard-simple-late-fee',
    label: 'Mora simple estándar',
    isActive: true,
    value: {
      annualEffectiveRate: 12,
      lateFeeMode: 'SIMPLE',
      priority: 100,
      description: 'Regla base para calcular mora sobre cuotas vencidas.',
      metadata: { seeded: true },
    },
  },
]);

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

const normalizeSchemaMode = (value) => String(value || '').trim().toLowerCase();

const isSafeLocalEnvironment = (env = process.env) => SAFE_RESET_ENVIRONMENTS.has(String(env.NODE_ENV || 'development').toLowerCase());

const extractMissingTableNames = (error) => {
  if (!Array.isArray(error?.details)) {
    return [];
  }

  return error.details
    .map((issue) => issue.match(/^Missing table "([^"]+)"/u)?.[1])
    .filter(Boolean);
};

const extractMissingColumnsByTable = (error) => {
  if (!Array.isArray(error?.details)) {
    return new Map();
  }

  const missingColumnsByTable = new Map();

  error.details.forEach((issue) => {
    const match = issue.match(/^Missing columns on "([^"]+)": (.+)$/u);
    if (!match) {
      return;
    }

    const [, tableName, columnsRaw] = match;
    missingColumnsByTable.set(
      tableName,
      columnsRaw.split(',').map((column) => column.trim()).filter(Boolean)
    );
  });

  return missingColumnsByTable;
};

const buildModelColumnMap = (model) => new Map(Object.entries(model.getAttributes()).map(([attributeName, attribute]) => {
  const columnName = attribute.field || attribute.fieldName || attributeName;
  return [columnName, attribute];
}));

const sanitizeColumnDefinition = (attribute) => {
  const definition = { ...attribute };
  delete definition.Model;
  delete definition.fieldName;
  delete definition.field;
  return definition;
};

const createMissingTables = async ({
  tableNames,
  models = REQUIRED_SCHEMA_MODELS,
} = {}) => {
  const modelByTableName = new Map(models.map((model) => [resolveTableName(model), model]));

  for (const tableName of tableNames) {
    const model = modelByTableName.get(tableName);

    if (!model || typeof model.sync !== 'function') {
      throw new Error(`Cannot auto-create missing table "${tableName}" because no syncable model was found`);
    }

    await model.sync();
  }
};

const createMissingColumns = async ({
  database,
  missingColumnsByTable,
  models = REQUIRED_SCHEMA_MODELS,
} = {}) => {
  if (!database) {
    throw new Error('Database connection is required to create missing columns');
  }

  const queryInterface = database.getQueryInterface();
  const modelByTableName = new Map(models.map((model) => [resolveTableName(model), model]));

  for (const [tableName, columns] of missingColumnsByTable.entries()) {
    const model = modelByTableName.get(tableName);

    if (!model) {
      throw new Error(`Cannot auto-create missing columns on "${tableName}" because no syncable model was found`);
    }

    const columnMap = buildModelColumnMap(model);

    for (const columnName of columns) {
      const attribute = columnMap.get(columnName);

      if (!attribute) {
        throw new Error(`Cannot auto-create missing column "${columnName}" on "${tableName}" because no attribute definition was found`);
      }

      await queryInterface.addColumn(tableName, columnName, sanitizeColumnDefinition(attribute));
    }
  }
};

/**
 * Resolve the startup schema mode with verify-by-default semantics.
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>} [env]
 * @returns {'verify'|'alter'|'reset'}
 */
const resolveSchemaMode = (env = process.env) => {
  const requestedMode = normalizeSchemaMode(env.DB_SCHEMA_MODE);

  if (requestedMode === SCHEMA_MODES.ALTER || requestedMode === SCHEMA_MODES.RESET || requestedMode === SCHEMA_MODES.VERIFY) {
    return requestedMode;
  }

  if (env.DB_RESET_ON_BOOT === 'true') {
    return SCHEMA_MODES.RESET;
  }

  return SCHEMA_MODES.VERIFY;
};

/**
 * Guard destructive schema reset usage to local-safe environments only.
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>} [env]
 */
const assertResetAllowed = (env = process.env) => {
  const explicitlyAllowed = env.DB_SCHEMA_RESET_ALLOWED === 'true';

  if (!isSafeLocalEnvironment(env) && !explicitlyAllowed) {
    throw new Error('Schema reset mode is disabled outside safe local/test environments');
  }
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

  assertResetAllowed(env);

  if (typeof database.getDialect === 'function' && database.getDialect() === 'postgres') {
    await database.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await database.query('CREATE SCHEMA public;');
  }

  await database.sync({ force: false });

  return verifyRequiredSchema({ database });
};

/**
 * Synchronize the database schema using an explicit startup mode.
 * @param {{ database: object, env?: NodeJS.ProcessEnv|Record<string, string|undefined>, mode?: string }} [options]
 * @returns {Promise<{ mode: string, status: string, tables: Array<string> }>}
 */
const syncDatabaseSchema = async ({
  database,
  env = process.env,
  mode = resolveSchemaMode(env),
  models = REQUIRED_SCHEMA_MODELS,
  requiredSchema = buildRequiredSchema(models),
} = {}) => {
  if (!database) {
    throw new Error('Database connection is required for schema synchronization');
  }

  if (mode === SCHEMA_MODES.RESET) {
    const verification = await resetDatabaseSchema({ database, env });

    return {
      mode: SCHEMA_MODES.RESET,
      ...verification,
    };
  }

  if (mode === SCHEMA_MODES.ALTER) {
    await database.sync({ alter: true });
  }

  let createdTables = [];
  let verification;

  try {
    verification = await verifyRequiredSchema({ database, requiredSchema });
  } catch (error) {
    const missingTables = extractMissingTableNames(error);
    const missingColumnsByTable = extractMissingColumnsByTable(error);

    if (mode !== SCHEMA_MODES.VERIFY || !isSafeLocalEnvironment(env) || (missingTables.length === 0 && missingColumnsByTable.size === 0)) {
      throw error;
    }

    if (missingTables.length > 0) {
      await createMissingTables({ tableNames: missingTables, models });
      createdTables = missingTables;
    }

    if (missingColumnsByTable.size > 0) {
      await createMissingColumns({ database, missingColumnsByTable, models });
    }

    verification = await verifyRequiredSchema({ database, requiredSchema });
  }

  return {
    mode,
    ...(createdTables.length > 0 ? { createdTables } : {}),
    ...verification,
  };
};

const ensureEnumValues = async ({ database, enumTypeName, values }) => {
  if (!database || typeof database.getDialect !== 'function' || database.getDialect() !== 'postgres') {
    return;
  }

  for (const value of values) {
    const safeEnumTypeName = String(enumTypeName).replace(/"/g, '""');
    const safeEnumValue = String(value).replace(/'/g, "''");

    await database.query(`ALTER TYPE "${safeEnumTypeName}" ADD VALUE IF NOT EXISTS '${safeEnumValue}';`);
  }
};

const ensureAuditLogEnums = async ({ database }) => {
  await ensureEnumValues({
    database,
    enumTypeName: 'enum_AuditLogs_action',
    values: AUDIT_ACTIONS,
  });
  await ensureEnumValues({
    database,
    enumTypeName: 'enum_AuditLogs_module',
    values: AUDIT_MODULES,
  });
};

const ensureApplicationRoleEnums = async ({ database }) => {
  await ensureEnumValues({
    database,
    enumTypeName: 'enum_Users_role',
    values: APPLICATION_ROLES,
  });
  await ensureEnumValues({
    database,
    enumTypeName: 'enum_RolePermissions_role',
    values: APPLICATION_ROLES,
  });
};

const FINANCIAL_PRODUCT_SEEDS = [
  {
    name: 'Personal Loan 12%',
    interestRate: 12,
    termMonths: 12,
    lateFeeMode: 'NONE',
    penaltyRate: 0,
  },
  {
    name: 'Business Loan 18%',
    interestRate: 18,
    termMonths: 24,
    lateFeeMode: 'SIMPLE',
    penaltyRate: 2.0,
  },
  {
    name: 'Quick Loan 24%',
    interestRate: 24,
    termMonths: 6,
    lateFeeMode: 'COMPOUND',
    penaltyRate: 5.0,
  },
];

const DEFAULT_ROLE_PERMISSION_NAMES = Object.freeze({
  admin: permissionsCatalog.map((permission) => permission.name),
  employee: [],
  customer: [],
  socio: [],
});

/**
 * Seed the permission catalog and baseline role assignments used by
 * operational authorization and settings access control.
 * Admins receive the full catalog by default so user provisioning and
 * permission management are never blocked on a fresh database.
 * @returns {Promise<void>}
 */
const seedPermissionCatalogAndRoleDefaults = async () => {
  const permissionsByName = new Map();

  for (const seed of permissionsCatalog) {
    const [permission, created] = await Permission.findOrCreate({
      where: { name: seed.name },
      defaults: seed,
    });

    if (!created && (permission.module !== seed.module || permission.description !== seed.description)) {
      await permission.update({
        module: seed.module,
        description: seed.description,
      });
    }

    permissionsByName.set(seed.name, permission);
  }

  for (const [role, permissionNames] of Object.entries(DEFAULT_ROLE_PERMISSION_NAMES)) {
    for (const permissionName of permissionNames) {
      const permission = permissionsByName.get(permissionName);
      if (!permission) continue;

      await RolePermission.findOrCreate({
        where: {
          role,
          permissionId: permission.id,
        },
        defaults: {
          role,
          permissionId: permission.id,
          grantedBy: null,
        },
      });
    }
  }
};

const seedFinancialProductsAndPermissions = async () => {
  for (const seed of FINANCIAL_PRODUCT_SEEDS) {
    const [product, created] = await FinancialProduct.findOrCreate({
      where: { name: seed.name },
      defaults: seed,
    });

    if (!created) {
      await product.update(seed);
    }
  }

  await seedPermissionCatalogAndRoleDefaults();
};

const seedCalculationProfileVersions = async () => {
  const { DEFAULT_CALCULATION_PROFILE } = require('@/modules/credits/domain/calculation');

  const existing = await CalculationProfileVersion.findOne({
    where: { scopeKey: DEFAULT_CALCULATION_PROFILE.scopeKey },
    order: [['version', 'DESC']],
  });

  if (existing) {
    return;
  }

  await CalculationProfileVersion.create({
    scopeKey: DEFAULT_CALCULATION_PROFILE.scopeKey,
    name: DEFAULT_CALCULATION_PROFILE.name,
    version: DEFAULT_CALCULATION_PROFILE.version,
    status: DEFAULT_CALCULATION_PROFILE.status,
    calculationMethod: DEFAULT_CALCULATION_PROFILE.calculationMethod,
    parameters: DEFAULT_CALCULATION_PROFILE.parameters,
    rules: DEFAULT_CALCULATION_PROFILE.rules,
    formulaSet: DEFAULT_CALCULATION_PROFILE.formulaSet,
    changelog: DEFAULT_CALCULATION_PROFILE.changelog,
    createdByUserId: null,
  });
};

const seedOperationalConfigDefaults = async () => {
  for (const seed of OPERATIONAL_CONFIG_SEEDS) {
    await ConfigEntry.findOrCreate({
      where: { category: seed.category, key: seed.key },
      defaults: seed,
    });
  }
};

const seedFinancialProductsAndProfiles = async () => {
  await seedFinancialProductsAndPermissions();
  await seedCalculationProfileVersions();
  await seedOperationalConfigDefaults();
};

module.exports = {
  REQUIRED_SCHEMA_MODELS,
  SAFE_RESET_ENVIRONMENTS,
  SCHEMA_MODES,
  buildRequiredSchema,
  buildSchemaVerificationError,
  normalizeTableNames,
  normalizeSchemaMode,
  resolveSchemaMode,
  assertResetAllowed,
  verifyRequiredSchema,
  resetDatabaseSchema,
  syncDatabaseSchema,
  ensureAuditLogEnums,
  ensureApplicationRoleEnums,
  seedPermissionCatalogAndRoleDefaults,
  seedFinancialProductsAndPermissions,
  seedCalculationProfileVersions,
  seedOperationalConfigDefaults,
  seedFinancialProductsAndProfiles,
};
