const { AuthorizationError, NotFoundError, ValidationError } = require('../../../utils/errorHandler');

const normalizeAttachmentVisibility = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  return false;
};

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

/**
 * Create the use case that lists customers in repository-defined order.
 * @param {{ customerRepository: object }} dependencies
 * @returns {Function}
 */
const createListCustomers = ({ customerRepository }) => async ({ pagination } = {}) => {
  if (pagination) {
    const result = await customerRepository.listPage(pagination);
    return enrichCustomersWithLoanSummaries({ customerRepository, result });
  }

  const customers = await customerRepository.list();
  return enrichCustomersWithLoanSummaries({ customerRepository, result: customers });
};

/**
 * Create the use case that persists a new customer record.
 * @param {{ customerRepository: object }} dependencies
 * @returns {Function}
 */
const createCreateCustomer = ({ customerRepository }) => async (payload) => {
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

const createFindCustomerByDocument = ({ customerRepository }) => async ({ documentNumber }) => {
  const normalizedDocumentNumber = String(documentNumber || '').trim();
  if (!normalizedDocumentNumber) {
    throw new ValidationError('Document number is required');
  }

  const customer = await customerRepository.findByDocumentNumber(normalizedDocumentNumber);
  if (!customer) {
    throw new NotFoundError('Customer');
  }

  return customer;
};

const createUpdateCustomer = ({ customerRepository }) => async ({ customerId, payload }) => {
  const customer = await customerRepository.findById(customerId);
  if (!customer) {
    throw new NotFoundError('Customer');
  }

  return customerRepository.update(customer, payload);
};

const createDeleteCustomer = ({ customerRepository }) => async ({ customerId }) => {
  const customer = await customerRepository.findById(customerId);
  if (!customer) {
    throw new NotFoundError('Customer');
  }

  await customerRepository.deleteById(customer.id);
  return { success: true };
};

const ensureCustomerDocumentAccess = async ({ actor, customerRepository, customerId }) => {
  if (!['admin', 'customer'].includes(actor.role)) {
    throw new AuthorizationError('You do not have access to customer documents');
  }

  if (actor.role === 'customer' && Number(actor.id) !== Number(customerId)) {
    throw new AuthorizationError('You can only access your own customer documents');
  }

  const customer = await customerRepository.findById(customerId);
  if (!customer) {
    throw new NotFoundError('Customer');
  }

  return customer;
};

const createListCustomerDocuments = ({ customerRepository }) => async ({ actor, customerId }) => {
  await ensureCustomerDocumentAccess({ actor, customerRepository, customerId });
  const documents = await customerRepository.listDocuments(customerId);

  if (actor.role === 'customer') {
    return documents.filter((document) => document.customerVisible);
  }

  return documents;
};

const createUploadCustomerDocument = ({ customerRepository, attachmentStorage }) => async ({ actor, customerId, file, metadata = {} }) => {
  if (!file) {
    throw new ValidationError('Attachment file is required');
  }

  if (actor.role !== 'admin') {
    await attachmentStorage.deleteByAbsolutePath(file.path);
    throw new AuthorizationError('Only admins can upload customer documents');
  }

  try {
    const customer = await ensureCustomerDocumentAccess({ actor, customerRepository, customerId });

    return await customerRepository.createDocument({
      customerId: customer.id,
      uploadedByUserId: actor.id,
      storageDisk: 'local',
      storagePath: attachmentStorage.toRelativePath(file.path),
      storedName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      customerVisible: normalizeAttachmentVisibility(metadata.customerVisible),
      category: metadata.category ? String(metadata.category).trim() : null,
      description: metadata.description ? String(metadata.description).trim() : null,
    });
  } catch (error) {
    await attachmentStorage.deleteByAbsolutePath(file.path);
    throw error;
  }
};

const createDownloadCustomerDocument = ({ customerRepository, attachmentStorage }) => async ({ actor, customerId, documentId }) => {
  await ensureCustomerDocumentAccess({ actor, customerRepository, customerId });
  const document = await customerRepository.findDocument({ customerId, documentId });

  if (!document) {
    throw new NotFoundError('Document');
  }

  if (actor.role === 'customer' && !document.customerVisible) {
    throw new AuthorizationError('You do not have access to this document');
  }

  await attachmentStorage.assertExists(document.storagePath);

  return {
    document,
    absolutePath: attachmentStorage.resolveAbsolutePath(document.storagePath),
  };
};

const createDeleteCustomerDocument = ({ customerRepository, attachmentStorage }) => async ({ actor, customerId, documentId }) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can delete customer documents');
  }

  await ensureCustomerDocumentAccess({ actor, customerRepository, customerId });
  const document = await customerRepository.findDocument({ customerId, documentId });

  if (!document) {
    throw new NotFoundError('Document');
  }

  const absolutePath = attachmentStorage.resolveAbsolutePath(document.storagePath);
  await attachmentStorage.deleteByAbsolutePath(absolutePath);
  await customerRepository.deleteDocument(documentId);

  return { success: true };
};

module.exports = {
  createListCustomers,
  createCreateCustomer,
  createFindCustomerByDocument,
  createUpdateCustomer,
  createDeleteCustomer,
  createListCustomerDocuments,
  createUploadCustomerDocument,
  createDownloadCustomerDocument,
  createDeleteCustomerDocument,
};
