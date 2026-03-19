const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Loan = sequelize.define('Loan', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  customerId: { type: DataTypes.INTEGER, allowNull: false },
  associateId: { type: DataTypes.INTEGER, allowNull: true },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  interestRate: { type: DataTypes.FLOAT, allowNull: false },
  termMonths: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'active', 'closed', 'defaulted'), defaultValue: 'pending' },
  startDate: { type: DataTypes.DATE },
  endDate: { type: DataTypes.DATE },
  agentId: { type: DataTypes.INTEGER, allowNull: true }, // assigned agent for recovery
  emiSchedule: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }, // store EMI schedule as JSON
  installmentAmount: { type: DataTypes.FLOAT, allowNull: true },
  totalPayable: { type: DataTypes.FLOAT, allowNull: true },
  totalPaid: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  principalOutstanding: { type: DataTypes.FLOAT, allowNull: true },
  interestOutstanding: { type: DataTypes.FLOAT, allowNull: true },
  lastPaymentDate: { type: DataTypes.DATE, allowNull: true },
  lateFeeMode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'NONE' },
  financialSnapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  recoveryStatus: { type: DataTypes.STRING, allowNull: true }, // e.g. 'pending', 'in-progress', 'recovered'
}, {
  timestamps: true,
});

module.exports = Loan;
