const { createJwtTokenService } = require('@/modules/shared/auth/tokenService');
const { createAuthMiddleware } = require('@/modules/shared/auth');

/**
 * Express auth middleware wired from the shared authentication factory.
 */
module.exports = createAuthMiddleware({ tokenService: createJwtTokenService() });
