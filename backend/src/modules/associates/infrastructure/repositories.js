const { Op } = require('sequelize');
const {
  Associate,
  AssociateContribution,
  AssociateInstallment,
  ProfitDistribution,
  IdempotencyKey,
  User,
} = require('@/models');
const { paginateModel } = require('@/modules/shared/pagination');

const PROPORTIONAL_DISTRIBUTION_SCOPE = 'associates.proportional-distribution';

const buildAssociateListWhere = (filters = {}) => {
  const clauses = [];
  const search = String(filters.search || '').trim();

  if (search) {
    const pattern = `%${search}%`;
    clauses.push({
      [Op.or]: [
        { name: { [Op.iLike]: pattern } },
        { email: { [Op.iLike]: pattern } },
        { phone: { [Op.iLike]: pattern } },
      ],
    });
  }

  if (filters.status) {
    clauses.push({ status: filters.status });
  }

  if (clauses.length === 0) {
    return undefined;
  }

  return { [Op.and]: clauses };
};

/**
 * Persistence port for associate CRUD and contact-conflict checks.
 */
const associateRepository = {
  list(filters = {}) {
    return Associate.findAll({
      where: buildAssociateListWhere(filters),
      order: [['name', 'ASC']],
    });
  },
  listPage({ page, pageSize, filters = {} }) {
    return paginateModel({
      model: Associate,
      page,
      pageSize,
      where: buildAssociateListWhere(filters),
      order: [['name', 'ASC']],
    });
  },
  async summarize(filters = {}) {
    const where = buildAssociateListWhere(filters);
    const associates = await Associate.findAll({
      where,
      attributes: ['id', 'status', 'participationPercentage', 'interestRate', 'interestType'],
      raw: true,
    });
    const associateIds = associates.map((associate) => associate.id);

    let contributionsByAssociate = new Map();
    if (associateIds.length > 0) {
      const contributionRows = await AssociateContribution.findAll({
        attributes: [
          'associateId',
          [AssociateContribution.sequelize.fn('SUM', AssociateContribution.sequelize.col('amount')), 'totalContributed'],
        ],
        where: { associateId: { [Op.in]: associateIds } },
        group: ['associateId'],
        raw: true,
      });

      contributionsByAssociate = new Map(
        contributionRows.map((row) => [Number(row.associateId), Number(row.totalContributed || 0)]),
      );
    }

    return associates.reduce((summary, associate) => {
      const totalContributed = Number(contributionsByAssociate.get(Number(associate.id)) || 0);
      const interestRate = Number(associate.interestRate || 0);
      const monthlyInterest = associate.interestType === 'annual'
        ? (totalContributed * (interestRate / 100)) / 12
        : totalContributed * (interestRate / 100);

      summary.totalAssociates += 1;
      summary.activeAssociates += associate.status === 'active' ? 1 : 0;
      summary.inactiveAssociates += associate.status === 'inactive' ? 1 : 0;
      summary.totalContributed += totalContributed;
      summary.monthlyInterestEstimate += monthlyInterest;
      summary.participationAssigned += Number(associate.participationPercentage || 0);
      return summary;
    }, {
      totalAssociates: 0,
      activeAssociates: 0,
      inactiveAssociates: 0,
      totalContributed: 0,
      monthlyInterestEstimate: 0,
      participationAssigned: 0,
    });
  },
  findById(id, { transaction } = {}) {
    return Associate.findByPk(id, { transaction });
  },
  create(payload, { transaction } = {}) {
    return Associate.create(payload, { transaction });
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
  listContributionsByAssociate(associateId, { transaction } = {}) {
    return AssociateContribution.findAll({
      where: { associateId },
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] }],
      order: [['contributionDate', 'DESC'], ['createdAt', 'DESC']],
      transaction,
    });
  },
  createContribution(payload, { transaction } = {}) {
    return AssociateContribution.create(payload, { transaction });
  },
  async createInstallment(payload, { transaction } = {}) {
    const existingInstallment = await AssociateInstallment.findOne({
      where: {
        associateId: payload.associateId,
        installmentNumber: payload.installmentNumber,
      },
      transaction,
    });

    if (existingInstallment) {
      return existingInstallment;
    }

    return AssociateInstallment.create(payload, { transaction });
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
  findByLinkedUser(userId) {
    return Associate.findOne({
      include: [{ model: User, as: 'portalUsers', where: { id: userId }, attributes: [] }],
    });
  },
  findInstallmentsByAssociateId(associateId, { transaction } = {}) {
    return AssociateInstallment.findAll({
      where: { associateId },
      include: [{ model: User, as: 'paidByUser', attributes: ['id', 'name', 'email', 'role'] }],
      order: [['dueDate', 'ASC'], ['installmentNumber', 'ASC']],
      transaction,
    });
  },
  updateInstallmentStatus(associateId, installmentNumber, status, paidAt, paidBy, paymentMethod = null, notes = null) {
    return AssociateInstallment.update(
      { status, paidAt, paidBy, paymentMethod, notes },
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
