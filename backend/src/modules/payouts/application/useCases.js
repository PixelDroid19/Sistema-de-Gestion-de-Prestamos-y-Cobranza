const { AuthorizationError, NotFoundError, ValidationError } = require('../../../utils/errorHandler');
const {
  evaluateCapitalPaymentEligibility,
  evaluatePayoffEligibility,
  PAYABLE_LOAN_STATUSES,
} = require('../../credits/application/paymentEligibility');
const { Loan, Customer } = require('../../../models');
const { VoucherService } = require('../domain/services/VoucherService');
const {
  normalizeAttachmentVisibility,
  ensureUploadedFile,
  withUploadCleanup,
  toTrimmedOrNull,
  buildStoredFileFields,
  ensureDocumentExists,
  resolveDocumentDownload,
} = require('../../shared/documentOperations');

const toPlainRecord = (record) => (typeof record?.toJSON === 'function' ? record.toJSON() : record);

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
const createListPayments = ({ paymentRepository }) => async ({ actor, pagination }) => {
  if (actor?.role !== 'admin') {
    throw new AuthorizationError('Only admins can access all payments');
  }

  if (pagination) {
    return paymentRepository.listPage(pagination);
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
const createAnnulInstallment = ({ paymentApplicationService, loanAccessPolicy, clock = () => new Date() }) => async ({ actor, loanId, reason, installmentNumber }) => {
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
  });
};

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

  const currentMetadata = payment.paymentMetadata && typeof payment.paymentMetadata === 'object'
    ? payment.paymentMetadata
    : {};

  return paymentRepository.update(payment, {
    paymentDate: paymentDate || payment.paymentDate,
    paymentMetadata: {
      ...currentMetadata,
      method: payload.method ? String(payload.method).trim() : currentMetadata.method || null,
      observation: payload.observation ? String(payload.observation).trim() : currentMetadata.observation || null,
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
  createAnnulInstallment,
  createUpdatePaymentMetadata,
  createListPaymentsByLoan,
  createListPaymentDocuments,
  createUploadPaymentDocument,
  createDownloadPaymentDocument,
  createGetPaymentVoucher,
};
