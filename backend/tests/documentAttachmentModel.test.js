const test = require('node:test');
const assert = require('node:assert/strict');

const models = require('@/models');

const buildAttachment = (overrides = {}) => models.DocumentAttachment.build({
  uploadedByUserId: 1,
  storageDisk: 'local',
  storagePath: 'attachments/soporte.pdf',
  storedName: 'soporte.pdf',
  originalName: 'soporte.pdf',
  sizeBytes: 10,
  ...overrides,
});

test('DocumentAttachment requires exactly one owner with Spanish validation messages', async () => {
  await assert.rejects(
    () => buildAttachment().validate(),
    /El adjunto debe pertenecer a un crédito, pago o cliente/,
  );

  await assert.rejects(
    () => buildAttachment({ loanId: 1, paymentId: 2 }).validate(),
    /El adjunto no puede pertenecer a más de un registro a la vez/,
  );
});
