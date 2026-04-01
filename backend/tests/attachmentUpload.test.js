const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_ALLOWED_ATTACHMENT_MIME_TYPES,
  isAllowedAttachmentMimeType,
} = require('../src/modules/credits/presentation/attachmentUpload');

test('isAllowedAttachmentMimeType allows default supported attachment mime types', () => {
  assert.equal(isAllowedAttachmentMimeType('application/pdf'), true);
  assert.equal(isAllowedAttachmentMimeType('image/jpeg'), true);
  assert.equal(isAllowedAttachmentMimeType('image/png'), true);
  assert.equal(isAllowedAttachmentMimeType('image/webp'), true);
});

test('isAllowedAttachmentMimeType rejects unsupported attachment mime types', () => {
  assert.equal(isAllowedAttachmentMimeType('application/x-msdownload'), false);
  assert.equal(isAllowedAttachmentMimeType('text/html'), false);
  assert.equal(isAllowedAttachmentMimeType(undefined), false);
  assert.equal(isAllowedAttachmentMimeType(null), false);
});

test('default allowed attachment mime types include only the expected safe formats', () => {
  assert.deepEqual(DEFAULT_ALLOWED_ATTACHMENT_MIME_TYPES, [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
});
