const crypto = require('crypto');
const { IdempotencyKey } = require('@/models');
const { NotFoundError, ValidationError, AuthorizationError } = require('@/utils/errorHandler');
const { roundCurrency, calculateLateFee } = require('./creditFormulaHelpers');
const { paginateArray } = require('@/modules/shared/pagination');
const { validateInterestRate } = require('@/modules/shared/validators');
const { withAudit } = require('@/modules/audit/application/auditDecorator');
const { isAdministrativeLoginRole } = require('@/modules/shared/roles');
const { buildDateRangeMessage } = require('@/modules/shared/dateUtils');
const {
  normalizeAttachmentVisibility,
  ensureUploadedFile,
  withUploadCleanup,
  toTrimmedOrNull,
  buildStoredFileFields,
  ensureDocumentExists,
  resolveDocumentDownload,
  isValidAttachmentSignature,
  validateAttachmentFileSignature,
} = require('@/modules/shared/documentOperations');
const {
  evaluateCapitalPaymentEligibility,
  evaluatePayoffEligibility,
  PAYABLE_LOAN_STATUSES,
} = require('./paymentEligibility');
const { normalizeUtcDateOnly } = require('./loanFinancials');

const LOAN_CREATION_IDEMPOTENCY_SCOPE = 'loan_creation';
const IDEMPOTENCY_WAIT_BASE_MS = 50;
const CREDIT_ACCESS_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden acceder a créditos.';
const CREDIT_CREATE_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden crear créditos.';
const CUSTOMER_CREDIT_LIST_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden consultar créditos del cliente.';
const CREDIT_SEARCH_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden buscar créditos.';
const CREDIT_CANCEL_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden anular créditos.';
const CREDIT_ATTACHMENT_LIST_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden consultar soportes del crédito.';
const CREDIT_ATTACHMENT_DOWNLOAD_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden descargar soportes del crédito.';
const PAYOFF_EXECUTE_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden registrar pagos totales.';
const PROMISE_CREATE_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden registrar promesas de pago.';
const FOLLOW_UP_CREATE_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden crear recordatorios de seguimiento.';
const LOAN_ALERT_UPDATE_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden actualizar alertas del crédito.';
const PROMISE_UPDATE_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden actualizar promesas de pago.';
const PROMISE_DOWNLOAD_DENIED_MESSAGE = 'Solo usuarios administrativos autorizados pueden descargar documentos de promesa de pago.';
const LATE_FEE_RATE_VALID_MESSAGE = 'La tasa de mora debe ser un número entre 0 y 100.';
const LOAN_CREATION_IDEMPOTENCY_CONFLICT_MESSAGE = 'Esta creación de crédito ya fue enviada con otros datos. Revisa el resultado antes de intentar nuevamente.';
const LOAN_CREATION_IDEMPOTENCY_PENDING_MESSAGE = 'La creación del crédito ya se está procesando. Espera el resultado antes de intentar nuevamente.';
const PROMISE_AMOUNT_POSITIVE_MESSAGE = 'El monto prometido debe ser mayor que 0.';
const FOLLOW_UP_DUE_DATE_VALID_MESSAGE = 'La fecha del recordatorio es obligatoria y debe ser válida.';
const PROMISE_STATUS_VALID_MESSAGE = 'Selecciona un estado de promesa válido.';
const CALENDAR_AGENDA_LIMIT_MESSAGE = 'El límite de la agenda debe ser un entero positivo.';
const LATE_FEE_RATE_ADMIN_REQUIRED_MESSAGE = 'Solo un administrador puede actualizar tasas de mora.';
const CREDIT_CANCEL_REJECTED_ONLY_MESSAGE = 'Solo se pueden cancelar créditos rechazados.';
const CLOSED_LOAN_MODIFICATION_MESSAGE = 'No se puede modificar un crédito cerrado.';
const REJECTED_LOAN_MODIFICATION_MESSAGE = 'No se puede modificar un crédito rechazado.';

class PendingIdempotencyError extends Error {}

/**
 * Ensure credit use cases are invoked only by administrative backoffice users.
 * @param {{ role?: string }} actor
 * @param {string} message
 * @returns {void}
 * @throws {AuthorizationError}
 */
const ensureCreditBackofficeActor = (actor, message) => {
  if (!isAdministrativeLoginRole(actor?.role)) {
    throw new AuthorizationError(message);
  }
};

const stringifyStable = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stringifyStable(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stringifyStable(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
};

const hashPayload = (payload) => crypto
  .createHash('sha256')
  .update(stringifyStable(payload))
  .digest('hex');

const toPlainJson = (value) => {
  const plainValue = typeof value?.toJSON === 'function' ? value.toJSON() : value;
  return JSON.parse(JSON.stringify(plainValue, (_key, nestedValue) => (
    typeof nestedValue === 'function' ? undefined : nestedValue
  )));
};

const sendOptionalNotification = async (sendFn) => {
  try {
    await sendFn();
    return true;
  } catch (error) {
    return false;
  }
};

const uniqueNotificationRecipients = (...ids) => [...new Set(ids
  .map((id) => Number(id))
  .filter((id) => Number.isInteger(id) && id > 0))];

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

const formatDateOnlyForDocument = (date) => {
  if (!date) return '-';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.slice(0, 10);
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return '-';
  }

  return parsedDate.toISOString().slice(0, 10);
};

const formatCurrencyForDocument = (amount) => `$${Number(amount || 0).toFixed(2)}`;

const formatPromiseStatus = (status) => ({
  pending: 'Pendiente',
  kept: 'Cumplida',
  broken: 'Incumplida',
  cancelled: 'Cancelada',
}[String(status || 'pending').trim().toLowerCase()] || 'Pendiente');

/**
 * Resolve the customer label used by due-payment API rows.
 * @param {object} loan
 * @returns {string}
 */
const getDuePaymentCustomerLabel = (loan) => {
  const name = String(loan?.Customer?.name || loan?.customerName || '').trim();
  if (name) {
    return name;
  }

  if (loan?.customerId !== undefined && loan?.customerId !== null) {
    return `Cliente ${loan.customerId}`;
  }

  return 'Cliente sin nombre';
};

/**
 * Build the operator-facing promise-to-pay PDF in Spanish with date-only
 * rendering so promised dates do not shift by local timezone.
 * @param {{ promise: object, loan: object, customer: object }} input
 * @returns {Buffer}
 */
