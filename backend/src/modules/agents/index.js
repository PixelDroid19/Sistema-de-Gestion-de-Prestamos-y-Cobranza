const { agentValidation } = require('../../middleware/validation');
const { createAuthMiddleware } = require('../shared/auth');
const { createJwtTokenService } = require('../shared/auth/tokenService');
const { createModule } = require('../shared');
const { createListAgents, createCreateAgent } = require('./application/useCases');
const { agentRepository } = require('./infrastructure/repositories');
const { createAgentsRouter } = require('./presentation/router');

/**
 * Compose the agents module entrypoint and its router dependencies.
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createAgentsModule = () => {
  const authMiddleware = createAuthMiddleware({ tokenService: createJwtTokenService() });
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
