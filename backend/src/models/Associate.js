const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Associate = sequelize.define('Associate', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  phone: { type: DataTypes.STRING, allowNull: false, unique: true },
  address: { type: DataTypes.STRING, allowNull: true },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active',
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  timestamps: true,
});

module.exports = Associate;
