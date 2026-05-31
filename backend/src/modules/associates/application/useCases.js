const crypto = require('node:crypto');

const {
  NotFoundError,
  ValidationError,
  AuthorizationError,
  ConflictError,
} = require('@/utils/errorHandler');
const { withAudit } = require('@/modules/audit/application/auditDecorator');
const { parsePositiveCurrencyAmount, roundCurrency, formatCurrency } = require('@/modules/shared/money');
const { validateIntegerRange } = require('@/modules/shared/validators');
const {
  buildDateRangeMessage,
  normalizeOperationalDate,
  normalizeOptionalDateOnlyString,
  normalizeOptionalOperationalDate,
  toDateOnlyOrNull,
  toOperationalDateOrNull,
} = require('@/modules/shared/dateUtils');

const PERCENTAGE_SCALE = 10000;
const HUNDRED_PERCENT_UNITS = 100 * PERCENTAGE_SCALE;
const ALLOWED_ASSOCIATE_STATUSES = new Set(['active', 'inactive']);
const ALLOWED_INTEREST_TYPES = new Set(['monthly', 'annual']);
const DEFAULT_INTEREST_PAYMENT_DAY = 1;
const DEFAULT_ANNUAL_INTEREST_PAYMENT_MONTH = 1;
const ASSOCIATE_PAYMENT_ALERT_WINDOW_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ASSOCIATE_CURRENCY_FIELD_LABELS = {
  initialCapital: 'El capital inicial',
};
const ASSOCIATE_DATE_FIELD_LABELS = {
  interestStartDate: 'La fecha de inicio de intereses',
  contributionDate: 'La fecha del aporte',
  distributionDate: 'La fecha de distribución',
  reinvestmentDate: 'La fecha de reinversión',
  paymentDate: 'La fecha de pago',
};
const ASSOCIATE_FINANCIAL_DETAILS_REQUIRED_MESSAGE = 'Selecciona un socio para consultar su información financiera.';
const PROPORTIONAL_DISTRIBUTION_IDEMPOTENCY_CONFLICT_MESSAGE = 'Esta distribución proporcional ya fue enviada con otros datos. Revisa el resultado antes de intentar nuevamente.';
const PROPORTIONAL_DISTRIBUTION_IDEMPOTENCY_PENDING_MESSAGE = 'Esta distribución proporcional ya se está procesando. Espera el resultado antes de intentar nuevamente.';

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const getAssociateCurrencyFieldLabel = (fieldName) => ASSOCIATE_CURRENCY_FIELD_LABELS[fieldName] || 'El monto';
const getAssociateDateFieldLabel = (fieldName) => ASSOCIATE_DATE_FIELD_LABELS[fieldName] || 'La fecha';

const parsePercentageToUnits = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(\.\d{1,4})?$/.test(normalizedValue)) {
    throw new ValidationError('El porcentaje de participación debe estar entre 0 y 100 con máximo 4 decimales');
  }

  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    throw new ValidationError('El porcentaje de participación debe estar entre 0 y 100 con máximo 4 decimales');
  }

  return Math.round(numericValue * PERCENTAGE_SCALE);
};

const normalizeParticipationPercentage = (value) => {
  const units = parsePercentageToUnits(value);
  return units === null ? null : (units / PERCENTAGE_SCALE).toFixed(4);
};

const parseCurrencyAmount = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const fieldLabel = getAssociateCurrencyFieldLabel(fieldName);
  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    throw new ValidationError(`${fieldLabel} debe ser mayor a 0 y usar máximo 2 decimales`);
  }

  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new ValidationError(`${fieldLabel} debe ser mayor a 0`);
  }

  return roundCurrency(numericValue);
};

const normalizeInterestType = (value) => {
  if (value === undefined || value === null || value === '') {
    return 'monthly';
  }

  const normalizedValue = String(value).trim().toLowerCase();
  if (!ALLOWED_INTEREST_TYPES.has(normalizedValue)) {
    throw new ValidationError('El tipo de interés debe ser mensual o anual');
  }

  return normalizedValue;
};

const normalizeInterestRate = (value) => {
  if (value === undefined || value === null || value === '') {
    return '0.0000';
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(\.\d{1,4})?$/.test(normalizedValue)) {
    throw new ValidationError('La tasa de interés debe estar entre 0 y 100 con máximo 4 decimales');
  }

  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    throw new ValidationError('La tasa de interés debe estar entre 0 y 100 con máximo 4 decimales');
  }

  return numericValue.toFixed(4);
};

const normalizePaymentDay = (value) => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_INTEREST_PAYMENT_DAY;
  }

  if (!validateIntegerRange(value, 1, 28)) {
    throw new ValidationError('El día de pago de intereses debe ser un entero entre 1 y 28');
  }

  return Number(typeof value === 'string' ? value.trim() : value);
};

const normalizePaymentMonth = (value) => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_ANNUAL_INTEREST_PAYMENT_MONTH;
  }

  if (!validateIntegerRange(value, 1, 12)) {
    throw new ValidationError('El mes de pago de intereses debe ser un entero entre 1 y 12');
  }

  return Number(typeof value === 'string' ? value.trim() : value);
};

const normalizeOptionalDateOnly = (value, fieldName) => {
  try {
    return normalizeOptionalDateOnlyString(value, fieldName);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError(`${getAssociateDateFieldLabel(fieldName)} debe tener formato AAAA-MM-DD`);
    }
    throw error;
  }
};

const normalizeOptionalOperationDate = (value, fieldName) => (
  (() => {
    try {
      return value === undefined || value === null || value === ''
        ? new Date()
        : normalizeOperationalDate(value, fieldName);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError(`${getAssociateDateFieldLabel(fieldName)} debe ser una fecha operativa válida`);
      }
      throw error;
    }
  })()
);

