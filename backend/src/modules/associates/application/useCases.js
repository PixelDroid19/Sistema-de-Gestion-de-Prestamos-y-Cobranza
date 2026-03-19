const { NotFoundError, ValidationError } = require('../../../utils/errorHandler');

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

module.exports = {
  createListAssociates,
  createCreateAssociate,
  createGetAssociateById,
  createUpdateAssociate,
  createDeleteAssociate,
};
