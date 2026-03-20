const { authValidation } = require('../../middleware/validation');
const { createModule, resolveAuthContext } = require('../shared');
const {
  createRegisterUser,
  createLoginUser,
  createGetProfile,
  createUpdateProfile,
} = require('./application/useCases');
const {
  userRepository,
  customerProfileRepository,
  agentProfileRepository,
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
      agentProfileRepository,
      associateProfileRepository,
      passwordHasher,
      tokenService,
    }),
    loginUser: createLoginUser({ userRepository, passwordHasher, tokenService }),
    getProfile: createGetProfile({ userRepository }),
    updateProfile: createUpdateProfile({
      userRepository,
      customerProfileRepository,
      agentProfileRepository,
      associateProfileRepository,
    }),
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
