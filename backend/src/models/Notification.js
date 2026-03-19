const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  dedupeKey: { type: DataTypes.STRING, allowNull: true },
}, {
  timestamps: true,
});

module.exports = Notification;
