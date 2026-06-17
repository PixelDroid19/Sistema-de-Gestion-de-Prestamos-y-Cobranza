const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const { rateColumn } = require('./columnTypes');

const FinancialProduct = sequelize.define('FinancialProduct', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  interestRate: rateColumn('interestRate', {
    allowNull: true,
  }),
  termMonths: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  lateFeeMode: {
    type: DataTypes.STRING(20),
    defaultValue: 'NONE',
  },
  penaltyRate: rateColumn('penaltyRate', {
    defaultValue: 0,
  }),
}, {
  timestamps: true,
});

module.exports = FinancialProduct;