const mapValidDatedRows = (rows, getDate, mapRow) => rows
  .map((row) => {
    const date = toOperationalDateOrNull(getDate(row));
    return date ? mapRow(row, date) : null;
  })
  .filter(Boolean);

const normalizeAssociatePayload = (payload) => {
  const normalizedPayload = { ...payload };

  if (hasOwn(payload, 'participationPercentage')) {
    normalizedPayload.participationPercentage = normalizeParticipationPercentage(payload.participationPercentage);
  }

  if (hasOwn(payload, 'interestType')) {
    normalizedPayload.interestType = normalizeInterestType(payload.interestType);
  }

  if (hasOwn(payload, 'interestRate')) {
    normalizedPayload.interestRate = normalizeInterestRate(payload.interestRate);
  }

  if (hasOwn(payload, 'interestPaymentDay')) {
    normalizedPayload.interestPaymentDay = normalizePaymentDay(payload.interestPaymentDay);
  }

  if (hasOwn(payload, 'interestPaymentMonth')) {
    normalizedPayload.interestPaymentMonth = normalizePaymentMonth(payload.interestPaymentMonth);
  }

  if (hasOwn(payload, 'interestStartDate') || hasOwn(payload, 'interestStartsAt')) {
    normalizedPayload.interestStartsAt = normalizeOptionalDateOnly(
      payload.interestStartsAt ?? payload.interestStartDate,
      'interestStartDate',
    );
    delete normalizedPayload.interestStartDate;
  }

  delete normalizedPayload.initialCapital;

  return normalizedPayload;
};

const normalizeAssociateListFilters = (filters = {}) => {
  const normalized = {};

  const rawSearch = String(filters.search || '').trim();
  if (rawSearch) {
    normalized.search = rawSearch;
  }

  const rawStatus = String(filters.status || '').trim().toLowerCase();
  if (rawStatus) {
    if (!ALLOWED_ASSOCIATE_STATUSES.has(rawStatus)) {
      throw new ValidationError('Filtro de estado de socio inválido.');
    }
    normalized.status = rawStatus;
  }

  return normalized;
};

const normalizeAssociateRecord = (associate) => {
  const serializedAssociate = typeof associate?.toJSON === 'function' ? associate.toJSON() : associate;
  if (!serializedAssociate) {
    return serializedAssociate;
  }

  return {
    ...serializedAssociate,
    participationPercentage: serializedAssociate.participationPercentage === null
      || serializedAssociate.participationPercentage === undefined
      ? null
      : normalizeParticipationPercentage(serializedAssociate.participationPercentage),
    interestType: normalizeInterestType(serializedAssociate.interestType),
    interestRate: normalizeInterestRate(serializedAssociate.interestRate),
    interestPaymentDay: normalizePaymentDay(serializedAssociate.interestPaymentDay),
    interestPaymentMonth: serializedAssociate.interestPaymentMonth === null || serializedAssociate.interestPaymentMonth === undefined
      ? null
      : normalizePaymentMonth(serializedAssociate.interestPaymentMonth),
  };
};

const addMonthsUtc = (date, months) => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth() + months,
  date.getUTCDate(),
));

