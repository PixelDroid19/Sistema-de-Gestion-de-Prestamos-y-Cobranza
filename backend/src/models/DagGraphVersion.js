const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const DagGraphVersion = sequelize.define('DagGraphVersion', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  scopeKey: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Untitled DAG Graph' },
  description: { type: DataTypes.STRING(500), allowNull: true },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' }, // active, inactive, archived
  graph: { type: DataTypes.JSONB, allowNull: false, defaultValue: { nodes: [], edges: [] } },
  graphSummary: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  validation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
  commitMessage: { type: DataTypes.STRING(500), allowNull: true },
  authorName: { type: DataTypes.STRING(100), allowNull: true },
  authorEmail: { type: DataTypes.STRING(255), allowNull: true },
  restoredFromVersionId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  timestamps: true,
  indexes: [
    { fields: ['scopeKey', 'version'], unique: true },
    { fields: ['scopeKey', 'status'] },
  ],
});

module.exports = DagGraphVersion;
