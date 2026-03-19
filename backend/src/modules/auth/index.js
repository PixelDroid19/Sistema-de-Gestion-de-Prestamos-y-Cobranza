const { authValidation } = require('../../middleware/validation');
const { createJwtTokenService } = require('../shared/auth/tokenService');
const { createModule } = require('../shared');
const { createAuthMiddleware } = require('../shared/auth');
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
const createAuthModule = () => {
  const tokenService = createJwtTokenService();
  const authMiddleware = createAuthMiddleware({ tokenService });
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
