'use strict';

const { DataTypes } = require('sequelize');

// Money columns become DECIMAL(15,2) and rate columns DECIMAL(7,4) so DB-side
// aggregation (SUM/AVG in reports) is exact instead of accumulating binary FLOAT
// drift. Postgres implicitly casts double precision -> numeric, so no USING clause
// is needed. Each entry carries its allowNull/defaultValue so changeColumn does not
// drop the existing NOT NULL / default constraints.
const MONEY = { precision: 15, scale: 2 };
const RATE = { precision: 7, scale: 4 };

const COLUMNS = [
  { table: 'Loans', column: 'amount', kind: MONEY, allowNull: false },
  { table: 'Loans', column: 'interestRate', kind: RATE, allowNull: false },
  { table: 'Loans', column: 'installmentAmount', kind: MONEY, allowNull: true },
  { table: 'Loans', column: 'totalPayable', kind: MONEY, allowNull: true },
  { table: 'Loans', column: 'totalPaid', kind: MONEY, allowNull: false, defaultValue: 0 },
  { table: 'Loans', column: 'principalOutstanding', kind: MONEY, allowNull: true },
  { table: 'Loans', column: 'interestOutstanding', kind: MONEY, allowNull: true },
  { table: 'Loans', column: 'annualLateFeeRate', kind: RATE, allowNull: true },

  { table: 'Payments', column: 'amount', kind: MONEY, allowNull: false },
  { table: 'Payments', column: 'principalApplied', kind: MONEY, allowNull: false, defaultValue: 0 },
  { table: 'Payments', column: 'interestApplied', kind: MONEY, allowNull: false, defaultValue: 0 },
  { table: 'Payments', column: 'penaltyApplied', kind: MONEY, allowNull: false, defaultValue: 0 },
  { table: 'Payments', column: 'overpaymentAmount', kind: MONEY, allowNull: false, defaultValue: 0 },
  { table: 'Payments', column: 'remainingBalanceAfterPayment', kind: MONEY, allowNull: false, defaultValue: 0 },

  { table: 'AssociateContributions', column: 'amount', kind: MONEY, allowNull: false },

  { table: 'LoanAlerts', column: 'scheduledAmount', kind: MONEY, allowNull: false, defaultValue: 0 },
  { table: 'LoanAlerts', column: 'outstandingAmount', kind: MONEY, allowNull: false, defaultValue: 0 },

  { table: 'OperatingExpenses', column: 'amount', kind: MONEY, allowNull: false },

  { table: 'ProfitDistributions', column: 'amount', kind: MONEY, allowNull: false },

  { table: 'PromiseToPays', column: 'amount', kind: MONEY, allowNull: false },

  { table: 'AssociateInstallments', column: 'amount', kind: MONEY, allowNull: false },
  { table: 'AssociateInstallments', column: 'capitalBase', kind: MONEY, allowNull: true },

  { table: 'FinancialProducts', column: 'interestRate', kind: RATE, allowNull: true },
  { table: 'FinancialProducts', column: 'penaltyRate', kind: RATE, allowNull: true, defaultValue: 0 },
];

const buildAttribute = (entry, type) => {
  const attribute = { type, allowNull: entry.allowNull };
  if (Object.prototype.hasOwnProperty.call(entry, 'defaultValue')) {
    attribute.defaultValue = entry.defaultValue;
  }
  return attribute;
};

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const entry of COLUMNS) {
        await queryInterface.changeColumn(
          entry.table,
          entry.column,
          buildAttribute(entry, DataTypes.DECIMAL(entry.kind.precision, entry.kind.scale)),
          { transaction },
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const entry of COLUMNS) {
        await queryInterface.changeColumn(
          entry.table,
          entry.column,
          buildAttribute(entry, DataTypes.FLOAT),
          { transaction },
        );
      }
    });
  },
};
