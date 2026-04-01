const { NotFoundError, ValidationError, AuthorizationError } = require('../../../utils/errorHandler');
const { roundCurrency } = require('./creditFormulaHelpers');
const { buildPaginatedResult } = require('../../shared/pagination');
const { withAudit } = require('../../audit/application/auditDecorator');
const {
  evaluateCapitalPaymentEligibility,
  evaluatePayoffEligibility,
  PAYABLE_LOAN_STATUSES,
} = require('./paymentEligibility');

const normalizeAttachmentVisibility = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  return false;
};

const SIGNATURE_LENGTH = 8;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE_PREFIX = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_SIGNATURE_RIFF = Buffer.from([0x52, 0x49, 0x46, 0x46]);
const WEBP_SIGNATURE_WEBP = Buffer.from([0x57, 0x45, 0x42, 0x50]);
const PDF_SIGNATURE = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-

const startsWithSignature = (buffer, signature) => (
  Buffer.isBuffer(buffer) && buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature)
);

const hasWebpSignature = (buffer) => (
  Buffer.isBuffer(buffer)
  && buffer.length >= 12
  && buffer.subarray(0, 4).equals(WEBP_SIGNATURE_RIFF)
  && buffer.subarray(8, 12).equals(WEBP_SIGNATURE_WEBP)
);

const isValidAttachmentSignature = (buffer, mimetype) => {
  if (!Buffer.isBuffer(buffer) || typeof mimetype !== 'string') {
    return false;
  }

  if (mimetype === 'application/pdf') {
    return startsWithSignature(buffer, PDF_SIGNATURE);
  }

  if (mimetype === 'image/png') {
    return startsWithSignature(buffer, PNG_SIGNATURE);
  }

  if (mimetype === 'image/jpeg') {
    return startsWithSignature(buffer, JPEG_SIGNATURE_PREFIX);
  }

  if (mimetype === 'image/webp') {
    return hasWebpSignature(buffer);
  }

  return false;
};

const validateAttachmentFileSignature = async (file, fsModule) => {
  if (!file?.path || typeof file.mimetype !== 'string') {
    throw new ValidationError('Attachment file metadata is invalid');
  }

  let handle;
  try {
    handle = await fsModule.open(file.path, 'r');
    const buffer = Buffer.alloc(SIGNATURE_LENGTH);
    const { bytesRead } = await handle.read(buffer, 0, SIGNATURE_LENGTH, 0);
    const header = buffer.subarray(0, bytesRead);
    if (!isValidAttachmentSignature(header, file.mimetype)) {
      throw new ValidationError('Attachment content does not match the declared file type');
    }
  } finally {
    await handle?.close();
  }
};

const escapePdfText = (value) => String(value)
  .replaceAll('\\', '\\\\')
  .replaceAll('(', '\\(')
  .replaceAll(')', '\\)');

const buildPdfTextStream = ({ title, lines }) => {
  const commands = [
    'BT',
    '/F1 18 Tf',
    '50 780 Td',
    `(${escapePdfText(title)}) Tj`,
    '0 -28 Td',
    '/F1 12 Tf',
  ];

  lines.forEach((line, index) => {
    if (index > 0) {
      commands.push('0 -18 Td');
    }
    commands.push(`(${escapePdfText(line)}) Tj`);
  });

  commands.push('ET');
  return commands.join('\n');
};

const buildPdfBuffer = ({ title, lines }) => {
  const contentStream = buildPdfTextStream({ title, lines });
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
};

const enrichLoansWithCustomerSummaries = async ({ loanRepository, result }) => {
  if (typeof loanRepository.attachCustomerSummaries !== 'function') {
    return result;
  }

  if (Array.isArray(result)) {
    return loanRepository.attachCustomerSummaries(result);
  }

  if (Array.isArray(result?.items)) {
    return {
      ...result,
      items: await loanRepository.attachCustomerSummaries(result.items),
    };
  }

  return result;
};

const enrichLoanWithCustomerSummary = async ({ loanRepository, loan }) => {
  if (!loan || typeof loanRepository.attachCustomerSummaries !== 'function') {
    return loan;
  }

  const [enrichedLoan = loan] = await loanRepository.attachCustomerSummaries([loan]);
  return enrichedLoan;
};

const enrichCustomerWithLoanSummary = async ({ customerRepository, customer }) => {
  if (!customer || typeof customerRepository.attachLoanSummaries !== 'function') {
    return customer;
  }

  const [enrichedCustomer = customer] = await customerRepository.attachLoanSummaries([customer]);
  return enrichedCustomer;
};

