const multer = require('multer');

const {
  buildStoredAttachmentName,
  createLocalAttachmentStorage,
} = require('../infrastructure/attachmentStorage');

const DEFAULT_ALLOWED_ATTACHMENT_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const isAllowedAttachmentMimeType = (mimetype, allowedMimeTypes = DEFAULT_ALLOWED_ATTACHMENT_MIME_TYPES) => (
  typeof mimetype === 'string' && allowedMimeTypes.includes(mimetype)
);

const createAttachmentUpload = ({
  storage = createLocalAttachmentStorage(),
  maxFileSize = 10 * 1024 * 1024,
  allowedMimeTypes = DEFAULT_ALLOWED_ATTACHMENT_MIME_TYPES,
} = {}) => multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      callback(null, storage.ensureDirectory());
    },
    filename(req, file, callback) {
      callback(null, buildStoredAttachmentName(file.originalname));
    },
  }),
  limits: {
    fileSize: maxFileSize,
  },
  fileFilter(req, file, callback) {
    if (!isAllowedAttachmentMimeType(file?.mimetype, allowedMimeTypes)) {
      const error = new Error('Unsupported attachment file type');
      error.statusCode = 400;
      return callback(error);
    }

    return callback(null, true);
  },
});

module.exports = {
  createAttachmentUpload,
  DEFAULT_ALLOWED_ATTACHMENT_MIME_TYPES,
  isAllowedAttachmentMimeType,
};
