const User = require('@/models/User');
const { Op } = require('sequelize');
const { paginateModel } = require('@/modules/shared/pagination');
const { ADMINISTRATIVE_LOGIN_ROLES, normalizeApplicationRole } = require('@/modules/shared/roles');

const buildUserListWhere = (filters = {}) => {
  const clauses = [];
  const normalizedSearch = String(filters.search || '').trim();
  const normalizedRoleFilter = String(filters.role || '').trim().toLowerCase();

  if (normalizedSearch) {
    const pattern = `%${normalizedSearch}%`;
    clauses.push({
      [Op.or]: [
        { name: { [Op.iLike]: pattern } },
        { email: { [Op.iLike]: pattern } },
      ],
    });
  }

  if (normalizedRoleFilter === 'administrative') {
    clauses.push({ role: { [Op.in]: ADMINISTRATIVE_LOGIN_ROLES } });
  } else {
    const normalizedRole = normalizeApplicationRole(normalizedRoleFilter);
    if (normalizedRole) {
      clauses.push({ role: normalizedRole });
    } else if (normalizedRoleFilter) {
      clauses.push({ id: { [Op.eq]: null } });
    }
  }

  if (clauses.length === 0) {
    return undefined;
  }

  return clauses.length === 1 ? clauses[0] : { [Op.and]: clauses };
};

const userRepository = {
  findAll(filters = {}) {
    return User.findAll({
      where: buildUserListWhere(filters),
      order: [['createdAt', 'DESC']],
    });
  },

  findPage({ page, pageSize, filters = {} }) {
    return paginateModel({
      model: User,
      page,
      pageSize,
      where: buildUserListWhere(filters),
      order: [['createdAt', 'DESC']],
    });
  },

  async countSummary(filters = {}) {
    const baseWhere = buildUserListWhere(filters);
    const [totalUsers, activeUsers, inactiveUsers] = await Promise.all([
      User.count({ where: baseWhere }),
      User.count({
        where: baseWhere
          ? { [Op.and]: [baseWhere, { isActive: true }] }
          : { isActive: true },
      }),
      User.count({
        where: baseWhere
          ? { [Op.and]: [baseWhere, { isActive: false }] }
          : { isActive: false },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
    };
  },

  findById(userId) {
    return User.findByPk(userId);
  },

  findByEmail(email) {
    return User.findOne({ where: { email } });
  },

  async update(userId, data) {
    const user = await User.findByPk(userId);
    if (!user) {
      return null;
    }

    await user.update(data);
    return user;
  },
};

module.exports = {
  userRepository,
  buildUserListWhere,
};