const buildPromiseToPayPdfBuffer = ({ promise, loan, customer }) => {
  const customerName = customer?.name || `Cliente ${loan?.customerId || '-'}`;
  const customerEmail = customer?.email || '-';

  return buildPdfBuffer({
    title: 'COMPROBANTE DE PROMESA DE PAGO',
    lines: [
      `ID del documento: ${promise.id}`,
      `Fecha de generacion: ${formatDateOnlyForDocument(promise.createdAt)}`,
      '',
      '=== DATOS DEL CREDITO ===',
      `Credito: ${loan.id}`,
      `Monto del credito: ${formatCurrencyForDocument(loan.amount)}`,
      `Cliente: ${customerName}`,
      `Correo del cliente: ${customerEmail}`,
      '',
      '=== DATOS DE LA PROMESA ===',
      `Fecha prometida: ${formatDateOnlyForDocument(promise.promisedDate)}`,
      `Monto prometido: ${formatCurrencyForDocument(promise.amount)}`,
      `Estado: ${formatPromiseStatus(promise.status)}`,
      promise.notes ? `Notas: ${promise.notes}` : '',
      '',
      '=== CONDICIONES OPERATIVAS ===',
      'Este documento registra la promesa de pago recibida por el operador.',
      'El cliente se compromete a pagar en la fecha indicada.',
      'El incumplimiento puede activar acciones de seguimiento y cobranza.',
      '',
      '=== FIRMAS ===',
      '',
      'Firma del cliente: ________________________',
      `Fecha: ${formatDateOnlyForDocument(promise.promisedDate)}`,
      '',
      'Operador autorizado: ________________________',
      `Fecha: ${formatDateOnlyForDocument(promise.createdAt)}`,
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

const normalizeDateOnly = (value, field = 'date') => {
  if (!value) {
    return normalizeUtcDateOnly(new Date(), field);
  }

  return normalizeUtcDateOnly(value, field);
};

const calculateDaysOverdue = ({ dueDate, asOfDate }) => {
  const parsedDueDate = normalizeDateOnly(dueDate, 'dueDate');
  const parsedAsOfDate = normalizeDateOnly(asOfDate, 'asOfDate');
  const diffMs = parsedAsOfDate.getTime() - parsedDueDate.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
};

const calculateInstallmentLateFeeDue = ({ loan, row, asOfDate }) => {
  const daysOverdue = calculateDaysOverdue({ dueDate: row.dueDate, asOfDate });
  if (daysOverdue <= 0 || row.status === 'paid' || row.status === 'annulled') {
    return { daysOverdue: 0, lateFeeDue: 0, lateFeeBase: 0, lateFeeBaseType: null };
  }

  const outstandingInterest = roundCurrency(row.remainingInterest || 0);
  const outstandingAmount = roundCurrency((row.remainingPrincipal || 0) + outstandingInterest);
  const lateFeeBase = outstandingInterest > 0 ? outstandingInterest : outstandingAmount;
  if (lateFeeBase <= 0) {
    return { daysOverdue, lateFeeDue: 0, lateFeeBase: 0, lateFeeBaseType: null };
  }

  const lateFeeDue = calculateLateFee({
    overdueAmount: lateFeeBase,
    daysOverdue,
    feeMode: String(loan.lateFeeMode || 'SIMPLE').toUpperCase(),
    annualRate: Number(loan.annualLateFeeRate || 0),
  });

  return {
    daysOverdue,
    lateFeeDue: roundCurrency(lateFeeDue),
    lateFeeBase,
    lateFeeBaseType: outstandingInterest > 0 ? 'OVERDUE_INTEREST' : 'OVERDUE_INSTALLMENT',
  };
};

const getOutstandingAmount = (row) => roundCurrency((row.remainingPrincipal || 0) + (row.remainingInterest || 0));

const getNextPayableInstallmentNumber = (schedule) => {
  const row = schedule.find((entry) => (
    entry.status !== 'annulled'
    && getOutstandingAmount(entry) > 0.01
  ));

  return row ? Number(row.installmentNumber) : null;
};

const buildInstallmentQuote = ({ loan, schedule, installmentNumber, asOfDate = new Date() }) => {
  const targetInstallmentNumber = Number(installmentNumber);
  if (!Number.isInteger(targetInstallmentNumber) || targetInstallmentNumber <= 0) {
    throw new ValidationError('El número de cuota debe ser un entero positivo');
  }

  const parsedAsOfDate = normalizeDateOnly(asOfDate, 'asOfDate');
  const targetRow = schedule.find((row) => Number(row.installmentNumber) === targetInstallmentNumber);

  if (!targetRow) {
    throw new NotFoundError('Installment');
  }

  const outstandingPrincipal = roundCurrency(targetRow.remainingPrincipal || 0);
  const outstandingInterest = roundCurrency(targetRow.remainingInterest || 0);
  const outstandingAmount = getOutstandingAmount(targetRow);
  const nextPayableInstallmentNumber = getNextPayableInstallmentNumber(schedule);
  const isNextPayable = nextPayableInstallmentNumber === targetInstallmentNumber;
  const lateFee = calculateInstallmentLateFeeDue({ loan, row: targetRow, asOfDate: parsedAsOfDate });
  const totalDue = roundCurrency(outstandingAmount + lateFee.lateFeeDue);
  const canPay = outstandingAmount > 0.01
    && targetRow.status !== 'annulled'
    && targetRow.status !== 'paid'
    && isNextPayable
    && PAYABLE_LOAN_STATUSES.has(loan.status);

  let disabledReason = null;
  if (!PAYABLE_LOAN_STATUSES.has(loan.status)) {
    disabledReason = 'El estado del crédito no permite registrar pagos';
  } else if (targetRow.status === 'annulled') {
    disabledReason = 'La cuota está anulada';
  } else if (outstandingAmount <= 0.01 || targetRow.status === 'paid') {
    disabledReason = 'La cuota ya está pagada';
  } else if (!isNextPayable) {
    disabledReason = nextPayableInstallmentNumber
      ? `Debe pagar primero la cuota ${nextPayableInstallmentNumber}`
      : 'No hay cuotas disponibles para pago';
  }

  return {
    loanId: loan.id,
    installmentNumber: targetInstallmentNumber,
    asOfDate: parsedAsOfDate.toISOString().slice(0, 10),
    dueDate: targetRow.dueDate,
    status: targetRow.status,
    scheduledPayment: roundCurrency(targetRow.scheduledPayment || 0),
    outstandingPrincipal,
    outstandingInterest,
    outstandingAmount,
    lateFeeDue: lateFee.lateFeeDue,
    lateFeeBase: lateFee.lateFeeBase,
    lateFeeBaseType: lateFee.lateFeeBaseType,
    annualLateFeeRate: Number(loan.annualLateFeeRate || 0),
    lateFeeMode: loan.lateFeeMode || 'SIMPLE',
    daysOverdue: lateFee.daysOverdue,
    totalDue,
    minimumSuggestedPayment: totalDue,
    canPay,
    disabledReason,
    isNextPayable,
    nextPayableInstallmentNumber,
  };
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

const buildCalendarEntries = ({ loan, schedule, alerts, asOfDate = new Date() }) => {
  const alertByInstallment = new Map(
    alerts
      .map((alert) => [Number(alert.installmentNumber), alert]),
  );

  const nextPayableInstallmentNumber = getNextPayableInstallmentNumber(schedule);

  return schedule.map((row) => {
    if (row.status === 'annulled') {
      return {
        installmentNumber: row.installmentNumber,
        dueDate: row.dueDate,
        scheduledPayment: roundCurrency(row.scheduledPayment || 0),
        principalComponent: roundCurrency(row.principalComponent || 0),
        interestComponent: roundCurrency(row.interestComponent || 0),
        paidPrincipal: roundCurrency(row.paidPrincipal || 0),
        paidInterest: roundCurrency(row.paidInterest || 0),
        paidTotal: roundCurrency(row.paidTotal || 0),
        remainingPrincipal: roundCurrency(row.remainingPrincipal || 0),
        remainingInterest: roundCurrency(row.remainingInterest || 0),
        remainingBalance: roundCurrency(row.remainingBalance || 0),
        outstandingAmount: 0,
        payableAmount: 0,
        lateFeeDue: 0,
        daysOverdue: 0,
        canPay: false,
        disabledReason: 'La cuota está anulada',
        isNextPayable: false,
        status: 'annulled',
        alertId: null,
      };
    }

    const outstandingAmount = getOutstandingAmount(row);
    const lateFee = calculateInstallmentLateFeeDue({ loan, row, asOfDate });
    const isOverdue = lateFee.daysOverdue > 0;
    const isNextPayable = nextPayableInstallmentNumber === Number(row.installmentNumber);
    const status = formatCalendarEntryStatus({ row, isOverdue, outstandingAmount });
    const canPay = outstandingAmount > 0.01
      && status !== 'paid'
      && status !== 'annulled'
      && isNextPayable
      && PAYABLE_LOAN_STATUSES.has(loan.status);

    return {
      installmentNumber: row.installmentNumber,
      dueDate: row.dueDate,
      scheduledPayment: roundCurrency(row.scheduledPayment || 0),
      principalComponent: roundCurrency(row.principalComponent || 0),
      interestComponent: roundCurrency(row.interestComponent || 0),
      paidPrincipal: roundCurrency(row.paidPrincipal || 0),
      paidInterest: roundCurrency(row.paidInterest || 0),
      paidTotal: roundCurrency(row.paidTotal || 0),
      remainingPrincipal: roundCurrency(row.remainingPrincipal || 0),
      remainingInterest: roundCurrency(row.remainingInterest || 0),
      remainingBalance: roundCurrency(row.remainingBalance || 0),
      outstandingAmount,
      payableAmount: roundCurrency(outstandingAmount + lateFee.lateFeeDue),
      lateFeeDue: lateFee.lateFeeDue,
      lateFeeBase: lateFee.lateFeeBase,
      lateFeeBaseType: lateFee.lateFeeBaseType,
      daysOverdue: lateFee.daysOverdue,
      canPay,
      disabledReason: canPay
        ? null
        : (isNextPayable ? null : `Debe pagar primero la cuota ${nextPayableInstallmentNumber || row.installmentNumber}`),
      isNextPayable,
      status,
      alertId: alertByInstallment.get(Number(row.installmentNumber))?.id || null,
    };
  });
};

const normalizeCalendarOverviewLoanIds = (loanIds) => {
  if (!Array.isArray(loanIds)) {
    return [];
  }

  return [...new Set(
    loanIds
      .map((loanId) => Number(loanId))
      .filter((loanId) => Number.isInteger(loanId) && loanId > 0),
  )].slice(0, 25);
};

const getCalendarDateKey = (value) => normalizeDateOnly(value, 'asOfDate').toISOString().slice(0, 10);

const getCalendarCustomerName = (loan) => {
  const rawName = loan?.Customer?.name || loan?.customerName || loan?.customer?.name;
  return rawName ? String(rawName).trim() : `Crédito #${loan.id}`;
};

const toCalendarOverviewEntry = ({ loan, entry }) => ({
  loanId: Number(loan.id),
  customerName: getCalendarCustomerName(loan),
  totalInstallments: Number(loan.termMonths || loan.totalInstallments || 0),
  loanStatus: String(loan.status || ''),
  installmentNumber: Number(entry.installmentNumber || 0),
  dueDate: entry.dueDate,
  status: String(entry.status || 'pending'),
  scheduledPayment: roundCurrency(entry.scheduledPayment || 0),
  principalComponent: roundCurrency(entry.principalComponent || 0),
  interestComponent: roundCurrency(entry.interestComponent || 0),
  remainingBalance: roundCurrency(entry.remainingBalance || 0),
  outstandingAmount: roundCurrency(entry.outstandingAmount || 0),
  payableAmount: roundCurrency(entry.payableAmount || 0),
  lateFeeDue: roundCurrency(entry.lateFeeDue || 0),
  daysOverdue: Number(entry.daysOverdue || 0),
  canPay: Boolean(entry.canPay),
  disabledReason: entry.disabledReason || null,
  isNextPayable: Boolean(entry.isNextPayable),
  alertId: entry.alertId || null,
});

const buildPaymentCalendarOverview = ({ normalizedLoanIds, entries, asOfDate }) => {
  const normalizedDateKey = getCalendarDateKey(asOfDate);
  const pendingStatuses = new Set(['pending', 'partial']);
  const actionableEntries = entries
    .filter((entry) => entry.isNextPayable && entry.status !== 'paid' && entry.status !== 'annulled')
    .sort((left, right) => {
      const leftRank = left.status === 'overdue' ? 0 : left.status === 'partial' ? 1 : 2;
      const rightRank = right.status === 'overdue' ? 0 : right.status === 'partial' ? 1 : 2;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      if (left.daysOverdue !== right.daysOverdue) {
        return right.daysOverdue - left.daysOverdue;
      }

      const leftDue = normalizeDateOnly(left.dueDate, 'dueDate').getTime();
      const rightDue = normalizeDateOnly(right.dueDate, 'dueDate').getTime();
      if (leftDue !== rightDue) {
        return leftDue - rightDue;
      }

      return left.loanId - right.loanId;
    });

  return {
    asOfDate: normalizedDateKey,
    summary: {
      totalLoans: normalizedLoanIds.length,
      totalEntries: entries.length,
      paidCount: entries.filter((entry) => entry.status === 'paid').length,
      pendingCount: entries.filter((entry) => pendingStatuses.has(entry.status)).length,
      overdueCount: entries.filter((entry) => entry.status === 'overdue').length,
      dueTodayCount: entries.filter((entry) => (
        entry.status !== 'paid'
        && entry.status !== 'annulled'
        && getCalendarDateKey(entry.dueDate) === normalizedDateKey
      )).length,
      actionableCount: actionableEntries.length,
      totalPayableAmount: roundCurrency(actionableEntries.reduce((sum, entry) => sum + entry.payableAmount, 0)),
      totalLateFeeAmount: roundCurrency(entries.reduce((sum, entry) => sum + entry.lateFeeDue, 0)),
    },
    agenda: actionableEntries.slice(0, 8),
    actionableEntries,
    nextAction: actionableEntries[0] || null,
    entries,
  };
};

const parseCalendarOverviewFilters = (filters = {}) => {
  const parseDate = (value, field) => {
    if (!value) return null;
    return normalizeDateOnly(value, field);
  };
  const normalizeStatus = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || null;
  };
  /**
   * Parses the optional agenda limit without accepting partial numeric text or
   * exponent notation, preserving the existing 1-250 clamp for plain integers.
   * @param {string|number|null|undefined} value
   * @returns {number|null}
   */
  const parseLimit = (value) => {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const normalizedValue = String(value).trim();
    if (!/^\d+$/.test(normalizedValue)) {
      throw new ValidationError(CALENDAR_AGENDA_LIMIT_MESSAGE);
    }

    const limit = Number(normalizedValue);
    if (!Number.isSafeInteger(limit)) {
      throw new ValidationError(CALENDAR_AGENDA_LIMIT_MESSAGE);
    }

    return Math.min(Math.max(limit || 100, 1), 250);
  };

  return {
    search: String(filters.search || '').trim(),
    status: normalizeStatus(filters.status),
    startDate: parseDate(filters.startDate, 'startDate'),
    endDate: parseDate(filters.endDate, 'endDate'),
    limit: parseLimit(filters.limit),
  };
};

const assertCalendarOverviewDateRange = ({ startDate, endDate }) => {
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    throw new ValidationError(buildDateRangeMessage('startDate', 'endDate'));
  }
};

const filterCalendarOverviewEntries = ({ entries, filters }) => entries.filter((entry) => {
  if (filters.status && String(entry.status || '').toLowerCase() !== filters.status) {
    return false;
  }

  const dueDate = normalizeDateOnly(entry.dueDate, 'dueDate');
  if (filters.startDate && dueDate.getTime() < filters.startDate.getTime()) {
    return false;
  }

  if (filters.endDate) {
    const inclusiveEnd = new Date(filters.endDate.getTime());
    inclusiveEnd.setHours(23, 59, 59, 999);
    if (dueDate.getTime() > inclusiveEnd.getTime()) {
      return false;
    }
  }

  return true;
});

const resolveCalendarOverviewLoans = async ({
  actor,
  loanIds,
  loanRepository,
  loanAccessPolicy,
  filters,
}) => {
  const normalizedLoanIds = normalizeCalendarOverviewLoanIds(loanIds);

  if (normalizedLoanIds.length > 0) {
    const loans = await Promise.all(
      normalizedLoanIds.map((loanId) => loanAccessPolicy.findAuthorizedLoan({ actor, loanId })),
    );
    return { normalizedLoanIds, loans };
  }

  let loans = [];
  if (loanRepository && typeof loanRepository.search === 'function') {
    loans = await loanRepository.search({
      actor,
      filters: filters.search ? { search: filters.search } : {},
    });
  } else if (loanRepository && typeof loanRepository.list === 'function') {
    const allLoans = await loanRepository.list();
    loans = loanAccessPolicy
      ? loanAccessPolicy.filterVisibleLoans({ actor, loans: allLoans })
      : allLoans;
  }

  const limitedLoans = (filters.limit
    ? loans.slice(0, filters.limit)
    : loans
  ).map((loan) => (typeof loan?.toJSON === 'function' ? loan.toJSON() : loan));

  return {
    normalizedLoanIds: limitedLoans.map((loan) => Number(loan.id)).filter(Number.isFinite),
    loans: limitedLoans,
  };
};

/**
 * Create the use case that lists loans, optionally filtered through the shared access policy.
 * @param {{ loanRepository: object, loanAccessPolicy?: object }} dependencies
 * @returns {Function}
 */
const createListLoans = ({ loanRepository, loanAccessPolicy }) => async ({ actor, pagination }) => {
  if (pagination && ['admin', 'employee'].includes(actor?.role)) {
    const result = await loanRepository.listPage(pagination);
    return enrichLoansWithCustomerSummaries({ loanRepository, result });
  }

  const loans = await loanRepository.list();
  const visibleLoans = loanAccessPolicy
    ? loanAccessPolicy.filterVisibleLoans({ actor, loans })
    : loans;

  if (pagination) {
    const result = paginateArray({ items: visibleLoans, pagination });
    return enrichLoansWithCustomerSummaries({ loanRepository, result });
  }

  return enrichLoansWithCustomerSummaries({ loanRepository, result: visibleLoans });
};

/**
 * Create the use case that returns canonical credit calculation data.
 * @param {{ creditDomainService: object }} dependencies
 * @returns {Function}
 */
const createCreateCreditCalculation = ({ creditDomainService }) => async (payload) => {
  if (!creditDomainService || typeof creditDomainService.calculate !== 'function') {
    throw new Error('creditDomainService.calculate is required');
  }
  return creditDomainService.calculate(payload);
};

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
    allowedPaymentTypes: isAdministrativeLoginRole(actor?.role)
      ? ['installment', 'partial', 'capital']
      : [],
    snapshot,
    payoffEligibility,
    capitalEligibility,
  };
};

const createGetLoanById = ({ loanAccessPolicy, loanRepository, loanViewService }) => async ({ actor, loanId }) => {
  ensureCreditBackofficeActor(actor, CREDIT_ACCESS_DENIED_MESSAGE);

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

  return {
    ...loan,
    paymentContext: loanViewService ? buildLoanPaymentContext({ actor, loan, loanViewService }) : undefined,
  };
};

const validateLoanCreationIdempotencyKey = (idempotencyKey) => {
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
    throw new ValidationError('El encabezado Idempotency-Key es obligatorio para crear créditos');
  }

  const normalizedKey = idempotencyKey.trim();
  if (normalizedKey.length < 8 || normalizedKey.length > 160) {
    throw new ValidationError('El encabezado Idempotency-Key debe tener entre 8 y 160 caracteres');
  }

  return normalizedKey;
};

