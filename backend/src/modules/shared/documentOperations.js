const { NotFoundError } = require('@/utils/errorHandler');

const normalizeAttachmentVisibility = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  return false;
};

const ensureUploadedFile = (file, errorFactory) => {
  if (!file) {
    throw errorFactory();
  }
};

const withUploadCleanup = async ({ file, attachmentStorage, task }) => {
  try {
    return await task();
  } catch (error) {
    if (file?.path) {
      await attachmentStorage.deleteByAbsolutePath(file.path);
    }
    throw error;
  }
};

const toTrimmedOrNull = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
};

const buildStoredFileFields = ({ file, attachmentStorage }) => ({
  storageDisk: 'local',
  storagePath: attachmentStorage.toRelativePath(file.path),
  storedName: file.filename,
  originalName: file.originalname,
  mimeType: file.mimetype,
  sizeBytes: file.size,
});

const ensureDocumentExists = (document, label = 'Document') => {
  if (!document) {
    throw new NotFoundError(label);
  }
  return document;
};

const resolveDocumentDownload = async ({ attachmentStorage, storagePath }) => {
  await attachmentStorage.assertExists(storagePath);
  return attachmentStorage.resolveAbsolutePath(storagePath);
};

module.exports = {
  normalizeAttachmentVisibility,
  ensureUploadedFile,
  withUploadCleanup,
  toTrimmedOrNull,
  buildStoredFileFields,
  ensureDocumentExists,
  resolveDocumentDownload,
};
