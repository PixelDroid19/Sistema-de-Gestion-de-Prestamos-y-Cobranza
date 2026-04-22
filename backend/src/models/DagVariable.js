const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const DagVariable = sequelize.define('DagVariable', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  type: {
    type: DataTypes.ENUM('integer', 'currency', 'boolean', 'float'),
    allowNull: false,
  },
  source: {
    type: DataTypes.ENUM('bureau_api', 'app_data', 'system_core'),
    allowNull: false,
  },
  description: { type: DataTypes.STRING(500), allowNull: true },
  status: {
    type: DataTypes.ENUM('active', 'idle', 'deprecated'),
    allowNull: false,
    defaultValue: 'active',
  },
  usageCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  timestamps: true,
  indexes: [
    { fields: ['type'] },
    { fields: ['source'] },
    { fields: ['status'] },
  ],
});

module.exports = DagVariable;
