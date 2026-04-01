const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  loanId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  paymentDate: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'completed', 'failed', 'annulled'), defaultValue: 'pending' },
  // paymentType: 'installment' (regular EMI), 'payoff' (total close), 'partial' (free amount), 'capital' (debt reduction)
  paymentType: { type: DataTypes.ENUM('installment', 'payoff', 'partial', 'capital'), allowNull: false, defaultValue: 'installment' },
  principalApplied: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  interestApplied: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  penaltyApplied: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 }, // Late fee/penalty portion
  overpaymentAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  remainingBalanceAfterPayment: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  allocationBreakdown: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  paymentMetadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  paymentMethod: { type: DataTypes.STRING, allowNull: true }, // Payment method used (e.g., 'cash', 'transfer', 'card')
  installmentNumber: { type: DataTypes.INTEGER, allowNull: true }, // For installment payments
  annulledFromInstallment: { type: DataTypes.INTEGER, allowNull: true }, // For annulled payments, reference to original installment
}, {
  timestamps: true,
});

module.exports = Payment;
