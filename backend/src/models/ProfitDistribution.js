const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const ProfitDistribution = sequelize.define('ProfitDistribution', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  associateId: { type: DataTypes.INTEGER, allowNull: false },
  loanId: { type: DataTypes.INTEGER, allowNull: true },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  distributionDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  basis: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, {
  timestamps: true,
});

module.exports = ProfitDistribution;
