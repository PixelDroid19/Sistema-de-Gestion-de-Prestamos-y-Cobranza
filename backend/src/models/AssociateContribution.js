const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const AssociateContribution = sequelize.define('AssociateContribution', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  associateId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  contributionDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'completed' },
  interestTypeSnapshot: {
    type: DataTypes.ENUM('monthly', 'annual'),
    allowNull: true,
  },
  interestRateSnapshot: { type: DataTypes.DECIMAL(7, 4), allowNull: true },
  createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  timestamps: true,
});

module.exports = AssociateContribution;