const toUtcDateOnlyTimestamp = (value) => {
  const date = toOperationalDateOrNull(value);
  if (!date) {
    return null;
  }

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const diffCalendarDaysUtc = (targetDate, baseDate) => {
  const targetTimestamp = toUtcDateOnlyTimestamp(targetDate);
  const baseTimestamp = toUtcDateOnlyTimestamp(baseDate);

  if (targetTimestamp === null || baseTimestamp === null) {
    return null;
  }

  return Math.round((targetTimestamp - baseTimestamp) / DAY_IN_MS);
};

const addYearsUtc = (date, years) => new Date(Date.UTC(
  date.getUTCFullYear() + years,
  date.getUTCMonth(),
  date.getUTCDate(),
));

const buildInterestDueDate = ({ associate, fromDate = new Date(), afterDate = null }) => {
  const interestType = normalizeInterestType(associate.interestType);
  const paymentDay = normalizePaymentDay(associate.interestPaymentDay);
  const paymentMonth = normalizePaymentMonth(associate.interestPaymentMonth);
  const baseDate = normalizeOperationalDate(afterDate || fromDate, 'interest due anchor date');
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  let dueDate = interestType === 'annual'
    ? new Date(Date.UTC(year, paymentMonth - 1, paymentDay))
    : new Date(Date.UTC(year, month, paymentDay));

  if (dueDate.getTime() <= baseDate.getTime()) {
    dueDate = interestType === 'annual' ? addYearsUtc(dueDate, 1) : addMonthsUtc(dueDate, 1);
  }

  return dueDate;
};

const buildInterestPeriod = ({ interestType, dueDate }) => {
  const periodEndDate = new Date(dueDate);
  const periodStartDate = interestType === 'annual'
    ? addYearsUtc(periodEndDate, -1)
    : addMonthsUtc(periodEndDate, -1);

  return { periodStartDate, periodEndDate };
};

const calculateInterestInstallmentAmount = ({ capitalBase, interestRate }) => roundCurrency(
  Number(capitalBase || 0) * (Number(interestRate || 0) / 100),
);

const getContributionInterestRate = ({ contribution, associate }) => normalizeInterestRate(
  contribution.interestRateSnapshot ?? associate.interestRate,
);

const buildInterestInstallmentBasis = ({ associate, contributions = [], capitalBaseOverride = null }) => {
  if (capitalBaseOverride !== null) {
    const capitalBase = roundCurrency(capitalBaseOverride);
    const interestRate = normalizeInterestRate(associate.interestRate);
    const amount = calculateInterestInstallmentAmount({ capitalBase, interestRate });

    return {
      capitalBase,
      amount,
      effectiveInterestRate: interestRate,
    };
  }

  const basis = contributions.reduce((result, contribution) => {
    const contributionAmount = roundCurrency(contribution.amount);
    if (contributionAmount <= 0) {
      return result;
    }

    const interestRate = getContributionInterestRate({ contribution, associate });
    result.capitalBase += contributionAmount;
    result.amount += calculateInterestInstallmentAmount({
      capitalBase: contributionAmount,
      interestRate,
    });
    return result;
  }, { capitalBase: 0, amount: 0 });

  const effectiveInterestRate = basis.capitalBase > 0
    ? ((basis.amount / basis.capitalBase) * 100).toFixed(4)
    : normalizeInterestRate(associate.interestRate);

  return {
    capitalBase: roundCurrency(basis.capitalBase),
    amount: roundCurrency(basis.amount),
    effectiveInterestRate,
  };
};

const buildContributionTermsSnapshot = (associate) => ({
  interestTypeSnapshot: normalizeInterestType(associate.interestType),
  interestRateSnapshot: normalizeInterestRate(associate.interestRate),
});

const getNextInstallmentNumber = (installments = []) => {
  const maxInstallmentNumber = installments.reduce((max, installment) => (
    Math.max(max, Number(installment.installmentNumber || 0))
  ), 0);

  return maxInstallmentNumber + 1;
};

const isAssociateInstallmentOverdue = (installment, asOfDate = new Date()) => {
  if (installment?.status === 'overdue') {
    return true;
  }

  if (installment?.status !== 'pending') {
    return false;
  }

  const dueDate = toOperationalDateOrNull(installment.dueDate);
  if (!dueDate) {
    return false;
  }

  return dueDate < asOfDate;
};

const resolveAssociateInstallmentStatus = (installment, asOfDate = new Date()) => {
  if (installment?.status === 'paid') {
    return 'paid';
  }

  if (installment?.status === 'overdue') {
    return 'overdue';
  }

  return isAssociateInstallmentOverdue(installment, asOfDate) ? 'overdue' : 'pending';
};

const persistExpiredAssociateInstallments = async ({ associateRepository, associateId, installments, asOfDate }) => {
  if (typeof associateRepository.updateInstallmentStatus !== 'function') {
    return installments;
  }

  await Promise.all(installments
    .filter((installment) => installment.status === 'pending' && isAssociateInstallmentOverdue(installment, asOfDate))
    .map((installment) => associateRepository.updateInstallmentStatus(
      associateId,
      installment.installmentNumber,
      'overdue',
      null,
      null,
      installment.paymentMethod || null,
      installment.notes || null,
    )));

  return installments.map((installment) => (
    installment.status === 'pending' && isAssociateInstallmentOverdue(installment, asOfDate)
      ? { ...installment, status: 'overdue' }
      : installment
  ));
};

const buildAssociatePaymentAlerts = (installments, asOfDate = new Date()) => installments
  .map((installment) => {
    const status = resolveAssociateInstallmentStatus(installment, asOfDate);
    if (!['pending', 'overdue'].includes(status)) {
      return null;
    }

    const daysUntilDue = diffCalendarDaysUtc(installment.dueDate, asOfDate);
    if (daysUntilDue === null) {
      return null;
    }

    if (status === 'overdue') {
      return {
        type: 'overdue',
        severity: 'high',
        installmentNumber: installment.installmentNumber,
        amount: Number(installment.amount || 0),
        dueDate: installment.dueDate,
        daysUntilDue: null,
        daysOverdue: Math.abs(daysUntilDue),
      };
    }

    if (daysUntilDue <= ASSOCIATE_PAYMENT_ALERT_WINDOW_DAYS) {
      return {
        type: 'upcoming',
        severity: 'medium',
        installmentNumber: installment.installmentNumber,
        amount: Number(installment.amount || 0),
        dueDate: installment.dueDate,
        daysUntilDue,
        daysOverdue: null,
      };
    }

    return null;
  })
  .filter(Boolean);

const ensureNextInterestInstallment = async ({
  associateRepository,
  associate,
  transaction,
  fromDate = new Date(),
  afterDate = null,
  capitalBaseOverride = null,
  excludeInstallmentNumber = null,
}) => {
  if (typeof associateRepository.createInstallment !== 'function') {
    return null;
  }

  const [contributions, installments] = await Promise.all([
    typeof associateRepository.listContributionsByAssociate === 'function'
      ? associateRepository.listContributionsByAssociate(associate.id, { transaction })
      : [],
    typeof associateRepository.findInstallmentsByAssociateId === 'function'
      ? associateRepository.findInstallmentsByAssociateId(associate.id, { transaction })
      : [],
  ]);

  const hasPendingInstallment = installments.some((installment) => (
    installment.status === 'pending'
      && Number(installment.installmentNumber) !== Number(excludeInstallmentNumber)
  ));
  if (hasPendingInstallment) {
    return null;
  }

  const interestBasis = buildInterestInstallmentBasis({
    associate,
    contributions,
    capitalBaseOverride,
  });
  if (interestBasis.capitalBase <= 0 || interestBasis.amount <= 0) {
    return null;
  }

  const interestType = normalizeInterestType(associate.interestType);
  const dueDate = buildInterestDueDate({ associate, fromDate, afterDate });
  const { periodStartDate, periodEndDate } = buildInterestPeriod({ interestType, dueDate });

  return associateRepository.createInstallment({
    associateId: associate.id,
    installmentNumber: getNextInstallmentNumber(installments),
    amount: interestBasis.amount,
    dueDate,
    capitalBase: interestBasis.capitalBase,
    interestRate: interestBasis.effectiveInterestRate,
    interestType,
    periodStartDate,
    periodEndDate,
    status: 'pending',
    notes: 'Interés programado sobre capital aportado',
  }, { transaction });
};

const normalizeDistributionRecord = (distribution) => {
  const serializedDistribution = typeof distribution?.toJSON === 'function' ? distribution.toJSON() : distribution;
  const basis = serializedDistribution?.basis && typeof serializedDistribution.basis === 'object'
    ? serializedDistribution.basis
    : {};
  const isProportional = basis.type === 'proportional-participation';

  return {
    ...serializedDistribution,
    distributionType: isProportional ? 'proportional' : 'manual',
    declaredProportionalTotal: isProportional ? basis.sourceAmount || null : null,
    allocatedAmount: isProportional ? basis.allocatedAmount || formatCurrency(serializedDistribution.amount) : formatCurrency(serializedDistribution.amount),
    participationPercentage: isProportional ? basis.participationPercentage || null : null,
    roundingAdjustment: isProportional ? basis.roundingAdjustment || '0.00' : null,
    batchKey: isProportional ? basis.batchKey || null : null,
    basis,
  };
};

const parseCurrencyToCents = (value) => {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError('El monto de la distribución debe ser mayor a 0');
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    throw new ValidationError('El monto de la distribución debe ser mayor a 0 y usar máximo 2 decimales');
  }

  const [wholePart, decimalPart = ''] = normalizedValue.split('.');
  const cents = (Number(wholePart) * 100) + Number(decimalPart.padEnd(2, '0'));

  if (!Number.isFinite(cents) || cents <= 0) {
    throw new ValidationError('El monto de la distribución debe ser mayor a 0');
  }

  return cents;
};

