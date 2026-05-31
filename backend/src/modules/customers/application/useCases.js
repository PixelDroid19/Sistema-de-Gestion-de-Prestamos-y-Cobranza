const { AuthorizationError, NotFoundError, ValidationError } = require('@/utils/errorHandler');
const { withAudit } = require('@/modules/audit/application/auditDecorator');
const {
  normalizeAttachmentVisibility,
  ensureUploadedFile,
  withUploadCleanup,
  toTrimmedOrNull,
  buildStoredFileFields,
  ensureDocumentExists,
  resolveDocumentDownload,
  validateAttachmentFileSignature,
} = require('@/modules/shared/documentOperations');

const enrichCustomersWithLoanSummaries = async ({ customerRepository, result }) => {
  if (typeof customerRepository.attachLoanSummaries !== 'function') {
    return result;
  }

  if (Array.isArray(result)) {
    return customerRepository.attachLoanSummaries(result);
  }

  if (Array.isArray(result?.items)) {
    return {
      ...result,
      items: await customerRepository.attachLoanSummaries(result.items),
    };
  }

  return result;
};

const isCustomerPrimaryKeyConflict = (error) => {
  if (error?.name !== 'SequelizeUniqueConstraintError') {
    return false;
  }

  const constraintName = String(error?.parent?.constraint || error?.original?.constraint || '').trim();
  if (constraintName === 'Customers_pkey') {
    return true;
  }

  return /Customers_pkey/u.test(String(error?.message || ''));
};

const ALLOWED_CUSTOMER_STATUSES = new Set(['active', 'inactive', 'blacklisted']);
const ALLOWED_CUSTOMER_REGISTERED_WINDOWS = new Set(['today', 'week', 'month', 'year']);
const CUSTOMER_DOCUMENT_ACCESS_MESSAGE = 'Solo usuarios administrativos autorizados pueden acceder a documentos de clientes.';
const CUSTOMER_REGISTERED_WITHIN_MESSAGE = 'El filtro de fecha de registro debe ser hoy, semana, mes o año.';
const CUSTOMER_DOCUMENT_NUMBER_REQUIRED_MESSAGE = 'El número de documento es obligatorio.';
const CUSTOMER_NOT_DELETED_MESSAGE = 'El cliente no está eliminado.';

const normalizeCustomerListFilters = (filters = {}) => {
  const normalized = {};

  const rawSearch = String(filters.search || '').trim();
  if (rawSearch) {
    normalized.search = rawSearch;
  }

  const rawStatus = String(filters.status || '').trim().toLowerCase();
  if (rawStatus) {
    if (!ALLOWED_CUSTOMER_STATUSES.has(rawStatus)) {
      throw new ValidationError('Filtro de estado de cliente inválido.');
    }
    normalized.status = rawStatus;
  }

  const rawRegisteredWithin = String(filters.registeredWithin || '').trim().toLowerCase();
  if (rawRegisteredWithin) {
    if (!ALLOWED_CUSTOMER_REGISTERED_WINDOWS.has(rawRegisteredWithin)) {
      throw new ValidationError(CUSTOMER_REGISTERED_WITHIN_MESSAGE);
    }
    normalized.registeredWithin = rawRegisteredWithin;
  }

  return normalized;
};

/**
 * Create the use case that lists customers in repository-defined order.
 * @param {{ customerRepository: object }} dependencies
 * @returns {Function}
 */
const createListCustomers = ({ customerRepository }) => async ({ pagination, filters } = {}) => {
  const normalizedFilters = normalizeCustomerListFilters(filters);

  if (pagination) {
    const result = await customerRepository.listPage({ ...pagination, filters: normalizedFilters });
    return enrichCustomersWithLoanSummaries({ customerRepository, result });
  }

  const customers = await customerRepository.list(normalizedFilters);
  return enrichCustomersWithLoanSummaries({ customerRepository, result: customers });
};

const createGetCustomerById = ({ customerRepository }) => async ({ customerId }) => {
  const customer = await customerRepository.findById(customerId);
  if (!customer) {
    throw new NotFoundError('Customer');
  }

  const [enrichedCustomer] = await enrichCustomersWithLoanSummaries({
    customerRepository,
    result: [customer],
  });

  return enrichedCustomer || customer;
};

/**
 * Create the use case that persists a new customer record.
 * @param {{ customerRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createCreateCustomer = ({ customerRepository, auditService }) => {
  const useCase = async ({ payload }) => {
    try {
      return await customerRepository.create(payload);
    } catch (error) {
      if (!isCustomerPrimaryKeyConflict(error) || typeof customerRepository.syncPrimaryKeySequence !== 'function') {
        throw error;
      }

      await customerRepository.syncPrimaryKeySequence();
      return customerRepository.create(payload);
    }
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'customers', getEntityId: (p) => p?.id, getEntityType: () => 'Customer' })(useCase);
  }
  return useCase;
};

const createFindCustomerByDocument = ({ customerRepository }) => async ({ documentNumber }) => {
  const normalizedDocumentNumber = String(documentNumber || '').trim();
  if (!normalizedDocumentNumber) {
    throw new ValidationError(CUSTOMER_DOCUMENT_NUMBER_REQUIRED_MESSAGE);
  }

  const customer = await customerRepository.findByDocumentNumber(normalizedDocumentNumber);
  if (!customer) {
    throw new NotFoundError('Customer');
  }

  return customer;
};

const createUpdateCustomer = ({ customerRepository, auditService }) => {
  const useCase = async ({ customerId, payload }) => {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError('Customer');
    }

    return customerRepository.update(customer, payload);
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'customers', getEntityId: (p) => p?.customerId, getEntityType: () => 'Customer' })(useCase);
  }
  return useCase;
};

const createDeleteCustomer = ({ customerRepository, auditService }) => {
  const useCase = async ({ customerId }) => {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError('Customer');
    }

    await customerRepository.deleteById(customer.id);
    return { success: true };
  };

  if (auditService) {
    return withAudit({ auditService, action: 'DELETE', module: 'customers', getEntityId: (p) => p?.customerId, getEntityType: () => 'Customer' })(useCase);
  }
  return useCase;
};

/**
 * Resolves a customer record for document operations after enforcing the
 * administrative backoffice boundary.
 *
 * Customer records are borrower domain data, not login principals for this
 * platform, so document listing and downloads are restricted to internal users.
 *
 * @param {{ actor: { role?: string }, customerRepository: object, customerId: number|string }} input
 * @returns {Promise<object>} Customer record.
 */