const buildPromiseToPayPdfBuffer = ({ promise, loan, customer }) => {
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

  return buildPdfBuffer({
    title: 'PROMISE TO PAY RECEIPT',
    lines: [
      `Document ID: ${promise.id}`,
      `Date: ${formatDate(promise.createdAt)}`,
      '',
      '=== LOAN DETAILS ===',
      `Loan ID: ${loan.id}`,
      `Loan Amount: ${formatCurrency(loan.amount)}`,
      `Customer: ${customer.name}`,
      `Customer Email: ${customer.email}`,
      '',
      '=== PROMISE DETAILS ===',
      `Promised Payment Date: ${formatDate(promise.promisedDate)}`,
      `Promised Amount: ${formatCurrency(promise.amount)}`,
      `Status: ${promise.status?.toUpperCase() || 'PENDING'}`,
      promise.notes ? `Notes: ${promise.notes}` : '',
      '',
      '=== PAYMENT TERMS ===',
      'This document serves as official acknowledgment of the promise to pay.',
      'The customer agrees to make the payment by the specified date.',
      'Failure to comply may result in collection proceedings.',
      '',
      '=== SIGNATURES ===',
      '',
      'Customer Signature: ________________________',
      `Date: ${formatDate(promise.promisedDate)}`,
      '',
      'Authorized Agent: ________________________',
      `Date: ${formatDate(promise.createdAt)}`,
      '',
      '---',
      'Generated by CrediCobranza - Sistema de Gestion de Prestamos y Cobranza',
    ].filter(Boolean),
  });
};

const appendFollowUpNote = (currentValue, nextEntry) => {
  const currentNotes = currentValue ? String(currentValue).trim() : '';
  const nextNote = nextEntry ? String(nextEntry).trim() : '';

  if (!nextNote) {
    return currentNotes || null;
  }

  if (!currentNotes) {
    return nextNote;
  }

  return `${currentNotes}\n${nextNote}`;
};

const buildFollowUpNoteEntry = ({ actor, note, status = null, kind = 'follow_up', changedAt = new Date() }) => {
  if (!note || !String(note).trim()) {
    return null;
  }

  const pieces = [
    `[${new Date(changedAt).toISOString()}]`,
    kind.toUpperCase(),
    `actor:${actor.id}`,
  ];

  if (status) {
    pieces.push(`status:${status}`);
  }

  pieces.push(String(note).trim());
  return pieces.join(' ');
};

const formatCalendarEntryStatus = ({ row, isOverdue, outstandingAmount }) => {
  if (outstandingAmount <= 0.01) {
    return 'paid';
  }

  if (isOverdue) {
    return 'overdue';
  }

  if ((row.paidTotal || 0) > 0) {
    return 'partial';
  }

  return 'pending';
};

const buildCalendarEntries = ({ schedule, alerts }) => {
  const activeAlertByInstallment = new Map(
    alerts
      .filter((alert) => alert.status === 'active')
      .map((alert) => [Number(alert.installmentNumber), alert]),
  );

  const alertByInstallment = new Map(
    alerts
      .map((alert) => [Number(alert.installmentNumber), alert]),
  );

  return schedule.map((row) => {
    if (row.status === 'annulled') {
      return {
        installmentNumber: row.installmentNumber,
        dueDate: row.dueDate,
        scheduledPayment: roundCurrency(row.scheduledPayment || 0),
        remainingPrincipal: roundCurrency(row.remainingPrincipal || 0),
        remainingInterest: roundCurrency(row.remainingInterest || 0),
        outstandingAmount: 0,
        status: 'annulled',
        alertId: null,
      };
    }

    const outstandingAmount = roundCurrency((row.remainingPrincipal || 0) + (row.remainingInterest || 0));
    const alert = activeAlertByInstallment.get(Number(row.installmentNumber)) || null;
    const isOverdue = Boolean(alert);

    return {
      installmentNumber: row.installmentNumber,
      dueDate: row.dueDate,
      scheduledPayment: roundCurrency(row.scheduledPayment || 0),
      remainingPrincipal: roundCurrency(row.remainingPrincipal || 0),
      remainingInterest: roundCurrency(row.remainingInterest || 0),
      outstandingAmount,
      status: formatCalendarEntryStatus({ row, isOverdue, outstandingAmount }),
      alertId: alertByInstallment.get(Number(row.installmentNumber))?.id || null,
    };
  });
};

/**
 * Create the use case that lists loans, optionally filtered through the shared access policy.
 * @param {{ loanRepository: object, loanAccessPolicy?: object }} dependencies
 * @returns {Function}
 */
