const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const AssociateInstallment = sequelize.define('AssociateInstallment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  associateId: { type: DataTypes.INTEGER, allowNull: false },
  installmentNumber: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  dueDate: { type: DataTypes.DATE, allowNull: false },
  status: {
    type: DataTypes.ENUM('pending', 'paid'),
    allowNull: false,
    defaultValue: 'pending',
  },
  paidAt: { type: DataTypes.DATE, allowNull: true },
  paidBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  timestamps: true,
});

module.exports = AssociateInstallment;
