const { Op } = require('sequelize');
const {
  Associate,
  AssociateContribution,
  ProfitDistribution,
  IdempotencyKey,
  Loan,
  User,
} = require('../../../models');

const PROPORTIONAL_DISTRIBUTION_SCOPE = 'associates.proportional-distribution';

/**
 * Persistence port for associate CRUD and contact-conflict checks.
 */
const associateRepository = {
  list() {
    return Associate.findAll({ order: [['name', 'ASC']] });
  },
  findById(id) {
    return Associate.findByPk(id);
  },
  create(payload) {
    return Associate.create(payload);
  },
  findConflictingContact({ email, phone, excludeId = null }) {
    const where = {
      [Op.or]: [],
    };

    if (email) {
      where[Op.or].push({ email });
    }

    if (phone) {
      where[Op.or].push({ phone });
    }

    if (where[Op.or].length === 0) {
      return null;
    }

    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    return Associate.findOne({ where });
  },
  update(associate, payload) {
    return associate.update(payload);
  },
  destroy(associate) {
    return associate.destroy();
  },
  listContributionsByAssociate(associateId) {
    return AssociateContribution.findAll({
      where: { associateId },
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] }],
      order: [['contributionDate', 'DESC'], ['createdAt', 'DESC']],
    });
  },
  createContribution(payload) {
    return AssociateContribution.create(payload);
  },
  listActiveAssociatesWithParticipation({ transaction } = {}) {
    return Associate.findAll({
      where: { status: 'active' },
      order: [['id', 'ASC']],
      transaction,
    });
  },
  listProfitDistributionsByAssociate(associateId) {
    return ProfitDistribution.findAll({
      where: { associateId },
      include: [
        { model: Loan, attributes: ['id', 'amount', 'status'] },
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] },
      ],
      order: [['distributionDate', 'DESC'], ['createdAt', 'DESC']],
    });
  },
  createProfitDistribution(payload) {
    return ProfitDistribution.create(payload);
  },
  createProfitDistributionBatch(payloads, { transaction } = {}) {
    if (transaction) {
      return ProfitDistribution.bulkCreate(payloads, {
        transaction,
        returning: true,
      });
    }

    return Associate.sequelize.transaction(async (managedTransaction) => ProfitDistribution.bulkCreate(payloads, {
      transaction: managedTransaction,
      returning: true,
    }));
  },
  runInTransaction(work) {
    return Associate.sequelize.transaction(work);
  },
  findProportionalDistributionIdempotency({ actorId, idempotencyKey, transaction } = {}) {
    return IdempotencyKey.findOne({
      where: {
        scope: PROPORTIONAL_DISTRIBUTION_SCOPE,
        createdByUserId: actorId,
        idempotencyKey,
      },
      transaction,
    });
  },
  createProportionalDistributionIdempotency({ actorId, idempotencyKey, requestHash, status = 'pending', responsePayload = {} }, { transaction } = {}) {
    return IdempotencyKey.create({
      scope: PROPORTIONAL_DISTRIBUTION_SCOPE,
      createdByUserId: actorId,
      idempotencyKey,
      requestHash,
      status,
      responsePayload,
    }, { transaction });
  },
  updateProportionalDistributionIdempotency(record, payload, { transaction } = {}) {
    return record.update(payload, { transaction });
  },
  listLoansByAssociate(associateId) {
    return Loan.findAll({
      where: { associateId },
      order: [['createdAt', 'DESC']],
    });
  },
  findByLinkedUser(userId) {
    return Associate.findOne({
      include: [{ model: User, as: 'portalUsers', where: { id: userId }, attributes: [] }],
    });
  },
};

module.exports = {
  associateRepository,
};