const createListLoans = ({ loanRepository, loanAccessPolicy }) => async ({ actor, pagination }) => {
  if (pagination && actor?.role === 'admin') {
    const result = await loanRepository.listPage(pagination);
    return enrichLoansWithCustomerSummaries({ loanRepository, result });
  }

  const loans = await loanRepository.list();
  const visibleLoans = loanAccessPolicy
    ? loanAccessPolicy.filterVisibleLoans({ actor, loans })
    : loans;

  if (pagination) {
    const offset = pagination.offset || 0;
    const items = visibleLoans.slice(offset, offset + pagination.pageSize);
    const result = buildPaginatedResult({
      items,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: visibleLoans.length,
    });
    return enrichLoansWithCustomerSummaries({ loanRepository, result });
  }

  return enrichLoansWithCustomerSummaries({ loanRepository, result: visibleLoans });
};

/**
 * Create the use case that returns a canonical credit simulation preview.
 * @param {{ creditDomainService: object }} dependencies
 * @returns {Function}
 */
const createCreateSimulation = ({ creditDomainService }) => async (payload) => creditDomainService.simulate(payload);

const createLoadDagWorkbenchGraph = ({ dagWorkbenchService }) => async ({ actor, scopeKey }) => dagWorkbenchService.loadGraph({ actor, scopeKey });

const createSaveDagWorkbenchGraph = ({ dagWorkbenchService }) => async ({ actor, scopeKey, name, graph }) => dagWorkbenchService.saveGraph({ actor, scopeKey, name, graph });

const createValidateDagWorkbenchGraph = ({ dagWorkbenchService }) => async ({ actor, scopeKey, graph }) => dagWorkbenchService.validateGraph({ actor, scopeKey, graph });

const createSimulateDagWorkbenchGraph = ({ dagWorkbenchService }) => async ({ actor, scopeKey, graph, simulationInput }) => dagWorkbenchService.simulateGraph({ actor, scopeKey, graph, simulationInput });

const createGetDagWorkbenchSummary = ({ dagWorkbenchService }) => async ({ actor, scopeKey }) => dagWorkbenchService.getSummary({ actor, scopeKey });

const createListDagWorkbenchGraphs = ({ dagWorkbenchService }) => async ({ actor, scopeKey }) => dagWorkbenchService.listGraphs({ actor, scopeKey });

const createGetDagWorkbenchGraphDetails = ({ dagWorkbenchService }) => async ({ actor, graphId }) => dagWorkbenchService.getGraphDetails({ actor, graphId });

const createActivateDagWorkbenchGraph = ({ dagWorkbenchService }) => async ({ actor, graphId }) => dagWorkbenchService.activateGraph({ actor, graphId });

const createDeactivateDagWorkbenchGraph = ({ dagWorkbenchService }) => async ({ actor, graphId }) => dagWorkbenchService.deactivateGraph({ actor, graphId });

const createDeleteDagWorkbenchGraph = ({ dagWorkbenchService }) => async ({ actor, graphId }) => dagWorkbenchService.deleteGraph({ actor, graphId });

/**
 * Create the use case that retrieves a single loan through the shared access policy.
 * @param {{ loanAccessPolicy?: object, loanRepository: object }} dependencies
 * @returns {Function}
 */
