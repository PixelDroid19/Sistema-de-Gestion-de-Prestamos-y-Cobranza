const crypto = require('node:crypto');

const {
  NotFoundError,
  ValidationError,
  AuthorizationError,
  ConflictError,
} = require('../../../utils/errorHandler');

const roundCurrency = (value) => Number.parseFloat((Number(value) || 0).toFixed(2));
const formatCurrency = (value) => roundCurrency(value).toFixed(2);
const PERCENTAGE_SCALE = 10000;
const HUNDRED_PERCENT_UNITS = 100 * PERCENTAGE_SCALE;

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

const normalizeAssociatePayload = (payload) => {
  if (!hasOwn(payload, 'participationPercentage')) {
    return payload;
  }

  return {
    ...payload,
    participationPercentage: normalizeParticipationPercentage(payload.participationPercentage),
  };
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
  };
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
const createListAssociates = ({ associateRepository }) => async () => {
  const associates = await associateRepository.list();
  return associates.map(normalizeAssociateRecord);
};

/**
 * Create the use case that validates unique associate contact details before creation.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createCreateAssociate = ({ associateRepository }) => async (payload) => {
  const normalizedPayload = normalizeAssociatePayload(payload);

  await ensureUniqueAssociateContact({
    associateRepository,
    email: normalizedPayload.email,
    phone: normalizedPayload.phone,
  });

  return normalizeAssociateRecord(await associateRepository.create(normalizedPayload));
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
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createUpdateAssociate = ({ associateRepository }) => async (associateId, payload) => {
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

/**
 * Create the use case that deletes an associate after confirming the record exists.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createDeleteAssociate = ({ associateRepository }) => async (associateId) => {
  const associate = await associateRepository.findById(associateId);
  if (!associate) {
    throw new NotFoundError('Associate');
  }

  await associateRepository.destroy(associate);
};

const ensureAssociatePortalAccess = async ({ actor, associateRepository, associateId = null }) => {
  if (actor.role === 'admin') {
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
    throw new AuthorizationError('Only admins and socios can access associate portal data');
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
  const [contributions, distributions, loans] = await Promise.all([
    associateRepository.listContributionsByAssociate(associate.id),
    associateRepository.listProfitDistributionsByAssociate(associate.id),
    associateRepository.listLoansByAssociate(associate.id),
  ]);

  const totalContributed = contributions.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalDistributed = distributions.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const activeLoans = loans.filter((loan) => ['approved', 'active', 'defaulted'].includes(loan.status));

  return {
    associate: normalizeAssociateRecord(associate),
    summary: {
      totalContributed: roundCurrency(totalContributed),
      totalDistributed: roundCurrency(totalDistributed),
      netProfit: roundCurrency(totalDistributed),
      activeLoanCount: activeLoans.length,
      portfolioExposure: roundCurrency(activeLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0)),
    },
    contributions,
    distributions: distributions.map(normalizeDistributionRecord),
    loans,
  };
};

const createCreateAssociateContribution = ({ associateRepository }) => async ({ actor, associateId, payload }) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can create associate contributions');
  }

  const associate = await associateRepository.findById(associateId);
  if (!associate) {
    throw new NotFoundError('Associate');
  }

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError('Contribution amount must be greater than 0');
  }

  return associateRepository.createContribution({
    associateId: associate.id,
    amount,
    contributionDate: payload.contributionDate ? new Date(payload.contributionDate) : new Date(),
    createdByUserId: actor.id,
    notes: payload.notes ? String(payload.notes).trim() : null,
  });
};

const createCreateProfitDistribution = ({ associateRepository }) => async ({ actor, associateId, payload }) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can create profit distributions');
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
    loanId: payload.loanId || null,
    amount,
    distributionDate: payload.distributionDate ? new Date(payload.distributionDate) : new Date(),
    createdByUserId: actor.id,
    notes: payload.notes ? String(payload.notes).trim() : null,
    basis: payload.basis && typeof payload.basis === 'object' ? payload.basis : {},
  });
};

const createCreateProportionalProfitDistribution = ({ associateRepository }) => async ({ actor, idempotencyKey, payload }) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can create proportional profit distributions');
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
  createCreateProportionalProfitDistribution,
};
