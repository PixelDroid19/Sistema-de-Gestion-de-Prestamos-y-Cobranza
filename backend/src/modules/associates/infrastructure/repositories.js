const { Op } = require('sequelize');
const {
  Associate,
  AssociateContribution,
  AssociateInstallment,
  ProfitDistribution,
  User,
} = require('@/models');
const { paginateModel } = require('@/modules/shared/pagination');

const getFinancialDatasetByAssociateIds = async (associateIds = []) => {
  if (!Array.isArray(associateIds) || associateIds.length === 0) {
    return {
      contributions: [],
      distributions: [],
      installments: [],
    };
  }

  const normalizedAssociateIds = associateIds
    .map((associateId) => Number(associateId))
    .filter((associateId) => Number.isFinite(associateId));

  if (normalizedAssociateIds.length === 0) {
    return {
      contributions: [],
      distributions: [],
      installments: [],
    };
  }

  const [contributions, distributions, installments] = await Promise.all([
    AssociateContribution.findAll({
      where: { associateId: { [Op.in]: normalizedAssociateIds } },
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] }],
      order: [['contributionDate', 'DESC'], ['createdAt', 'DESC']],
    }),
    ProfitDistribution.findAll({
      where: { associateId: { [Op.in]: normalizedAssociateIds } },
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] }],
      order: [['distributionDate', 'DESC'], ['createdAt', 'DESC']],
    }),
    AssociateInstallment.findAll({
      where: { associateId: { [Op.in]: normalizedAssociateIds } },
      include: [{ model: User, as: 'paidByUser', attributes: ['id', 'name', 'email', 'role'] }],
      order: [['dueDate', 'ASC'], ['installmentNumber', 'ASC']],
    }),
  ]);

  return {
    contributions,
    distributions,
    installments,
  };
};

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

const getInclusiveEndOfDay = (value) => {
  const endOfDay = new Date(value);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return endOfDay;
};

