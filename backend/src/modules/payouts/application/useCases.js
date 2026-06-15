const {
  AuthorizationError,
  BusinessRuleViolationError,
  NotFoundError,
  ValidationError,
} = require('@/utils/errorHandler');
const { logger } = require('@/utils/logger');
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
  validateAttachmentFileSignature,
} = require('@/modules/shared/documentOperations');

const toPlainRecord = (record) => (typeof record?.toJSON === 'function' ? record.toJSON() : record);
const PAYMENT_METHOD_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const PAYMENT_LIST_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden consultar pagos.';
const PAYMENT_CREATE_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden registrar pagos.';
const PARTIAL_PAYMENT_CREATE_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden crear pagos parciales.';
const CAPITAL_PAYMENT_CREATE_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden registrar abonos a capital.';
const INSTALLMENT_ANNUL_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden anular cuotas.';
const PAYMENT_METADATA_UPDATE_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden actualizar datos de pago.';
const PAYMENT_DOCUMENT_ACCESS_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden acceder a documentos de pago.';
const PAYMENT_DOCUMENT_UPLOAD_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden cargar documentos de pago.';
const PAYMENT_METHOD_CONFIGURED_MESSAGE = 'Selecciona un método de pago configurado.';
const PAYMENT_DATE_VALID_MESSAGE = 'La fecha del pago debe ser válida.';
const ANNULLED_PAYMENT_EDIT_MESSAGE = 'No se puede editar un pago anulado.';

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
  const directValue = toTrimmedOrNull(payload.paymentMethod);

  if (!directValue) {
    return null;
  }

  const normalizedValue = directValue.toLowerCase();
  if (!PAYMENT_METHOD_KEY_PATTERN.test(normalizedValue)) {
    throw new ValidationError(PAYMENT_METHOD_CONFIGURED_MESSAGE);
  }

  return normalizedValue;
};

const resolveMetadataInput = (payload = {}) => {
  const incomingMetadata = payload.paymentMetadata && typeof payload.paymentMetadata === 'object'
    ? payload.paymentMetadata
    : {};
  const normalizedMetadata = { ...incomingMetadata };
  if (Object.prototype.hasOwnProperty.call(normalizedMetadata, 'method')) {
    delete normalizedMetadata.method;
  }

  return {
    incomingMetadata: normalizedMetadata,
    reference: toTrimmedOrNull(payload.reference ?? normalizedMetadata.reference),
    observation: toTrimmedOrNull(payload.observation ?? normalizedMetadata.observation),
  };
};