const assertSameLoanCreationRequest = (record, requestHash) => {
  if (record?.requestHash && record.requestHash !== requestHash) {
    throw new ValidationError(LOAN_CREATION_IDEMPOTENCY_CONFLICT_MESSAGE);
  }
};

const buildLoanCreationRequestHash = ({ actor, payload }) => hashPayload({
  actorId: Number(actor?.id || 0),
  actorRole: actor?.role || null,
  payload,
});

const buildLoanCreationCachePayload = (loan) => ({
  loan: toPlainJson(loan),
});

const waitForCompletedLoanCreationKey = async ({
  idempotencyKeyModel,
  idempotencyKey,
  requestHash,
}) => {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const record = await idempotencyKeyModel.findOne({
      where: { scope: LOAN_CREATION_IDEMPOTENCY_SCOPE, idempotencyKey },
    });

    assertSameLoanCreationRequest(record, requestHash);

    if (record?.status === 'completed') {
      return {
        ...record.responsePayload.loan,
        idempotent: true,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, IDEMPOTENCY_WAIT_BASE_MS * attempt));
  }

  throw new ValidationError(LOAN_CREATION_IDEMPOTENCY_PENDING_MESSAGE);
};

const runLoanCreationWithIdempotency = async ({
  actor,
  payload,
  idempotencyKey,
  idempotencyKeyModel,
  operation,
}) => {
  const normalizedKey = validateLoanCreationIdempotencyKey(idempotencyKey);
  const requestHash = buildLoanCreationRequestHash({ actor, payload });
  const actorId = Number(actor?.id || 0);

  try {
    const existingKey = await idempotencyKeyModel.findOne({
      where: { scope: LOAN_CREATION_IDEMPOTENCY_SCOPE, idempotencyKey: normalizedKey },
    });

    assertSameLoanCreationRequest(existingKey, requestHash);

    if (existingKey?.status === 'completed') {
      return {
        ...existingKey.responsePayload.loan,
        idempotent: true,
      };
    }

    if (existingKey?.status === 'pending') {
      throw new PendingIdempotencyError(LOAN_CREATION_IDEMPOTENCY_PENDING_MESSAGE);
    }

    if (existingKey) {
      await existingKey.update({
        createdByUserId: actorId,
        requestHash,
        responsePayload: {},
        status: 'pending',
      });
    } else {
      try {
        await idempotencyKeyModel.create({
          scope: LOAN_CREATION_IDEMPOTENCY_SCOPE,
          idempotencyKey: normalizedKey,
          createdByUserId: actorId,
          requestHash,
          responsePayload: {},
          status: 'pending',
        });
      } catch (error) {
        if (error.name !== 'SequelizeUniqueConstraintError') {
          throw error;
        }
        throw new PendingIdempotencyError(LOAN_CREATION_IDEMPOTENCY_PENDING_MESSAGE);
      }
    }

    try {
      const loan = await operation();
      await idempotencyKeyModel.update({
        responsePayload: buildLoanCreationCachePayload(loan),
        status: 'completed',
      }, {
        where: { scope: LOAN_CREATION_IDEMPOTENCY_SCOPE, idempotencyKey: normalizedKey },
      });
      return loan;
    } catch (error) {
      await idempotencyKeyModel.update({
        responsePayload: {
          error: {
            name: error.name,
            message: error.message,
          },
        },
        status: 'failed',
      }, {
        where: { scope: LOAN_CREATION_IDEMPOTENCY_SCOPE, idempotencyKey: normalizedKey },
      }).catch(() => {});
      throw error;
    }
  } catch (error) {
    if (error instanceof PendingIdempotencyError) {
      return waitForCompletedLoanCreationKey({
        idempotencyKeyModel,
        idempotencyKey: normalizedKey,
        requestHash,
      });
    }
    throw error;
  }
};

