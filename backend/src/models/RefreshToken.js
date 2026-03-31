const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const crypto = require('crypto');

const RefreshToken = sequelize.define('RefreshToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tokenHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
  tableName: 'refresh_tokens',
});

/**
 * Hash a refresh token using SHA-256.
 * @param {string} token - The plain text refresh token
 * @returns {string} The SHA-256 hash of the token
 */
RefreshToken.hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

module.exports = RefreshToken;
