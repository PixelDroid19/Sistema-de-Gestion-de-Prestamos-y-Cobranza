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

const createListAssociates = ({ associateRepository }) => async () => associateRepository.list();

const createCreateAssociate = ({ associateRepository }) => async (payload) => {
  await ensureUniqueAssociateContact({
    associateRepository,
    email: payload.email,
    phone: payload.phone,
  });

  return associateRepository.create(payload);
};

const createGetAssociateById = ({ associateRepository }) => async (associateId) => {
  const associate = await associateRepository.findById(associateId);
  if (!associate) {
    throw new NotFoundError('Associate');
  }

  return associate;
};

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
