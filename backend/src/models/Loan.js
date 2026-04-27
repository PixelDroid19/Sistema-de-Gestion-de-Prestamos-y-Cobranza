const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Loan = sequelize.define('Loan', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  customerId: { type: DataTypes.INTEGER, allowNull: false },
  associateId: { type: DataTypes.INTEGER, allowNull: true },
  financialProductId: { type: DataTypes.UUID, allowNull: true },
  dagGraphVersionId: { type: DataTypes.INTEGER, allowNull: true }, // FK to DagGraphVersion used for this loan's calculation
  calculationMethod: { type: DataTypes.STRING, allowNull: true }, // Method frozen from the formula result, e.g. FRENCH/SIMPLE/COMPOUND
  ratePolicyId: { type: DataTypes.INTEGER, allowNull: true }, // Configuration policy applied at origination, if any
  lateFeePolicyId: { type: DataTypes.INTEGER, allowNull: true }, // Late-fee policy applied at origination, if any
  policySnapshot: { type: DataTypes.JSONB, allowNull: true }, // Full immutable policy trace used for this loan
  amount: { type: DataTypes.FLOAT, allowNull: false, validate: { min: 0.01 } },
  interestRate: { type: DataTypes.FLOAT, allowNull: false, validate: { min: 0, max: 100 } },
  termMonths: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 360, isInt: true } },
  // status: 'pending', 'approved', 'rejected', 'active', 'overdue', 'paid', 'cancelled', 'closed', 'defaulted'
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'active', 'overdue', 'paid', 'cancelled', 'closed', 'defaulted'), defaultValue: 'pending' },
  startDate: { type: DataTypes.DATE },
  endDate: { type: DataTypes.DATE },
  emiSchedule: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }, // store EMI schedule as JSON
  installmentAmount: { type: DataTypes.FLOAT, allowNull: true, validate: { min: 0 } },
  totalPayable: { type: DataTypes.FLOAT, allowNull: true, validate: { min: 0 } },
  totalPaid: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, validate: { min: 0 } },
  principalOutstanding: { type: DataTypes.FLOAT, allowNull: true, validate: { min: 0 } },
  interestOutstanding: { type: DataTypes.FLOAT, allowNull: true, validate: { min: 0 } },
  lastPaymentDate: { type: DataTypes.DATE, allowNull: true },
  lateFeeMode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'NONE' },
  annualLateFeeRate: { type: DataTypes.FLOAT, allowNull: true, validate: { min: 0, max: 100 } }, // Annual late fee rate percentage (0-100)
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
  ],
  validate: {
    /** Ensure endDate is not before startDate when both are set. */
    endDateNotBeforeStartDate() {
      if (this.startDate && this.endDate) {
        if (new Date(this.endDate) < new Date(this.startDate)) {
          throw new Error('endDate must be on or after startDate');
        }
      }
    },
    /** Prevent semantically conflicting status/closureReason combinations. */
    consistentClosureState() {
      const { status, closureReason, closedAt } = this;
      const closedStatuses = new Set(['closed', 'cancelled', 'paid']);
      const closureReasons = new Set(['payoff', 'schedule_completion', 'annulled', 'cancelled']);

      if (closureReasons.has(closureReason) && !closedStatuses.has(status)) {
        throw new Error(`Loan with closureReason '${closureReason}' must have a closed status (closed, cancelled, or paid)`);
      }

      if (closedStatuses.has(status) && !closedAt) {
        throw new Error(`Loan with status '${status}' must have a closedAt date`);
      }
    },
  },
});

module.exports = Loan;
