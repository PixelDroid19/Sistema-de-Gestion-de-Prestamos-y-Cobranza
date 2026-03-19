const createListAgents = ({ agentRepository }) => async () => agentRepository.list();

const createCreateAgent = ({ agentRepository }) => async (payload) => agentRepository.create(payload);

module.exports = {
  createListAgents,
  createCreateAgent,
};