/**
 * Create the use case that persists a new loan for an authorized backoffice actor.
 * @param {{ loanCreationService: object, auditService?: object, idempotencyKeyModel?: object }} dependencies
 * @returns {Function}
 */
const createCreateLoan = ({ loanCreationService, auditService, idempotencyKeyModel = IdempotencyKey }) => {
  const useCase = async ({ actor, payload, idempotencyKey }) => {
    ensureCreditBackofficeActor(actor, CREDIT_CREATE_DENIED_MESSAGE);

    return runLoanCreationWithIdempotency({
      actor,
      payload,
      idempotencyKey,
      idempotencyKeyModel,
      operation: () => loanCreationService.create(payload),
    });
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'credits', getEntityId: (p) => p?.result?.id, getEntityType: () => 'Loan' })(useCase);
  }
  return useCase;
};

const buildCustomerLoanPortfolioSummary = (loans = []) => {
  const normalizedLoans = Array.isArray(loans) ? loans : [];
  const activeStatuses = new Set(['active', 'approved']);
  const completedStatuses = new Set(['closed', 'completed', 'paid']);
  const overdueStatuses = new Set(['overdue', 'defaulted']);

  return normalizedLoans.reduce((summary, loan) => {
    const normalizedStatus = String(loan?.status || '').trim().toLowerCase();
    const amount = Number(loan?.amount || 0);
    const daysLate = Number(loan?.daysLate || 0);

    summary.totalLoans += 1;
    summary.totalDisbursed = roundCurrency(summary.totalDisbursed + (Number.isFinite(amount) ? amount : 0));

    if (activeStatuses.has(normalizedStatus)) {
      summary.activeLoans += 1;
    }

    if (completedStatuses.has(normalizedStatus)) {
      summary.completedLoans += 1;
    }

    if (overdueStatuses.has(normalizedStatus) || daysLate > 0) {
      summary.overdueLoans += 1;
    }

    return summary;
  }, {
    totalLoans: 0,
    activeLoans: 0,
    completedLoans: 0,
    overdueLoans: 0,
    totalDisbursed: 0,
  });
};

