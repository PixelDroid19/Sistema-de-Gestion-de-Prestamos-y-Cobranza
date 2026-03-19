const { NotFoundError, ValidationError, AuthorizationError } = require('../../../utils/errorHandler');

const roundCurrency = (value) => Number.parseFloat((Number(value) || 0).toFixed(2));

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
const createListAssociates = ({ associateRepository }) => async () => associateRepository.list();

/**
 * Create the use case that validates unique associate contact details before creation.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createCreateAssociate = ({ associateRepository }) => async (payload) => {
  await ensureUniqueAssociateContact({
    associateRepository,
    email: payload.email,
    phone: payload.phone,
  });

  return associateRepository.create(payload);
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

  return associate;
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

  await ensureUniqueAssociateContact({
    associateRepository,
    email: payload.email,
    phone: payload.phone,
    excludeId: associate.id,
  });

  return associateRepository.update(associate, payload);
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
    associate,
    summary: {
      totalContributed: roundCurrency(totalContributed),
      totalDistributed: roundCurrency(totalDistributed),
      netProfit: roundCurrency(totalDistributed),
      activeLoanCount: activeLoans.length,
      portfolioExposure: roundCurrency(activeLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0)),
    },
    contributions,
    distributions,
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

module.exports = {
  createListAssociates,
  createCreateAssociate,
  createGetAssociateById,
  createUpdateAssociate,
  createDeleteAssociate,
  createListAssociatePortalSummary,
  createCreateAssociateContribution,
  createCreateProfitDistribution,
};
