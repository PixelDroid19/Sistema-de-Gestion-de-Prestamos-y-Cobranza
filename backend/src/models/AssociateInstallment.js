const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const { moneyColumn } = require('./columnTypes');

const AssociateInstallment = sequelize.define('AssociateInstallment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  associateId: { type: DataTypes.INTEGER, allowNull: false },
  installmentNumber: { type: DataTypes.INTEGER, allowNull: false },
  amount: moneyColumn('amount', { allowNull: false }),
  dueDate: { type: DataTypes.DATE, allowNull: false },
  capitalBase: moneyColumn('capitalBase', { allowNull: true }),
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
  indexes: [
    {
      unique: true,
      fields: ['associateId', 'installmentNumber'],
      name: 'associate_installments_associate_number_unique',
    },
  ],
});

module.exports = AssociateInstallment;
