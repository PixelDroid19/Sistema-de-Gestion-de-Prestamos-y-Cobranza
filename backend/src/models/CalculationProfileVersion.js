const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const CalculationProfileVersion = sequelize.define('CalculationProfileVersion', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  scopeKey: { type: DataTypes.STRING(120), allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
  calculationMethod: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'FRENCH' },
  parameters: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  rules: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  formulaSet: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  changelog: { type: DataTypes.STRING(1000), allowNull: true },
  createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  timestamps: true,
  indexes: [
    { fields: ['scopeKey', 'version'], unique: true },
    {
      fields: ['scopeKey', 'status'],
      unique: true,
      where: { status: 'active' },
      name: 'calculation_profile_versions_scope_active_unique',
    },
  ],
});

module.exports = CalculationProfileVersion;
