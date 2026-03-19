const { createJwtTokenService } = require('../modules/shared/auth/tokenService');
const { createAuthMiddleware } = require('../modules/shared/auth');

module.exports = createAuthMiddleware({ tokenService: createJwtTokenService() });
