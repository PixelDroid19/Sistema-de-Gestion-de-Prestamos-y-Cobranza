const { createJwtTokenService } = require('../modules/shared/auth/tokenService');
const { createAuthMiddleware } = require('../modules/shared/auth');

/**
 * Legacy export that keeps the shared auth middleware factory available through middleware/auth.
 */
module.exports = createAuthMiddleware({ tokenService: createJwtTokenService() });
