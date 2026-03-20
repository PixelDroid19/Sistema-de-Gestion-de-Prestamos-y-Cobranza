const { AuthenticationError, AuthorizationError } = require('../../utils/errorHandler');
const { createJwtTokenService } = require('./auth/tokenService');

const normalizeRoles = (roles = []) => (typeof roles === 'string' ? [roles] : roles);

/**
 * Create role-aware authentication middleware backed by a token verification service.
 * @param {{ tokenService: { verify: Function } }} dependencies
 * @returns {(roles?: string|string[]) => import('express').RequestHandler}
 */
const createAuthMiddleware = ({ tokenService }) => (roles = []) => {
  const requiredRoles = normalizeRoles(roles);

  return (req, res, next) => {
    try {
      const authHeader = req.headers?.authorization || req.headers?.Authorization;

      if (!authHeader) {
        throw new AuthenticationError('Authorization header is required');
      }

      const [scheme, token] = authHeader.split(' ');
      if (scheme !== 'Bearer' || !token) {
        throw new AuthenticationError('Bearer token is required');
      }

      const user = tokenService.verify(token);
      if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
        throw new AuthorizationError(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new AuthenticationError('Token has expired'));
      }

      if (error.name === 'JsonWebTokenError') {
        return next(new AuthenticationError('Invalid token format'));
      }

      return next(error);
    }
  };
};

/**
 * Create the shared authentication context reused across backend modules.
 * @param {{ tokenService?: object, authMiddleware?: Function }} [options]
 * @returns {{ tokenService: object, authMiddleware: Function }}
 */
const createAuthContext = ({
  tokenService = createJwtTokenService(),
  authMiddleware = createAuthMiddleware({ tokenService }),
} = {}) => ({
  tokenService,
  authMiddleware,
});

/**
 * Resolve auth dependencies from the shared runtime when available.
 * @param {{ authContext?: { tokenService: object, authMiddleware: Function } }} [sharedRuntime]
 * @returns {{ tokenService: object, authMiddleware: Function }}
 */
const resolveAuthContext = (sharedRuntime) => sharedRuntime?.authContext || createAuthContext();

module.exports = {
  createAuthMiddleware,
  createAuthContext,
  resolveAuthContext,
};