/**
 * Create the use case that lists loans for a customer and returns the owning customer record.
 * @param {{ customerRepository: object, loanRepository: object }} dependencies
 * @returns {Function}
 */
const createListLoansByCustomer = ({ customerRepository, loanRepository }) => async ({ actor, customerId, pagination }) => {
  ensureCreditBackofficeActor(actor, CUSTOMER_CREDIT_LIST_DENIED_MESSAGE);

  const foundCustomer = await customerRepository.findById(customerId);
  const customer = await enrichCustomerWithLoanSummary({ customerRepository, customer: foundCustomer });
  if (!customer) {
    throw new NotFoundError('Customer');
  }

  const allCustomerLoans = await loanRepository.listByCustomer(customerId);
  const loanSummary = buildCustomerLoanPortfolioSummary(allCustomerLoans);

  if (pagination) {
    const result = await loanRepository.listPageByCustomer({ customerId, ...pagination });
    const enrichedLoans = await enrichLoansWithCustomerSummaries({ loanRepository, result: result.items });
    return { customer, loans: enrichedLoans, pagination: result.pagination, summary: loanSummary };
  }

  const enrichedLoans = await enrichLoansWithCustomerSummaries({ loanRepository, result: allCustomerLoans });
  return { loans: enrichedLoans, customer, summary: loanSummary };
};

