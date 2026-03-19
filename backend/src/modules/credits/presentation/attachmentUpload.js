const multer = require('multer');

const {
  buildStoredAttachmentName,
  createLocalAttachmentStorage,
} = require('../infrastructure/attachmentStorage');

const createAttachmentUpload = ({
  storage = createLocalAttachmentStorage(),
  maxFileSize = 10 * 1024 * 1024,
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
});

module.exports = {
  createAttachmentUpload,
};
