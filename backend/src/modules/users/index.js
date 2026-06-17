const { createModule, resolveAuthContext } = require('@/modules/shared');
const { createUsersRouter } = require('./presentation/router');
const {
  createListUsers,
  createGetUserById,
  createUpdateUser,
  createDeactivateUser,
  createReactivateUser,
  createUnlockUser,
} = require('./application/useCases');
const { userRepository } = require('./infrastructure/repositories');
const { passwordHasher } = require('@/modules/auth/infrastructure/repositories');

/**
 * Compose the administrative users module and its user-management router.
 * @param {{ sharedRuntime?: object }} [options]
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createUsersModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const useCases = {
    listUsers: createListUsers({ userRepository }),
    getUserById: createGetUserById({ userRepository }),
    updateUser: createUpdateUser({ userRepository, passwordHasher }),
    deactivateUser: createDeactivateUser({ userRepository }),
    reactivateUser: createReactivateUser({ userRepository }),
    unlockUser: createUnlockUser({ userRepository }),
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
