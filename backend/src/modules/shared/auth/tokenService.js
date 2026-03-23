const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('../../../utils/errorHandler');
const { normalizeApplicationRole } = require('../roles');

const normalizeTokenPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new AuthenticationError('Invalid token payload');
  }

  const normalizedRole = normalizeApplicationRole(payload.role);
  if (!normalizedRole) {
    throw new AuthenticationError('Token contains an unsupported application role');
  }

  return {
    ...payload,
    role: normalizedRole,
  };
};

/**
 * Create the JWT token service used by backend auth seams.
 * @param {{ secret?: string, expiresIn?: string }} [options]
 * @returns {{ sign: Function, verify: Function }}
 */
const createJwtTokenService = ({ secret = process.env.JWT_SECRET, expiresIn = '24h' } = {}) => ({
  sign(payload) {
    return jwt.sign(normalizeTokenPayload(payload), secret, { expiresIn });
  },
  verify(token) {
    return normalizeTokenPayload(jwt.verify(token, secret));
  },
});

module.exports = {
  createJwtTokenService,
};
