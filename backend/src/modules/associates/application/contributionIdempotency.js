const { createHash } = require('node:crypto');
const { ValidationError, ConflictError } = require('@/utils/errorHandler');
const { validateIdempotencyKey } = require('@/modules/shared/validators');

/** The caller holds the associate row lock until the contribution and receipt commit. */
const prepareContributionReceipt = async ({ repository, transaction, associateId, actorId, key, payload }) => {
  if (key === undefined || key === null) return null;
  if (!key || !validateIdempotencyKey(key)) {
    throw new ValidationError('Idempotency-Key debe tener entre 8 y 160 caracteres.');
  }
  const scope = `associate-contribution:${associateId}`;
  const idempotencyKey = key.trim();
  const requestHash = createHash('sha256').update(JSON.stringify({ actorId, ...payload })).digest('hex');
  const existing = await repository.findContributionReceipt({ scope, idempotencyKey }, { transaction });
  if (existing && existing.requestHash !== requestHash) {
    throw new ConflictError('La clave de operación ya fue utilizada para otro aporte.');
  }
  return { scope, idempotencyKey, requestHash, createdByUserId: actorId, existing };
};

module.exports = { prepareContributionReceipt };
