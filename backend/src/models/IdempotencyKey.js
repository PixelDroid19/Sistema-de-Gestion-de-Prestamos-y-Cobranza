const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const IdempotencyKey = sequelize.define('IdempotencyKey', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  scope: { type: DataTypes.STRING, allowNull: false },
  createdByUserId: { type: DataTypes.INTEGER, allowNull: false },
  idempotencyKey: { type: DataTypes.STRING(160), allowNull: false },
  requestHash: { type: DataTypes.STRING(64), allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
  responsePayload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, {
  timestamps: true,
  indexes: [
    // Unique constraint per scope + idempotency key (prevents cross-user TOCTOU race condition)
    {
      unique: true,
      fields: ['scope', 'idempotencyKey'],
    },
    // Secondary index for user-specific lookups
    {
      fields: ['scope', 'createdByUserId', 'idempotencyKey'],
    },
    {
      fields: ['status'],
    },
  ],
});

module.exports = IdempotencyKey;
