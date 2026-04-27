const { AuthorizationError, NotFoundError, ValidationError } = require('@/utils/errorHandler');
const {
  evaluateCapitalPaymentEligibility,
  evaluatePayoffEligibility,
  PAYABLE_LOAN_STATUSES,
} = require('@/modules/credits/application/paymentEligibility');
const { Loan, Customer } = require('@/models');
const { VoucherService } = require('@/modules/payouts/domain/services/VoucherService');
const {
  normalizeAttachmentVisibility,
  ensureUploadedFile,
  withUploadCleanup,
  toTrimmedOrNull,
  buildStoredFileFields,
  ensureDocumentExists,
  resolveDocumentDownload,
} = require('@/modules/shared/documentOperations');

const toPlainRecord = (record) => (typeof record?.toJSON === 'function' ? record.toJSON() : record);
const PAYMENT_METHOD_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/**
 * Normalize free-text payment filters into a comparable lowercase token.
 * @param {unknown} value
 * @returns {string}
 */
const normalizeSearchValue = (value) => String(value || '').trim().toLowerCase();

/**
 * Build a fallback text surface for payment searches when a repository adapter
 * cannot push the filter down to the database layer.
 * @param {object} payment
 * @returns {string}
 */
const buildPaymentSearchHaystack = (payment) => {
  const segments = [
    payment?.id,
    payment?.loanId,
    payment?.paymentType,
    payment?.paymentMethod,
    payment?.Loan?.Customer?.name,
    payment?.Loan?.Customer?.email,
    payment?.paymentMetadata?.reference,
  ];

  return segments
    .filter((segment) => segment !== undefined && segment !== null)
    .map((segment) => String(segment).toLowerCase())
    .join(' ');
};

/**
 * Filter payment rows using the same shape expected by the frontend listing params.
 * @param {{ payments?: Array<object>, filters?: object }} input
 * @returns {Array<object>}
 */
const filterPaymentsByFilters = ({ payments = [], filters = {} }) => {
  const searchTerm = normalizeSearchValue(filters.search);
  const status = filters.status ? String(filters.status).trim().toLowerCase() : '';

  return payments.filter((payment) => {
    if (status && String(payment?.status || '').toLowerCase() !== status) {
      return false;
    }

    if (searchTerm) {
      return buildPaymentSearchHaystack(payment).includes(searchTerm);
    }

    return true;
  });
};

const resolvePaymentMethodInput = (payload = {}) => {
  const directValue = toTrimmedOrNull(
    payload.paymentMethod
    ?? payload.method
    ?? payload.paymentMetadata?.method,
  );

  if (!directValue) {
    return null;
  }

  const normalizedValue = directValue.toLowerCase();
  if (!PAYMENT_METHOD_KEY_PATTERN.test(normalizedValue)) {
    throw new ValidationError('Payment method must be a configured key using letters, numbers, hyphen or underscore');
  }

  return normalizedValue;
};

const resolveMetadataInput = (payload = {}) => {
  const incomingMetadata = payload.paymentMetadata && typeof payload.paymentMetadata === 'object'
    ? payload.paymentMetadata
    : {};

  return {
    incomingMetadata,
    reference: toTrimmedOrNull(payload.reference ?? incomingMetadata.reference),
    observation: toTrimmedOrNull(payload.observation ?? incomingMetadata.observation),
  };
};

const buildLoanPaymentContext = ({ actor, loan, loanViewService }) => {
  if (!loanViewService || typeof loanViewService.getCanonicalLoanView !== 'function') {
    return undefined;
  }

  const { schedule, snapshot } = loanViewService.getCanonicalLoanView(loan);
  const payoffEligibility = evaluatePayoffEligibility({ loan, schedule, snapshot });
  const capitalEligibility = evaluateCapitalPaymentEligibility({ loan, schedule, snapshot });

  return {
    isPayable: PAYABLE_LOAN_STATUSES.has(loan.status),
    allowedPaymentTypes: actor?.role === 'admin'
      ? ['installment', 'partial', 'capital']
      : actor?.role === 'customer'
        ? ['installment', 'payoff']
        : [],
    snapshot,
    payoffEligibility,
    capitalEligibility,
  };
};

const buildLoanHistoryContext = ({ actor, loan, loanViewService }) => {
  const plainLoan = toPlainRecord(loan);

  return {
    ...plainLoan,
    paymentContext: buildLoanPaymentContext({ actor, loan: plainLoan, loanViewService }),
  };
};