/**
 * Create the use case that updates the primary loan lifecycle status.
 * @param {{ loanRepository: object, loanAccessPolicy?: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const LOAN_STATUS_TRANSITIONS = {
  pending: ['approved', 'rejected'],
  approved: ['active', 'rejected', 'defaulted'],
  rejected: [], // Terminal state
  active: ['overdue', 'closed', 'defaulted'],
  overdue: ['active', 'closed', 'defaulted'],
  paid: ['closed'],
  closed: [], // Terminal state
  defaulted: ['closed', 'active'], // Can recover from defaulted
  cancelled: [], // Terminal state (set by annulment)
};

const createUpdateLoanStatus = ({ loanRepository, loanAccessPolicy, auditService }) => {
  const useCase = async ({ actor, loanId, status }) => {
    const validStatuses = ['pending', 'approved', 'rejected', 'active', 'overdue', 'paid', 'closed', 'defaulted', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError('Selecciona un estado de crédito válido.');
    }

    const loan = loanAccessPolicy
      ? await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId })
      : await loanRepository.findById(loanId);

    if (!loan) {
      throw new NotFoundError('Loan');
    }

    if (loan.status === 'closed' && status !== 'closed') {
      throw new ValidationError(CLOSED_LOAN_MODIFICATION_MESSAGE);
    }

    if (loan.status === 'rejected' && status !== 'rejected') {
      throw new ValidationError(REJECTED_LOAN_MODIFICATION_MESSAGE);
    }

    const allowedTransitions = LOAN_STATUS_TRANSITIONS[loan.status] || [];
    if (!allowedTransitions.includes(status)) {
      throw new ValidationError('El cambio de estado solicitado no está permitido para este crédito.');
    }

    loan.status = status;
    // Approval authorizes the credit without rewriting the persisted
    // disbursement date or the frozen amortization schedule created at origination.

    if (status === 'defaulted') {
      loan.recoveryStatus = 'pending';
    }

    if (status === 'closed') {
      loan.closedAt = loan.closedAt || new Date();
      loan.recoveryStatus = 'recovered';
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
      throw new ValidationError('Selecciona un estado de recuperación válido.');
    }

    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Solo usuarios administrativos autorizados pueden actualizar la recuperación.');
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

const saveLoanRecord = async (loanRepository, loan) => {
  if (typeof loanRepository.save === 'function') {
    return loanRepository.save(loan);
  }

  if (typeof loan.save === 'function') {
    return loan.save();
  }

  return loan;
};

/**
 * Create the use case that preserves rejected loans by cancelling them after
 * access checks succeed.
 * @param {{ loanRepository: object, loanAccessPolicy?: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createDeleteLoan = ({ loanRepository, loanAccessPolicy, auditService }) => {
  const useCase = async ({ actor, loanId }) => {
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError(CREDIT_CANCEL_DENIED_MESSAGE);
    }

    const loan = loanAccessPolicy
      ? await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId })
      : await loanRepository.findById(loanId);

    if (!loan) {
      throw new NotFoundError('Loan');
    }

    if (loan.status !== 'rejected') {
      throw new ValidationError(CREDIT_CANCEL_REJECTED_ONLY_MESSAGE);
    }

    loan.status = 'cancelled';
    loan.closureReason = 'cancelled';
    loan.closedAt = new Date();

    return saveLoanRecord(loanRepository, loan);
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'credits', getEntityId: (p) => p?.loanId, getEntityType: () => 'Loan' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that lists authorized loan attachments for backoffice users.
 * @param {{ attachmentRepository: object, loanAccessPolicy: object }} dependencies
 * @returns {Function}
 */
