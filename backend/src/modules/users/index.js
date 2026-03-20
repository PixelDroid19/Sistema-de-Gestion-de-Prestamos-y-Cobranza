const { createAuthMiddleware } = require('../shared/auth');
const { createJwtTokenService } = require('../shared/auth/tokenService');
const { createModule } = require('../shared');
const { createUsersRouter } = require('./presentation/router');
const { createListUsers, createGetUserById, createUpdateUser, createDeactivateUser, createReactivateUser } = require('./application/useCases');
const { userRepository } = require('./infrastructure/repositories');

const createUsersModule = () => {
  const authMiddleware = createAuthMiddleware({ tokenService: createJwtTokenService() });
  const useCases = {
    listUsers: createListUsers({ userRepository }),
    getUserById: createGetUserById({ userRepository }),
    updateUser: createUpdateUser({ userRepository }),
    deactivateUser: createDeactivateUser({ userRepository }),
    reactivateUser: createReactivateUser({ userRepository }),
  };

  return createModule({
    name: 'users',
    basePath: '/api/users',
    router: createUsersRouter({ authMiddleware, useCases }),
  });
};

module.exports = {
  createUsersModule,
};
