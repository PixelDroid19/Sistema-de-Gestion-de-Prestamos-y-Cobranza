const { AuthenticationError, AuthorizationError } = require('@/utils/errorHandler');
const { createJwtTokenService } = require('./auth/tokenService');
const { normalizeApplicationRole } = require('./roles');

const normalizeRoles = (roles = []) => {
  const requestedRoles = typeof roles === 'string' ? [roles] : roles;

  return [...new Set(requestedRoles.map((role) => {
    const normalizedRole = normalizeApplicationRole(role);

    if (!normalizedRole) {
      throw new Error(`Unsupported role policy requested: ${role}`);
    }

    return normalizedRole;
  }))];
};

const normalizeOptions = (options = []) => {
  if (Array.isArray(options)) {
    return { roles: options, permissions: [] };
  }
  return {
    roles: options.roles || [],
    permissions: options.permissions || [],
  };
};

/**
 * Create role-aware authentication middleware backed by a token verification service.
 * @param {{ tokenService: { verify: Function }, permissionService?: { check: Function, checkMultiple: Function } }} dependencies
 * @returns {(options?: string|string[]|{roles?: string[], permissions?: string[]}) => import('express').RequestHandler}
 */
const createAuthMiddleware = ({ tokenService, permissionService }) => (options = []) => {
  const { roles: requiredRoles, permissions: requiredPermissions } = normalizeOptions(options);
  const normalizedRoles = normalizeRoles(requiredRoles);

  return async (req, res, next) => {
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
      const normalizedRole = normalizeApplicationRole(user?.role);

      if (!normalizedRole) {
        throw new AuthenticationError('Token contains an unsupported application role');
      }

      const authenticatedUser = {
        ...user,
        role: normalizedRole,
      };

      if (normalizedRoles.length > 0 && !normalizedRoles.includes(authenticatedUser.role)) {
        throw new AuthorizationError(`Access denied. Required roles: ${normalizedRoles.join(', ')}`);
      }

      if (requiredPermissions.length > 0 && permissionService) {
        const { denied } = await permissionService.checkMultiple(authenticatedUser, requiredPermissions);
        if (denied.length > 0) {
          const err = new AuthorizationError(`Insufficient permissions. Denied: ${denied.join(', ')}`);
          err.code = 'INSUFFICIENT_PERMISSION';
          throw err;
        }
      }

      req.user = authenticatedUser;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new AuthenticationError('Token has expired'));
      }

      if (error.name === 'JsonWebTokenError') {
        return next(new AuthenticationError('Invalid token format'));
      }

      if (error.code === 'INSUFFICIENT_PERMISSION') {
        return next(error);
      }

      return next(error);
    }
  };
};

/**
 * Create the shared authentication context reused across backend modules.
 * @param {{ tokenService?: object, permissionService?: object, authMiddleware?: Function }} [options]
 * @returns {{ tokenService: object, permissionService?: object, authMiddleware: Function }}
 */
const createAuthContext = ({
  tokenService = createJwtTokenService(),
  permissionService = null,
  authMiddleware = createAuthMiddleware({ tokenService, permissionService }),
} = {}) => ({
  tokenService,
  permissionService,
  authMiddleware,
});

/**
 * Resolve auth dependencies from the shared runtime when available.
 * @param {{ authContext?: { tokenService: object, permissionService?: object, authMiddleware: Function } }} [sharedRuntime]
 * @returns {{ tokenService: object, permissionService?: object, authMiddleware: Function }}
 */
const resolveAuthContext = (sharedRuntime) => sharedRuntime?.authContext || createAuthContext();

module.exports = {
  createAuthMiddleware,
  createAuthContext,
  resolveAuthContext,
};
