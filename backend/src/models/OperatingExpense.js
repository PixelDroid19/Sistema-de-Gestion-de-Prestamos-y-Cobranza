const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const { moneyColumn } = require('./columnTypes');

const OperatingExpense = sequelize.define('OperatingExpense', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  amount: moneyColumn('amount', {
    allowNull: false,
    validate: { min: 0.01 },
  }),
  expenseDate: { type: DataTypes.DATE, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: false },
  status: {
    type: DataTypes.ENUM('completed', 'annulled'),
    allowNull: false,
    defaultValue: 'completed',
  },
  paymentMethod: { type: DataTypes.STRING, allowNull: true },
  reference: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
  annulledAt: { type: DataTypes.DATE, allowNull: true },
  annulledByUserId: { type: DataTypes.INTEGER, allowNull: true },
  annulmentReason: { type: DataTypes.TEXT, allowNull: true },
}, {
  timestamps: true,
  indexes: [
    { fields: ['expenseDate'] },
    { fields: ['status'] },
    { fields: ['createdByUserId'] },
  ],
});

module.exports = OperatingExpense;
