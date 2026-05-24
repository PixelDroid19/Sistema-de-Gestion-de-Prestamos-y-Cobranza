const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const AssociateInstallment = sequelize.define('AssociateInstallment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  associateId: { type: DataTypes.INTEGER, allowNull: false },
  installmentNumber: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  dueDate: { type: DataTypes.DATE, allowNull: false },
  capitalBase: { type: DataTypes.FLOAT, allowNull: true },
  interestRate: { type: DataTypes.DECIMAL(7, 4), allowNull: true },
  interestType: {
    type: DataTypes.ENUM('monthly', 'annual'),
    allowNull: true,
  },
  periodStartDate: { type: DataTypes.DATE, allowNull: true },
  periodEndDate: { type: DataTypes.DATE, allowNull: true },
  paymentMethod: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'overdue'),
    allowNull: false,
    defaultValue: 'pending',
  },
  paidAt: { type: DataTypes.DATE, allowNull: true },
  paidBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  timestamps: true,
});

module.exports = AssociateInstallment;
