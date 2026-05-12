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
  participationPercentage: { type: DataTypes.DECIMAL(7, 4), allowNull: true },
  interestType: {
    type: DataTypes.ENUM('monthly', 'annual'),
    allowNull: false,
    defaultValue: 'monthly',
  },
  interestRate: { type: DataTypes.DECIMAL(7, 4), allowNull: false, defaultValue: 0 },
  interestPaymentDay: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  interestPaymentMonth: { type: DataTypes.INTEGER, allowNull: true },
  interestStartsAt: { type: DataTypes.DATEONLY, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  timestamps: true,
});

module.exports = Associate;