const canonicalizeJson = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        const normalizedValue = value[key];
        if (normalizedValue !== undefined) {
          result[key] = canonicalizeJson(normalizedValue);
        }
        return result;
      }, {});
  }

  return value;
};

/**
 * Builds the canonical request hash used to distinguish safe retries from
 * conflicting proportional distribution submissions.
 * @param {object} payload - Normalized distribution request payload.
 * @returns {string} SHA-256 hash of the canonical payload.
 */
const buildProportionalIdempotencyRequestHash = (payload) => crypto
  .createHash('sha256')
  .update(JSON.stringify(canonicalizeJson(payload)))
  .digest('hex');

const buildProportionalIdempotencyPayload = ({ amountCents, distributionDate, notes, basis }) => ({
  amount: formatCurrency(amountCents / 100),
  distributionDate: distributionDate.toISOString(),
  notes,
  basis: canonicalizeJson(basis || {}),
});

const buildIdempotencyConflictError = (message) => {
  const error = new ConflictError(message);
  error.errors = [{ field: 'idempotencyKey', message }];
  return error;
};

const serializeIdempotentDistributionResult = (result, idempotencyStatus) => ({
  ...result,
  idempotencyStatus,
});

const buildBatchKey = ({ actorId, distributionDate, amountCents, associateIds }) => [
  'assoc-proportional',
  actorId,
  distributionDate.toISOString(),
  amountCents,
  associateIds.join('-'),
  Date.now(),
].join(':');

/**
 * Allocates a declared distribution amount across eligible associates using
 * participation units and deterministic largest-remainder rounding.
 * @param {{associates: Array<object>, amountCents: number}} params
 * @returns {Array<{associate: object, amountCents: number, roundingAdjustmentCents: number}>}
 */
const allocateProportionalDistribution = ({ associates, amountCents }) => {
  const baseAllocations = associates.map((associate) => {
    const numerator = amountCents * associate.participationUnits;
    const flooredCents = Math.floor(numerator / HUNDRED_PERCENT_UNITS);

    return {
      associate,
      flooredCents,
      fractionalRemainder: numerator % HUNDRED_PERCENT_UNITS,
    };
  });

  const allocatedCents = baseAllocations.reduce((sum, allocation) => sum + allocation.flooredCents, 0);
  const remainingCents = amountCents - allocatedCents;
  const recipients = [...baseAllocations].sort((left, right) => {
    if (right.fractionalRemainder !== left.fractionalRemainder) {
      return right.fractionalRemainder - left.fractionalRemainder;
    }

    return Number(left.associate.id) - Number(right.associate.id);
  });

  recipients.slice(0, remainingCents).forEach((allocation) => {
    allocation.flooredCents += 1;
  });

  return baseAllocations
    .map((allocation) => ({
      associate: allocation.associate,
      amountCents: allocation.flooredCents,
      roundingAdjustmentCents: recipients.includes(allocation) && allocation.flooredCents > Math.floor((amountCents * allocation.associate.participationUnits) / HUNDRED_PERCENT_UNITS)
        ? 1
        : 0,
    }))
    .sort((left, right) => Number(left.associate.id) - Number(right.associate.id));
};

/**
 * Validates and normalizes the active associate pool before proportional
 * distributions so allocated money always closes against exactly 100.0000%.
 * @param {Array<object>} associates
 * @returns {Array<object>} Associates with normalized participation units.
 * @throws {ValidationError} When the active pool is empty, incomplete, or does not total 100%.
 */
