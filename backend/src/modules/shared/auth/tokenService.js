const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { AuthenticationError } = require('@/utils/errorHandler');
const { normalizeApplicationRole } = require('@/modules/shared/roles');

// Access token expiry: 15 minutes
const ACCESS_TOKEN_EXPIRY = '15m';

// Refresh token expiry: 7 days
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const INVALID_REFRESH_TOKEN_MESSAGE = 'La sesión no es válida o expiró. Inicia sesión de nuevo.';

const normalizeTokenPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new AuthenticationError('La sesión no es válida. Inicia sesión de nuevo.');
  }

  const normalizedRole = normalizeApplicationRole(payload.role);
  if (!normalizedRole) {
    throw new AuthenticationError('La sesión no es válida. Inicia sesión de nuevo.');
  }

  return {
    ...payload,
    role: normalizedRole,
  };
};

/**
 * Create the JWT token service used by backend auth seams.
 * @param {{ secret?: string, expiresIn?: string, refreshTokenRepository?: object }} [options]
 * @returns {{ sign: Function, verify: Function, generateAccessToken: Function, generateRefreshToken: Function, generateTokenPair: Function, verifyRefreshToken: Function }}
 */
const createJwtTokenService = ({ 
  secret = process.env.JWT_SECRET, 
  expiresIn = '24h',
  refreshTokenRepository = null,
} = {}) => ({
  /**
   * Generate an access token (JWT) with 15-minute expiry.
   * @param {number} userId
   * @param {string|string[]} roles
   * @returns {string} JWT access token
   */
  generateAccessToken(userId, roles, extraPayload = {}) {
    const payload = {
      id: userId,
      role: Array.isArray(roles) ? roles[0] : roles,
      ...extraPayload,
      type: 'access',
    };
    return jwt.sign(normalizeTokenPayload(payload), secret, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      algorithm: 'HS256',
    });
  },

  /**
   * Generate a secure random refresh token.
   * @returns {string} 64-character hex string
   */
  generateRefreshToken() {
    return crypto.randomBytes(32).toString('hex');
  },

  /**
   * Generate both access and refresh tokens.
   * @param {number} userId
   * @param {string|string[]} roles
   * @returns {{ accessToken: string, refreshToken: string }}
   */
  generateTokenPair(userId, roles, extraPayload = {}) {
    return {
      accessToken: this.generateAccessToken(userId, roles, extraPayload),
      refreshToken: this.generateRefreshToken(),
    };
  },

  /**
   * Verify and validate a refresh token.
   * Looks up the token hash in the repository and checks expiry and revocation status.
   * @param {string} token - The plain text refresh token
   * @returns {{ userId: number, tokenId: string }} Token metadata if valid
   * @throws {AuthenticationError} If token is invalid, expired, or revoked
   */
  async verifyRefreshToken(token) {
    if (!refreshTokenRepository) {
      throw new Error('Refresh token repository not configured');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const storedToken = await refreshTokenRepository.findByTokenHash(tokenHash);

    if (!storedToken) {
      throw new AuthenticationError(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    // Check if revoked
    if (storedToken.revokedAt) {
      throw new AuthenticationError(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    // Check if expired
    if (new Date(storedToken.expiresAt) < new Date()) {
      throw new AuthenticationError(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    return {
      userId: storedToken.userId,
      tokenId: storedToken.id,
    };
  },

  /** Sign an access-token compatible JWT for auth adapters and tests. */
  sign(payload) {
    return jwt.sign(normalizeTokenPayload(payload), secret, { 
      expiresIn,
      algorithm: 'HS256',
    });
  },

  /** Verify an access-token compatible JWT for auth middleware. */
  verify(token) {
    return normalizeTokenPayload(jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }));
  },
});

/**
 * Hash a refresh token using SHA-256.
 * @param {string} token
 * @returns {string}
 */
const hashRefreshToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Calculate expiry date for a refresh token.
 * @param {number} days - Number of days until expiry
 * @returns {Date}
 */
const calculateRefreshTokenExpiry = (days = REFRESH_TOKEN_EXPIRY_DAYS) => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate;
};

module.exports = {
  createJwtTokenService,
  hashRefreshToken,
  calculateRefreshTokenExpiry,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
};
