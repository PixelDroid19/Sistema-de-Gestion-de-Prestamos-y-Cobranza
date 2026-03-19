const { customerValidation } = require('../../middleware/validation');
const { createAuthMiddleware } = require('../shared/auth');
const { createJwtTokenService } = require('../shared/auth/tokenService');
const { createModule } = require('../shared');
const { createListCustomers, createCreateCustomer } = require('./application/useCases');
const { customerRepository } = require('./infrastructure/repositories');
const { createCustomersRouter } = require('./presentation/router');

/**
 * Compose the customers module entrypoint and its router dependencies.
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createCustomersModule = () => {
  const authMiddleware = createAuthMiddleware({ tokenService: createJwtTokenService() });
  const useCases = {
    listCustomers: createListCustomers({ customerRepository }),
    createCustomer: createCreateCustomer({ customerRepository }),
  };

  return createModule({
    name: 'customers',
    basePath: '/api/customers',
    router: createCustomersRouter({ customerValidation, authMiddleware, useCases }),
  });
};

module.exports = {
  createCustomersModule,
};
