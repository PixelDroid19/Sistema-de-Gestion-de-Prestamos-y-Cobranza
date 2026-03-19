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
    {
      unique: true,
      fields: ['scope', 'createdByUserId', 'idempotencyKey'],
    },
  ],
});

module.exports = IdempotencyKey;
