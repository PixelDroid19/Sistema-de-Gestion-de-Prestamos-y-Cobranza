const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const { createCreditsInfrastructure } = require('../src/modules/credits/infrastructure/repositories');
const { createOverdueAlertScheduler } = require('../src/modules/credits/application/overdueAlertScheduler');
const { createOverdueAlertSyncService } = require('../src/modules/credits/application/overdueAlertSyncService');

const createAlertModelDouble = () => {
  const records = [];
  let nextId = 1;

  const attachUpdate = (record) => ({
    ...record,
    async update(patch) {
      Object.assign(this, patch);
      return this;
    },
  });

  return {
    records,
    async findAll({ where } = {}) {
      const filtered = where?.loanId === undefined
        ? records
        : records.filter((record) => record.loanId === where.loanId);

      return filtered;
    },
    async create(payload) {
      const record = attachUpdate({
        id: nextId++,
        createdAt: new Date().toISOString(),
        ...payload,
      });
      records.push(record);
      return record;
    },
  };
};

test('scheduler overdue sync stays idempotent across repeated runs', async () => {
  const loanAlertModel = createAlertModelDouble();
  const { alertRepository } = createCreditsInfrastructure({
    loanAlertModel,
    loanModel: {},
    customerModel: {},
    agentModel: {},
    associateModel: {},
    userModel: {},
    documentAttachmentModel: {},
    promiseToPayModel: {},
    paymentModel: {},
    notifications: {},
    attachmentStorage: {},
  });

  const loan = { id: 22, status: 'active' };
  const schedule = [
    {
      installmentNumber: 1,
      dueDate: '2026-01-01T00:00:00.000Z',
      remainingPrincipal: 100,
      remainingInterest: 20,
      scheduledPayment: 120,
    },
  ];
  const syncService = createOverdueAlertSyncService({
    loanRepository: {
      async listForOverdueAlertSync() {
        return [loan];
      },
    },
    alertRepository,
    loanViewService: {
      getCanonicalLoanView() {
        return { schedule };
      },
    },
  });
  const scheduler = createOverdueAlertScheduler({
    syncService,
    logger: { error() {} },
  });

  const firstRun = await scheduler.runSync();
  const secondRun = await scheduler.runSync();

  assert.equal(firstRun.processedLoans, 1);
  assert.equal(secondRun.processedLoans, 1);
  assert.equal(loanAlertModel.records.length, 1);
  assert.equal(loanAlertModel.records[0].loanId, 22);
  assert.equal(loanAlertModel.records[0].installmentNumber, 1);
  assert.equal(firstRun.results[0].alertCount, 1);
  assert.equal(secondRun.results[0].alertCount, 1);
});

test('createCreditsInfrastructure builds overdue-sync loan queries with Sequelize operators', async () => {
  let receivedQuery = null;
  const { loanRepository } = createCreditsInfrastructure({
    loanModel: {
      async findAll(query) {
        receivedQuery = query;
        return [];
      },
    },
    customerModel: {},
    agentModel: {},
    associateModel: {},
    userModel: {},
    documentAttachmentModel: {},
    loanAlertModel: {},
    promiseToPayModel: {},
    paymentModel: {},
    notifications: {},
    attachmentStorage: {},
  });

  await loanRepository.listForOverdueAlertSync();

  assert.deepEqual(receivedQuery.order, [['updatedAt', 'DESC']]);
  assert.deepEqual(receivedQuery.status, undefined);
  assert.deepEqual(receivedQuery.where.status[Op.in], ['approved', 'active', 'defaulted', 'closed']);
});
