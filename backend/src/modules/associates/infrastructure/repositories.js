const { Op } = require('sequelize');
const Associate = require('../../../models/Associate');

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
};

module.exports = {
  associateRepository,
};