const validateEligibleParticipationPool = (associates) => {
  if (!associates.length) {
    throw new ValidationError('Debe existir al menos un socio activo para distribuir utilidades.');
  }

  const errors = [];
  let totalUnits = 0;
  const normalizedAssociates = associates.map((associate) => {
    const participationUnits = parsePercentageToUnits(associate.participationPercentage);

    if (participationUnits === null) {
      errors.push({
        field: 'participationPercentage',
        message: 'Completa el porcentaje de participación de todos los socios activos.',
      });
      return { ...normalizeAssociateRecord(associate), participationUnits: null };
    }

    if (participationUnits <= 0) {
      errors.push({
        field: 'participationPercentage',
        message: 'Los porcentajes de participación de socios activos deben ser mayores que cero.',
      });
    }

    totalUnits += participationUnits;

    return {
      ...normalizeAssociateRecord(associate),
      participationUnits,
    };
  });

  if (errors.length > 0) {
    const error = new ValidationError('Completa la participación de los socios activos antes de distribuir utilidades.');
    error.errors = errors;
    throw error;
  }

  if (totalUnits !== HUNDRED_PERCENT_UNITS) {
    throw new ValidationError('La participación activa de socios debe sumar exactamente 100%.');
  }

  return normalizedAssociates;
};

const buildAssociateConflictError = ({ existingAssociate, email, phone }) => {
  const error = new ValidationError('Ya existe un socio con esos datos de contacto.');
  error.errors = [];

  if (email && existingAssociate.email === email) {
    error.errors.push({ field: 'email', message: 'Ya existe un socio con ese correo.' });
  }

  if (phone && existingAssociate.phone === phone) {
    error.errors.push({ field: 'phone', message: 'Ya existe un socio con ese teléfono.' });
  }

  return error;
};

const ensureUniqueAssociateContact = async ({ associateRepository, email, phone, excludeId = null }) => {
  if (!email && !phone) {
    return;
  }

  const existingAssociate = await associateRepository.findConflictingContact({ email, phone, excludeId });

  if (existingAssociate) {
    throw buildAssociateConflictError({ existingAssociate, email, phone });
  }
};

/**
 * Create the use case that lists associates in repository-defined order.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createListAssociates = ({ associateRepository }) => async ({ pagination, filters } = {}) => {
  const normalizedFilters = normalizeAssociateListFilters(filters);
  const summary = typeof associateRepository.summarize === 'function'
    ? await associateRepository.summarize(normalizedFilters)
    : undefined;

  if (pagination) {
    const result = await associateRepository.listPage({ ...pagination, filters: normalizedFilters });
    const response = {
      items: result.items.map(normalizeAssociateRecord),
      pagination: result.pagination,
    };
    if (summary) {
      response.summary = summary;
    }
    return response;
  }

  const associates = await associateRepository.list(normalizedFilters);
  const items = associates.map(normalizeAssociateRecord);
  return summary ? { items, summary } : items;
};

/**
 * Create the use case that validates unique associate contact details before creation.
 * @param {{ associateRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createCreateAssociate = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, payload }) => {
    const normalizedPayload = normalizeAssociatePayload(payload);
    const initialCapital = parseCurrencyAmount(payload.initialCapital, 'initialCapital');

    await ensureUniqueAssociateContact({
      associateRepository,
      email: normalizedPayload.email,
      phone: normalizedPayload.phone,
    });

    const createAssociateWithFinancialTrace = async (transaction) => {
      const associate = await associateRepository.create(normalizedPayload, { transaction });
      if (initialCapital !== null) {
        await associateRepository.createContribution({
          associateId: associate.id,
          amount: initialCapital,
          contributionDate: normalizedPayload.interestStartsAt ? new Date(normalizedPayload.interestStartsAt) : new Date(),
          ...buildContributionTermsSnapshot(associate),
          createdByUserId: actor?.id || null,
          notes: 'Capital inicial registrado al crear el socio',
        }, { transaction });

        await ensureNextInterestInstallment({
          associateRepository,
          associate,
          transaction,
          fromDate: normalizedPayload.interestStartsAt ? new Date(normalizedPayload.interestStartsAt) : new Date(),
          capitalBaseOverride: initialCapital,
        });
      }

      return associate;
    };

    const associate = initialCapital !== null && typeof associateRepository.runInTransaction === 'function'
      ? await associateRepository.runInTransaction(createAssociateWithFinancialTrace)
      : await createAssociateWithFinancialTrace();

    return normalizeAssociateRecord(associate);
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'associates', getEntityId: (p) => p?.id, getEntityType: () => 'Associate' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that retrieves a single associate by identifier.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createGetAssociateById = ({ associateRepository }) => async (associateId) => {
  const associate = await associateRepository.findById(associateId);
  if (!associate) {
    throw new NotFoundError('Associate');
  }

  return normalizeAssociateRecord(associate);
};

/**
 * Create the use case that updates an associate while preserving unique contact data.
 * @param {{ associateRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createUpdateAssociate = ({ associateRepository, auditService }) => {
  const useCase = async ({ associateId, payload }) => {
    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    const normalizedPayload = normalizeAssociatePayload(payload);

    await ensureUniqueAssociateContact({
      associateRepository,
      email: normalizedPayload.email,
      phone: normalizedPayload.phone,
      excludeId: associate.id,
    });

    return normalizeAssociateRecord(await associateRepository.update(associate, normalizedPayload));
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'Associate' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that deactivates an associate while preserving financial history.
 * @param {{ associateRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createDeleteAssociate = ({ associateRepository, auditService }) => {
  const useCase = async ({ associateId }) => {
    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    return normalizeAssociateRecord(await associateRepository.update(associate, { status: 'inactive' }));
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'Associate' })(useCase);
  }
  return useCase;
};

/**
 * Ensure an administrative actor can inspect a specific associate's financial details.
 * Socios are investor records in this backoffice and are not authenticated portal users.
 * @param {{ actor: { role: string }, associateRepository: object, associateId?: number|string|null }} params
 * @returns {Promise<object>} Associate record authorized for the request.
 * @throws {AuthorizationError|ValidationError|NotFoundError}
 */
