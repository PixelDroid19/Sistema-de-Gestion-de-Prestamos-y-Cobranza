const { authValidation } = require('../../middleware/validation');
const { createModule, resolveAuthContext } = require('../shared');
const { createJwtTokenService } = require('../shared/auth/tokenService');
const {
  createRegisterUser,
  createLoginUser,
  createGetProfile,
  createUpdateProfile,
  createChangePassword,
  createRefreshToken,
  createRevokeRefreshToken,
  createRevokeAllUserTokens,
  createRegisterWithPermissions,
} = require('./application/useCases');
const {
  userRepository,
  customerProfileRepository,
  associateProfileRepository,
  passwordHasher,
  refreshTokenRepository,
} = require('./infrastructure/repositories');
const { userPermissionRepository, rolePermissionRepository, permissionRepository } = require('../permissions/infrastructure');
const { createAuthRouter } = require('./presentation/router');

/**
 * Compose the authentication module entrypoint and its router dependencies.
 * @param {{ sharedRuntime?: object, auditService?: object }} [options]
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createAuthModule = ({ sharedRuntime, auditService } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  
  // Create token service with refresh token repository
  const tokenService = createJwtTokenService({ refreshTokenRepository });
  
  const useCases = {
    registerUser: createRegisterUser({
      userRepository,
      customerProfileRepository,
      associateProfileRepository,
      passwordHasher,
      tokenService,
      auditService,
    }),
    loginUser: createLoginUser({ userRepository, passwordHasher, tokenService, refreshTokenRepository, auditService }),
    getProfile: createGetProfile({ userRepository }),
    updateProfile: createUpdateProfile({
      userRepository,
      customerProfileRepository,
      associateProfileRepository,
      auditService,
    }),
    changePassword: createChangePassword({ userRepository, passwordHasher, auditService }),
    refreshToken: createRefreshToken({ tokenService, refreshTokenRepository, userRepository }),
    revokeRefreshToken: createRevokeRefreshToken({ refreshTokenRepository }),
    revokeAllUserTokens: createRevokeAllUserTokens({ refreshTokenRepository, auditService }),
    registerWithPermissions: createRegisterWithPermissions({
      userRepository,
      customerProfileRepository,
      associateProfileRepository,
      passwordHasher,
      tokenService,
      userPermissionRepository,
      rolePermissionRepository,
      permissionRepository,
      auditService,
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
