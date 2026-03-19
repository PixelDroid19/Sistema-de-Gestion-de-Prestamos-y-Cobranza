const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  loanId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  paymentDate: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'completed', 'failed'), defaultValue: 'pending' },
  paymentType: { type: DataTypes.ENUM('installment', 'payoff'), allowNull: false, defaultValue: 'installment' },
  principalApplied: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  interestApplied: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  overpaymentAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  remainingBalanceAfterPayment: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  allocationBreakdown: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  paymentMetadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, {
  timestamps: true,
});

module.exports = Payment;
