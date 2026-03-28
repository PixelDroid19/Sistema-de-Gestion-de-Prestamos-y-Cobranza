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
    return jwt.sign(normalizeTokenPayload(payload), secret, { 
      expiresIn,
      algorithm: 'HS256', // Explicitly specify the signing algorithm
    });
  },
  verify(token) {
    // Explicitly specify allowed algorithms to prevent algorithm confusion attacks
    // This prevents attackers from crafting tokens with 'none' algorithm or using HS256/HS384/HS512 interchangeably
    return normalizeTokenPayload(jwt.verify(token, secret, {
      algorithms: ['HS256'], // Only allow HS256 - reject 'none', 'HS384', 'HS512', 'RS256', etc.
    }));
  },
});

module.exports = {
  createJwtTokenService,
};
