const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRequiredSchema,
  resetDatabaseSchema,
  syncDatabaseSchema,
  verifyRequiredSchema,
} = require('../src/bootstrap/schema');

test('buildRequiredSchema derives required tables and columns from runtime models', () => {
  const requiredSchema = buildRequiredSchema();
  const associates = requiredSchema.find((entry) => entry.tableName === 'Associates');
  const loans = requiredSchema.find((entry) => entry.tableName === 'Loans');
  const payments = requiredSchema.find((entry) => entry.tableName === 'Payments');

  assert.ok(associates);
  assert.ok(loans);
  assert.ok(payments);
  assert.ok(associates.columns.includes('email'));
  assert.ok(loans.columns.includes('associateId'));
  assert.ok(payments.columns.includes('allocationBreakdown'));
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
      async sync() {
        calls.push('sync');
      },
      getQueryInterface() {
        return {
          async showAllTables() {
            return ['Associates', 'Loans', 'Payments'];
          },
          async describeTable(tableName) {
            if (tableName === 'Associates') {
              return { id: {}, name: {}, email: {}, phone: {}, address: {}, status: {}, notes: {}, createdAt: {}, updatedAt: {} };
            }

            if (tableName === 'Loans') {
              return {
                id: {}, customerId: {}, associateId: {}, amount: {}, interestRate: {}, termMonths: {}, status: {},
                startDate: {}, endDate: {}, agentId: {}, emiSchedule: {}, installmentAmount: {}, totalPayable: {},
                totalPaid: {}, principalOutstanding: {}, interestOutstanding: {}, lastPaymentDate: {}, lateFeeMode: {},
                financialSnapshot: {}, recoveryStatus: {}, createdAt: {}, updatedAt: {},
              };
            }

            return {
              id: {}, loanId: {}, amount: {}, paymentDate: {}, status: {}, principalApplied: {}, interestApplied: {},
              overpaymentAmount: {}, remainingBalanceAfterPayment: {}, allocationBreakdown: {}, createdAt: {}, updatedAt: {},
            };
          },
        };
      },
    },
  });

  assert.deepEqual(calls, ['sync']);
  assert.equal(result.mode, 'sync');
  assert.deepEqual(result.tables, ['Associates', 'Loans', 'Payments']);
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
            return ['Associates', 'Loans', 'Payments'];
          },
          async describeTable(tableName) {
            if (tableName === 'Associates') {
              return { id: {}, name: {}, email: {}, phone: {}, address: {}, status: {}, notes: {}, createdAt: {}, updatedAt: {} };
            }

            if (tableName === 'Loans') {
              return {
                id: {}, customerId: {}, associateId: {}, amount: {}, interestRate: {}, termMonths: {}, status: {},
                startDate: {}, endDate: {}, agentId: {}, emiSchedule: {}, installmentAmount: {}, totalPayable: {},
                totalPaid: {}, principalOutstanding: {}, interestOutstanding: {}, lastPaymentDate: {}, lateFeeMode: {},
                financialSnapshot: {}, recoveryStatus: {}, createdAt: {}, updatedAt: {},
              };
            }

            return {
              id: {}, loanId: {}, amount: {}, paymentDate: {}, status: {}, principalApplied: {}, interestApplied: {},
              overpaymentAmount: {}, remainingBalanceAfterPayment: {}, allocationBreakdown: {}, createdAt: {}, updatedAt: {},
            };
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
