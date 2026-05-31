const { NotFoundError, ValidationError } = require('@/utils/errorHandler');

const SIGNATURE_LENGTH = 12;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE_PREFIX = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_SIGNATURE_RIFF = Buffer.from([0x52, 0x49, 0x46, 0x46]);
const WEBP_SIGNATURE_WEBP = Buffer.from([0x57, 0x45, 0x42, 0x50]);
const PDF_SIGNATURE = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);

const startsWithSignature = (buffer, signature) => (
  Buffer.isBuffer(buffer) && buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature)
);

const hasWebpSignature = (buffer) => (
  Buffer.isBuffer(buffer)
  && buffer.length >= 12
  && buffer.subarray(0, 4).equals(WEBP_SIGNATURE_RIFF)
  && buffer.subarray(8, 12).equals(WEBP_SIGNATURE_WEBP)
);

const isValidAttachmentSignature = (buffer, mimetype) => {
  if (!Buffer.isBuffer(buffer) || typeof mimetype !== 'string') {
    return false;
  }

  if (mimetype === 'application/pdf') {
    return startsWithSignature(buffer, PDF_SIGNATURE);
  }
  if (mimetype === 'image/png') {
    return startsWithSignature(buffer, PNG_SIGNATURE);
  }
  if (mimetype === 'image/jpeg') {
    return startsWithSignature(buffer, JPEG_SIGNATURE_PREFIX);
  }
  if (mimetype === 'image/webp') {
    return hasWebpSignature(buffer);
  }

  return false;
};

const getMinimumSignatureLength = (mimetype) => {
  if (mimetype === 'image/webp') {
    return 12;
  }
  if (mimetype === 'application/pdf') {
    return PDF_SIGNATURE.length;
  }
  if (mimetype === 'image/png') {
    return PNG_SIGNATURE.length;
  }
  if (mimetype === 'image/jpeg') {
    return JPEG_SIGNATURE_PREFIX.length;
  }
  return 1;
};

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

const validateAttachmentFileSignature = async (file, fsModule) => {
  if (!file?.path || typeof file.mimetype !== 'string') {
    throw new ValidationError('Los datos del archivo adjunto no son válidos');
  }

  let handle;
  try {
    handle = await fsModule.open(file.path, 'r');
    const buffer = Buffer.alloc(SIGNATURE_LENGTH);
    const { bytesRead } = await handle.read(buffer, 0, SIGNATURE_LENGTH, 0);

    const minimumSignatureLength = getMinimumSignatureLength(file.mimetype);

    if (bytesRead < minimumSignatureLength) {
      throw new ValidationError('El archivo adjunto no se puede leer o es demasiado pequeño para el tipo declarado');
    }

    const header = buffer.subarray(0, bytesRead);

    if (!isValidAttachmentSignature(header, file.mimetype)) {
      throw new ValidationError('El contenido del archivo adjunto no coincide con el tipo declarado');
    }
  } finally {
    await handle?.close();
  }
};

module.exports = {
  normalizeAttachmentVisibility,
  ensureUploadedFile,
  withUploadCleanup,
  toTrimmedOrNull,
  buildStoredFileFields,
  ensureDocumentExists,
  resolveDocumentDownload,
  isValidAttachmentSignature,
  validateAttachmentFileSignature,
};
