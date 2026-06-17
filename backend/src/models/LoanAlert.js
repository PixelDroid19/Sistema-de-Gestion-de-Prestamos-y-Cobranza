const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const { moneyColumn } = require('./columnTypes');

const LoanAlert = sequelize.define('LoanAlert', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  loanId: { type: DataTypes.INTEGER, allowNull: false },
  installmentNumber: { type: DataTypes.INTEGER, allowNull: false },
  alertType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'overdue_installment' },
  dueDate: { type: DataTypes.DATE, allowNull: false },
  scheduledAmount: moneyColumn('scheduledAmount', { allowNull: false, defaultValue: 0 }),
  outstandingAmount: moneyColumn('outstandingAmount', { allowNull: false, defaultValue: 0 }),
  status: { type: DataTypes.ENUM('active', 'resolved'), allowNull: false, defaultValue: 'active' },
  resolutionSource: { type: DataTypes.STRING, allowNull: true },
  resolvedAt: { type: DataTypes.DATE, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  timestamps: true,
});

module.exports = LoanAlert;
