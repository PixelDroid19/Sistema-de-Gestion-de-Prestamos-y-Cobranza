const { AuthenticationError, AuthorizationError } = require('../../utils/errorHandler');

const normalizeRoles = (roles = []) => (typeof roles === 'string' ? [roles] : roles);

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

module.exports = {
  createAuthMiddleware,
};
