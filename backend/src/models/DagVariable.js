const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const DagVariable = sequelize.define('DagVariable', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  type: { type: DataTypes.ENUM('integer', 'currency', 'boolean', 'percent'), allowNull: false },
  source: { type: DataTypes.ENUM('bureau_api', 'app_data', 'system_core'), allowNull: false },
  value: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.ENUM('active', 'idle', 'deprecated'), defaultValue: 'active' },
  description: { type: DataTypes.STRING(500), allowNull: true },
  createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  timestamps: true,
});

module.exports = DagVariable;
