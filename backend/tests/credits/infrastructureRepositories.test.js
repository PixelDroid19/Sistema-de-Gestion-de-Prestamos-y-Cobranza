const test = require('node:test');
const assert = require('node:assert/strict');

const { createCreditsInfrastructure } = require('@/modules/credits/infrastructure/repositories');

test('credits notification port emits Spanish operational messages', async () => {
  const sentNotifications = [];
  const { notificationPort } = createCreditsInfrastructure({
    notifications: {
      async sendNotification(userId, message, type, payload, options) {
        sentNotifications.push({ userId, message, type, payload, options });
      },
    },
  });

  await notificationPort.sendLoanReminder(9, {
    loanId: 23,
    installmentNumber: 2,
    dueDate: '2026-03-25',
    alertId: 7,
  });
  await notificationPort.sendPaymentRegistered(11, {
    loanId: 25,
    paymentId: 15,
    amount: 125000,
  });
  await notificationPort.sendPromiseStatus(10, {
    loanId: 24,
    promiseId: 4,
    status: 'broken',
  });

  assert.deepEqual(sentNotifications.map((notification) => notification.type), [
    'loan_reminder',
    'payment_registered',
    'promise_status',
  ]);
  assert.match(sentNotifications[0].message, /Recordatorio del crédito #23/);
  assert.match(sentNotifications[1].message, /Pago registrado en el crédito #25/);
  assert.match(sentNotifications[2].message, /Promesa de pago del crédito #24/);
  assert.match(sentNotifications[2].message, /Incumplida/);
  sentNotifications.forEach((notification) => {
    assert.doesNotMatch(notification.message, /Loan|Promise to pay|Unknown|customer/i);
  });
});

test('promise expiration respects the Bogotá operational day by default', async () => {
  const promise = {
    id: 4,
    loanId: 22,
    status: 'pending',
    promisedDate: '2026-04-01T00:00:00.000Z',
    statusHistory: [],
    async update(patch) {
      Object.assign(this, patch);
      return this;
    },
  };
  const promiseToPayModel = {
    async findAll() {
      return [promise];
    },
  };
  const { promiseRepository } = createCreditsInfrastructure({
    clock: () => new Date('2026-04-02T02:30:00.000Z'),
    promiseToPayModel,
  });

  const promises = await promiseRepository.expireBrokenPromises({ loanId: 22 });

  assert.equal(promise.status, 'pending');
  assert.equal(promise.statusHistory.length, 0);
  assert.equal(promises[0].status, 'pending');
});