const ensureCustomerDocumentAccess = async ({ actor, customerRepository, customerId }) => {
  if (!actor || !['admin', 'employee'].includes(actor.role)) {
    throw new AuthorizationError(CUSTOMER_DOCUMENT_ACCESS_MESSAGE);
  }

  const customer = await customerRepository.findById(customerId);
  if (!customer) {
    throw new NotFoundError('Customer');
  }

  return customer;
};

const createListCustomerDocuments = ({ customerRepository }) => async ({ actor, customerId }) => {
  await ensureCustomerDocumentAccess({ actor, customerRepository, customerId });
  return customerRepository.listDocuments(customerId);
};

const createUploadCustomerDocument = ({
  customerRepository,
  attachmentStorage,
  auditService,
  fsModule = require('node:fs/promises'),
}) => {
  const useCase = async ({ actor, customerId, file, metadata = {} }) => {
    ensureUploadedFile(file, () => new ValidationError('Debes adjuntar un archivo'));

    if (!['admin', 'employee'].includes(actor.role)) {
      await attachmentStorage.deleteByAbsolutePath(file.path);
      throw new AuthorizationError('Solo usuarios administrativos autorizados pueden cargar documentos de clientes.');
    }

    return withUploadCleanup({
      file,
      attachmentStorage,
      task: async () => {
        await validateAttachmentFileSignature(file, fsModule);

        const customer = await ensureCustomerDocumentAccess({ actor, customerRepository, customerId });

        return customerRepository.createDocument({
          customerId: customer.id,
          uploadedByUserId: actor.id,
          ...buildStoredFileFields({ file, attachmentStorage }),
          customerVisible: normalizeAttachmentVisibility(metadata.customerVisible),
          category: toTrimmedOrNull(metadata.category),
          description: toTrimmedOrNull(metadata.description),
        });
      },
    });
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'customers', getEntityId: (p) => p?.customerId, getEntityType: () => 'CustomerDocument' })(useCase);
  }
  return useCase;
};

const createDownloadCustomerDocument = ({ customerRepository, attachmentStorage }) => async ({ actor, customerId, documentId }) => {
  await ensureCustomerDocumentAccess({ actor, customerRepository, customerId });
  const document = await customerRepository.findDocument({ customerId, documentId });

  ensureDocumentExists(document, 'Document');

  return {
    document,
    absolutePath: await resolveDocumentDownload({ attachmentStorage, storagePath: document.storagePath }),
  };
};

const createDeleteCustomerDocument = ({ customerRepository, attachmentStorage, auditService }) => {
  const useCase = async ({ actor, customerId, documentId }) => {
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Solo usuarios administrativos autorizados pueden eliminar documentos de clientes.');
    }

    await ensureCustomerDocumentAccess({ actor, customerRepository, customerId });
    const document = await customerRepository.findDocument({ customerId, documentId });

    ensureDocumentExists(document, 'Document');

    const absolutePath = attachmentStorage.resolveAbsolutePath(document.storagePath);
    await attachmentStorage.deleteByAbsolutePath(absolutePath);
    await customerRepository.deleteDocument(documentId);

    return { success: true };
  };

  if (auditService) {
    return withAudit({ auditService, action: 'DELETE', module: 'customers', getEntityId: (p) => p?.documentId, getEntityType: () => 'CustomerDocument' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that restores a soft-deleted customer.
 * Only finds customers that have been soft-deleted (deletedAt is not null).
 * @param {{ customerRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createRestoreCustomer = ({ customerRepository, auditService }) => {
  const useCase = async ({ actor, customerId }) => {
    // Only admins can restore customers
    if (!actor || !['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Solo usuarios administrativos autorizados pueden restaurar clientes.');
    }

    // Find the customer including deleted records
    const customer = await customerRepository.findByIdIncludingDeleted(customerId);
    if (!customer) {
      throw new NotFoundError('Customer');
    }

    // Check if the customer was actually deleted
    if (!customer.deletedAt) {
      throw new ValidationError(CUSTOMER_NOT_DELETED_MESSAGE);
    }

    // Restore the customer
    await customerRepository.restore(customer.id);

    // Reload the customer to get the updated state
    const restoredCustomer = await customerRepository.findById(customer.id);

    return restoredCustomer;
  };

  if (auditService) {
    return withAudit({ auditService, action: 'RESTORE', module: 'customers', getEntityId: (p) => p?.customerId, getEntityType: () => 'Customer' })(useCase);
  }
  return useCase;
};

module.exports = {
  createListCustomers,
  createGetCustomerById,
  createCreateCustomer,
  createFindCustomerByDocument,
  createUpdateCustomer,
  createDeleteCustomer,
  createListCustomerDocuments,
  createUploadCustomerDocument,
  createDownloadCustomerDocument,
  createDeleteCustomerDocument,
  createRestoreCustomer,
};
