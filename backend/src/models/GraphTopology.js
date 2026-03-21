const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const GraphTopology = sequelize.define('GraphTopology', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  nodes: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  edges: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
}, {
  timestamps: true,
  indexes: [
    { fields: ['productId', 'version'], unique: true },
  ],
});

module.exports = GraphTopology;
