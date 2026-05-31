const crypto = require('node:crypto');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { NotFoundError } = require('@/utils/errorHandler');

const DEFAULT_ATTACHMENT_STORAGE_DIRECTORY = path.resolve(__dirname, '..', '..', '..', '..', 'uploads', 'attachments');
const ATTACHMENT_STORAGE_PATH_MESSAGE = 'La ruta del adjunto debe permanecer dentro del almacenamiento local';

const normalizeStoragePath = (storagePath) => storagePath.split(path.sep).join('/');
const isInsideBaseDirectory = (baseDirectory, absolutePath) => {
  const relativePath = path.relative(baseDirectory, absolutePath);
  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const buildStoredAttachmentExtension = (originalName = '') => {
  const extension = path.extname(originalName || '');
  return /^\.[a-z0-9]{1,20}$/i.test(extension) ? extension.toLowerCase() : '';
};

const buildStoredAttachmentName = (originalName = '') => {
  const extension = buildStoredAttachmentExtension(originalName);
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
};

const createLocalAttachmentStorage = ({
  baseDirectory = DEFAULT_ATTACHMENT_STORAGE_DIRECTORY,
} = {}) => {
  const resolvedBaseDirectory = path.resolve(baseDirectory);

  return {
    baseDirectory: resolvedBaseDirectory,
    ensureDirectory() {
      fs.mkdirSync(resolvedBaseDirectory, { recursive: true });
      return resolvedBaseDirectory;
    },
    toRelativePath(filePath) {
      const absolutePath = path.resolve(filePath);

      if (!isInsideBaseDirectory(resolvedBaseDirectory, absolutePath)) {
        throw new Error(ATTACHMENT_STORAGE_PATH_MESSAGE);
      }

      return normalizeStoragePath(path.relative(resolvedBaseDirectory, absolutePath));
    },
    resolveAbsolutePath(storagePath) {
      const absolutePath = path.resolve(resolvedBaseDirectory, storagePath);

      if (!isInsideBaseDirectory(resolvedBaseDirectory, absolutePath)) {
        throw new Error(ATTACHMENT_STORAGE_PATH_MESSAGE);
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

      const absolutePath = path.resolve(filePath);

      if (!isInsideBaseDirectory(resolvedBaseDirectory, absolutePath)) {
        return;
      }

      await fsPromises.rm(absolutePath, { force: true });
    },
  };
};

module.exports = {
  ATTACHMENT_STORAGE_PATH_MESSAGE,
  DEFAULT_ATTACHMENT_STORAGE_DIRECTORY,
  buildStoredAttachmentName,
  createLocalAttachmentStorage,
};
