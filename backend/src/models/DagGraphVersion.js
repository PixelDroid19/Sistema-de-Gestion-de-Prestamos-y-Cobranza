const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const DagGraphVersion = sequelize.define('DagGraphVersion', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  scopeKey: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Untitled DAG Graph' },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  graph: { type: DataTypes.JSONB, allowNull: false, defaultValue: { nodes: [], edges: [] } },
  graphSummary: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  validation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  createdByUserId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  timestamps: true,
  indexes: [
    { fields: ['scopeKey', 'version'], unique: true },
  ],
});

module.exports = DagGraphVersion;
