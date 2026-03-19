const jwt = require('jsonwebtoken');

/**
 * Create the JWT token service used by backend auth seams.
 * @param {{ secret?: string, expiresIn?: string }} [options]
 * @returns {{ sign: Function, verify: Function }}
 */
const createJwtTokenService = ({ secret = process.env.JWT_SECRET, expiresIn = '24h' } = {}) => ({
  sign(payload) {
    return jwt.sign(payload, secret, { expiresIn });
  },
  verify(token) {
    return jwt.verify(token, secret);
  },
});

module.exports = {
  createJwtTokenService,
};
