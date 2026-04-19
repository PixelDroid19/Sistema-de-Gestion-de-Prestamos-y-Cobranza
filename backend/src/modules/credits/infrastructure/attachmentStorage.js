const crypto = require('node:crypto');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { NotFoundError } = require('@/utils/errorHandler');

const DEFAULT_ATTACHMENT_STORAGE_DIRECTORY = path.resolve(__dirname, '..', '..', '..', '..', 'uploads', 'attachments');

const normalizeStoragePath = (storagePath) => storagePath.split(path.sep).join('/');
const isInsideBaseDirectory = (baseDirectory, absolutePath) => {
  const relativePath = path.relative(baseDirectory, absolutePath);
  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const buildStoredAttachmentName = (originalName = '') => {
  const extension = path.extname(originalName || '').slice(0, 20);
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
};

const createLocalAttachmentStorage = ({
  baseDirectory = DEFAULT_ATTACHMENT_STORAGE_DIRECTORY,
} = {}) => ({
  baseDirectory,
  ensureDirectory() {
    fs.mkdirSync(baseDirectory, { recursive: true });
    return baseDirectory;
  },
  toRelativePath(filePath) {
    return normalizeStoragePath(path.relative(baseDirectory, filePath));
  },
  resolveAbsolutePath(storagePath) {
    const absolutePath = path.resolve(baseDirectory, storagePath);

    if (!isInsideBaseDirectory(baseDirectory, absolutePath)) {
      throw new Error('Attachment storage path must stay within the local storage directory');
    }

    return absolutePath;
  },
  async assertExists(storagePath) {
    try {
      await fsPromises.access(this.resolveAbsolutePath(storagePath));
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new NotFoundError('Attachment file');
      }

      throw error;
    }
  },
  async deleteByAbsolutePath(filePath) {
    if (!filePath) {
      return;
    }

    await fsPromises.rm(filePath, { force: true });
  },
});

module.exports = {
  DEFAULT_ATTACHMENT_STORAGE_DIRECTORY,
  buildStoredAttachmentName,
  createLocalAttachmentStorage,
};
