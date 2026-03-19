const Agent = require('../../../models/Agent');

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
