const { customerValidation } = require('../../middleware/validation');
const { createAuthMiddleware } = require('../shared/auth');
const { createJwtTokenService } = require('../shared/auth/tokenService');
const { createModule } = require('../shared');
const {
  createListCustomers,
  createCreateCustomer,
  createListCustomerDocuments,
  createUploadCustomerDocument,
  createDownloadCustomerDocument,
  createDeleteCustomerDocument,
} = require('./application/useCases');
const { customerRepository } = require('./infrastructure/repositories');
const { createCustomersRouter } = require('./presentation/router');
const { createAttachmentUpload } = require('../credits/presentation/attachmentUpload');
const { createLocalAttachmentStorage } = require('../credits/infrastructure/attachmentStorage');

/**
 * Compose the customers module entrypoint and its router dependencies.
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createCustomersModule = () => {
  const authMiddleware = createAuthMiddleware({ tokenService: createJwtTokenService() });
  const attachmentStorage = createLocalAttachmentStorage();
  const attachmentUpload = createAttachmentUpload({ storage: attachmentStorage });
  const useCases = {
    listCustomers: createListCustomers({ customerRepository }),
    createCustomer: createCreateCustomer({ customerRepository }),
    listCustomerDocuments: createListCustomerDocuments({ customerRepository }),
    uploadCustomerDocument: createUploadCustomerDocument({ customerRepository, attachmentStorage }),
    downloadCustomerDocument: createDownloadCustomerDocument({ customerRepository, attachmentStorage }),
    deleteCustomerDocument: createDeleteCustomerDocument({ customerRepository, attachmentStorage }),
  };

  return createModule({
    name: 'customers',
    basePath: '/api/customers',
    router: createCustomersRouter({ customerValidation, authMiddleware, attachmentUpload, useCases }),
  });
};

module.exports = {
  createCustomersModule,
};
