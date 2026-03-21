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

const ensurePaymentDocumentAccess = async ({ actor, paymentRepository, paymentId }) => {
  if (!['admin', 'agent', 'customer'].includes(actor?.role)) {
    throw new AuthorizationError('You do not have access to payment documents');
  }

  const payment = await paymentRepository.findById(paymentId);
  if (!payment) {
    throw new NotFoundError('Payment');
  }

  return payment;
};

/**
 * Create the use case that lists all payments for admins.
 */
const createListPayments = ({ paymentRepository }) => async ({ actor }) => {
  if (actor?.role !== 'admin') {
    throw new AuthorizationError('Only admins can access all payments');
  }

  return paymentRepository.list();
};

/**
 * Create the use case that applies a customer payment against an authorized loan.
 */
const createCreatePayment = ({ paymentApplicationService, loanAccessPolicy, clock = () => new Date() }) => async ({ actor, loanId, amount }) => {
  if (actor?.role !== 'customer') {
    throw new AuthorizationError('Only customers can create payments');
  }

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

  return paymentApplicationService.applyPayment({
    loanId: loan.id,
    amount,
    paymentDate: clock(),
  });
};

/**
 * Create the use case that applies a partial payment (free amount within limits).
 */
const createCreatePartialPayment = ({ paymentApplicationService, loanAccessPolicy, clock = () => new Date() }) => async ({ actor, loanId, amount }) => {
  if (actor?.role !== 'admin' && actor?.role !== 'customer') {
    throw new AuthorizationError('Only admins and customers can create partial payments');
  }

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

  return paymentApplicationService.applyPartialPayment({
    loanId: loan.id,
    amount,
    paymentDate: clock(),
  });
};

/**
 * Create the use case that applies a capital payment (reduces debt principal directly).
 */
const createCreateCapitalPayment = ({ paymentApplicationService, loanAccessPolicy, clock = () => new Date() }) => async ({ actor, loanId, amount }) => {
  if (actor?.role !== 'admin') {
    throw new AuthorizationError('Only admins can create capital reduction payments');
  }

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

  return paymentApplicationService.applyCapitalPayment({
    loanId: loan.id,
    amount,
    paymentDate: clock(),
  });
};

/**
 * Create the use case that annuls the nearest pending or overdue installment.
 */
const createAnnulInstallment = ({ paymentApplicationService, loanAccessPolicy, clock = () => new Date() }) => async ({ actor, loanId }) => {
  if (actor?.role !== 'admin' && actor?.role !== 'agent') {
    throw new AuthorizationError('Only admins and agents can annul installments');
  }

  const loan = await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId });

  return paymentApplicationService.annulInstallment({
    loanId: loan.id,
    actor,
    paymentDate: clock(),
  });
};

/**
 * Create the use case that lists payment history for an authorized loan.
 */
const createListPaymentsByLoan = ({ paymentRepository, loanAccessPolicy }) => async ({ actor, loanId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  return paymentRepository.listByLoan(loan.id);
};

const createListPaymentDocuments = ({ paymentRepository, loanAccessPolicy }) => async ({ actor, paymentId }) => {
  const payment = await ensurePaymentDocumentAccess({ actor, paymentRepository, paymentId });
  await loanAccessPolicy.findAuthorizedLoan({ actor, loanId: payment.loanId });

  const documents = await paymentRepository.listDocuments(payment.id);
  if (actor.role === 'customer') {
    return documents.filter((document) => document.customerVisible);
  }

  return documents;
};

const createUploadPaymentDocument = ({ paymentRepository, loanAccessPolicy, attachmentStorage }) => async ({ actor, paymentId, file, metadata = {} }) => {
  if (!file) {
    throw new ValidationError('Attachment file is required');
  }

  if (!['admin', 'agent'].includes(actor?.role)) {
    await attachmentStorage.deleteByAbsolutePath(file.path);
    throw new AuthorizationError('Only admins and agents can upload payment documents');
  }

  try {
    const payment = await ensurePaymentDocumentAccess({ actor, paymentRepository, paymentId });
    await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId: payment.loanId });

    return await paymentRepository.createDocument({
      paymentId: payment.id,
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

const createDownloadPaymentDocument = ({ paymentRepository, loanAccessPolicy, attachmentStorage }) => async ({ actor, paymentId, documentId }) => {
  const payment = await ensurePaymentDocumentAccess({ actor, paymentRepository, paymentId });
  await loanAccessPolicy.findAuthorizedLoan({ actor, loanId: payment.loanId });
  const document = await paymentRepository.findDocument({ paymentId: payment.id, documentId });

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

module.exports = {
  createListPayments,
  createCreatePayment,
  createCreatePartialPayment,
  createCreateCapitalPayment,
  createAnnulInstallment,
  createListPaymentsByLoan,
  createListPaymentDocuments,
  createUploadPaymentDocument,
  createDownloadPaymentDocument,
};