const ensureAssociateFinancialDetailsAccess = async ({ actor, associateRepository, associateId = null }) => {
  if (actor.role !== 'admin' && actor.role !== 'employee') {
    throw new AuthorizationError('Solo usuarios administrativos autorizados pueden consultar información financiera de socios.');
  }

  if (actor.role === 'admin' || actor.role === 'employee') {
    if (!associateId) {
      throw new ValidationError(ASSOCIATE_FINANCIAL_DETAILS_REQUIRED_MESSAGE);
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    return associate;
  }
};

/**
 * Build the administrative associate financial-details read model.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createListAssociateFinancialDetails = ({ associateRepository }) => async ({ actor, associateId }) => {
  const associate = await ensureAssociateFinancialDetailsAccess({ actor, associateRepository, associateId });
  const [contributions, distributions, rawInstallments] = await Promise.all([
    associateRepository.listContributionsByAssociate(associate.id),
    associateRepository.listProfitDistributionsByAssociate(associate.id),
    associateRepository.findInstallmentsByAssociateId(associate.id),
  ]);
  const installments = await persistExpiredAssociateInstallments({
    associateRepository,
    associateId: associate.id,
    installments: rawInstallments,
    asOfDate: new Date(),
  });

  const totalContributed = contributions.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalDistributed = distributions.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalInterestPaid = installments
    .filter((installment) => installment.status === 'paid')
    .reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
  const interestDebt = installments
    .filter((installment) => ['pending', 'overdue'].includes(installment.status))
    .reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
  const nextInterestPayment = installments
    .filter((installment) => ['pending', 'overdue'].includes(installment.status))
    .map((installment) => ({ installment, dateOnly: toDateOnlyOrNull(installment.dueDate) }))
    .filter((entry) => entry.dateOnly)
    .sort((left, right) => normalizeOperationalDate(left.dateOnly).getTime() - normalizeOperationalDate(right.dateOnly).getTime())[0]?.installment || null;
  const paymentHistory = installments
    .filter((installment) => installment.status === 'paid')
    .sort((left, right) => {
      const rightDate = toOperationalDateOrNull(right.paidAt || right.updatedAt);
      const leftDate = toOperationalDateOrNull(left.paidAt || left.updatedAt);
      return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
    })
    .map((installment) => ({
      id: installment.id,
      amount: roundCurrency(installment.amount),
      installmentNumber: installment.installmentNumber,
      dueDate: installment.dueDate,
      paidAt: installment.paidAt,
      paidBy: installment.paidBy,
      paidByUser: installment.paidByUser,
      paymentMethod: installment.paymentMethod || null,
    }));
  return {
    associate: normalizeAssociateRecord(associate),
    summary: {
      totalContributed: roundCurrency(totalContributed),
      totalDistributed: roundCurrency(totalDistributed),
      totalInterestPaid: roundCurrency(totalInterestPaid),
      interestDebt: roundCurrency(interestDebt),
      nextInterestPaymentDate: nextInterestPayment?.dueDate ? toDateOnlyOrNull(nextInterestPayment.dueDate) : null,
      netProfit: roundCurrency(totalDistributed),
      debtStatus: installments.some((installment) => installment.status === 'overdue')
        ? 'overdue'
        : (interestDebt > 0 ? 'pending' : 'up_to_date'),
    },
    contributions,
    distributions: distributions.map(normalizeDistributionRecord),
    paymentHistory,
  };
};

const createCreateAssociateContribution = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, associateId, payload }) => {
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Solo usuarios administrativos autorizados pueden registrar aportes de socios.');
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    const amount = parsePositiveCurrencyAmount(payload.amount);
    if (amount === null) {
      throw new ValidationError('El monto del aporte debe ser mayor a 0');
    }

    const contribution = await associateRepository.createContribution({
      associateId: associate.id,
      amount,
      contributionDate: normalizeOptionalOperationDate(payload.contributionDate, 'contributionDate'),
      ...buildContributionTermsSnapshot(associate),
      createdByUserId: actor.id,
      notes: payload.notes ? String(payload.notes).trim() : null,
    });

    await ensureNextInterestInstallment({
      associateRepository,
      associate,
      fromDate: contribution.contributionDate || payload.contributionDate || new Date(),
    });

    return contribution;
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'AssociateContribution' })(useCase);
  }
  return useCase;
};

const createCreateProfitDistribution = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, associateId, payload }) => {
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Solo usuarios administrativos autorizados pueden registrar distribuciones de utilidades.');
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    const amount = parsePositiveCurrencyAmount(payload.amount);
    if (amount === null) {
      throw new ValidationError('El monto de la distribución debe ser mayor a 0');
    }

    return associateRepository.createProfitDistribution({
      associateId: associate.id,
      loanId: null,
      amount,
      distributionDate: normalizeOptionalOperationDate(payload.distributionDate, 'distributionDate'),
      createdByUserId: actor.id,
      notes: payload.notes ? String(payload.notes).trim() : null,
      basis: payload.basis && typeof payload.basis === 'object' ? payload.basis : {},
    });
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'ProfitDistribution' })(useCase);
  }
  return useCase;
};

const createCreateAssociateReinvestment = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, associateId, payload }) => {
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Solo usuarios administrativos autorizados pueden registrar reinversiones de socios.');
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    const amount = parsePositiveCurrencyAmount(payload.amount);
    if (amount === null) {
      throw new ValidationError('El monto de la reinversión debe ser mayor a 0');
    }

    const operationDate = normalizeOptionalOperationDate(payload.reinvestmentDate, 'reinvestmentDate');

    return associateRepository.runInTransaction(async (transaction) => {
      const note = payload.notes ? String(payload.notes).trim() : null;
      const distribution = await associateRepository.createProfitDistribution({
        associateId: associate.id,
        loanId: null,
        amount,
        distributionDate: operationDate,
        createdByUserId: actor.id,
        notes: note,
        basis: {
          type: 'reinvestment',
          reinvestment: true,
          direction: 'distribution',
        },
      }, { transaction });

      const contribution = await associateRepository.createContribution({
        associateId: associate.id,
        amount,
        contributionDate: operationDate,
        ...buildContributionTermsSnapshot(associate),
        createdByUserId: actor.id,
        notes: note,
      }, { transaction });

      return {
        associate: normalizeAssociateRecord(associate),
        reinvestment: {
          amount: formatCurrency(amount),
          reinvestmentDate: operationDate.toISOString(),
          notes: note,
        },
        distribution: normalizeDistributionRecord(distribution),
        contribution,
      };
    });
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'AssociateReinvestment' })(useCase);
  }
  return useCase;
};

/**
 * Creates the proportional profit distribution use case with idempotency,
 * deterministic allocation, transactional persistence, and audit recording.
 * @param {object} dependencies
 * @param {object} dependencies.associateRepository
 * @param {object} [dependencies.auditService]
 * @returns {Function} Use case for creating a proportional distribution batch.
 */
const createCreateProportionalProfitDistribution = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, idempotencyKey, payload }) => {
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Solo usuarios administrativos autorizados pueden registrar distribuciones proporcionales.');
    }

    const amountCents = parseCurrencyToCents(payload.amount);
    const distributionDate = normalizeOptionalOperationDate(payload.distributionDate, 'distributionDate');

    const notes = payload.notes ? String(payload.notes).trim() : null;
    const customBasis = payload.basis && typeof payload.basis === 'object' ? payload.basis : {};
    const idempotencyPayload = buildProportionalIdempotencyPayload({
      amountCents,
      distributionDate,
      notes,
      basis: customBasis,
    });
    const requestHash = idempotencyKey
      ? buildProportionalIdempotencyRequestHash(idempotencyPayload)
      : null;

    const buildCreatedResult = ({ batchKey, eligibleAssociates, createdRows }) => serializeIdempotentDistributionResult({
      batchKey,
      idempotencyKey: idempotencyKey || null,
      distributionDate: distributionDate.toISOString(),
      declaredAmount: formatCurrency(amountCents / 100),
      totalAllocatedAmount: formatCurrency(createdRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)),
      eligibleAssociateCount: eligibleAssociates.length,
      createdRows: createdRows.map(normalizeDistributionRecord),
    }, 'created');

    const createDistributionBatch = async ({ transaction } = {}) => {
      const eligibleAssociates = validateEligibleParticipationPool(
        await associateRepository.listActiveAssociatesWithParticipation({ transaction }),
      );
      const allocations = allocateProportionalDistribution({ associates: eligibleAssociates, amountCents });
      const batchKey = buildBatchKey({
        actorId: actor.id,
        distributionDate,
        amountCents,
        associateIds: eligibleAssociates.map((associate) => associate.id),
      });
      const createdRows = await associateRepository.createProfitDistributionBatch(
        allocations.map((allocation) => ({
          associateId: allocation.associate.id,
          loanId: null,
          amount: allocation.amountCents / 100,
          distributionDate,
          createdByUserId: actor.id,
          notes,
          basis: {
            ...customBasis,
            type: 'proportional-participation',
            version: 1,
            batchKey,
            idempotencyKey: idempotencyKey || null,
            participationPercentage: allocation.associate.participationPercentage,
            sourceAmount: formatCurrency(amountCents / 100),
            allocatedAmount: formatCurrency(allocation.amountCents / 100),
            roundingAdjustment: formatCurrency(allocation.roundingAdjustmentCents / 100),
            eligibleAssociateCount: eligibleAssociates.length,
            manual: false,
          },
        })),
        { transaction },
      );

      return buildCreatedResult({ batchKey, eligibleAssociates, createdRows });
    };

    if (!idempotencyKey) {
      return createDistributionBatch();
    }

    const resolveExistingIdempotency = async () => {
      const existingRecord = await associateRepository.findProportionalDistributionIdempotency({
        actorId: actor.id,
        idempotencyKey,
      });

      if (!existingRecord) {
        return null;
      }

      if (existingRecord.requestHash !== requestHash) {
        throw buildIdempotencyConflictError(PROPORTIONAL_DISTRIBUTION_IDEMPOTENCY_CONFLICT_MESSAGE);
      }

      if (existingRecord.status === 'completed') {
        return serializeIdempotentDistributionResult(existingRecord.responsePayload, 'replayed');
      }

      throw buildIdempotencyConflictError(PROPORTIONAL_DISTRIBUTION_IDEMPOTENCY_PENDING_MESSAGE);
    };

    const existingResult = await resolveExistingIdempotency();
    if (existingResult) {
      return existingResult;
    }

    try {
      return await associateRepository.runInTransaction(async (transaction) => {
        await associateRepository.createProportionalDistributionIdempotency({
          actorId: actor.id,
          idempotencyKey,
          requestHash,
          status: 'pending',
        }, { transaction });

        const result = await createDistributionBatch({ transaction });

        const idempotencyRecord = await associateRepository.findProportionalDistributionIdempotency({
          actorId: actor.id,
          idempotencyKey,
          transaction,
        });
        await associateRepository.updateProportionalDistributionIdempotency(idempotencyRecord, {
          status: 'completed',
          responsePayload: result,
        }, { transaction });

        return result;
      });
    } catch (error) {
      if (error?.name === 'SequelizeUniqueConstraintError') {
        const replayedResult = await resolveExistingIdempotency();
        if (replayedResult) {
          return replayedResult;
        }
      }

      throw error;
    }
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'associates', getEntityId: () => null, getEntityType: () => 'ProportionalProfitDistribution' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that retrieves installments for an associate.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createGetAssociateInstallments = ({ associateRepository, clock = () => new Date() }) => async ({ actor, associateId }) => {
  await ensureAssociateFinancialDetailsAccess({ actor, associateRepository, associateId });

  const rawInstallments = await associateRepository.findInstallmentsByAssociateId(associateId);
  const asOfDate = clock();
  const installments = await persistExpiredAssociateInstallments({
    associateRepository,
    associateId,
    installments: rawInstallments,
    asOfDate,
  });

  const totalPending = installments
    .filter((i) => resolveAssociateInstallmentStatus(i, asOfDate) === 'pending')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const totalPaid = installments
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const totalOverdue = installments
    .filter((i) => resolveAssociateInstallmentStatus(i, asOfDate) === 'overdue')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  return {
    associateId,
    installments: installments.map((i) => ({
      id: i.id,
      installmentNumber: i.installmentNumber,
      amount: Number(i.amount),
      dueDate: i.dueDate,
      status: resolveAssociateInstallmentStatus(i, asOfDate),
      paidAt: i.paidAt,
      paidBy: i.paidBy,
      paidByUser: i.paidByUser,
    })),
    totals: {
      totalPending: roundCurrency(totalPending),
      totalPaid: roundCurrency(totalPaid),
      totalOverdue: roundCurrency(totalOverdue),
    },
    alerts: buildAssociatePaymentAlerts(installments, asOfDate),
  };
};