const buildLoanPaymentContext = ({ actor, loan, loanViewService }) => {
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

const createGetLoanById = ({ loanAccessPolicy, loanRepository, loanViewService }) => async ({ actor, loanId }) => {
  if (loanAccessPolicy) {
    const authorizedLoan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
    const loan = await enrichLoanWithCustomerSummary({ loanRepository, loan: authorizedLoan });
    return {
      ...loan,
      paymentContext: loanViewService ? buildLoanPaymentContext({ actor, loan, loanViewService }) : undefined,
    };
  }

  const foundLoan = await loanRepository.findById(loanId);
  const loan = await enrichLoanWithCustomerSummary({ loanRepository, loan: foundLoan });
  if (!loan) {
    throw new NotFoundError('Loan');
  }

  if (actor.role === 'customer' && loan.customerId !== actor.id) {
    throw new AuthorizationError('You can only view your own loans');
  }

  return {
    ...loan,
    paymentContext: loanViewService ? buildLoanPaymentContext({ actor, loan, loanViewService }) : undefined,
  };
};

/**
 * Create the use case that persists a new loan while enforcing customer self-service boundaries.
 * @param {{ loanCreationService: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createCreateLoan = ({ loanCreationService, auditService }) => {
  const useCase = async ({ actor, payload }) => {
    if (actor.role === 'customer' && Number(payload.customerId) !== actor.id) {
      throw new AuthorizationError('You can only create loans for your own customer record');
    }

    return loanCreationService.create(payload);
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'credits', getEntityId: (p) => p?.result?.id, getEntityType: () => 'Loan' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that lists loans for a customer and returns the owning customer record.
 * @param {{ customerRepository: object, loanRepository: object }} dependencies
 * @returns {Function}
 */
const createListLoansByCustomer = ({ customerRepository, loanRepository }) => async ({ actor, customerId, pagination }) => {
  if (actor.role === 'customer' && actor.id !== Number(customerId)) {
    throw new AuthorizationError('You can only view your own loans');
  }

  const foundCustomer = await customerRepository.findById(customerId);
  const customer = await enrichCustomerWithLoanSummary({ customerRepository, customer: foundCustomer });
  if (!customer) {
    throw new NotFoundError('Customer');
  }

  if (pagination) {
    const result = await loanRepository.listPageByCustomer({ customerId, ...pagination });
    const enrichedLoans = await enrichLoansWithCustomerSummaries({ loanRepository, result: result.items });
    return { customer, loans: enrichedLoans, pagination: result.pagination };
  }

  const loans = await loanRepository.listByCustomer(customerId);
  const enrichedLoans = await enrichLoansWithCustomerSummaries({ loanRepository, result: loans });
  return { loans: enrichedLoans, customer };
};

/**
 * Create the use case that updates the primary loan lifecycle status.
 * @param {{ loanRepository: object, loanAccessPolicy?: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createUpdateLoanStatus = ({ loanRepository, loanAccessPolicy, auditService }) => {
  const useCase = async ({ actor, loanId, status }) => {
    const validStatuses = ['pending', 'approved', 'rejected', 'active', 'closed', 'defaulted'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const loan = loanAccessPolicy
      ? await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId })
      : await loanRepository.findById(loanId);

    if (!loan) {
      throw new NotFoundError('Loan');
    }

    if (loan.status === 'closed' && status !== 'closed') {
      throw new ValidationError('Cannot modify a closed loan');
    }

    if (loan.status === 'rejected' && status !== 'rejected') {
      throw new ValidationError('Cannot modify a rejected loan');
    }

    loan.status = status;

    if (status === 'approved') {
      loan.startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + loan.termMonths);
      loan.endDate = endDate;
    }

    if (status === 'defaulted') {
      loan.recoveryStatus = 'pending';
    }

    return loanRepository.save(loan);
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'credits', getEntityId: (p) => p?.loanId, getEntityType: () => 'Loan' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that updates recovery state after policy and domain-guard validation.
 * @param {{ loanRepository: object, loanAccessPolicy?: object, recoveryStatusGuard?: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createUpdateRecoveryStatus = ({ loanRepository, loanAccessPolicy, recoveryStatusGuard, auditService }) => {
  const useCase = async ({ actor, loanId, recoveryStatus }) => {
    const validRecoveryStatuses = ['pending', 'assigned', 'in_progress', 'contacted', 'negotiated', 'recovered', 'failed'];
    if (!validRecoveryStatuses.includes(recoveryStatus)) {
      throw new ValidationError(`Invalid recovery status. Must be one of: ${validRecoveryStatuses.join(', ')}`);
    }

    if (actor.role !== 'admin') {
      throw new AuthorizationError('Only admins can update recovery status');
    }

    const loan = loanAccessPolicy
      ? await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId })
      : await loanRepository.findById(loanId);

    if (!loan) {
      throw new NotFoundError('Loan');
    }

    if (recoveryStatusGuard) {
      recoveryStatusGuard.assertCanTransition({ loan, nextRecoveryStatus: recoveryStatus });
    }

    loan.recoveryStatus = recoveryStatus;
    return loanRepository.save(loan);
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'credits', getEntityId: (p) => p?.loanId, getEntityType: () => 'Loan' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that deletes rejected loans after access checks succeed.
 * @param {{ loanRepository: object, loanAccessPolicy?: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createDeleteLoan = ({ loanRepository, loanAccessPolicy, auditService }) => {
  const useCase = async ({ actor, loanId }) => {
    if (actor.role === 'socio') {
      throw new AuthorizationError('Socio users cannot delete loans');
    }

    const loan = loanAccessPolicy
      ? await loanAccessPolicy.findAuthorizedLoan({ actor, loanId })
      : await loanRepository.findById(loanId);

    if (!loan) {
      throw new NotFoundError('Loan');
    }

    if (loan.status !== 'rejected') {
      throw new ValidationError('Only rejected loans can be deleted');
    }

    await loanRepository.destroy(loan);
  };

  if (auditService) {
    return withAudit({ auditService, action: 'DELETE', module: 'credits', getEntityId: (p) => p?.loanId, getEntityType: () => 'Loan' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that lists authorized loan attachments, filtering customer-visible rows when needed.
 * @param {{ attachmentRepository: object, loanAccessPolicy: object }} dependencies
 * @returns {Function}
 */
const createListLoanAttachments = ({ attachmentRepository, loanAccessPolicy }) => async ({ actor, loanId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const attachments = await attachmentRepository.listByLoan(loan.id);

  if (actor.role === 'customer') {
    return attachments.filter((attachment) => attachment.customerVisible);
  }

  return attachments;
};

/**
 * Create the use case that persists metadata for a newly uploaded loan attachment.
 * @param {{ attachmentRepository: object, attachmentStorage: object, loanAccessPolicy: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createCreateLoanAttachment = ({
  attachmentRepository,
  attachmentStorage,
  loanAccessPolicy,
  auditService,
  fsModule = require('node:fs/promises'),
}) => {
  const useCase = async ({ actor, loanId, file, metadata = {} }) => {
    if (!file) {
      throw new ValidationError('Attachment file is required');
    }

    try {
      await validateAttachmentFileSignature(file, fsModule);
      const loan = await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId });

      return await attachmentRepository.create({
        loanId: loan.id,
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

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'credits', getEntityId: (p) => p?.loanId, getEntityType: () => 'LoanAttachment' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that resolves a readable loan attachment for download.
 * @param {{ attachmentRepository: object, attachmentStorage: object, loanAccessPolicy: object }} dependencies
 * @returns {Function}
 */
const createDownloadLoanAttachment = ({ attachmentRepository, attachmentStorage, loanAccessPolicy }) => async ({ actor, loanId, attachmentId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const attachment = await attachmentRepository.findByIdForLoan({ loanId: loan.id, attachmentId });

  if (!attachment) {
    throw new NotFoundError('Attachment');
  }

  if (actor.role === 'customer' && !attachment.customerVisible) {
    throw new AuthorizationError('You do not have access to this attachment');
  }

  await attachmentStorage.assertExists(attachment.storagePath);

  return {
    attachment,
    absolutePath: attachmentStorage.resolveAbsolutePath(attachment.storagePath),
  };
};

const createListLoanAlerts = ({ alertRepository, loanAccessPolicy, loanViewService }) => async ({ actor, loanId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const { schedule } = loanViewService.getCanonicalLoanView(loan);
  await alertRepository.syncOverdueInstallmentAlerts({ loan, schedule });
  return alertRepository.listByLoan(loan.id);
};

const createGetPaymentCalendar = ({ alertRepository, loanAccessPolicy, loanViewService }) => async ({ actor, loanId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const { schedule, snapshot } = loanViewService.getCanonicalLoanView(loan);
  const alerts = await alertRepository.listByLoan(loan.id);

  return {
    loanId: loan.id,
    entries: buildCalendarEntries({ schedule, alerts }),
    snapshot,
    alerts,
  };
};

const createGetPayoffQuote = ({ loanAccessPolicy, loanViewService }) => async ({ actor, loanId, asOfDate }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

  return loanViewService.getPayoffQuote(loan, asOfDate);
};

const createExecutePayoff = ({ loanAccessPolicy, paymentApplicationService, auditService, clock = () => new Date() }) => {
  const useCase = async ({ actor, loanId, asOfDate, quotedTotal }) => {
    if (actor?.role !== 'customer') {
      throw new AuthorizationError('Only customers can execute payoff payments');
    }

    const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

    return paymentApplicationService.applyPayoff({
      loanId: loan.id,
      asOfDate,
      quotedTotal,
      paymentDate: clock(),
    });
  };

  if (auditService) {
    return withAudit({ auditService, action: 'PAYOFF', module: 'credits', getEntityId: (p) => p?.loanId, getEntityType: () => 'Loan' })(useCase);
  }
  return useCase;
};

const createListPromisesToPay = ({ promiseRepository, loanAccessPolicy }) => async ({ actor, loanId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  return promiseRepository.expireBrokenPromises({ loanId: loan.id });
};

const createCreatePromiseToPay = ({ promiseRepository, loanAccessPolicy, auditService }) => {
  const useCase = async ({ actor, loanId, payload }) => {
    if (actor.role !== 'admin') {
      throw new AuthorizationError('Only admins can create promises to pay');
    }

    const loan = await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId });
    const promisedDate = new Date(payload.promisedDate);
    if (Number.isNaN(promisedDate.getTime())) {
      throw new ValidationError('Promised date is required');
    }

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError('Promise amount must be greater than 0');
    }

    const now = new Date();
    const statusHistory = [{
      status: 'pending',
      changedAt: now.toISOString(),
      actorId: actor.id,
    }];

    return promiseRepository.create({
      loanId: loan.id,
      createdByUserId: actor.id,
      promisedDate,
      amount,
      status: 'pending',
      notes: payload.notes ? String(payload.notes).trim() : null,
      statusHistory,
      lastStatusChangedAt: now,
    });
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'credits', getEntityId: (p) => p?.loanId, getEntityType: () => 'PromiseToPay' })(useCase);
  }
  return useCase;
};

const createCreateLoanFollowUp = ({ alertRepository, loanAccessPolicy, notificationPort }) => async ({ actor, loanId, payload }) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can create follow-up reminders');
  }

  const loan = await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId });
  const dueDate = new Date(payload.dueDate || payload.reminderDate || new Date());

  if (Number.isNaN(dueDate.getTime())) {
    throw new ValidationError('Reminder due date is required');
  }

  const scheduledAmount = Number(payload.scheduledAmount || 0);
  const outstandingAmount = Number(payload.outstandingAmount || scheduledAmount || 0);
  const noteEntry = buildFollowUpNoteEntry({
    actor,
    note: payload.notes,
    status: 'active',
    kind: 'reminder',
  });

  const reminder = payload.alertId
    ? await alertRepository.findByIdForLoan({ loanId: loan.id, alertId: payload.alertId })
    : await alertRepository.create({
      loanId: loan.id,
      installmentNumber: Number(payload.installmentNumber || 0),
      alertType: payload.alertType ? String(payload.alertType).trim() : 'payment_reminder',
      dueDate,
      scheduledAmount,
      outstandingAmount,
      status: 'active',
      notes: noteEntry,
    });

  if (!reminder) {
    throw new NotFoundError('Loan alert');
  }

  if (payload.alertId) {
    reminder.status = 'active';
    reminder.alertType = payload.alertType ? String(payload.alertType).trim() : reminder.alertType;
    reminder.installmentNumber = Number(payload.installmentNumber ?? reminder.installmentNumber ?? 0);
    reminder.dueDate = dueDate;
    reminder.scheduledAmount = scheduledAmount || reminder.scheduledAmount || 0;
    reminder.outstandingAmount = outstandingAmount || reminder.outstandingAmount || 0;
    reminder.resolvedAt = null;
    reminder.resolutionSource = null;
    reminder.notes = appendFollowUpNote(reminder.notes, noteEntry);
    await alertRepository.save(reminder);
  }

  const shouldNotifyCustomer = payload.notifyCustomer !== false;
  if (shouldNotifyCustomer && loan.customerId) {
    await notificationPort.sendLoanReminder(loan.customerId, {
      alertId: reminder.id,
      customerId: loan.customerId,
      loanId: loan.id,
      dueDate: dueDate.toISOString(),
      installmentNumber: reminder.installmentNumber,
      outstandingAmount: reminder.outstandingAmount,
      notes: payload.notes ? String(payload.notes).trim() : null,
    });
  }

  return {
    reminder,
    notificationSent: shouldNotifyCustomer && Boolean(loan.customerId),
  };
};

