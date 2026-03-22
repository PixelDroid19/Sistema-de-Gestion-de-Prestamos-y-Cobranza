const Agent = require('../../../models/Agent');
const { paginateModel } = require('../../shared/pagination');

/**
 * Persistence port for agent list and creation workflows.
 */
const agentRepository = {
  list() {
    return Agent.findAll({ order: [['name', 'ASC']] });
  },
  listPage({ page, pageSize }) {
    return paginateModel({
      model: Agent,
      page,
      pageSize,
      order: [['name', 'ASC']],
    });
  },
  create(payload) {
    return Agent.create(payload);
  },
};

module.exports = {
  agentRepository,
};
