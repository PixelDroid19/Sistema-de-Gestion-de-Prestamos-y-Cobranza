const crypto = require('node:crypto');

const {
  NotFoundError,
  ValidationError,
  AuthorizationError,
  ConflictError,
} = require('@/utils/errorHandler');
const { withAudit } = require('@/modules/audit/application/auditDecorator');
const { roundCurrency, formatCurrency } = require('@/modules/shared/money');

const PERCENTAGE_SCALE = 10000;
const HUNDRED_PERCENT_UNITS = 100 * PERCENTAGE_SCALE;
const ALLOWED_ASSOCIATE_STATUSES = new Set(['active', 'inactive']);
const ALLOWED_INTEREST_TYPES = new Set(['monthly', 'annual']);
const DEFAULT_INTEREST_PAYMENT_DAY = 1;
const DEFAULT_ANNUAL_INTEREST_PAYMENT_MONTH = 1;

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const parsePercentageToUnits = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(\.\d{1,4})?$/.test(normalizedValue)) {
    throw new ValidationError('participationPercentage must be between 0 and 100 with up to 4 decimal places');
  }

  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    throw new ValidationError('participationPercentage must be between 0 and 100 with up to 4 decimal places');
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

  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    throw new ValidationError(`${fieldName} must be greater than 0 and use up to 2 decimal places`);
  }

  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new ValidationError(`${fieldName} must be greater than 0`);
  }

  return roundCurrency(numericValue);
};

const normalizeInterestType = (value) => {
  if (value === undefined || value === null || value === '') {
    return 'monthly';
  }

  const normalizedValue = String(value).trim().toLowerCase();
  if (!ALLOWED_INTEREST_TYPES.has(normalizedValue)) {
    throw new ValidationError('interestType must be monthly or annual');
  }

  return normalizedValue;
};

const normalizeInterestRate = (value) => {
  if (value === undefined || value === null || value === '') {
    return '0.0000';
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(\.\d{1,4})?$/.test(normalizedValue)) {
    throw new ValidationError('interestRate must be between 0 and 100 with up to 4 decimal places');
  }

  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    throw new ValidationError('interestRate must be between 0 and 100 with up to 4 decimal places');
  }

  return numericValue.toFixed(4);
};

const normalizePaymentDay = (value) => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_INTEREST_PAYMENT_DAY;
  }

  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    throw new ValidationError('interestPaymentDay must be an integer between 1 and 28');
  }

  return day;
};

const normalizePaymentMonth = (value) => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_ANNUAL_INTEREST_PAYMENT_MONTH;
  }

  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new ValidationError('interestPaymentMonth must be an integer between 1 and 12');
  }

  return month;
};

const normalizeOptionalDateOnly = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalizedValue = String(value).trim();
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(normalizedValue);
  if (!match) {
    throw new ValidationError(`${fieldName} must be a valid YYYY-MM-DD date`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new ValidationError(`${fieldName} must be a valid YYYY-MM-DD date`);
  }

  return normalizedValue;
};

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
      throw new ValidationError('Associate status filter must be active or inactive');
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

const addYearsUtc = (date, years) => new Date(Date.UTC(
  date.getUTCFullYear() + years,
  date.getUTCMonth(),
  date.getUTCDate(),
));