const createUpdateLoanAlertStatus = ({ alertRepository, loanAccessPolicy }) => async ({ actor, loanId, alertId, payload }) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can update loan alerts');
  }

  const loan = await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId });
  const alert = await alertRepository.findByIdForLoan({ loanId: loan.id, alertId });

  if (!alert) {
    throw new NotFoundError('Loan alert');
  }

  const nextStatus = payload.status;
  if (!['active', 'resolved'].includes(nextStatus)) {
    throw new ValidationError('Alert status must be active or resolved');
  }

  const changedAt = new Date();
  alert.status = nextStatus;
  alert.resolutionSource = nextStatus === 'resolved'
    ? (payload.resolutionSource ? String(payload.resolutionSource).trim() : 'manual_follow_up')
    : null;
  alert.resolvedAt = nextStatus === 'resolved' ? changedAt : null;
  alert.notes = appendFollowUpNote(alert.notes, buildFollowUpNoteEntry({
    actor,
    note: payload.notes,
    status: nextStatus,
    kind: 'alert',
    changedAt,
  }));

  return alertRepository.save(alert);
};

const createUpdatePromiseToPayStatus = ({ promiseRepository, loanAccessPolicy, notificationPort, auditService }) => {
  const useCase = async ({ actor, loanId, promiseId, payload }) => {
    if (actor.role !== 'admin') {
      throw new AuthorizationError('Only admins can update promise statuses');
    }

    const loan = await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId });
    const promise = await promiseRepository.findByIdForLoan({ loanId: loan.id, promiseId });

    if (!promise) {
      throw new NotFoundError('Promise to pay');
    }

    const nextStatus = payload.status;
    if (!['pending', 'kept', 'broken', 'cancelled'].includes(nextStatus)) {
      throw new ValidationError('Promise status must be pending, kept, broken, or cancelled');
    }

    const changedAt = new Date();
    const history = Array.isArray(promise.statusHistory) ? [...promise.statusHistory] : [];
    history.push({
      status: nextStatus,
      changedAt: changedAt.toISOString(),
      actorId: actor.id,
      note: payload.notes ? String(payload.notes).trim() : undefined,
    });

    promise.status = nextStatus;
    promise.fulfilledPaymentId = payload.fulfilledPaymentId || promise.fulfilledPaymentId || null;
    promise.lastStatusChangedAt = changedAt;
    promise.statusHistory = history;
    promise.notes = appendFollowUpNote(promise.notes, buildFollowUpNoteEntry({
      actor,
      note: payload.notes,
      status: nextStatus,
      kind: 'promise',
      changedAt,
    }));

    const updatedPromise = await promiseRepository.save(promise);

    if (payload.notifyCustomer !== false && loan.customerId) {
      await notificationPort.sendPromiseStatus(loan.customerId, {
        customerId: loan.customerId,
        loanId: loan.id,
        promiseId: updatedPromise.id,
        status: updatedPromise.status,
        fulfilledPaymentId: updatedPromise.fulfilledPaymentId,
      });
    }

    return updatedPromise;
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'credits', getEntityId: (p) => p?.promiseId, getEntityType: () => 'PromiseToPay' })(useCase);
  }
  return useCase;
};

