const { AuthenticationError, AuthorizationError } = require('@/utils/errorHandler');
const { createJwtTokenService } = require('./auth/tokenService');
const { isAdministrativeLoginRole, normalizeApplicationRole } = require('./roles');
const { enrichContextWithUser } = require('./requestContext');

const SESSION_REQUIRED_MESSAGE = 'Debes iniciar sesión para continuar.';
const SESSION_INVALID_MESSAGE = 'La sesión no es válida. Inicia sesión de nuevo.';
const SESSION_EXPIRED_MESSAGE = 'La sesión expiró. Inicia sesión de nuevo.';
const ADMIN_PLATFORM_ACCESS_MESSAGE = 'Esta cuenta no puede acceder a la plataforma administrativa.';

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
  if (typeof options === 'string') {
    return { roles: [options], permissions: [] };
  }
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

      let token;
      if (authHeader) {
        const [scheme, headerToken] = authHeader.split(' ');
        if (scheme !== 'Bearer' || !headerToken) {
          throw new AuthenticationError(SESSION_INVALID_MESSAGE);
        }
        token = headerToken;
      } else if (req.query?.access_token) {
        // EventSource (SSE) cannot set Authorization headers, so it passes the
        // bearer token as a query param instead.
        token = req.query.access_token;
      } else {
        throw new AuthenticationError(SESSION_REQUIRED_MESSAGE);
      }

      const user = tokenService.verify(token);
      const normalizedRole = normalizeApplicationRole(user?.role);

      if (!normalizedRole) {
        throw new AuthenticationError(SESSION_INVALID_MESSAGE);
      }

      if (!isAdministrativeLoginRole(normalizedRole)) {
        throw new AuthenticationError(ADMIN_PLATFORM_ACCESS_MESSAGE);
      }

      const authenticatedUser = {
        ...user,
        role: normalizedRole,
      };

      if (normalizedRoles.length > 0 && !normalizedRoles.includes(authenticatedUser.role)) {
        throw new AuthorizationError('No tienes acceso a esta sección.');
      }

      if (requiredPermissions.length > 0) {
        if (!permissionService || typeof permissionService.checkMultiple !== 'function') {
          // Fail closed: a route that declares permission requirements must never be
          // served when the permission service is missing/misconfigured, otherwise the
          // checks would be silently skipped and the route left unprotected.
          throw new Error('Permission service is not configured for a route that requires permissions');
        }
        const { denied } = await permissionService.checkMultiple(authenticatedUser, requiredPermissions);
        if (denied.length > 0) {
          const err = new AuthorizationError('No tienes permisos suficientes para realizar esta acción.');
          err.code = 'INSUFFICIENT_PERMISSION';
          throw err;
        }
      }

      req.user = authenticatedUser;
      enrichContextWithUser(authenticatedUser);
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new AuthenticationError(SESSION_EXPIRED_MESSAGE));
      }

      if (error.name === 'JsonWebTokenError') {
        return next(new AuthenticationError(SESSION_INVALID_MESSAGE));
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
