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

  await notificationPort.sendRecoveryAssignment(8, {
    loanId: 22,
    loanAmount: 1500000,
    customerName: 'Ana Cliente',
  });
  await notificationPort.sendLoanReminder(9, {
    loanId: 23,
    installmentNumber: 2,
    dueDate: '2026-03-25',
    alertId: 7,
  });
  await notificationPort.sendPromiseStatus(10, {
    loanId: 24,
    promiseId: 4,
    status: 'broken',
  });

  assert.deepEqual(sentNotifications.map((notification) => notification.type), [
    'loan_assignment',
    'loan_reminder',
    'promise_status',
  ]);
  assert.match(sentNotifications[0].message, /Crédito #22/);
  assert.match(sentNotifications[0].message, /Ana Cliente/);
  assert.match(sentNotifications[1].message, /Recordatorio del crédito #23/);
  assert.match(sentNotifications[2].message, /Promesa de pago del crédito #24/);
  assert.match(sentNotifications[2].message, /Incumplida/);
  sentNotifications.forEach((notification) => {
    assert.doesNotMatch(notification.message, /Loan|Promise to pay|Unknown|customer/i);
  });
});