const buildCalendarDateWhere = (field, startDate, endDate) => {
  const range = {};

  if (startDate) {
    range[Op.gte] = startDate;
  }

  if (endDate) {
    range[Op.lte] = getInclusiveEndOfDay(endDate);
  }

  return startDate || endDate ? { [field]: range } : {};
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
      attributes: ['id', 'status', 'interestRate', 'interestType'],
      raw: true,
    });
    const associateIds = associates.map((associate) => associate.id);

    let contributionsByAssociate = new Map();
    let capitalReturnsByAssociate = new Map();
    if (associateIds.length > 0) {
      const [contributionRows, capitalReturnRows] = await Promise.all([
        AssociateContribution.findAll({
          attributes: [
            'associateId',
            [AssociateContribution.sequelize.fn('SUM', AssociateContribution.sequelize.col('amount')), 'totalContributed'],
          ],
          where: {
            associateId: { [Op.in]: associateIds },
            status: 'completed',
          },
          group: ['associateId'],
          raw: true,
        }),
        ProfitDistribution.findAll({
          attributes: [
            'associateId',
            [ProfitDistribution.sequelize.fn('SUM', ProfitDistribution.sequelize.col('amount')), 'totalCapitalReturned'],
          ],
          where: {
            associateId: { [Op.in]: associateIds },
            basis: { [Op.contains]: { type: 'capital-return' } },
          },
          group: ['associateId'],
          raw: true,
        }),
      ]);

      contributionsByAssociate = new Map(
        contributionRows.map((row) => [Number(row.associateId), Number(row.totalContributed || 0)]),
      );
      capitalReturnsByAssociate = new Map(
        capitalReturnRows.map((row) => [Number(row.associateId), Number(row.totalCapitalReturned || 0)]),
      );
    }

    return associates.reduce((summary, associate) => {
      const totalContributed = Number(contributionsByAssociate.get(Number(associate.id)) || 0);
      const totalCapitalReturned = Number(capitalReturnsByAssociate.get(Number(associate.id)) || 0);
      const currentCapital = Math.max(0, totalContributed - totalCapitalReturned);
      const interestRate = Number(associate.interestRate || 0);
      const monthlyInterest = associate.status !== 'active'
        ? 0
        : (associate.interestType === 'annual'
          ? (currentCapital * (interestRate / 100)) / 12
          : currentCapital * (interestRate / 100));

      summary.totalAssociates += 1;
      summary.activeAssociates += associate.status === 'active' ? 1 : 0;
      summary.inactiveAssociates += associate.status === 'inactive' ? 1 : 0;
      summary.totalContributed += totalContributed;
      summary.monthlyInterestEstimate += monthlyInterest;
      return summary;
    }, {
      totalAssociates: 0,
      activeAssociates: 0,
      inactiveAssociates: 0,
      totalContributed: 0,
      monthlyInterestEstimate: 0,
    });
  },
  async getTrackingDataset(filters = {}) {
    const where = buildAssociateListWhere(filters);
    const associates = await Associate.findAll({
      where,
      order: [['name', 'ASC']],
    });
    const associateIds = associates.map((associate) => associate.id);
    const dataset = await getFinancialDatasetByAssociateIds(associateIds);

    return {
      associates,
      contributions: dataset.contributions,
      distributions: dataset.distributions,
      installments: dataset.installments,
    };
  },
  getFinancialDatasetByAssociateIds,
  findById(id, { transaction } = {}) {
    return Associate.findByPk(id, { transaction });
  },
  findByIdForUpdate(id, { transaction } = {}) {
    if (!transaction) {
      return Associate.findByPk(id);
    }

    return Associate.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
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
  update(associate, payload, { transaction } = {}) {
    return associate.update(payload, { transaction });
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
    const status = String(existingInstallment.status || '').toLowerCase();
    if (status === 'pending' || status === 'overdue') {
      return existingInstallment.update({
        amount: payload.amount,
        dueDate: payload.dueDate,
        capitalBase: payload.capitalBase,
        interestRate: payload.interestRate,
        interestType: payload.interestType,
        periodStartDate: payload.periodStartDate,
        periodEndDate: payload.periodEndDate,
        notes: payload.notes ?? existingInstallment.notes,
      }, { transaction });
    }

    return existingInstallment;
  }

    return AssociateInstallment.create(payload, { transaction });
  },
  listActiveAssociates({ transaction } = {}) {
    return Associate.findAll({
      where: { status: 'active' },
      order: [['id', 'ASC']],
      transaction,
    });
  },
  listProfitDistributionsByAssociate(associateId, { transaction } = {}) {
    return ProfitDistribution.findAll({
      where: { associateId },
      include: [
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] },
      ],
      order: [['distributionDate', 'DESC'], ['createdAt', 'DESC']],
      transaction,
    });
  },
  createProfitDistribution(payload, { transaction } = {}) {
    return ProfitDistribution.create(payload, { transaction });
  },
  runInTransaction(work) {
    return Associate.sequelize.transaction(work);
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
  updateInstallmentProjection(installmentId, payload, { transaction } = {}) {
    return AssociateInstallment.findByPk(installmentId, { transaction }).then((installment) => (
      installment ? installment.update(payload, { transaction }) : null
    ));
  },
  deleteInstallmentById(installmentId, { transaction } = {}) {
    return AssociateInstallment.destroy({
      where: { id: installmentId },
      transaction,
    });
  },
  findCalendarEvents(associateId, startDate, endDate) {
    return Promise.all([
      AssociateContribution.findAll({
        where: {
          associateId,
          ...buildCalendarDateWhere('contributionDate', startDate, endDate),
        },
        include: [{ model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] }],
        order: [['contributionDate', 'ASC']],
      }),
      ProfitDistribution.findAll({
        where: {
          associateId,
          ...buildCalendarDateWhere('distributionDate', startDate, endDate),
        },
        include: [
          { model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] },
        ],
        order: [['distributionDate', 'ASC']],
      }),
      AssociateInstallment.findAll({
        where: {
          associateId,
          ...buildCalendarDateWhere('dueDate', startDate, endDate),
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
        distributionKind: d?.basis?.type ?? null,
        displayType: d?.basis?.type === 'capital-return'
          ? 'Devolución de capital'
          : (d?.basis?.type === 'reinvestment'
            ? 'Reinversión'
            : 'Pago manual de rentabilidad'),
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
