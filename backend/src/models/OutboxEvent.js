const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const OutboxEvent = sequelize.define('OutboxEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  aggregateType: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  aggregateId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  eventType: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  payload: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'PENDING',
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  indexes: [
    { fields: ['status', 'createdAt'] },
  ],
});

module.exports = OutboxEvent;
