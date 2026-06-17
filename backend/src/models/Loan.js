const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const { moneyColumn, rateColumn } = require('./columnTypes');
const { assertEndDateNotBeforeStartDate, assertConsistentClosureState } = require('@/modules/credits/domain/loanInvariants');

const Loan = sequelize.define('Loan', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  customerId: { type: DataTypes.INTEGER, allowNull: false },
  associateId: { type: DataTypes.INTEGER, allowNull: true },
  financialProductId: { type: DataTypes.UUID, allowNull: true },
  calculationProfileVersionId: { type: DataTypes.INTEGER, allowNull: true },
  calculationMethod: { type: DataTypes.STRING, allowNull: true }, // Method frozen from the formula result, e.g. FRENCH/SIMPLE/COMPOUND
  ratePolicyId: { type: DataTypes.INTEGER, allowNull: true }, // Configuration policy applied at origination, if any
  lateFeePolicyId: { type: DataTypes.INTEGER, allowNull: true }, // Late-fee policy applied at origination, if any
  policySnapshot: { type: DataTypes.JSONB, allowNull: true }, // Full immutable policy trace used for this loan
  amount: moneyColumn('amount', { allowNull: false, validate: { min: 0.01 } }),
  interestRate: rateColumn('interestRate', { allowNull: false, validate: { min: 0, max: 100 } }),
  termMonths: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 360, isInt: true } },
  // status: 'pending', 'approved', 'rejected', 'active', 'overdue', 'paid', 'cancelled', 'closed', 'defaulted'
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'active', 'overdue', 'paid', 'cancelled', 'closed', 'defaulted'), defaultValue: 'pending' },
  startDate: { type: DataTypes.DATE },
  endDate: { type: DataTypes.DATE },
  emiSchedule: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }, // store EMI schedule as JSON
  installmentAmount: moneyColumn('installmentAmount', { allowNull: true, validate: { min: 0 } }),
  totalPayable: moneyColumn('totalPayable', { allowNull: true, validate: { min: 0 } }),
  totalPaid: moneyColumn('totalPaid', { allowNull: false, defaultValue: 0, validate: { min: 0 } }),
  principalOutstanding: moneyColumn('principalOutstanding', { allowNull: true, validate: { min: 0 } }),
  interestOutstanding: moneyColumn('interestOutstanding', { allowNull: true, validate: { min: 0 } }),
  lastPaymentDate: { type: DataTypes.DATE, allowNull: true },
  lateFeeMode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'NONE' },
  annualLateFeeRate: rateColumn('annualLateFeeRate', { allowNull: true, validate: { min: 0, max: 100 } }), // Annual late fee rate percentage (0-100)
  financialSnapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  financialBlock: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  closedAt: { type: DataTypes.DATE, allowNull: true },
  // closureReason: 'payoff', 'schedule_completion', 'annulled', 'cancelled'
  closureReason: { type: DataTypes.ENUM('payoff', 'schedule_completion', 'annulled', 'cancelled'), allowNull: true },
  recoveryStatus: { type: DataTypes.STRING, allowNull: true }, // e.g. 'pending', 'in-progress', 'recovered'
}, {
  timestamps: true,
  indexes: [
    { fields: ['customerId'] },
    { fields: ['associateId'] },
    { fields: ['status'] },
    { fields: ['customerId', 'status'] },
    { fields: ['startDate'] },
    { fields: ['financialProductId'] },
    { fields: ['calculationProfileVersionId'] },
  ],
  validate: {
    /** Ensure endDate is not before startDate when both are set. */
    endDateNotBeforeStartDate() {
      assertEndDateNotBeforeStartDate(this);
    },
    /** Prevent semantically conflicting status/closureReason combinations. */
    consistentClosureState() {
      assertConsistentClosureState(this);
    },
  },
});

module.exports = Loan;
