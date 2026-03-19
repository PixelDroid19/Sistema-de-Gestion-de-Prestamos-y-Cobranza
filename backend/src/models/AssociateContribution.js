const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const AssociateContribution = sequelize.define('AssociateContribution', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  associateId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  contributionDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  timestamps: true,
});

module.exports = AssociateContribution;
