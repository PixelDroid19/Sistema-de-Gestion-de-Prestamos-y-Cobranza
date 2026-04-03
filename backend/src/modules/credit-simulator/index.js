const { createModule, resolveAuthContext } = require('../shared');
const { createCalculateLoanUseCase } = require('./application/calculateLoan');
const { createCreditSimulatorRouter } = require('./presentation/router');

/**
 * Create the credit simulator module entrypoint
 * @param {{ sharedRuntime?: object }} options
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createCreditSimulatorModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);

  const useCases = {
    calculateLoan: createCalculateLoanUseCase({}),
  };

  return createModule({
    name: 'credit-simulator',
    basePath: '/api/credit-simulator',
    router: createCreditSimulatorRouter({ authMiddleware, useCases }),
  });
};

module.exports = {
  createCreditSimulatorModule,
};