const ensurePaymentDocumentAccess = async ({ actor, paymentRepository, paymentId }) => {
  if (!['admin', 'customer'].includes(actor?.role)) {
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
const createListPayments = ({ paymentRepository }) => async ({ actor, pagination, filters = {} }) => {
  if (actor?.role !== 'admin') {
    throw new AuthorizationError('Only admins can access all payments');
  }

  if (pagination && typeof paymentRepository.listPage === 'function') {
    return paymentRepository.listPage({ ...pagination, filters });
  }

  const payments = await paymentRepository.list({ filters });
  const filteredPayments = filterPaymentsByFilters({ payments, filters });

  if (pagination) {
    const { paginateArray } = require('@/modules/shared/pagination');
    return paginateArray({ items: filteredPayments, pagination });
  }

  return filteredPayments;
};

/**
 * Create the use case that applies a customer payment against an authorized loan.
 */
const createCreatePayment = ({ paymentApplicationService, loanAccessPolicy, clock = () => new Date() }) => async ({ actor, loanId, amount, paymentMethod, idempotencyKey }) => {
  if (actor?.role !== 'customer') {
    throw new AuthorizationError('Only customers can create payments');
  }

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

  return paymentApplicationService.applyPayment({
    loanId: loan.id,
    amount,
    paymentDate: clock(),
    paymentMethod,
    actorId: actor?.id || 0,
    idempotencyKey,
  });
};

/**
 * Create the use case that applies a partial payment (free amount within limits).
 */
const createCreatePartialPayment = ({ paymentApplicationService, loanAccessPolicy, clock = () => new Date() }) => async ({ actor, loanId, amount, paymentMethod, idempotencyKey }) => {
  if (actor?.role !== 'admin' && actor?.role !== 'customer') {
    throw new AuthorizationError('Only admins and customers can create partial payments');
  }

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

  return paymentApplicationService.applyPartialPayment({
    loanId: loan.id,
    amount,
    paymentDate: clock(),
    paymentMethod,
    actorId: actor?.id || 0,
    idempotencyKey,
  });
};

/**
 * Create the use case that applies a capital payment (reduces debt principal directly).
 */
const createCreateCapitalPayment = ({ paymentApplicationService, loanAccessPolicy, clock = () => new Date() }) => async ({ actor, loanId, amount, paymentMethod, strategy, idempotencyKey }) => {
  if (actor?.role !== 'admin') {
    throw new AuthorizationError('Only admins can create capital reduction payments');
  }

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

  return paymentApplicationService.applyCapitalPayment({
    loanId: loan.id,
    amount,
    paymentDate: clock(),
    paymentMethod,
    strategy,
    actorId: actor?.id || 0,
    idempotencyKey,
  });
};

const createCalculateTotalDebt = ({ loanAccessPolicy, loanViewService }) => async ({ actor, loanId, asOfDate }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const quote = loanViewService.getPayoffQuote(loan, asOfDate || new Date().toISOString().slice(0, 10));

  return {
    loanId: loan.id,
    asOfDate: quote.asOfDate,
    totalDebt: quote.total,
    payoffQuote: quote,
  };
};

const createPayTotalDebt = ({ paymentApplicationService, loanAccessPolicy, loanViewService, clock = () => new Date() }) => async ({
  actor,
  loanId,
  asOfDate,
  quotedTotal,
  idempotencyKey,
}) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const effectiveAsOfDate = asOfDate || new Date().toISOString().slice(0, 10);
  const effectiveQuotedTotal = quotedTotal || loanViewService.getPayoffQuote(loan, effectiveAsOfDate).total;

  return paymentApplicationService.applyPayoff({
    loanId: loan.id,
    asOfDate: effectiveAsOfDate,
    quotedTotal: effectiveQuotedTotal,
    paymentDate: clock(),
    actor,
    idempotencyKey,
  });
};

/**
 * Create the use case that annuls the nearest pending or overdue installment.
 */
const createAnnulInstallment = ({ paymentApplicationService, loanAccessPolicy, clock = () => new Date() }) => async ({ actor, loanId, reason, installmentNumber, idempotencyKey }) => {
  if (actor?.role !== 'admin') {
    throw new AuthorizationError('Only admins can annul installments');
  }

  const loan = await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId });

  return paymentApplicationService.annulInstallment({
    loanId: loan.id,
    actor,
    reason,
    installmentNumber,
    paymentDate: clock(),
    idempotencyKey,
  });
};

/**
 * Update mutable payment metadata while keeping the top-level payment method
 * column and nested metadata in sync for reporting and voucher generation.
 * @param {{ paymentRepository: object, loanAccessPolicy: object }} dependencies
 * @returns {Function}
 */
