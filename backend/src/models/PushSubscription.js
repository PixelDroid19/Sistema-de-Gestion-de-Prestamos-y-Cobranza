const { DataTypes, Op } = require('sequelize');
const sequelize = require('./database');

const PushSubscription = sequelize.define('PushSubscription', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  providerKey: { type: DataTypes.STRING, allowNull: false },
  channel: { type: DataTypes.ENUM('web', 'mobile'), allowNull: false },
  endpoint: { type: DataTypes.TEXT, allowNull: true },
  endpointHash: { type: DataTypes.STRING(64), allowNull: true },
  deviceToken: { type: DataTypes.TEXT, allowNull: true },
  tokenHash: { type: DataTypes.STRING(64), allowNull: true },
  subscription: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'expired'),
    allowNull: false,
    defaultValue: 'active',
  },
  lastDeliveredAt: { type: DataTypes.DATE, allowNull: true },
  lastFailureAt: { type: DataTypes.DATE, allowNull: true },
  invalidatedAt: { type: DataTypes.DATE, allowNull: true },
  failureReason: { type: DataTypes.TEXT, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'providerKey', 'endpointHash'],
      where: {
        endpointHash: {
          [Op.ne]: null,
        },
      },
    },
    {
      unique: true,
      fields: ['userId', 'providerKey', 'tokenHash'],
      where: {
        tokenHash: {
          [Op.ne]: null,
        },
      },
    },
  ],
});

module.exports = PushSubscription;
