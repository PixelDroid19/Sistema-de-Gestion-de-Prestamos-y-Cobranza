const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  SCHEMA_MODES,
  assertResetAllowed,
  buildRequiredSchema,
  REQUIRED_SCHEMA_MODELS,
  resolveSchemaMode,
  resetDatabaseSchema,
  syncDatabaseSchema,
  verifyRequiredSchema,
} = require('@/bootstrap/schema');

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
    return { id: {}, name: {}, email: {}, phone: {}, address: {}, status: {}, participationPercentage: {}, notes: {}, createdAt: {}, updatedAt: {} };
  }

  if (tableName === 'Loans') {
    return {
      id: {}, customerId: {}, associateId: {}, dagGraphVersionId: {}, amount: {}, interestRate: {}, termMonths: {}, status: {},
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

  if (tableName === 'DagGraphVersions') {
    return {
      id: {}, scopeKey: {}, name: {}, description: {}, version: {}, status: {}, graph: {}, graphSummary: {}, validation: {}, createdByUserId: {}, commitMessage: {}, authorName: {}, authorEmail: {}, restoredFromVersionId: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'DagVariables') {
    return {
      id: {}, name: {}, type: {}, source: {}, description: {}, status: {}, usageCount: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'DagSimulationSummaries') {
    return {
      id: {}, scopeKey: {}, graphVersionId: {}, createdByUserId: {}, selectedSource: {}, fallbackReason: {}, parity: {}, simulationInput: {}, summary: {}, schedulePreview: {}, createdAt: {}, updatedAt: {},
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
      id: {}, associateId: {}, amount: {}, contributionDate: {}, createdByUserId: {}, notes: {}, createdAt: {}, updatedAt: {},
    };
  }

  if (tableName === 'AssociateInstallments') {
    return {
      id: {}, associateId: {}, installmentNumber: {}, amount: {}, dueDate: {}, status: {}, paidAt: {}, paidBy: {}, createdAt: {}, updatedAt: {},
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
      id: {}, userId: {}, userName: {}, action: {}, module: {}, entityId: {}, entityType: {},
      previousData: {}, newData: {}, metadata: {}, ip: {}, userAgent: {}, timestamp: {}, createdAt: {}, updatedAt: {},
    };
  }

  return {
    id: {}, loanId: {}, amount: {}, paymentDate: {}, status: {}, principalApplied: {}, interestApplied: {},
    penaltyApplied: {}, paymentType: {}, overpaymentAmount: {}, remainingBalanceAfterPayment: {}, allocationBreakdown: {}, paymentMetadata: {},
    paymentMethod: {}, installmentNumber: {}, annulledFromInstallment: {}, createdAt: {}, updatedAt: {},
  };
};

const allTables = ['Customers', 'Associates', 'Loans', 'Payments', 'DocumentAttachments', 'LoanAlerts', 'PromiseToPays', 'AssociateContributions', 'AssociateInstallments', 'ProfitDistributions', 'IdempotencyKeys', 'Notifications', 'PushSubscriptions', 'Users', 'AuditLogs', 'DagGraphVersions', 'DagSimulationSummaries', 'DagVariables', 'FinancialProducts', 'OutboxEvents', 'ConfigEntries', 'refresh_tokens', 'rate_limit_entries'];

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
  const dagGraphVersions = requiredSchema.find((entry) => entry.tableName === 'DagGraphVersions');
  const dagSimulationSummaries = requiredSchema.find((entry) => entry.tableName === 'DagSimulationSummaries');
  const financialProducts = requiredSchema.find((entry) => entry.tableName === 'FinancialProducts');
  const outboxEvents = requiredSchema.find((entry) => entry.tableName === 'OutboxEvents');
  const configEntries = requiredSchema.find((entry) => entry.tableName === 'ConfigEntries');
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
  assert.ok(dagGraphVersions);
  assert.ok(dagSimulationSummaries);
  assert.ok(financialProducts);
  assert.ok(outboxEvents);
  assert.ok(configEntries);
  assert.ok(rateLimitEntries);
  assert.ok(requiredSchema.find((entry) => entry.tableName === 'AuditLogs'));
  assert.ok(requiredSchema.find((entry) => entry.tableName === 'Users').columns.includes('associateId'));
  assert.ok(requiredSchema.find((entry) => entry.tableName === 'Users').columns.includes('failedLoginAttempts'));
  assert.ok(requiredSchema.find((entry) => entry.tableName === 'Users').columns.includes('lockedUntil'));
  assert.ok(associates.columns.includes('email'));
  assert.ok(associates.columns.includes('participationPercentage'));
  assert.ok(loans.columns.includes('associateId'));
  assert.ok(loans.columns.includes('dagGraphVersionId'));
  assert.ok(loans.columns.includes('financialProductId'));
  assert.ok(loans.columns.includes('closedAt'));
  assert.ok(loans.columns.includes('closureReason'));
  assert.ok(loans.columns.includes('financialBlock'));
  assert.ok(payments.columns.includes('allocationBreakdown'));
  assert.ok(payments.columns.includes('paymentType'));
  assert.ok(payments.columns.includes('paymentMetadata'));
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
  assert.ok(dagGraphVersions.columns.includes('graphSummary'));
  assert.ok(dagGraphVersions.columns.includes('description'));
  assert.ok(dagGraphVersions.columns.includes('status'));
  assert.ok(dagSimulationSummaries.columns.includes('selectedSource'));
  assert.ok(financialProducts.columns.includes('penaltyRate'));
  assert.ok(outboxEvents.columns.includes('eventType'));
  assert.ok(configEntries.columns.includes('category'));
  assert.ok(configEntries.columns.includes('value'));
  assert.ok(rateLimitEntries.columns.includes('keyPrefix'));
  assert.ok(rateLimitEntries.columns.includes('identifier'));
  assert.ok(rateLimitEntries.columns.includes('created_at'));
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
  const dagGraphVersionModel = {
    name: 'DagGraphVersion',
    getTableName() {
      return 'DagGraphVersions';
    },
    getAttributes() {
      return {
        id: { fieldName: 'id' },
        scopeKey: { fieldName: 'scopeKey' },
      };
    },
    async sync() {
      calls.push('DagGraphVersions.sync');
      existingTables.add('DagGraphVersions');
    },
  };
  const dagSimulationSummaryModel = {
    name: 'DagSimulationSummary',
    getTableName() {
      return 'DagSimulationSummaries';
    },
    getAttributes() {
      return {
        id: { fieldName: 'id' },
        scopeKey: { fieldName: 'scopeKey' },
      };
    },
    async sync() {
      calls.push('DagSimulationSummaries.sync');
      existingTables.add('DagSimulationSummaries');
    },
  };
  const calls = [];
  const existingTables = new Set(allTables.filter((tableName) => !['DagGraphVersions', 'DagSimulationSummaries'].includes(tableName)));
  const models = [
    ...REQUIRED_SCHEMA_MODELS.filter((model) => !['DagGraphVersion', 'DagSimulationSummary'].includes(model.name)),
    dagGraphVersionModel,
    dagSimulationSummaryModel,
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

  assert.deepEqual(calls, ['DagGraphVersions.sync', 'DagSimulationSummaries.sync']);
  assert.equal(result.mode, 'verify');
  assert.deepEqual(result.createdTables, ['DagGraphVersions', 'DagSimulationSummaries']);
});

test('REQUIRED_SCHEMA_MODELS keeps parent tables before dependent child tables', () => {
  const names = REQUIRED_SCHEMA_MODELS.map((model) => model.name);

  assert.ok(names.indexOf('FinancialProduct') < names.indexOf('Loan'));
  assert.ok(names.indexOf('User') < names.indexOf('DagGraphVersion'));
  assert.ok(names.indexOf('DagGraphVersion') < names.indexOf('Loan'));
  assert.ok(names.indexOf('Loan') < names.indexOf('Payment'));
  assert.ok(names.indexOf('User') < names.indexOf('Notification'));
  assert.ok(names.indexOf('User') < names.indexOf('RefreshToken'));
  assert.ok(names.indexOf('Associate') < names.indexOf('AssociateInstallment'));
  assert.ok(names.indexOf('User') < names.indexOf('AssociateInstallment'));
  assert.ok(names.indexOf('Loan') < names.indexOf('DocumentAttachment'));
  assert.ok(names.indexOf('Payment') < names.indexOf('DocumentAttachment'));
});

test('syncDatabaseSchema keeps failing on missing tables outside safe local environments', async () => {
  const dagGraphVersionModel = {
    name: 'DagGraphVersion',
    getTableName() {
      return 'DagGraphVersions';
    },
    getAttributes() {
      return {
        id: { fieldName: 'id' },
      };
    },
    async sync() {
      throw new Error('should not auto-create tables in production verify mode');
    },
  };

  await assert.rejects(() => syncDatabaseSchema({
    env: { NODE_ENV: 'production' },
    models: [dagGraphVersionModel],
    database: {
      getQueryInterface() {
        return {
          async showAllTables() {
            return [];
          },
          async describeTable() {
            return {};
          },
        };
      },
    },
  }), /Missing table "DagGraphVersions"/);
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