const resolvePaymentDateInput = (paymentDate, clock) => {
  if (paymentDate === undefined || paymentDate === null || paymentDate === '') {
    return clock();
  }

  const resolvedDate = new Date(paymentDate);
  if (Number.isNaN(resolvedDate.getTime())) {
    throw new ValidationError(PAYMENT_DATE_VALID_MESSAGE);
  }

  return resolvedDate;
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
    allowedPaymentTypes: ['admin', 'employee'].includes(actor?.role)
      ? ['installment', 'partial', 'capital']
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
  if (!['admin', 'employee'].includes(actor?.role)) {
    throw new AuthorizationError(PAYMENT_DOCUMENT_ACCESS_DENIED_MESSAGE);
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
  if (!['admin', 'employee'].includes(actor?.role)) {
    throw new AuthorizationError(PAYMENT_LIST_DENIED_MESSAGE);
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
 * Create the use case that applies an operator-recorded payment against an authorized loan.
 */
const createCreatePayment = ({ paymentApplicationService, loanAccessPolicy, clock = () => new Date() }) => async ({ actor, loanId, amount, paymentDate, paymentMethod, idempotencyKey }) => {
  if (!['admin', 'employee'].includes(actor?.role)) {
    throw new AuthorizationError(PAYMENT_CREATE_DENIED_MESSAGE);
  }

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

  return paymentApplicationService.applyPayment({
    loanId: loan.id,
    amount,
    paymentDate: resolvePaymentDateInput(paymentDate, clock),
    paymentMethod,
    actorId: actor?.id || 0,
    idempotencyKey,
  });
};

/**
 * Create the use case that applies a backoffice-only partial payment
 * for a free amount within operational limits.
 */
const createCreatePartialPayment = ({ paymentApplicationService, loanAccessPolicy, clock = () => new Date() }) => async ({ actor, loanId, amount, paymentDate, paymentMethod, idempotencyKey }) => {
  if (!['admin', 'employee'].includes(actor?.role)) {
    throw new AuthorizationError(PARTIAL_PAYMENT_CREATE_DENIED_MESSAGE);
  }

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

  return paymentApplicationService.applyPartialPayment({
    loanId: loan.id,
    amount,
    paymentDate: resolvePaymentDateInput(paymentDate, clock),
    paymentMethod,
    actorId: actor?.id || 0,
    idempotencyKey,
  });
};

/**
 * Audit a rejected capital payment attempt without masking the original denial.
 * @param {{ auditService?: object, actor?: object, loanId: number|string, amount: number|string, paymentMethod?: string|null, strategy?: string|null, error: Error, req?: object }} params
 * @returns {Promise<void>}
 */
const auditRejectedCapitalPayment = async ({
  auditService,
  actor,
  loanId,
  amount,
  paymentMethod,
  strategy,
  newTermMonths,
  error,
  req,
}) => {
  if (!auditService || typeof auditService.log !== 'function') {
    return;
  }

  try {
    await auditService.log({
      actor,
      action: 'REJECT',
      module: 'payments',
      entityId: loanId ? String(loanId) : null,
      entityType: 'CapitalPaymentAttempt',
      metadata: {
        amount,
        paymentMethod,
        strategy,
        ...(newTermMonths === undefined ? {} : { newTermMonths }),
        errorCode: error?.code || error?.name || 'CAPITAL_PAYMENT_REJECTED',
        denialReasons: Array.isArray(error?.denialReasons) ? error.denialReasons : [],
      },
      req,
    });
  } catch (auditError) {
    logger.error('Capital payment rejection audit failed', { error: auditError?.message || String(auditError) });
  }
};

/**
 * Create the use case that applies a capital payment (reduces debt principal directly).
 */
const createCreateCapitalPayment = ({
  paymentApplicationService,
  loanAccessPolicy,
  auditService,
  clock = () => new Date(),
}) => async ({ actor, loanId, amount, paymentDate, paymentMethod, strategy, newTermMonths, idempotencyKey, req }) => {
  if (!['admin', 'employee'].includes(actor?.role)) {
    throw new AuthorizationError(CAPITAL_PAYMENT_CREATE_DENIED_MESSAGE);
  }

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

  try {
    return await paymentApplicationService.applyCapitalPayment({
      loanId: loan.id,
      amount,
      paymentDate: resolvePaymentDateInput(paymentDate, clock),
      paymentMethod,
      strategy,
      newTermMonths,
      actorId: actor?.id || 0,
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof BusinessRuleViolationError && error.code === 'CAPITAL_PAYMENT_NOT_ALLOWED') {
      await auditRejectedCapitalPayment({
        auditService,
        actor,
        loanId: loan.id,
        amount,
        paymentMethod,
        strategy,
        newTermMonths,
        error,
        req,
      });
    }
    throw error;
  }
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
  if (!['admin', 'employee'].includes(actor?.role)) {
    throw new AuthorizationError(INSTALLMENT_ANNUL_DENIED_MESSAGE);
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
 * Update mutable payment metadata while treating paymentMethod as the canonical source
 * of truth.
 * @param {{ paymentRepository: object, loanAccessPolicy: object }} dependencies
 * @returns {Function}
 */
const createUpdatePaymentMetadata = ({ paymentRepository, loanAccessPolicy }) => async ({ actor, paymentId, payload = {} }) => {
  if (!['admin', 'employee'].includes(actor?.role)) {
    throw new AuthorizationError(PAYMENT_METADATA_UPDATE_DENIED_MESSAGE);
  }

  const payment = await paymentRepository.findById(paymentId);
  if (!payment) {
    throw new NotFoundError('Payment');
  }
  await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId: payment.loanId });

  const paymentDate = payload.paymentDate ? new Date(payload.paymentDate) : null;
  if (payload.paymentDate && Number.isNaN(paymentDate?.getTime())) {
    throw new ValidationError(PAYMENT_DATE_VALID_MESSAGE);
  }

  if (payment.status === 'annulled') {
    throw new ValidationError(ANNULLED_PAYMENT_EDIT_MESSAGE);
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
  const nextPaymentMetadata = {
    ...currentMetadata,
    ...incomingMetadata,
    reference: reference || currentMetadata.reference || null,
    observation: observation || currentMetadata.observation || null,
  };

  if (Object.prototype.hasOwnProperty.call(nextPaymentMetadata, 'method')) {
    delete nextPaymentMetadata.method;
  }

  return paymentRepository.update(payment, {
    paymentDate: paymentDate || payment.paymentDate,
    paymentMethod: paymentMethod || payment.paymentMethod || null,
    paymentMetadata: nextPaymentMetadata,
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

  return documents;
};

const createUploadPaymentDocument = ({
  paymentRepository,
  loanAccessPolicy,
  attachmentStorage,
  fsModule = require('node:fs/promises'),
}) => async ({ actor, paymentId, file, metadata = {} }) => {
  ensureUploadedFile(file, () => new ValidationError('Debes adjuntar un archivo'));

  if (!['admin', 'employee'].includes(actor?.role)) {
    await attachmentStorage.deleteByAbsolutePath(file.path);
    throw new AuthorizationError(PAYMENT_DOCUMENT_UPLOAD_DENIED_MESSAGE);
  }

  return withUploadCleanup({
    file,
    attachmentStorage,
    task: async () => {
      await validateAttachmentFileSignature(file, fsModule);

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

  return {
    document,
    absolutePath: await resolveDocumentDownload({ attachmentStorage, storagePath: document.storagePath }),
  };
};

/**
 * Create the use case that generates a payment voucher PDF.
 */
const createGetPaymentVoucher = ({ paymentRepository, loanAccessPolicy }) => async ({ actor, paymentId }) => {
  const payment = await ensurePaymentDocumentAccess({ actor, paymentRepository, paymentId });
  if (!payment) {
    throw new NotFoundError('Payment');
  }

  await loanAccessPolicy.findAuthorizedLoan({ actor, loanId: payment.loanId });

  const loan = await Loan.findByPk(payment.loanId, {
    include: [{ model: Customer, as: 'Customer' }],
  });

  if (!loan) {
    throw new NotFoundError('Loan');
  }

  const customer = loan.Customer || loan.customer;

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
};
