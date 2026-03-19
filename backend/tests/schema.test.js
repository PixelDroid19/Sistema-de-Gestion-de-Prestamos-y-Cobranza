const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRequiredSchema,
  resetDatabaseSchema,
  syncDatabaseSchema,
  verifyRequiredSchema,
} = require('../src/bootstrap/schema');

const buildDescribedTable = (tableName) => {
  if (tableName === 'Associates') {
    return { id: {}, name: {}, email: {}, phone: {}, address: {}, status: {}, participationPercentage: {}, notes: {}, createdAt: {}, updatedAt: {} };
  }

  if (tableName === 'Loans') {
    return {
      id: {}, customerId: {}, associateId: {}, amount: {}, interestRate: {}, termMonths: {}, status: {},
      startDate: {}, endDate: {}, agentId: {}, emiSchedule: {}, installmentAmount: {}, totalPayable: {},
      totalPaid: {}, principalOutstanding: {}, interestOutstanding: {}, lastPaymentDate: {}, lateFeeMode: {},
      financialSnapshot: {}, closedAt: {}, closureReason: {}, recoveryStatus: {}, createdAt: {}, updatedAt: {},
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
      id: {}, name: {}, email: {}, password: {}, role: {}, associateId: {}, createdAt: {}, updatedAt: {},
    };
  }

  return {
    id: {}, loanId: {}, amount: {}, paymentDate: {}, status: {}, principalApplied: {}, interestApplied: {},
    paymentType: {}, overpaymentAmount: {}, remainingBalanceAfterPayment: {}, allocationBreakdown: {}, paymentMetadata: {}, createdAt: {}, updatedAt: {},
  };
};

const allTables = ['Associates', 'Loans', 'Payments', 'DocumentAttachments', 'LoanAlerts', 'PromiseToPays', 'AssociateContributions', 'ProfitDistributions', 'IdempotencyKeys', 'Notifications', 'PushSubscriptions', 'Users'];

test('buildRequiredSchema derives required tables and columns from runtime models', () => {
  const requiredSchema = buildRequiredSchema();
  const associates = requiredSchema.find((entry) => entry.tableName === 'Associates');
  const loans = requiredSchema.find((entry) => entry.tableName === 'Loans');
  const payments = requiredSchema.find((entry) => entry.tableName === 'Payments');
  const attachments = requiredSchema.find((entry) => entry.tableName === 'DocumentAttachments');
  const alerts = requiredSchema.find((entry) => entry.tableName === 'LoanAlerts');
  const promises = requiredSchema.find((entry) => entry.tableName === 'PromiseToPays');
  const contributions = requiredSchema.find((entry) => entry.tableName === 'AssociateContributions');
  const distributions = requiredSchema.find((entry) => entry.tableName === 'ProfitDistributions');
  const idempotencyKeys = requiredSchema.find((entry) => entry.tableName === 'IdempotencyKeys');
  const notifications = requiredSchema.find((entry) => entry.tableName === 'Notifications');
  const pushSubscriptions = requiredSchema.find((entry) => entry.tableName === 'PushSubscriptions');

  assert.ok(associates);
  assert.ok(loans);
  assert.ok(payments);
  assert.ok(attachments);
  assert.ok(alerts);
  assert.ok(promises);
  assert.ok(contributions);
  assert.ok(distributions);
  assert.ok(idempotencyKeys);
  assert.ok(notifications);
  assert.ok(pushSubscriptions);
  assert.ok(requiredSchema.find((entry) => entry.tableName === 'Users').columns.includes('associateId'));
  assert.ok(associates.columns.includes('email'));
  assert.ok(associates.columns.includes('participationPercentage'));
  assert.ok(loans.columns.includes('associateId'));
  assert.ok(loans.columns.includes('closedAt'));
  assert.ok(loans.columns.includes('closureReason'));
  assert.ok(payments.columns.includes('allocationBreakdown'));
  assert.ok(payments.columns.includes('paymentType'));
  assert.ok(payments.columns.includes('paymentMetadata'));
  assert.ok(attachments.columns.includes('customerId'));
  assert.ok(attachments.columns.includes('customerVisible'));
  assert.ok(alerts.columns.includes('outstandingAmount'));
  assert.ok(promises.columns.includes('statusHistory'));
  assert.ok(idempotencyKeys.columns.includes('idempotencyKey'));
  assert.ok(idempotencyKeys.columns.includes('responsePayload'));
  assert.ok(notifications.columns.includes('payload'));
  assert.ok(pushSubscriptions.columns.includes('providerKey'));
  assert.ok(pushSubscriptions.columns.includes('endpointHash'));
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

test('syncDatabaseSchema syncs and verifies schema without destructive reset by default', async () => {
  const calls = [];

  const result = await syncDatabaseSchema({
    env: { NODE_ENV: 'development', DB_RESET_ON_BOOT: 'false' },
    database: {
      async sync(options) {
        calls.push(`sync:${JSON.stringify(options)}`);
      },
      getQueryInterface() {
        return {
          async showAllTables() {
            return allTables;
          },
          async describeTable(tableName) {
            return buildDescribedTable(tableName);
          },
        };
      },
    },
  });

  assert.deepEqual(calls, ['sync:{"alter":true}']);
  assert.equal(result.mode, 'sync');
  assert.deepEqual(result.tables, allTables);
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