/**
 * Create the use case that marks an installment as paid.
 * @param {{ associateRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createPayAssociateInstallment = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, associateId, installmentNumber, payload }) => {
    await ensureAssociateFinancialDetailsAccess({ actor, associateRepository, associateId });

    const installments = await associateRepository.findInstallmentsByAssociateId(associateId);
    const installment = installments.find(
      (i) => Number(i.installmentNumber) === Number(installmentNumber),
    );

    if (!installment) {
      throw new NotFoundError('Installment');
    }

    if (installment.status === 'paid') {
      throw new ValidationError('La cuota del socio ya fue pagada');
    }

    const paymentDate = normalizeOptionalOperationDate(payload?.paymentDate, 'paymentDate');
    const paidBy = actor.id;

    await associateRepository.updateInstallmentStatus(
      associateId,
      installmentNumber,
      'paid',
      paymentDate,
      paidBy,
      payload?.paymentMethod || null,
      payload?.notes ? String(payload.notes).trim() : null,
    );

    const associate = await associateRepository.findById(associateId);
    if (associate) {
      await ensureNextInterestInstallment({
        associateRepository,
        associate,
        afterDate: installment.dueDate,
        excludeInstallmentNumber: installmentNumber,
      });
    }

    const updatedInstallment = {
      ...installment.toJSON(),
      status: 'paid',
      paidAt: paymentDate,
      paidBy,
      paymentMethod: payload?.paymentMethod || null,
    };

    return {
      success: true,
      installment: {
        id: updatedInstallment.id,
        installmentNumber: updatedInstallment.installmentNumber,
        amount: Number(updatedInstallment.amount),
        dueDate: updatedInstallment.dueDate,
        status: updatedInstallment.status,
        paidAt: updatedInstallment.paidAt,
        paidBy: updatedInstallment.paidBy,
      },
    };
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'AssociateInstallment' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that retrieves calendar events for an associate.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createGetAssociateCalendar = ({ associateRepository }) => async ({ actor, associateId, startDate, endDate }) => {
  await ensureAssociateFinancialDetailsAccess({ actor, associateRepository, associateId });

  const normalizedStartDate = normalizeOptionalOperationalDate(startDate, 'startDate');
  const normalizedEndDate = normalizeOptionalOperationalDate(endDate, 'endDate');

  if (normalizedStartDate && normalizedEndDate && normalizedStartDate.getTime() > normalizedEndDate.getTime()) {
    throw new ValidationError(buildDateRangeMessage('startDate', 'endDate'));
  }

  const events = await associateRepository.findCalendarEvents(associateId, normalizedStartDate, normalizedEndDate);

  const allEvents = [
    ...mapValidDatedRows(events.contributions, (c) => c.date, (c, date) => ({
      ...c,
      date,
      displayType: 'Aporte',
      displayAmount: `+${c.amount.toFixed(2)}`,
    })),
    ...mapValidDatedRows(events.distributions, (d) => d.date, (d, date) => ({
      ...d,
      date,
      displayType: 'Distribución',
      displayAmount: `-${d.amount.toFixed(2)}`,
    })),
    ...mapValidDatedRows(events.installments, (i) => i.dueDate, (i, date) => ({
      ...i,
      date,
      displayType: 'Cuota',
      displayAmount: i.status === 'paid' ? `✓ ${i.amount.toFixed(2)}` : i.amount.toFixed(2),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    associateId,
    startDate: toDateOnlyOrNull(normalizedStartDate),
    endDate: toDateOnlyOrNull(normalizedEndDate),
    events: allEvents,
    summary: {
      contributionCount: events.contributions.length,
      distributionCount: events.distributions.length,
      installmentCount: events.installments.length,
      pendingInstallments: events.installments.filter((i) => i.status === 'pending').length,
    },
  };
};

module.exports = {
  allocateProportionalDistribution,
  buildProportionalIdempotencyRequestHash,
  normalizeDistributionRecord,
  createListAssociates,
  createCreateAssociate,
  createGetAssociateById,
  createUpdateAssociate,
  createDeleteAssociate,
  createListAssociateFinancialDetails,
  createCreateAssociateContribution,
  createCreateProfitDistribution,
  createCreateAssociateReinvestment,
  createCreateProportionalProfitDistribution,
  createGetAssociateInstallments,
  createPayAssociateInstallment,
  createGetAssociateCalendar,
};
