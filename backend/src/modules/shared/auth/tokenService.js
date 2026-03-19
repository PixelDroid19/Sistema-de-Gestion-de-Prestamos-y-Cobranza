const jwt = require('jsonwebtoken');

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