const createDownloadPromiseToPay = ({ promiseRepository, loanAccessPolicy }) => async ({ actor, loanId, promiseId }) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can download promise documents');
  }

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const promise = await promiseRepository.findByIdForLoan({ loanId: loan.id, promiseId });

  if (!promise) {
    throw new NotFoundError('Promise to pay');
  }

  const customer = loan.Customer || await promiseRepository.getCustomerForPromise(promise.id);

  return {
    fileName: `promise-to-pay-${promise.id}.pdf`,
    contentType: 'application/pdf',
    buffer: buildPromiseToPayPdfBuffer({ promise, loan, customer }),
  };
};

/**
 * Create the use case that returns aggregated loan statistics.
 * @param {{ loanRepository: object }} dependencies
 * @returns {Function}
 */
const createGetLoanStatistics = ({ loanRepository }) => async () => {
  const loans = await loanRepository.list();

  const totalCredits = loans.length;
  const activeCredits = loans.filter((l) => ['approved', 'active'].includes(l.status)).length;
  const paidCredits = loans.filter((l) => l.status === 'closed').length;
  const overdueCredits = loans.filter((l) => l.status === 'defaulted' || l.recoveryStatus === 'overdue').length;

  const totalLoanAmount = loans.reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const totalCollected = loans.reduce((sum, l) => sum + Number(l.totalPaid || 0), 0);
  const totalPending = loans.reduce((sum, l) => sum + Number(l.principalOutstanding || 0) + Number(l.interestOutstanding || 0), 0);
  const totalOverdue = loans.filter((l) => l.status === 'defaulted' || l.recoveryStatus === 'overdue')
    .reduce((sum, l) => sum + Number(l.principalOutstanding || 0) + Number(l.interestOutstanding || 0), 0);

  const averageLoanAmount = totalCredits > 0 ? totalLoanAmount / totalCredits : 0;
  const averageTerm = totalCredits > 0
    ? loans.reduce((sum, l) => sum + Number(l.termMonths || 0), 0) / totalCredits
    : 0;
  const collectionRate = totalLoanAmount > 0 ? (totalCollected / totalLoanAmount) * 100 : 0;

  return {
    counts: {
      totalCredits,
      activeCredits,
      paidCredits,
      overdueCredits,
    },
    amounts: {
      totalLoanAmount: roundCurrency(totalLoanAmount),
      totalCollected: roundCurrency(totalCollected),
      totalPending: roundCurrency(totalPending),
      totalOverdue: roundCurrency(totalOverdue),
    },
    averages: {
      averageLoanAmount: roundCurrency(averageLoanAmount),
      averageTerm: Number(averageTerm.toFixed(1)),
      collectionRate: Number(collectionRate.toFixed(2)),
    },
  };
};

