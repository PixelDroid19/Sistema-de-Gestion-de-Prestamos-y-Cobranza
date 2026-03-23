const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const ConfigEntry = sequelize.define('ConfigEntry', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  category: { type: DataTypes.STRING, allowNull: false },
  key: { type: DataTypes.STRING, allowNull: false },
  label: { type: DataTypes.STRING, allowNull: false },
  value: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['category', 'key'],
    },
  ],
});

module.exports = ConfigEntry;