const createListLoanAttachments = ({ attachmentRepository, loanAccessPolicy }) => async ({ actor, loanId }) => {
  ensureCreditBackofficeActor(actor, CREDIT_ATTACHMENT_LIST_DENIED_MESSAGE);

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const attachments = await attachmentRepository.listByLoan(loan.id);

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
    ensureUploadedFile(file, () => new ValidationError('Debes adjuntar un archivo'));

    return withUploadCleanup({
      file,
      attachmentStorage,
      task: async () => {
      await validateAttachmentFileSignature(file, fsModule);

      const loan = await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId });

        return attachmentRepository.create({
          loanId: loan.id,
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
  ensureCreditBackofficeActor(actor, CREDIT_ATTACHMENT_DOWNLOAD_DENIED_MESSAGE);

  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const attachment = await attachmentRepository.findByIdForLoan({ loanId: loan.id, attachmentId });

  ensureDocumentExists(attachment, 'Attachment');

  return {
    attachment,
    absolutePath: await resolveDocumentDownload({ attachmentStorage, storagePath: attachment.storagePath }),
  };
};

const createListLoanAlerts = ({ alertRepository, loanAccessPolicy, loanViewService }) => async ({ actor, loanId }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const { schedule } = loanViewService.getCanonicalLoanView(loan);
  await alertRepository.syncOverdueInstallmentAlerts({ loan, schedule });
  return alertRepository.listByLoan(loan.id);
};

const createGetPaymentCalendar = ({ alertRepository, loanAccessPolicy, loanViewService }) => async ({ actor, loanId, asOfDate }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const { schedule, snapshot } = loanViewService.getCanonicalLoanView(loan);
  const alerts = await alertRepository.listByLoan(loan.id);

  return {
    loanId: loan.id,
    entries: buildCalendarEntries({ loan, schedule, alerts, asOfDate: asOfDate || new Date() }),
    snapshot,
    alerts,
  };
};

const createGetPaymentCalendarOverview = ({
  alertRepository,
  loanAccessPolicy,
  loanViewService,
  loanRepository,
}) => async ({
  actor,
  loanIds,
  asOfDate,
  filters = {},
}) => {
  const parsedFilters = parseCalendarOverviewFilters(filters);
  assertCalendarOverviewDateRange(parsedFilters);
  const effectiveAsOfDate = asOfDate || new Date();
  const { normalizedLoanIds, loans } = await resolveCalendarOverviewLoans({
    actor,
    loanIds,
    loanRepository,
    loanAccessPolicy,
    filters: parsedFilters,
  });

  if (loans.length === 0) {
    return buildPaymentCalendarOverview({
      normalizedLoanIds,
      entries: [],
      asOfDate: effectiveAsOfDate,
    });
  }

  const perLoanEntries = await Promise.all(
    loans.map(async (loan) => {
      const { schedule } = loanViewService.getCanonicalLoanView(loan);
      const alerts = await alertRepository.listByLoan(loan.id);
      const entries = buildCalendarEntries({
        loan,
        schedule,
        alerts,
        asOfDate: effectiveAsOfDate,
      }).map((entry) => toCalendarOverviewEntry({ loan, entry }));

      return entries;
    }),
  );

  return buildPaymentCalendarOverview({
    normalizedLoanIds,
    entries: filterCalendarOverviewEntries({
      entries: perLoanEntries.flat(),
      filters: parsedFilters,
    }),
    asOfDate: effectiveAsOfDate,
  });
};

const createGetInstallmentQuote = ({ loanAccessPolicy, loanViewService }) => async ({
  actor,
  loanId,
  installmentNumber,
  asOfDate,
}) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  const { schedule } = loanViewService.getCanonicalLoanView(loan);
  return buildInstallmentQuote({
    loan,
    schedule,
    installmentNumber,
    asOfDate: asOfDate || new Date(),
  });
};

const createGetPayoffQuote = ({ loanAccessPolicy, loanViewService }) => async ({ actor, loanId, asOfDate }) => {
  const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

  return loanViewService.getPayoffQuote(loan, asOfDate);
};

const createExecutePayoff = ({ loanAccessPolicy, paymentApplicationService, auditService, clock = () => new Date() }) => {
  const useCase = async ({ actor, loanId, asOfDate, quotedTotal, idempotencyKey }) => {
    if (!['admin', 'employee'].includes(actor?.role)) {
      throw new AuthorizationError(PAYOFF_EXECUTE_DENIED_MESSAGE);
    }

    const loan = await loanAccessPolicy.findAuthorizedLoan({ actor, loanId });

    return paymentApplicationService.applyPayoff({
      loanId: loan.id,
      asOfDate,
      quotedTotal,
      paymentDate: clock(),
      actor,
      idempotencyKey,
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

const createCreatePromiseToPay = ({ promiseRepository, loanAccessPolicy, notificationPort, auditService }) => {
  const useCase = async ({ actor, loanId, payload }) => {
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError(PROMISE_CREATE_DENIED_MESSAGE);
    }

    const loan = await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId });
    const promisedDateInput = typeof payload.promisedDate === 'string' ? payload.promisedDate.trim() : payload.promisedDate;
    const promisedDate = normalizeUtcDateOnly(promisedDateInput, 'promisedDate');

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError(PROMISE_AMOUNT_POSITIVE_MESSAGE);
    }

    const now = new Date();
    const statusHistory = [{
      status: 'pending',
      changedAt: now.toISOString(),
      actorId: actor.id,
    }];

    const promise = await promiseRepository.create({
      loanId: loan.id,
      createdByUserId: actor.id,
      promisedDate,
      amount,
      status: 'pending',
      notes: payload.notes ? String(payload.notes).trim() : null,
      statusHistory,
      lastStatusChangedAt: now,
    });

    if (notificationPort?.sendPromiseCreated) {
      const recipients = uniqueNotificationRecipients(loan.customerId, actor.id);
      await Promise.all(recipients.map((userId) => sendOptionalNotification(() => notificationPort.sendPromiseCreated(userId, {
        loanId: loan.id,
        promiseId: promise.id,
        amount,
        promisedDate: promisedDate.toISOString().slice(0, 10),
        createdByUserId: actor.id,
      }))));
    }

    return promise;
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'credits', getEntityId: (p) => p?.loanId, getEntityType: () => 'PromiseToPay' })(useCase);
  }
  return useCase;
};

const createCreateLoanFollowUp = ({ alertRepository, loanAccessPolicy, notificationPort }) => async ({ actor, loanId, payload }) => {
  if (!['admin', 'employee'].includes(actor.role)) {
    throw new AuthorizationError(FOLLOW_UP_CREATE_DENIED_MESSAGE);
  }

  const loan = await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId });
  const dueDate = new Date(payload.dueDate || payload.reminderDate || new Date());

  if (Number.isNaN(dueDate.getTime())) {
    throw new ValidationError(FOLLOW_UP_DUE_DATE_VALID_MESSAGE);
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
  const notificationSent = shouldNotifyCustomer && loan.customerId
    ? await sendOptionalNotification(() => notificationPort.sendLoanReminder(loan.customerId, {
      alertId: reminder.id,
      customerId: loan.customerId,
      loanId: loan.id,
      dueDate: dueDate.toISOString(),
      installmentNumber: reminder.installmentNumber,
      outstandingAmount: reminder.outstandingAmount,
      notes: payload.notes ? String(payload.notes).trim() : null,
    }))
    : false;

  return {
    reminder,
    notificationSent,
  };
};

