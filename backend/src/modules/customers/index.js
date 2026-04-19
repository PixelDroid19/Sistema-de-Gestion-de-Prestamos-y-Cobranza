const { customerValidation } = require('@/middleware/validation');
const { createModule, resolveAuthContext } = require('@/modules/shared');
const {
  createListCustomers,
  createCreateCustomer,
  createFindCustomerByDocument,
  createUpdateCustomer,
  createDeleteCustomer,
  createListCustomerDocuments,
  createUploadCustomerDocument,
  createDownloadCustomerDocument,
  createDeleteCustomerDocument,
  createRestoreCustomer,
} = require('./application/useCases');
const { customerRepository } = require('./infrastructure/repositories');
const { createCustomersRouter } = require('./presentation/router');
const { createAttachmentUpload } = require('@/modules/credits/presentation/attachmentUpload');
const { createLocalAttachmentStorage } = require('@/modules/credits/infrastructure/attachmentStorage');

/**
 * Compose the customers module entrypoint and its router dependencies.
 * @param {{ sharedRuntime?: object, auditService?: object }} [options]
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createCustomersModule = ({ sharedRuntime, auditService } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const attachmentStorage = createLocalAttachmentStorage();
  const attachmentUpload = createAttachmentUpload({ storage: attachmentStorage });
  const useCases = {
    listCustomers: createListCustomers({ customerRepository }),
    createCustomer: createCreateCustomer({ customerRepository, auditService }),
    findCustomerByDocument: createFindCustomerByDocument({ customerRepository }),
    updateCustomer: createUpdateCustomer({ customerRepository, auditService }),
    deleteCustomer: createDeleteCustomer({ customerRepository, auditService }),
    listCustomerDocuments: createListCustomerDocuments({ customerRepository }),
    uploadCustomerDocument: createUploadCustomerDocument({ customerRepository, attachmentStorage, auditService }),
    downloadCustomerDocument: createDownloadCustomerDocument({ customerRepository, attachmentStorage }),
    deleteCustomerDocument: createDeleteCustomerDocument({ customerRepository, attachmentStorage, auditService }),
    restoreCustomer: createRestoreCustomer({ customerRepository, auditService }),
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
