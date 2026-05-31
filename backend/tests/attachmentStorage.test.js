const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  buildStoredAttachmentName,
  createLocalAttachmentStorage,
} = require('@/modules/credits/infrastructure/attachmentStorage');

test('stored attachment names reject unsafe characters from the original extension', () => {
  const storedName = buildStoredAttachmentName('soporte.pdf\r\nmalicious');

  assert.match(storedName, /^\d+-[a-f0-9]{16}$/);
  assert.doesNotMatch(storedName, /[\r\n"\\/]/);
});

test('local attachment storage rejects relative paths for files outside the base directory', async () => {
  const baseDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'attachments-base-'));
  const outsideDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'attachments-outside-'));
  const storage = createLocalAttachmentStorage({ baseDirectory });

  try {
    assert.throws(
      () => storage.toRelativePath(path.join(outsideDirectory, 'outside.pdf')),
      /La ruta del adjunto debe permanecer dentro del almacenamiento local/,
    );
  } finally {
    await fs.rm(baseDirectory, { recursive: true, force: true });
    await fs.rm(outsideDirectory, { recursive: true, force: true });
  }
});

test('local attachment storage does not delete files outside the base directory', async () => {
  const baseDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'attachments-base-'));
  const outsideDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'attachments-outside-'));
  const outsideFile = path.join(outsideDirectory, 'outside.pdf');
  await fs.writeFile(outsideFile, 'keep');

  const storage = createLocalAttachmentStorage({ baseDirectory });

  try {
    await storage.deleteByAbsolutePath(outsideFile);

    assert.equal(await fs.readFile(outsideFile, 'utf8'), 'keep');
  } finally {
    await fs.rm(baseDirectory, { recursive: true, force: true });
    await fs.rm(outsideDirectory, { recursive: true, force: true });
  }
});
