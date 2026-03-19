/**
 * Create the use case that lists agents in repository-defined order.
 * @param {{ agentRepository: object }} dependencies
 * @returns {Function}
 */
const createListAgents = ({ agentRepository }) => async () => agentRepository.list();

/**
 * Create the use case that persists a new agent record.
 * @param {{ agentRepository: object }} dependencies
 * @returns {Function}
 */
const createCreateAgent = ({ agentRepository }) => async (payload) => agentRepository.create(payload);

module.exports = {
  createListAgents,
  createCreateAgent,
};
