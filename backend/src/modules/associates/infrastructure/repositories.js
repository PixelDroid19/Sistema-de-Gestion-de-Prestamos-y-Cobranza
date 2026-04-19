const { Op } = require('sequelize');
const {
  Associate,
  AssociateContribution,
  AssociateInstallment,
  ProfitDistribution,
  IdempotencyKey,
  Loan,
  Customer,
  User,
} = require('@/models');
const { paginateModel } = require('@/modules/shared/pagination');

const PROPORTIONAL_DISTRIBUTION_SCOPE = 'associates.proportional-distribution';

/**
 * Persistence port for associate CRUD and contact-conflict checks.
 */
const associateRepository = {
  list() {
    return Associate.findAll({ order: [['name', 'ASC']] });
  },
  listPage({ page, pageSize }) {
    return paginateModel({
      model: Associate,
      page,
      pageSize,
      order: [['name', 'ASC']],
    });
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
  createContribution(payload, { transaction } = {}) {
    return AssociateContribution.create(payload, { transaction });
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
  createProfitDistribution(payload, { transaction } = {}) {
    return ProfitDistribution.create(payload, { transaction });
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
      include: [{ model: Customer, attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
    });
  },
  findByLinkedUser(userId) {
    return Associate.findOne({
      include: [{ model: User, as: 'portalUsers', where: { id: userId }, attributes: [] }],
    });
  },
  findInstallmentsByAssociateId(associateId) {
    return AssociateInstallment.findAll({
      where: { associateId },
      include: [{ model: User, as: 'paidByUser', attributes: ['id', 'name', 'email', 'role'] }],
      order: [['dueDate', 'ASC'], ['installmentNumber', 'ASC']],
    });
  },
  updateInstallmentStatus(associateId, installmentNumber, status, paidAt, paidBy) {
    return AssociateInstallment.update(
      { status, paidAt, paidBy },
      {
        where: {
          associateId,
          installmentNumber,
        },
      },
    );
  },
  findCalendarEvents(associateId, startDate, endDate) {
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date(new Date().getFullYear(), 11, 31);

    return Promise.all([
      AssociateContribution.findAll({
        where: {
          associateId,
          contributionDate: { [Op.between]: [start, end] },
        },
        include: [{ model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] }],
        order: [['contributionDate', 'ASC']],
      }),
      ProfitDistribution.findAll({
        where: {
          associateId,
          distributionDate: { [Op.between]: [start, end] },
        },
        include: [
          { model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] },
          { model: Loan, attributes: ['id', 'amount', 'status'] },
        ],
        order: [['distributionDate', 'ASC']],
      }),
      AssociateInstallment.findAll({
        where: {
          associateId,
          dueDate: { [Op.between]: [start, end] },
        },
        order: [['dueDate', 'ASC']],
      }),
    ]).then(([contributions, distributions, installments]) => ({
      contributions: contributions.map((c) => ({
        id: c.id,
        type: 'contribution',
        amount: c.amount,
        date: c.contributionDate,
        notes: c.notes,
        createdBy: c.createdBy,
      })),
      distributions: distributions.map((d) => ({
        id: d.id,
        type: 'distribution',
        amount: d.amount,
        date: d.distributionDate,
        notes: d.notes,
        createdBy: d.createdBy,
        loanId: d.loanId,
        loan: d.Loan,
      })),
      installments: installments.map((i) => ({
        id: i.id,
        type: 'installment',
        installmentNumber: i.installmentNumber,
        amount: i.amount,
        dueDate: i.dueDate,
        status: i.status,
        paidAt: i.paidAt,
      })),
    }));
  },
};

module.exports = {
  associateRepository,
};