const createUpdatePaymentMetadata = ({ paymentRepository, loanAccessPolicy }) => async ({ actor, paymentId, payload = {} }) => {
  if (actor?.role !== 'admin') {
    throw new AuthorizationError('Only admins can update payment metadata');
  }

  const payment = await paymentRepository.findById(paymentId);
  if (!payment) {
    throw new NotFoundError('Payment');
  }
  await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId: payment.loanId });

  const paymentDate = payload.paymentDate ? new Date(payload.paymentDate) : null;
  if (payload.paymentDate && Number.isNaN(paymentDate?.getTime())) {
    throw new ValidationError('Payment date must be a valid date');
  }

  if (payment.status === 'annulled') {
    throw new ValidationError('Annulled payments cannot be edited');
  }

  const currentMetadata = payment.paymentMetadata && typeof payment.paymentMetadata === 'object'
    ? payment.paymentMetadata
    : {};
  const paymentMethod = resolvePaymentMethodInput(payload);
  const {
    incomingMetadata,
    reference,
    observation,
  } = resolveMetadataInput(payload);

  return paymentRepository.update(payment, {
    paymentDate: paymentDate || payment.paymentDate,
    paymentMethod: paymentMethod || payment.paymentMethod || null,
    paymentMetadata: {
      ...currentMetadata,
      ...incomingMetadata,
      method: paymentMethod || currentMetadata.method || null,
      reference: reference || currentMetadata.reference || null,
      observation: observation || currentMetadata.observation || null,
    },
  });
};

/**
 * Create the use case that lists payment history for an authorized loan.
 */
const createListPaymentsByLoan = ({ paymentRepository, loanAccessPolicy, loanViewService }) => async ({ actor, loanId, pagination }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const loanContext = buildLoanHistoryContext({ actor, loan, loanViewService });

  if (pagination) {
    const result = await paymentRepository.listPageByLoan({ loanId: loan.id, ...pagination });
    return {
      ...result,
      loan: loanContext,
    };
  }

  const payments = await paymentRepository.listByLoan(loan.id);
  return {
    payments,
    loan: loanContext,
  };
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
  ensureUploadedFile(file, () => new ValidationError('Attachment file is required'));

  if (actor?.role !== 'admin') {
    await attachmentStorage.deleteByAbsolutePath(file.path);
    throw new AuthorizationError('Only admins can upload payment documents');
  }

  return withUploadCleanup({
    file,
    attachmentStorage,
    task: async () => {
      const payment = await ensurePaymentDocumentAccess({ actor, paymentRepository, paymentId });
      await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId: payment.loanId });

      return paymentRepository.createDocument({
        paymentId: payment.id,
        uploadedByUserId: actor.id,
        ...buildStoredFileFields({ file, attachmentStorage }),
        customerVisible: normalizeAttachmentVisibility(metadata.customerVisible),
        category: toTrimmedOrNull(metadata.category),
        description: toTrimmedOrNull(metadata.description),
      });
    },
  });
};

const createDownloadPaymentDocument = ({ paymentRepository, loanAccessPolicy, attachmentStorage }) => async ({ actor, paymentId, documentId }) => {
  const payment = await ensurePaymentDocumentAccess({ actor, paymentRepository, paymentId });
  await loanAccessPolicy.findAuthorizedLoan({ actor, loanId: payment.loanId });
  const document = await paymentRepository.findDocument({ paymentId: payment.id, documentId });

  ensureDocumentExists(document, 'Document');

  if (actor.role === 'customer' && !document.customerVisible) {
    throw new AuthorizationError('You do not have access to this document');
  }

  return {
    document,
    absolutePath: await resolveDocumentDownload({ attachmentStorage, storagePath: document.storagePath }),
  };
};

/**
 * Create the use case that generates a payment voucher PDF.
 */
const createGetPaymentVoucher = ({ paymentRepository, loanAccessPolicy }) => async ({ actor, paymentId }) => {
  // TASK-007: Fetch payment/credit/customer data
  const payment = await ensurePaymentDocumentAccess({ actor, paymentRepository, paymentId });
  if (!payment) {
    throw new NotFoundError('Payment');
  }

  // TASK-008: Add authorization check using ensurePaymentDocumentAccess pattern
  await loanAccessPolicy.findAuthorizedLoan({ actor, loanId: payment.loanId });

  // Fetch loan with customer data
  const loan = await Loan.findByPk(payment.loanId, {
    include: [{ model: Customer, as: 'Customer' }],
  });

  if (!loan) {
    throw new NotFoundError('Loan');
  }

  const customer = loan.Customer || loan.customer;

  // Generate PDF
  const pdfBuffer = await VoucherService.generateVoucherPdf(payment, loan, customer);

  return {
    buffer: pdfBuffer,
    paymentId: payment.id,
    filename: `voucher-${payment.id}.pdf`,
  };
};

module.exports = {
  createListPayments,
  createCreatePayment,
  createCreatePartialPayment,
  createCreateCapitalPayment,
  createCalculateTotalDebt,
  createPayTotalDebt,
  createAnnulInstallment,
  createUpdatePaymentMetadata,
  createListPaymentsByLoan,
  createListPaymentDocuments,
  createUploadPaymentDocument,
  createDownloadPaymentDocument,
  createGetPaymentVoucher,
  filterPaymentsByFilters,
};
