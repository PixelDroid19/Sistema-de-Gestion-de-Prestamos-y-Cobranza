const { createModule, resolveAuthContext } = require('../shared');
const { createUsersRouter } = require('./presentation/router');
const { createListUsers, createGetUserById, createUpdateUser, createDeactivateUser, createReactivateUser } = require('./application/useCases');
const { userRepository } = require('./infrastructure/repositories');

const createUsersModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
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
