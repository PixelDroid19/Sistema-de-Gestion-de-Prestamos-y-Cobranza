const Agent = require('../../../models/Agent');

/**
 * Persistence port for agent list and creation workflows.
 */
const agentRepository = {
  list() {
    return Agent.findAll({ order: [['name', 'ASC']] });
  },
  create(payload) {
    return Agent.create(payload);
  },
};

module.exports = {
  agentRepository,
};
