const { Op } = require('sequelize');
const {
  Associate,
  AssociateContribution,
  ProfitDistribution,
  Loan,
  User,
} = require('../../../models');

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
