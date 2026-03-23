const { authValidation } = require('../../middleware/validation');
const { createModule, resolveAuthContext } = require('../shared');
const {
  createRegisterUser,
  createLoginUser,
  createGetProfile,
  createUpdateProfile,
  createChangePassword,
} = require('./application/useCases');
const {
  userRepository,
  customerProfileRepository,
  associateProfileRepository,
  passwordHasher,
} = require('./infrastructure/repositories');
const { createAuthRouter } = require('./presentation/router');

/**
 * Compose the authentication module entrypoint and its router dependencies.
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createAuthModule = ({ sharedRuntime } = {}) => {
  const { tokenService, authMiddleware } = resolveAuthContext(sharedRuntime);
  const useCases = {
    registerUser: createRegisterUser({
      userRepository,
      customerProfileRepository,
      associateProfileRepository,
      passwordHasher,
      tokenService,
    }),
    loginUser: createLoginUser({ userRepository, passwordHasher, tokenService }),
    getProfile: createGetProfile({ userRepository }),
    updateProfile: createUpdateProfile({
      userRepository,
      customerProfileRepository,
      associateProfileRepository,
    }),
    changePassword: createChangePassword({ userRepository, passwordHasher }),
  };

  return createModule({
    name: 'auth',
    basePath: '/api/auth',
    router: createAuthRouter({ authValidation, authMiddleware, useCases }),
  });
};

module.exports = {
  createAuthModule,
};
