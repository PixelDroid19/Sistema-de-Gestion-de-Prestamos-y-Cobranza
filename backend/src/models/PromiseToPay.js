const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const PromiseToPay = sequelize.define('PromiseToPay', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  loanId: { type: DataTypes.INTEGER, allowNull: false },
  createdByUserId: { type: DataTypes.INTEGER, allowNull: false },
  promisedDate: { type: DataTypes.DATE, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'kept', 'broken', 'cancelled'), allowNull: false, defaultValue: 'pending' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  statusHistory: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  lastStatusChangedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  fulfilledPaymentId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  timestamps: true,
});

module.exports = PromiseToPay;
