const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  loanId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false, validate: { min: 0.01 } },
  paymentDate: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'completed', 'failed', 'annulled'), defaultValue: 'pending' },
  // paymentType: 'installment' (regular EMI), 'payoff' (total close), 'partial' (free amount), 'capital' (debt reduction)
  paymentType: { type: DataTypes.ENUM('installment', 'payoff', 'partial', 'capital'), allowNull: false, defaultValue: 'installment' },
  principalApplied: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, validate: { min: 0 } },
  interestApplied: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, validate: { min: 0 } },
  penaltyApplied: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, validate: { min: 0 } }, // Late fee/penalty portion
  overpaymentAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, validate: { min: 0 } },
  remainingBalanceAfterPayment: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, validate: { min: 0 } },
  allocationBreakdown: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  paymentMetadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  paymentMethod: { type: DataTypes.STRING, allowNull: true }, // Payment method used (e.g., 'cash', 'transfer', 'card')
  installmentNumber: { type: DataTypes.INTEGER, allowNull: true }, // For installment payments
  annulledFromInstallment: { type: DataTypes.INTEGER, allowNull: true }, // For annulled payments, reference to original installment
}, {
  timestamps: true,
  indexes: [
    { fields: ['loanId'] },
    { fields: ['paymentDate'] },
    { fields: ['status'] },
    { fields: ['paymentType'] },
    { fields: ['loanId', 'installmentNumber'] },
  ],
  validate: {
    /** Ensure allocation fields sum approximately to the payment amount (within rounding tolerance). */
    allocationIntegrity() {
      const { amount, principalApplied, interestApplied, penaltyApplied, overpaymentAmount } = this;
      if (amount == null || amount <= 0) return; // Skip if amount is invalid

      const allocatedTotal = Number(principalApplied || 0)
        + Number(interestApplied || 0)
        + Number(penaltyApplied || 0)
        + Number(overpaymentAmount || 0);

      // Allow 0.02 rounding tolerance for floating-point precision
      if (Math.abs(allocatedTotal - amount) > 0.02) {
        throw new Error(
          `Allocation breakdown (${allocatedTotal.toFixed(2)}) does not match payment amount (${amount.toFixed(2)}). `
          + `principalApplied=${principalApplied}, interestApplied=${interestApplied}, penaltyApplied=${penaltyApplied}, overpaymentAmount=${overpaymentAmount}`
        );
      }
    },
  },
});

module.exports = Payment;