const buildInterestDueDate = ({ associate, fromDate = new Date(), afterDate = null }) => {
  const interestType = normalizeInterestType(associate.interestType);
  const paymentDay = normalizePaymentDay(associate.interestPaymentDay);
  const paymentMonth = normalizePaymentMonth(associate.interestPaymentMonth);
  const baseDate = afterDate ? new Date(afterDate) : new Date(fromDate);
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

const getTotalContributed = (contributions = []) => roundCurrency(
  contributions.reduce((sum, contribution) => sum + Number(contribution.amount || 0), 0),
);

const getNextInstallmentNumber = (installments = []) => {
  const maxInstallmentNumber = installments.reduce((max, installment) => (
    Math.max(max, Number(installment.installmentNumber || 0))
  ), 0);

  return maxInstallmentNumber + 1;
};

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

  const interestRate = normalizeInterestRate(associate.interestRate);
  if (Number(interestRate) <= 0) {
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

  const capitalBase = capitalBaseOverride === null ? getTotalContributed(contributions) : roundCurrency(capitalBaseOverride);
  if (capitalBase <= 0) {
    return null;
  }

  const interestType = normalizeInterestType(associate.interestType);
  const dueDate = buildInterestDueDate({ associate, fromDate, afterDate });
  const { periodStartDate, periodEndDate } = buildInterestPeriod({ interestType, dueDate });
  const amount = calculateInterestInstallmentAmount({ capitalBase, interestRate });

  if (amount <= 0) {
    return null;
  }

  return associateRepository.createInstallment({
    associateId: associate.id,
    installmentNumber: getNextInstallmentNumber(installments),
    amount,
    dueDate,
    capitalBase,
    interestRate,
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
    throw new ValidationError('Distribution amount must be greater than 0');
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    throw new ValidationError('Distribution amount must be greater than 0 and use up to 2 decimal places');
  }

  const [wholePart, decimalPart = ''] = normalizedValue.split('.');
  const cents = (Number(wholePart) * 100) + Number(decimalPart.padEnd(2, '0'));

  if (!Number.isFinite(cents) || cents <= 0) {
    throw new ValidationError('Distribution amount must be greater than 0');
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

const validateEligibleParticipationPool = (associates) => {
  if (!associates.length) {
    throw new ValidationError('At least one active associate is required for proportional distributions');
  }

  const errors = [];
  let totalUnits = 0;
  const normalizedAssociates = associates.map((associate) => {
    const participationUnits = parsePercentageToUnits(associate.participationPercentage);

    if (participationUnits === null) {
      errors.push({
        field: 'participationPercentage',
        message: `Active associate ${associate.id} must define participationPercentage before proportional distributions`,
      });
      return { ...normalizeAssociateRecord(associate), participationUnits: null };
    }

    if (participationUnits <= 0) {
      errors.push({
        field: 'participationPercentage',
        message: `Active associate ${associate.id} must have participationPercentage greater than 0 for proportional distributions`,
      });
    }

    totalUnits += participationUnits;

    return {
      ...normalizeAssociateRecord(associate),
      participationUnits,
    };
  });

  if (errors.length > 0) {
    const error = new ValidationError('Eligible associate participation is incomplete');
    error.errors = errors;
    throw error;
  }

  if (totalUnits !== HUNDRED_PERCENT_UNITS) {
    throw new ValidationError('Active associate participation percentages must total exactly 100.0000');
  }

  return normalizedAssociates;
};

const buildAssociateConflictError = ({ existingAssociate, email, phone }) => {
  const error = new ValidationError('Associate already exists with the provided contact details');
  error.errors = [];

  if (email && existingAssociate.email === email) {
    error.errors.push({ field: 'email', message: 'Associate email already exists' });
  }

  if (phone && existingAssociate.phone === phone) {
    error.errors.push({ field: 'phone', message: 'Associate phone already exists' });
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
 * Create the use case that deletes an associate after confirming the record exists.
 * @param {{ associateRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createDeleteAssociate = ({ associateRepository, auditService }) => {
  const useCase = async ({ associateId }) => {
    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    await associateRepository.destroy(associate);
  };

  if (auditService) {
    return withAudit({ auditService, action: 'DELETE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'Associate' })(useCase);
  }
  return useCase;
};

const ensureAssociatePortalAccess = async ({ actor, associateRepository, associateId = null }) => {
  if (actor.role === 'admin' || actor.role === 'employee') {
    if (!associateId) {
      throw new ValidationError('Associate ID is required');
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    return associate;
  }

  if (actor.role !== 'socio') {
    throw new AuthorizationError('Only authorized backoffice users can access associate portal data');
  }

  const associate = actor.associateId
    ? await associateRepository.findById(actor.associateId)
    : await associateRepository.findByLinkedUser(actor.id);

  if (!associate) {
    throw new NotFoundError('Associate');
  }

  if (associateId && Number(associate.id) !== Number(associateId)) {
    throw new AuthorizationError('Socio users can only access their linked associate data');
  }

  return associate;
};

const createListAssociatePortalSummary = ({ associateRepository }) => async ({ actor, associateId }) => {
  const associate = await ensureAssociatePortalAccess({ actor, associateRepository, associateId });
  const [contributions, distributions, installments] = await Promise.all([
    associateRepository.listContributionsByAssociate(associate.id),
    associateRepository.listProfitDistributionsByAssociate(associate.id),
    associateRepository.findInstallmentsByAssociateId(associate.id),
  ]);

  const totalContributed = contributions.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalDistributed = distributions.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalInterestPaid = installments
    .filter((installment) => installment.status === 'paid')
    .reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
  const interestDebt = installments
    .filter((installment) => installment.status === 'pending')
    .reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
  const nextInterestPayment = installments
    .filter((installment) => installment.status === 'pending')
    .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())[0] || null;
  const paymentHistory = installments
    .filter((installment) => installment.status === 'paid')
    .sort((left, right) => new Date(right.paidAt || right.updatedAt || 0).getTime() - new Date(left.paidAt || left.updatedAt || 0).getTime())
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
      nextInterestPaymentDate: nextInterestPayment?.dueDate ? new Date(nextInterestPayment.dueDate).toISOString() : null,
      netProfit: roundCurrency(totalDistributed),
      debtStatus: interestDebt > 0 ? 'pending' : 'up_to_date',
    },
    contributions,
    distributions: distributions.map(normalizeDistributionRecord),
    paymentHistory,
  };
};

const createCreateAssociateContribution = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, associateId, payload }) => {
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Only authorized backoffice users can create associate contributions');
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError('Contribution amount must be greater than 0');
    }

    const contribution = await associateRepository.createContribution({
      associateId: associate.id,
      amount,
      contributionDate: payload.contributionDate ? new Date(payload.contributionDate) : new Date(),
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
      throw new AuthorizationError('Only authorized backoffice users can create profit distributions');
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError('Distribution amount must be greater than 0');
    }

    return associateRepository.createProfitDistribution({
      associateId: associate.id,
      loanId: null,
      amount,
      distributionDate: payload.distributionDate ? new Date(payload.distributionDate) : new Date(),
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
      throw new AuthorizationError('Only authorized backoffice users can create associate reinvestments');
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError('Reinvestment amount must be greater than 0');
    }

    const operationDate = payload.reinvestmentDate ? new Date(payload.reinvestmentDate) : new Date();
    if (Number.isNaN(operationDate.getTime())) {
      throw new ValidationError('reinvestmentDate must be a valid date when provided');
    }

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

const createCreateProportionalProfitDistribution = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, idempotencyKey, payload }) => {
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Only authorized backoffice users can create proportional profit distributions');
    }

    const amountCents = parseCurrencyToCents(payload.amount);
    const distributionDate = payload.distributionDate ? new Date(payload.distributionDate) : new Date();

    if (Number.isNaN(distributionDate.getTime())) {
      throw new ValidationError('distributionDate must be a valid date when provided');
    }

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
        throw buildIdempotencyConflictError('Idempotency key has already been used with a different proportional distribution payload');
      }

      if (existingRecord.status === 'completed') {
        return serializeIdempotentDistributionResult(existingRecord.responsePayload, 'replayed');
      }

      throw buildIdempotencyConflictError('A proportional distribution with this idempotency key is already being processed');
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
const createGetAssociateInstallments = ({ associateRepository }) => async ({ actor, associateId }) => {
  await ensureAssociatePortalAccess({ actor, associateRepository, associateId });

  const installments = await associateRepository.findInstallmentsByAssociateId(associateId);

  const totalPending = installments
    .filter((i) => i.status === 'pending')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const totalPaid = installments
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const totalOverdue = installments
    .filter((i) => i.status === 'pending' && new Date(i.dueDate) < new Date())
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  return {
    associateId,
    installments: installments.map((i) => ({
      id: i.id,
      installmentNumber: i.installmentNumber,
      amount: Number(i.amount),
      dueDate: i.dueDate,
      status: i.status,
      paidAt: i.paidAt,
      paidBy: i.paidBy,
      paidByUser: i.paidByUser,
    })),
    totals: {
      totalPending: roundCurrency(totalPending),
      totalPaid: roundCurrency(totalPaid),
      totalOverdue: roundCurrency(totalOverdue),
    },
  };
};

/**
 * Create the use case that marks an installment as paid.
 * @param {{ associateRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createPayAssociateInstallment = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, associateId, installmentNumber, payload }) => {
    await ensureAssociatePortalAccess({ actor, associateRepository, associateId });

    const installments = await associateRepository.findInstallmentsByAssociateId(associateId);
    const installment = installments.find(
      (i) => Number(i.installmentNumber) === Number(installmentNumber),
    );

    if (!installment) {
      throw new NotFoundError('Installment');
    }

    if (installment.status === 'paid') {
      throw new ValidationError('Installment already paid');
    }

    const paymentDate = payload?.paymentDate ? new Date(payload.paymentDate) : new Date();
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
  await ensureAssociatePortalAccess({ actor, associateRepository, associateId });

  const events = await associateRepository.findCalendarEvents(associateId, startDate, endDate);

  const allEvents = [
    ...events.contributions.map((c) => ({
      ...c,
      date: new Date(c.date),
      displayType: 'Aporte',
      displayAmount: `+${c.amount.toFixed(2)}`,
    })),
    ...events.distributions.map((d) => ({
      ...d,
      date: new Date(d.date),
      displayType: 'Distribución',
      displayAmount: `-${d.amount.toFixed(2)}`,
    })),
    ...events.installments.map((i) => ({
      ...i,
      date: new Date(i.dueDate),
      displayType: 'Cuota',
      displayAmount: i.status === 'paid' ? `✓ ${i.amount.toFixed(2)}` : i.amount.toFixed(2),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    associateId,
    startDate: startDate || null,
    endDate: endDate || null,
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
  createListAssociatePortalSummary,
  createCreateAssociateContribution,
  createCreateProfitDistribution,
  createCreateAssociateReinvestment,
  createCreateProportionalProfitDistribution,
  createGetAssociateInstallments,
  createPayAssociateInstallment,
  createGetAssociateCalendar,
};