/**
 * Create the use case that returns installments due on or before a specified date.
 * @param {{ loanRepository: object, alertRepository: object, loanViewService: object }} dependencies
 * @returns {Function}
 */
const createGetDuePayments = ({ loanRepository, alertRepository, loanViewService }) => async ({ date }) => {
  const loans = await loanRepository.list();
  const targetDate = new Date(date);
  const now = new Date();
  const duePayments = [];

  for (const loan of loans) {
    if (loan.status === 'closed' || loan.status === 'rejected') {
      continue;
    }

    const { schedule } = loanViewService.getCanonicalLoanView(loan);
    const alerts = await alertRepository.listByLoan(loan.id);

    for (const installment of schedule) {
      if (installment.status === 'annulled') {
        continue;
      }

      const installmentDate = new Date(installment.dueDate);
      if (installmentDate > targetDate) {
        continue;
      }

      const outstandingAmount = roundCurrency((installment.remainingPrincipal || 0) + (installment.remainingInterest || 0));
      if (outstandingAmount <= 0) {
        continue;
      }

      const alert = alerts.find((a) => Number(a.installmentNumber) === Number(installment.installmentNumber));
      const isOverdue = Boolean(alert) || installmentDate < now;
      const daysOverdue = isOverdue
        ? Math.floor((now.getTime() - installmentDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      duePayments.push({
        creditId: loan.id,
        customerName: loan.Customer?.name || loan.customerId || 'Unknown',
        installmentNumber: installment.installmentNumber,
        amountDue: roundCurrency(outstandingAmount),
        dueDate: installment.dueDate,
        daysOverdue,
      });
    }
  }

  return duePayments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
};

/**
 * Create the use case that searches loans with filters and pagination.
 * @param {{ loanRepository: object }} dependencies
 * @returns {Function}
 */
/**
 * Create the use case that updates the annual late fee rate for a loan.
 * @param {{ loanRepository: object, loanAccessPolicy?: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createUpdateLateFeeRate = ({ loanRepository, loanAccessPolicy, auditService }) => {
  const useCase = async ({ actor, loanId, lateFeeRate }) => {
    if (actor.role !== 'admin') {
      throw new AuthorizationError('Only admins can update late fee rates');
    }

    const parsedRate = parseFloat(lateFeeRate);
    if (Number.isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      throw new ValidationError('Late fee rate must be a number between 0 and 100');
    }

    const loan = loanAccessPolicy
      ? await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId })
      : await loanRepository.findById(loanId);

    if (!loan) {
      throw new NotFoundError('Loan');
    }

    loan.annualLateFeeRate = parsedRate;
    return loanRepository.save(loan);
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'credits', getEntityId: (p) => p?.loanId, getEntityType: () => 'Loan' })(useCase);
  }
  return useCase;
};

const createSearchLoans = ({ loanRepository }) => async ({ filters = {}, pagination }) => {
  const loans = await loanRepository.list();
  let filteredLoans = loans;

  if (filters.status) {
    filteredLoans = filteredLoans.filter((l) => l.status === filters.status);
  }

  if (filters.minAmount !== undefined) {
    filteredLoans = filteredLoans.filter((l) => Number(l.amount || 0) >= Number(filters.minAmount));
  }

  if (filters.maxAmount !== undefined) {
    filteredLoans = filteredLoans.filter((l) => Number(l.amount || 0) <= Number(filters.maxAmount));
  }

  if (filters.startDate) {
    const startDate = new Date(filters.startDate);
    filteredLoans = filteredLoans.filter((l) => new Date(l.createdAt) >= startDate);
  }

  if (filters.endDate) {
    const endDate = new Date(filters.endDate);
    filteredLoans = filteredLoans.filter((l) => new Date(l.createdAt) <= endDate);
  }

  if (pagination) {
    const offset = pagination.offset || 0;
    const pageSize = pagination.pageSize || 25;
    const items = filteredLoans.slice(offset, offset + pageSize);
    return {
      items,
      pagination: {
        page: pagination.page,
        pageSize,
        totalItems: filteredLoans.length,
        totalPages: Math.ceil(filteredLoans.length / pageSize),
      },
    };
  }

  return filteredLoans;
};

module.exports = {
  createListLoans,
  createCreateSimulation,
  createLoadDagWorkbenchGraph,
  createSaveDagWorkbenchGraph,
  createValidateDagWorkbenchGraph,
  createSimulateDagWorkbenchGraph,
  createGetDagWorkbenchSummary,
  createListDagWorkbenchGraphs,
  createGetDagWorkbenchGraphDetails,
  createActivateDagWorkbenchGraph,
  createDeactivateDagWorkbenchGraph,
  createDeleteDagWorkbenchGraph,
  createGetLoanById,
  createCreateLoan,
  createListLoansByCustomer,
  createUpdateLoanStatus,
  createUpdateRecoveryStatus,
  createDeleteLoan,
  createListLoanAttachments,
  createCreateLoanAttachment,
  isValidAttachmentSignature,
  validateAttachmentFileSignature,
  createDownloadLoanAttachment,
  createListLoanAlerts,
  createGetPaymentCalendar,
  createGetPayoffQuote,
  createExecutePayoff,
  createListPromisesToPay,
  createCreatePromiseToPay,
  createCreateLoanFollowUp,
  createUpdateLoanAlertStatus,
  createUpdatePromiseToPayStatus,
  createDownloadPromiseToPay,
  createGetLoanStatistics,
  createGetDuePayments,
  createSearchLoans,
  createUpdateLateFeeRate,
};
