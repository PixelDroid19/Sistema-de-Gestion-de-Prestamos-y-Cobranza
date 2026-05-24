const { Op } = require('sequelize');
const { OperatingExpense, User } = require('@/models');
const { paginateModel } = require('@/modules/shared/pagination');

const buildExpenseWhere = (filters = {}) => {
  const where = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.fromDate || filters.toDate) {
    where.expenseDate = {
      ...(filters.fromDate ? { [Op.gte]: filters.fromDate } : {}),
      ...(filters.toDate ? { [Op.lte]: filters.toDate } : {}),
    };
  }

  return where;
};

const includeUsers = [
  { model: User, as: 'createdBy', attributes: ['id', 'name', 'email', 'role'] },
  { model: User, as: 'annulledBy', attributes: ['id', 'name', 'email', 'role'] },
];

const operatingExpenseRepository = {
  listPage({ filters = {}, pagination = {}, page = pagination.page, pageSize = pagination.pageSize }) {
    return paginateModel({
      model: OperatingExpense,
      page,
      pageSize,
      where: buildExpenseWhere(filters),
      include: includeUsers,
      order: [['expenseDate', 'DESC'], ['createdAt', 'DESC'], ['id', 'DESC']],
    });
  },
  create(payload, { transaction } = {}) {
    return OperatingExpense.create(payload, { transaction });
  },
  findById(expenseId, { transaction } = {}) {
    return OperatingExpense.findByPk(expenseId, {
      include: includeUsers,
      transaction,
    });
  },
};

module.exports = {
  operatingExpenseRepository,
  buildExpenseWhere,
};
