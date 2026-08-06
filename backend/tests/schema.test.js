const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  SCHEMA_MODES,
  assertResetAllowed,
  buildRequiredSchema,
  REQUIRED_SCHEMA_MODELS,
  resolveSchemaMode,
  resetDatabaseSchema,
  seedOperationalConfigDefaults,
  seedPermissionCatalogAndRoleDefaults,
  ensureAssociateInstallmentStatusEnums,
  ensurePermissionModuleEnums,
  syncDatabaseSchema,
  verifyRequiredSchema,
} = require('@/bootstrap/schema');
const { permissionsCatalog, PERMISSION_MODULES } = require('@/db/seeds/permissions_catalog');
const { AssociateInstallment, Permission } = require('@/models');

const buildDescribedTable = (tableName) => {
  if (tableName === 'Customers') {
    return {
      id: {},
      name: {},
      email: {},
      phone: {},
      status: {},
      documentNumber: {},
      occupation: {},
      birthDate: {},
      department: {},
      city: {},
      address: {},
      createdAt: {},
      updatedAt: {},
      deletedAt: {},
    };
  }

  if (tableName === 'Associates') {
    return {
      id: {}, name: {}, email: {}, phone: {}, address: {}, status: {},
      interestType: {}, interestRate: {}, interestPaymentDay: {}, interestPaymentMonth: {},
      investmentTermMonths: {}, investmentMaturityDate: {},
      notes: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'Loans') {
    return {
      id: {}, customerId: {}, associateId: {}, calculationProfileVersionId: {}, calculationMethod: {}, ratePolicyId: {}, lateFeePolicyId: {}, policySnapshot: {}, amount: {}, interestRate: {}, termMonths: {}, status: {},
      startDate: {}, endDate: {}, financialProductId: {}, emiSchedule: {}, installmentAmount: {}, totalPayable: {},
      totalPaid: {}, principalOutstanding: {}, interestOutstanding: {}, lastPaymentDate: {}, lateFeeMode: {},
      annualLateFeeRate: {}, financialSnapshot: {}, financialBlock: {}, closedAt: {}, closureReason: {}, recoveryStatus: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'FinancialProducts') {
    return {
      id: {}, name: {}, active: {}, interestRate: {}, termMonths: {}, lateFeeMode: {}, penaltyRate: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'OutboxEvents') {
    return {
      id: {}, aggregateType: {}, aggregateId: {}, eventType: {}, payload: {}, status: {}, processedAt: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'ConfigEntries') {
    return {
      id: {}, category: {}, key: {}, label: {}, value: {}, isActive: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'OperatingExpenses') {
    return {
      id: {}, amount: {}, expenseDate: {}, category: {}, description: {}, status: {}, paymentMethod: {},
      reference: {}, notes: {}, createdByUserId: {}, annulledAt: {}, annulledByUserId: {}, annulmentReason: {},
      createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'Permissions') {
    return {
      id: {}, name: {}, module: {}, description: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'RolePermissions') {
    return {
      id: {}, role: {}, permissionId: {}, grantedBy: {},
    };
  }

  if (tableName === 'UserPermissions') {
    return {
      id: {}, userId: {}, permissionId: {}, grantedBy: {}, createdAt: {},
    };
  }

  if (tableName === 'refresh_tokens') {
    return {
      id: {}, tokenHash: {}, userId: {}, expiresAt: {}, revokedAt: {}, createdAt: {},
    };
  }

  if (tableName === 'rate_limit_entries') {
    return {
      id: {}, keyPrefix: {}, identifier: {}, created_at: {},
    };
  }

  if (tableName === 'DocumentAttachments') {
    return {
      id: {}, loanId: {}, paymentId: {}, customerId: {}, uploadedByUserId: {}, storageDisk: {}, storagePath: {}, storedName: {},
      originalName: {}, mimeType: {}, sizeBytes: {}, customerVisible: {}, category: {}, description: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'Notifications') {
    return {
      id: {}, userId: {}, message: {}, type: {}, payload: {}, isRead: {}, dedupeKey: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'PushSubscriptions') {
    return {
      id: {}, userId: {}, providerKey: {}, channel: {}, endpoint: {}, endpointHash: {}, deviceToken: {}, tokenHash: {},
      subscription: {}, status: {}, lastDeliveredAt: {}, lastFailureAt: {}, invalidatedAt: {}, failureReason: {}, expiresAt: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'CalculationProfileVersions') {
    return {
      id: {}, scopeKey: {}, name: {}, version: {}, status: {}, calculationMethod: {}, parameters: {}, rules: {}, formulaSet: {}, changelog: {}, createdByUserId: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'LoanAlerts') {
    return {
      id: {}, loanId: {}, installmentNumber: {}, alertType: {}, dueDate: {}, scheduledAmount: {}, outstandingAmount: {},
      status: {}, resolutionSource: {}, resolvedAt: {}, notes: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'PromiseToPays') {
    return {
      id: {}, loanId: {}, createdByUserId: {}, promisedDate: {}, amount: {}, status: {}, notes: {}, statusHistory: {},
      lastStatusChangedAt: {}, fulfilledPaymentId: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'AssociateContributions') {
    return {
      id: {}, associateId: {}, amount: {}, contributionDate: {}, status: {}, interestTypeSnapshot: {}, interestRateSnapshot: {}, createdByUserId: {}, notes: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'AssociateInstallments') {
    return {
      id: {}, associateId: {}, installmentNumber: {}, amount: {}, dueDate: {},
      capitalBase: {}, interestRate: {}, interestType: {}, periodStartDate: {}, periodEndDate: {}, paymentMethod: {}, notes: {},
      status: {}, paidAt: {}, paidBy: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'ProfitDistributions') {
    return {
      id: {}, associateId: {}, loanId: {}, amount: {}, distributionDate: {}, createdByUserId: {}, notes: {}, basis: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'IdempotencyKeys') {
    return {
      id: {}, scope: {}, createdByUserId: {}, idempotencyKey: {}, requestHash: {}, status: {}, responsePayload: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'Users') {
    return {
      id: {}, name: {}, email: {}, password: {}, role: {}, associateId: {}, isActive: {}, failedLoginAttempts: {}, lockedUntil: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'AuditLogs') {
    return {
      id: {}, userId: {}, userName: {}, action: {}, module: {}, category: {}, severity: {}, entityId: {}, entityType: {},
      previousData: {}, newData: {}, metadata: {}, ip: {}, userAgent: {}, timestamp: {}, createdAt: {}, updatedAt: {},
    };
  }

  return {
    id: {}, loanId: {}, amount: {}, paymentDate: {}, status: {}, principalApplied: {}, interestApplied: {},
    penaltyApplied: {}, paymentType: {}, overpaymentAmount: {}, remainingBalanceAfterPayment: {}, allocationBreakdown: {}, paymentMetadata: {},
    paymentMethod: {}, installmentNumber: {}, annulledFromInstallment: {}, createdByUserId: {}, createdAt: {}, updatedAt: {},
  };
};

const allTables = ['Customers', 'Associates', 'Loans', 'Payments', 'DocumentAttachments', 'LoanAlerts', 'PromiseToPays', 'AssociateContributions', 'AssociateInstallments', 'ProfitDistributions', 'IdempotencyKeys', 'Notifications', 'PushSubscriptions', 'Users', 'AuditLogs', 'CalculationProfileVersions', 'FinancialProducts', 'OutboxEvents', 'ConfigEntries', 'OperatingExpenses', 'Permissions', 'RolePermissions', 'UserPermissions', 'refresh_tokens', 'rate_limit_entries'];

test('buildRequiredSchema derives required tables and columns from runtime models', () => {
  const requiredSchema = buildRequiredSchema();
  const associates = requiredSchema.find((entry) => entry.tableName === 'Associates');
  const loans = requiredSchema.find((entry) => entry.tableName === 'Loans');
  const payments = requiredSchema.find((entry) => entry.tableName === 'Payments');
  const attachments = requiredSchema.find((entry) => entry.tableName === 'DocumentAttachments');
  const alerts = requiredSchema.find((entry) => entry.tableName === 'LoanAlerts');
  const promises = requiredSchema.find((entry) => entry.tableName === 'PromiseToPays');
  const contributions = requiredSchema.find((entry) => entry.tableName === 'AssociateContributions');
  const associateInstallments = requiredSchema.find((entry) => entry.tableName === 'AssociateInstallments');
  const distributions = requiredSchema.find((entry) => entry.tableName === 'ProfitDistributions');
  const idempotencyKeys = requiredSchema.find((entry) => entry.tableName === 'IdempotencyKeys');
  const notifications = requiredSchema.find((entry) => entry.tableName === 'Notifications');
  const pushSubscriptions = requiredSchema.find((entry) => entry.tableName === 'PushSubscriptions');
  const calculationProfileVersions = requiredSchema.find((entry) => entry.tableName === 'CalculationProfileVersions');
  const financialProducts = requiredSchema.find((entry) => entry.tableName === 'FinancialProducts');
  const outboxEvents = requiredSchema.find((entry) => entry.tableName === 'OutboxEvents');
  const configEntries = requiredSchema.find((entry) => entry.tableName === 'ConfigEntries');
  const operatingExpenses = requiredSchema.find((entry) => entry.tableName === 'OperatingExpenses');
  const permissions = requiredSchema.find((entry) => entry.tableName === 'Permissions');
  const rolePermissions = requiredSchema.find((entry) => entry.tableName === 'RolePermissions');
  const userPermissions = requiredSchema.find((entry) => entry.tableName === 'UserPermissions');
  const rateLimitEntries = requiredSchema.find((entry) => entry.tableName === 'rate_limit_entries');

  assert.ok(associates);
  assert.ok(loans);
  assert.ok(payments);
  assert.ok(attachments);
  assert.ok(alerts);
  assert.ok(promises);
  assert.ok(contributions);
  assert.ok(associateInstallments);
  assert.ok(distributions);
  assert.ok(idempotencyKeys);
  assert.ok(notifications);
  assert.ok(pushSubscriptions);
  assert.ok(calculationProfileVersions);
  assert.ok(financialProducts);
  assert.ok(outboxEvents);
  assert.ok(configEntries);
  assert.ok(operatingExpenses);
  assert.ok(permissions);
  assert.ok(rolePermissions);
  assert.ok(userPermissions);
  assert.ok(rateLimitEntries);
  assert.ok(requiredSchema.find((entry) => entry.tableName === 'AuditLogs'));
  assert.ok(requiredSchema.find((entry) => entry.tableName === 'Users').columns.includes('associateId'));
  assert.ok(requiredSchema.find((entry) => entry.tableName === 'Users').columns.includes('failedLoginAttempts'));
  assert.ok(requiredSchema.find((entry) => entry.tableName === 'Users').columns.includes('lockedUntil'));
  assert.ok(associates.columns.includes('email'));
  assert.equal(associates.columns.includes('participationPercentage'), false);
  assert.equal(associates.columns.includes('interestStartsAt'), false);
  assert.ok(associates.columns.includes('interestType'));
  assert.ok(associates.columns.includes('interestRate'));
  assert.ok(associates.columns.includes('interestPaymentDay'));
  assert.ok(associates.columns.includes('investmentTermMonths'));
  assert.ok(associates.columns.includes('investmentMaturityDate'));
  assert.ok(contributions.columns.includes('interestTypeSnapshot'));
  assert.ok(contributions.columns.includes('interestRateSnapshot'));
  assert.ok(contributions.columns.includes('status'));
  assert.ok(associateInstallments.columns.includes('capitalBase'));
  assert.ok(associateInstallments.columns.includes('interestRate'));
  assert.ok(associateInstallments.columns.includes('interestType'));
  assert.ok(associateInstallments.columns.includes('paymentMethod'));
  assert.ok(loans.columns.includes('associateId'));
  assert.equal(loans.columns.includes(['dag', 'GraphVersionId'].join('')), false);
  assert.ok(loans.columns.includes('calculationProfileVersionId'));
  assert.ok(loans.columns.includes('financialProductId'));
  assert.ok(loans.columns.includes('closedAt'));
  assert.ok(loans.columns.includes('closureReason'));
  assert.ok(loans.columns.includes('financialBlock'));
  assert.ok(payments.columns.includes('allocationBreakdown'));
  assert.ok(payments.columns.includes('paymentType'));
  assert.ok(payments.columns.includes('paymentMetadata'));
  assert.ok(payments.columns.includes('createdByUserId'));
  assert.ok(attachments.columns.includes('customerId'));
  assert.ok(attachments.columns.includes('customerVisible'));
  assert.ok(alerts.columns.includes('outstandingAmount'));
  assert.ok(promises.columns.includes('statusHistory'));
  assert.ok(idempotencyKeys.columns.includes('idempotencyKey'));
  assert.ok(associateInstallments.columns.includes('associateId'));
  assert.ok(associateInstallments.columns.includes('installmentNumber'));
  assert.ok(associateInstallments.columns.includes('paidBy'));
  assert.ok(idempotencyKeys.columns.includes('responsePayload'));
  assert.ok(notifications.columns.includes('payload'));
  assert.ok(pushSubscriptions.columns.includes('providerKey'));
  assert.ok(pushSubscriptions.columns.includes('endpointHash'));
  assert.ok(calculationProfileVersions.columns.includes('calculationMethod'));
  assert.ok(calculationProfileVersions.columns.includes('parameters'));
  assert.ok(financialProducts.columns.includes('penaltyRate'));
  assert.ok(outboxEvents.columns.includes('eventType'));
  assert.ok(configEntries.columns.includes('category'));
  assert.ok(configEntries.columns.includes('value'));
  assert.ok(operatingExpenses.columns.includes('amount'));
  assert.ok(operatingExpenses.columns.includes('expenseDate'));
  assert.ok(operatingExpenses.columns.includes('status'));
  assert.ok(operatingExpenses.columns.includes('createdByUserId'));
  assert.ok(operatingExpenses.columns.includes('annulledAt'));
  assert.ok(permissions.columns.includes('name'));
  assert.ok(rolePermissions.columns.includes('role'));
  assert.ok(rolePermissions.columns.includes('permissionId'));
  assert.ok(userPermissions.columns.includes('userId'));
  assert.ok(userPermissions.columns.includes('grantedBy'));
  assert.ok(rateLimitEntries.columns.includes('keyPrefix'));
  assert.ok(rateLimitEntries.columns.includes('identifier'));
  assert.ok(rateLimitEntries.columns.includes('created_at'));
});

test('permission catalog includes finance permissions for operating expenses', () => {
  const permissionNames = permissionsCatalog.map((permission) => permission.name);
  const permissionModuleValues = Permission.getAttributes().module.values;

  assert.ok(PERMISSION_MODULES.includes('FINANZAS'));
  assert.ok(permissionModuleValues.includes('FINANZAS'));
  assert.deepEqual(permissionModuleValues, PERMISSION_MODULES);
  assert.ok(permissionNames.includes('FINANCE_VIEW_ALL'));
  assert.ok(permissionNames.includes('FINANCE_CREATE'));
  assert.ok(permissionNames.includes('FINANCE_ANNUL'));
});

test('associate installment status enum includes persisted overdue state', () => {
  const associateInstallmentStatusValues = AssociateInstallment.getAttributes().status.values;

  assert.deepEqual(associateInstallmentStatusValues, ['pending', 'paid', 'overdue']);
});

test('ensurePermissionModuleEnums keeps Postgres permission module enum aligned before seeding', async () => {
  const queries = [];

  await ensurePermissionModuleEnums({
    database: {
      getDialect: () => 'postgres',
      query: async (sql) => {
        queries.push(sql);
      },
    },
  });

  assert.ok(queries.some((sql) => sql.includes('ALTER TYPE "enum_Permissions_module" ADD VALUE IF NOT EXISTS')));
  assert.ok(queries.some((sql) => sql.includes("'FINANZAS'")));
});

test('ensureAssociateInstallmentStatusEnums keeps overdue status available before seeding data', async () => {
  const queries = [];

  await ensureAssociateInstallmentStatusEnums({
    database: {
      getDialect: () => 'postgres',
      query: async (sql) => {
        queries.push(sql);
      },
    },
  });

  assert.ok(queries.some((sql) => sql.includes('ALTER TYPE "enum_AssociateInstallments_status" ADD VALUE IF NOT EXISTS')));
  assert.ok(queries.some((sql) => sql.includes("'overdue'")));
});

test('verifyRequiredSchema rejects when a required table is missing', async () => {
  await assert.rejects(() => verifyRequiredSchema({
    database: {
      getQueryInterface() {
        return {
          async showAllTables() {
            return ['Loans', 'Payments'];
          },
          async describeTable() {
            return {};
          },
        };
      },
    },
    requiredSchema: [
      { modelName: 'Associate', tableName: 'Associates', columns: ['id', 'email'] },
    ],
  }), /Missing table "Associates"/);
});

test('verifyRequiredSchema rejects when a required column is missing', async () => {
  await assert.rejects(() => verifyRequiredSchema({
    database: {
      getQueryInterface() {
        return {
          async showAllTables() {
            return ['Loans'];
          },
          async describeTable() {
            return {
              id: {},
              customerId: {},
            };
          },
        };
      },
    },
    requiredSchema: [
      { modelName: 'Loan', tableName: 'Loans', columns: ['id', 'customerId', 'associateId'] },
    ],
  }), /Missing columns on "Loans": associateId/);
});

test('resolveSchemaMode defaults to verify and honors explicit alter/reset modes', () => {
  assert.equal(resolveSchemaMode({}), SCHEMA_MODES.VERIFY);
  assert.equal(resolveSchemaMode({ DB_SCHEMA_MODE: 'alter' }), SCHEMA_MODES.ALTER);
  assert.equal(resolveSchemaMode({ DB_SCHEMA_MODE: 'reset' }), SCHEMA_MODES.RESET);
  assert.equal(resolveSchemaMode({ DB_RESET_ON_BOOT: 'true' }), SCHEMA_MODES.RESET);
});

test('assertResetAllowed rejects unsafe non-local environments by default', () => {
  assert.throws(() => assertResetAllowed({ NODE_ENV: 'production' }), /disabled outside safe local\/test environments/i);
  assert.doesNotThrow(() => assertResetAllowed({ NODE_ENV: 'production', DB_SCHEMA_RESET_ALLOWED: 'true' }));
});

test('syncDatabaseSchema verifies schema without altering tables by default', async () => {
  const calls = [];

  const result = await syncDatabaseSchema({
    env: { NODE_ENV: 'development' },
    database: {
      async sync(options) {
        calls.push(`sync:${JSON.stringify(options)}`);
      },
      getQueryInterface() {
        return {
          async showAllTables() {
            return allTables;
          },
          async addColumn() {},
          async describeTable(tableName) {
            return buildDescribedTable(tableName);
          },
        };
      },
    },
  });

  assert.deepEqual(calls, []);
  assert.equal(result.mode, 'verify');
  assert.deepEqual(result.tables.slice().sort(), allTables.slice().sort());
});

test('seedPermissionCatalogAndRoleDefaults seeds the permission catalog and grants admin defaults', async () => {
  const createdPermissions = [];
  const updatedPermissions = [];
  const grantedRolePermissions = [];
  const { Permission, RolePermission } = require('@/models');
  const originalFindOrCreatePermission = Permission.findOrCreate;
  const originalFindOrCreateRolePermission = RolePermission.findOrCreate;

  Permission.findOrCreate = async ({ where, defaults }) => {
    createdPermissions.push(where.name);
    return [
      {
        id: createdPermissions.length,
        name: defaults.name,
        module: defaults.module,
        description: defaults.description,
        async update(payload) {
          updatedPermissions.push(payload);
          Object.assign(this, payload);
          return this;
        },
      },
      true,
    ];
  };

  RolePermission.findOrCreate = async ({ where, defaults }) => {
    grantedRolePermissions.push({ ...where, grantedBy: defaults.grantedBy });
    return [{ id: grantedRolePermissions.length, ...defaults }, true];
  };

  try {
    await seedPermissionCatalogAndRoleDefaults();
  } finally {
    Permission.findOrCreate = originalFindOrCreatePermission;
    RolePermission.findOrCreate = originalFindOrCreateRolePermission;
  }

  assert.ok(createdPermissions.includes('PERMISSIONS_ASSIGN'));
  assert.equal(updatedPermissions.length, 0);
  assert.ok(grantedRolePermissions.length > 0);
  assert.ok(grantedRolePermissions.every((entry) => entry.role === 'admin'));
  assert.ok(grantedRolePermissions.some((entry) => Number.isInteger(entry.permissionId) && entry.permissionId > 0));
});

test('seedOperationalConfigDefaults seeds payment methods and policy entries without overwriting existing config', async () => {
  const calls = [];
  const { ConfigEntry } = require('@/models');
  const originalFindOrCreate = ConfigEntry.findOrCreate;

  ConfigEntry.findOrCreate = async ({ where, defaults }) => {
    calls.push({ where, defaults });
    return [{ id: calls.length, ...defaults }, true];
  };

  try {
    await seedOperationalConfigDefaults();
  } finally {
    ConfigEntry.findOrCreate = originalFindOrCreate;
  }

  const byKey = new Map(calls.map((call) => [call.where.key, call]));
  assert.equal(calls.length, 7);
  assert.deepEqual(byKey.get('transfer').where, { category: 'payment_method', key: 'transfer' });
  assert.equal(byKey.get('transfer').defaults.value.metadata.type, 'bank_transfer');
  assert.equal(byKey.get('cash').defaults.value.requiresReference, false);
  assert.deepEqual(byKey.get('standard-credit').where, { category: 'rate_policy', key: 'standard-credit' });
  assert.equal(byKey.get('standard-credit').defaults.value.annualEffectiveRate, 60);
  assert.deepEqual(byKey.get('standard-simple-late-fee').where, { category: 'late_fee_policy', key: 'standard-simple-late-fee' });
  assert.equal(byKey.get('standard-simple-late-fee').defaults.value.lateFeeMode, 'SIMPLE');
});

test('syncDatabaseSchema alters schema only when alter mode is explicitly requested', async () => {
  const calls = [];

  const result = await syncDatabaseSchema({
    env: { NODE_ENV: 'development', DB_SCHEMA_MODE: 'alter' },
    database: {
      async sync(options) {
        calls.push(`sync:${JSON.stringify(options)}`);
      },
      getQueryInterface() {
        return {
          async showAllTables() {
            return allTables;
          },
          async addColumn() {},
          async describeTable(tableName) {
            return buildDescribedTable(tableName);
          },
        };
      },
    },
  });

  assert.deepEqual(calls, ['sync:{"alter":true}']);
  assert.equal(result.mode, 'alter');
});

test('syncDatabaseSchema auto-creates newly required tables in local verify mode', async () => {
  const calculationProfileVersionModel = {
    name: 'CalculationProfileVersion',
    getTableName() {
      return 'CalculationProfileVersions';
    },
    getAttributes() {
      return {
        id: { fieldName: 'id' },
        scopeKey: { fieldName: 'scopeKey' },
        version: { fieldName: 'version' },
      };
    },
    async sync() {
      calls.push('CalculationProfileVersions.sync');
      existingTables.add('CalculationProfileVersions');
    },
  };
  const calls = [];
  const existingTables = new Set(allTables.filter((tableName) => tableName !== 'CalculationProfileVersions'));
  const models = [
    ...REQUIRED_SCHEMA_MODELS.filter((model) => model.name !== 'CalculationProfileVersion'),
    calculationProfileVersionModel,
  ];

  const result = await syncDatabaseSchema({
    env: { NODE_ENV: 'development' },
    models,
    database: {
      async sync() {
        throw new Error('database.sync should not run in verify mode');
      },
      getQueryInterface() {
        return {
          async showAllTables() {
            return Array.from(existingTables);
          },
          async addColumn() {},
          async describeTable(tableName) {
            return buildDescribedTable(tableName);
          },
        };
      },
    },
  });

  assert.deepEqual(calls, ['CalculationProfileVersions.sync']);
  assert.equal(result.mode, 'verify');
  assert.deepEqual(result.createdTables, ['CalculationProfileVersions']);
});

test('REQUIRED_SCHEMA_MODELS keeps parent tables before dependent child tables', () => {
  const names = REQUIRED_SCHEMA_MODELS.map((model) => model.name);

  assert.ok(names.indexOf('FinancialProduct') < names.indexOf('Loan'));
  assert.equal(names.includes(['Dag', 'GraphVersion'].join('')), false);
  assert.ok(names.indexOf('User') < names.indexOf('CalculationProfileVersion'));
  assert.ok(names.indexOf('CalculationProfileVersion') < names.indexOf('Loan'));
  assert.ok(names.indexOf('Loan') < names.indexOf('Payment'));
  assert.ok(names.indexOf('User') < names.indexOf('Notification'));
  assert.ok(names.indexOf('User') < names.indexOf('RefreshToken'));
  assert.ok(names.indexOf('User') < names.indexOf('OperatingExpense'));
  assert.ok(names.indexOf('Associate') < names.indexOf('AssociateInstallment'));
  assert.ok(names.indexOf('User') < names.indexOf('AssociateInstallment'));
  assert.ok(names.indexOf('Loan') < names.indexOf('DocumentAttachment'));
  assert.ok(names.indexOf('Payment') < names.indexOf('DocumentAttachment'));
});

test('resetDatabaseSchema drops and recreates the local postgres schema before verifying', async () => {
  const calls = [];

  const result = await resetDatabaseSchema({
    env: { NODE_ENV: 'development' },
    database: {
      getDialect() {
        return 'postgres';
      },
      async query(sql) {
        calls.push(sql);
      },
      async sync(options) {
        calls.push(`sync:${JSON.stringify(options)}`);
      },
      getQueryInterface() {
        return {
          async showAllTables() {
            return allTables;
          },
          async addColumn() {},
          async describeTable(tableName) {
            return buildDescribedTable(tableName);
          },
        };
      },
    },
  });

  assert.deepEqual(calls, [
    'DROP SCHEMA IF EXISTS public CASCADE;',
    'CREATE SCHEMA public;',
    'sync:{"force":false}',
  ]);
  assert.equal(result.status, 'verified');
});
