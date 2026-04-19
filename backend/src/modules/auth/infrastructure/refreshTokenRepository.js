const RefreshToken = require('@/models/RefreshToken');

/**
 * Repository for managing refresh tokens in the database.
 */
const refreshTokenRepository = {
  /**
   * Create a new refresh token record.
   * @param {{ tokenHash: string, userId: number, expiresAt: Date }} data
   * @returns {Promise<RefreshToken>}
   */
  async create({ tokenHash, userId, expiresAt }) {
    return RefreshToken.create({
      tokenHash,
      userId,
      expiresAt,
      revokedAt: null,
    });
  },

  /**
   * Find a refresh token by its hash.
   * @param {string} tokenHash - SHA-256 hash of the token
   * @returns {Promise<RefreshToken|null>}
   */
  findByTokenHash(tokenHash) {
    return RefreshToken.findOne({ where: { tokenHash } });
  },

  /**
   * Find all refresh tokens for a specific user.
   * @param {number} userId
   * @returns {Promise<RefreshToken[]>}
   */
  findByUserId(userId) {
    return RefreshToken.findAll({ where: { userId } });
  },

  /**
   * Revoke a refresh token by setting revokedAt to now.
   * @param {string} tokenHash - SHA-256 hash of the token
   * @returns {Promise<RefreshToken|null>}
   */
  async revoke(tokenHash) {
    const token = await RefreshToken.findOne({ where: { tokenHash } });
    if (!token) {
      return null;
    }
    await token.update({ revokedAt: new Date() });
    return token;
  },

  /**
   * Revoke all refresh tokens for a specific user.
   * @param {number} userId
   * @returns {Promise<number>} Number of tokens revoked
   */
  async revokeAllForUser(userId) {
    const [updatedCount] = await RefreshToken.update(
      { revokedAt: new Date() },
      {
        where: {
          userId,
          revokedAt: null,
        },
      }
    );
    return updatedCount;
  },

  /**
   * Delete all revoked tokens older than a certain date (cleanup).
   * @param {Date} beforeDate
   * @returns {Promise<number>} Number of tokens deleted
   */
  async deleteRevokedBefore(beforeDate) {
    const deletedCount = await RefreshToken.destroy({
      where: {
        revokedAt: {
          [require('sequelize').Op.lt]: beforeDate,
        },
      },
    });
    return deletedCount;
  },
};

module.exports = {
  refreshTokenRepository,
};
