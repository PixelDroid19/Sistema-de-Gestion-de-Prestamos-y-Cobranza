const test = require('node:test');
const assert = require('node:assert/strict');

const { SequelizeNotificationService } = require('@/modules/notifications/application/notificationService');
const { NotFoundError } = require('@/utils/errorHandler');

test('SequelizeNotificationService.markAsRead uses the shared Spanish not-found error', async () => {
  const service = new SequelizeNotificationService({
    notificationModel: {
      async findByPk() {
        return null;
      },
    },
  });

  await assert.rejects(
    () => service.markAsRead(99),
    (error) => {
      assert.ok(error instanceof NotFoundError);
      assert.equal(error.message, 'La notificación no existe.');
      return true;
    },
  );
});