const createUpdateLoanAlertStatus = ({ alertRepository, loanAccessPolicy }) => async ({ actor, loanId, alertId, payload }) => {
  if (!['admin', 'employee'].includes(actor.role)) {
    throw new AuthorizationError(LOAN_ALERT_UPDATE_DENIED_MESSAGE);
  }

  const loan = await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId });
  const alert = await alertRepository.findByIdForLoan({ loanId: loan.id, alertId });

  if (!alert) {
    throw new NotFoundError('Loan alert');
  }

  const nextStatus = payload.status;
  if (!['active', 'resolved'].includes(nextStatus)) {
    throw new ValidationError('Selecciona un estado de alerta válido.');
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
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError(PROMISE_UPDATE_DENIED_MESSAGE);
    }

    const loan = await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId });
    const promise = await promiseRepository.findByIdForLoan({ loanId: loan.id, promiseId });

    if (!promise) {
      throw new NotFoundError('Promise to pay');
    }

    const nextStatus = payload.status;
    if (!['pending', 'kept', 'broken', 'cancelled'].includes(nextStatus)) {
      throw new ValidationError(PROMISE_STATUS_VALID_MESSAGE);
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
      await sendOptionalNotification(() => notificationPort.sendPromiseStatus(loan.customerId, {
        customerId: loan.customerId,
        loanId: loan.id,
        promiseId: updatedPromise.id,
        status: updatedPromise.status,
        fulfilledPaymentId: updatedPromise.fulfilledPaymentId,
      }));
    }

    return updatedPromise;
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'credits', getEntityId: (p) => p?.promiseId, getEntityType: () => 'PromiseToPay' })(useCase);
  }
  return useCase;
};

const createDownloadPromiseToPay = ({ promiseRepository, loanAccessPolicy }) => async ({ actor, loanId, promiseId }) => {
  if (!['admin', 'employee'].includes(actor.role)) {
    throw new AuthorizationError(PROMISE_DOWNLOAD_DENIED_MESSAGE);
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
 * Normalize free-text filters so search comparisons stay stable across API seams.
 * @param {unknown} value
 * @returns {string}
 */
const normalizeSearchValue = (value) => String(value || '').trim().toLowerCase();

/**
 * Parse optional search dates while treating invalid values as absent filters.
 * @param {unknown} value
 * @returns {Date|null}
 */
const normalizeLoanSearchDate = (value) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

/**
 * Build a single searchable text surface for loan rows when repository-level
 * filtering is unavailable in tests or lightweight adapters.
 * @param {object} loan
 * @returns {string}
 */
const buildLoanSearchHaystack = (loan) => {
  const segments = [
    loan?.id,
    loan?.customerId,
    loan?.associateId,
    loan?.status,
    loan?.Customer?.name,
    loan?.Customer?.email,
    loan?.Associate?.name,
    loan?.Associate?.email,
  ];

  return segments
    .filter((segment) => segment !== undefined && segment !== null)
    .map((segment) => String(segment).toLowerCase())
    .join(' ');
};

/**
 * Apply credit-list filters in one place so search, list, and reporting surfaces stay aligned.
 * @param {{ loans?: Array<object>, filters?: object }} input
 * @returns {Array<object>}
 */
const filterLoansByFilters = ({ loans = [], filters = {} }) => {
  const searchTerm = normalizeSearchValue(filters.search);
  const minAmount = filters.minAmount !== undefined ? Number(filters.minAmount) : null;
  const maxAmount = filters.maxAmount !== undefined ? Number(filters.maxAmount) : null;
  const startDate = normalizeLoanSearchDate(filters.startDate);
  const endDate = normalizeLoanSearchDate(filters.endDate);
  const status = filters.status ? String(filters.status).trim().toLowerCase() : '';

  return loans.filter((loan) => {
    if (status && String(loan?.status || '').toLowerCase() !== status) {
      return false;
    }

    const loanAmount = Number(loan?.amount || 0);
    if (Number.isFinite(minAmount) && loanAmount < minAmount) {
      return false;
    }

    if (Number.isFinite(maxAmount) && loanAmount > maxAmount) {
      return false;
    }

    const createdAt = normalizeLoanSearchDate(loan?.createdAt);
    if (startDate && (!createdAt || createdAt < startDate)) {
      return false;
    }

    if (endDate && (!createdAt || createdAt > endDate)) {
      return false;
    }

    if (searchTerm) {
      return buildLoanSearchHaystack(loan).includes(searchTerm);
    }

    return true;
  });
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
        customerName: getDuePaymentCustomerLabel(loan),
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
 * Search results are always scoped through the shared backoffice visibility policy.
 * @param {{ loanRepository: object, loanAccessPolicy?: object }} dependencies
 * @returns {Function}
 */
const createSearchLoans = ({ loanRepository, loanAccessPolicy }) => async ({ actor, filters = {}, pagination }) => {
  ensureCreditBackofficeActor(actor, CREDIT_SEARCH_DENIED_MESSAGE);

  if (pagination && typeof loanRepository.searchPage === 'function') {
    return loanRepository.searchPage({ actor, filters, ...pagination });
  }

  if (!pagination && typeof loanRepository.search === 'function') {
    return loanRepository.search({ actor, filters });
  }

  const loans = await loanRepository.list();
  const visibleLoans = loanAccessPolicy
    ? loanAccessPolicy.filterVisibleLoans({ actor, loans })
    : loans;
  const filteredLoans = filterLoansByFilters({ loans: visibleLoans, filters });

  if (pagination) {
    return paginateArray({ items: filteredLoans, pagination });
  }

  return filteredLoans;
};

/**
 * Create the use case that updates the annual late fee rate for a loan.
 * @param {{ loanRepository: object, loanAccessPolicy?: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createUpdateLateFeeRate = ({ loanRepository, loanAccessPolicy, auditService }) => {
  const useCase = async ({ actor, loanId, lateFeeRate }) => {
    if (actor.role !== 'admin') {
      throw new AuthorizationError(LATE_FEE_RATE_ADMIN_REQUIRED_MESSAGE);
    }

    if (!validateInterestRate(lateFeeRate)) {
      throw new ValidationError(LATE_FEE_RATE_VALID_MESSAGE);
    }
    const parsedRate = Number(typeof lateFeeRate === 'string' ? lateFeeRate.trim() : lateFeeRate);

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

module.exports = {
  createListLoans,
  createCreateCreditCalculation,
  createGetLoanById,
  createCreateLoan,
  createListLoansByCustomer,
  createUpdateLoanStatus,
  createUpdateRecoveryStatus,
  createDeleteLoan,
  createListLoanAttachments,
  createCreateLoanAttachment,
  createDownloadLoanAttachment,
  createListLoanAlerts,
  createGetPaymentCalendar,
  createGetPaymentCalendarOverview,
  createGetInstallmentQuote,
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
  filterLoansByFilters,
  isValidAttachmentSignature,
  validateAttachmentFileSignature,
};
