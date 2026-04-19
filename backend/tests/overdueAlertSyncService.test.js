const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const { createCreditsInfrastructure } = require('@/modules/credits/infrastructure/repositories');
const { createOverdueAlertScheduler } = require('@/modules/credits/application/overdueAlertScheduler');
const { createOverdueAlertSyncService } = require('@/modules/credits/application/overdueAlertSyncService');
const { createCreateLoanFollowUp } = require('@/modules/credits/application/useCases');

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

test('syncOverdueInstallmentAlerts does not auto-resolve manual payment reminders', async () => {
  const loanAlertModel = createAlertModelDouble();
  const manualReminder = await loanAlertModel.create({
    loanId: 22,
    installmentNumber: 1,
    alertType: 'payment_reminder',
    dueDate: new Date('2026-01-02T00:00:00.000Z'),
    scheduledAmount: 120,
    outstandingAmount: 120,
    status: 'active',
    notes: 'Manual follow-up reminder',
  });

  const { alertRepository } = createCreditsInfrastructure({
    loanAlertModel,
    loanModel: {},
    customerModel: {},

    associateModel: {},
    userModel: {},
    documentAttachmentModel: {},
    promiseToPayModel: {},
    paymentModel: {},
    notifications: {},
    attachmentStorage: {},
  });

  const alerts = await alertRepository.syncOverdueInstallmentAlerts({
    loan: { id: 22, status: 'active' },
    schedule: [],
  });

  assert.equal(alerts.length, 1);
  assert.equal(manualReminder.status, 'active');
  assert.equal(manualReminder.resolutionSource, undefined);
  assert.equal(manualReminder.outstandingAmount, 120);
});

test('syncOverdueInstallmentAlerts ignores manual reminders when creating overdue alerts', async () => {
  const loanAlertModel = createAlertModelDouble();
  await loanAlertModel.create({
    loanId: 22,
    installmentNumber: 1,
    alertType: 'payment_reminder',
    dueDate: new Date('2026-01-02T00:00:00.000Z'),
    scheduledAmount: 120,
    outstandingAmount: 120,
    status: 'active',
    notes: 'Manual follow-up reminder',
  });

  const { alertRepository } = createCreditsInfrastructure({
    loanAlertModel,
    loanModel: {},
    customerModel: {},

    associateModel: {},
    userModel: {},
    documentAttachmentModel: {},
    promiseToPayModel: {},
    paymentModel: {},
    notifications: {},
    attachmentStorage: {},
  });

  const alerts = await alertRepository.syncOverdueInstallmentAlerts({
    loan: { id: 22, status: 'active' },
    schedule: [{
      installmentNumber: 1,
      dueDate: '2026-01-01T00:00:00.000Z',
      remainingPrincipal: 100,
      remainingInterest: 20,
      scheduledPayment: 120,
    }],
  });

  assert.equal(alerts.length, 2);
  assert.equal(alerts.filter((alert) => alert.alertType === 'payment_reminder').length, 1);
  assert.equal(alerts.filter((alert) => alert.alertType === 'overdue_installment').length, 1);
});

test('manual follow-up created through the use case stays active after overdue sync runs', async () => {
  const loanAlertModel = createAlertModelDouble();
  const loan = { id: 22, status: 'active', customerId: 7 };
  const { alertRepository } = createCreditsInfrastructure({
    loanAlertModel,
    loanModel: {},
    customerModel: {},

    associateModel: {},
    userModel: {},
    documentAttachmentModel: {},
    promiseToPayModel: {},
    paymentModel: {},
    notifications: {},
    attachmentStorage: {},
  });

  const createLoanFollowUp = createCreateLoanFollowUp({
    alertRepository,
    loanAccessPolicy: {
      async findAuthorizedMutationLoan({ loanId }) {
        assert.equal(loanId, 22);
        return loan;
      },
    },
    notificationPort: {
      async sendLoanReminder() {},
    },
  });

  const syncService = createOverdueAlertSyncService({
    loanRepository: {
      async listForOverdueAlertSync() {
        return [loan];
      },
    },
    alertRepository,
    loanViewService: {
      getCanonicalLoanView() {
        return {
          schedule: [{
            installmentNumber: 1,
            dueDate: '2020-01-01T00:00:00.000Z',
            remainingPrincipal: 100,
            remainingInterest: 20,
            scheduledPayment: 120,
          }],
        };
      },
    },
  });
  const scheduler = createOverdueAlertScheduler({
    syncService,
    logger: { error() {} },
  });

  const followUpResult = await createLoanFollowUp({
    actor: { id: 9, role: 'admin' },
    loanId: 22,
    payload: {
      installmentNumber: 1,
      dueDate: '2020-01-02T00:00:00.000Z',
      outstandingAmount: 120,
      notes: 'Manual follow-up reminder',
    },
  });
  const syncResult = await scheduler.runSync();
  const alerts = await alertRepository.listByLoan(22);

  const manualReminder = alerts.find((alert) => alert.id === followUpResult.reminder.id);
  const overdueAlert = alerts.find((alert) => alert.alertType === 'overdue_installment');

  assert.equal(syncResult.processedLoans, 1);
  assert.equal(followUpResult.notificationSent, true);
  assert.ok(manualReminder);
  assert.equal(manualReminder.alertType, 'payment_reminder');
  assert.equal(manualReminder.status, 'active');
  assert.equal(manualReminder.resolutionSource, undefined);
  assert.ok(overdueAlert);
  assert.equal(overdueAlert.status, 'active');
  assert.equal(alerts.filter((alert) => alert.alertType === 'payment_reminder').length, 1);
  assert.equal(alerts.filter((alert) => alert.alertType === 'overdue_installment').length, 1);
});
