const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const DagSimulationSummary = sequelize.define('DagSimulationSummary', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  scopeKey: { type: DataTypes.STRING, allowNull: false },
  graphVersionId: { type: DataTypes.INTEGER, allowNull: true },
  createdByUserId: { type: DataTypes.INTEGER, allowNull: false },
  selectedSource: { type: DataTypes.STRING, allowNull: false, defaultValue: 'dag' },
  fallbackReason: { type: DataTypes.STRING, allowNull: true },
  simulationInput: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  summary: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  schedulePreview: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
}, {
  timestamps: true,
  indexes: [
    { fields: ['scopeKey', 'createdAt'] },
  ],
});

module.exports = DagSimulationSummary;
