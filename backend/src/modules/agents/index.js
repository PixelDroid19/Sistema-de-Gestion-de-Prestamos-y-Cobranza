const { agentValidation } = require('../../middleware/validation');
const { createModule, resolveAuthContext } = require('../shared');
const { createListAgents, createCreateAgent } = require('./application/useCases');
const { agentRepository } = require('./infrastructure/repositories');
const { createAgentsRouter } = require('./presentation/router');

/**
 * Compose the agents module entrypoint and its router dependencies.
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createAgentsModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const useCases = {
    listAgents: createListAgents({ agentRepository }),
    createAgent: createCreateAgent({ agentRepository }),
  };

  return createModule({
    name: 'agents',
    basePath: '/api/agents',
    router: createAgentsRouter({ agentValidation, authMiddleware, useCases }),
  });
};

module.exports = {
  createAgentsModule,
};
