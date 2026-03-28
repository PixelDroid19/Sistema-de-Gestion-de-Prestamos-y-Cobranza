const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const { APPLICATION_ROLES } = require('../modules/shared/roles');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM(...APPLICATION_ROLES), allowNull: false },
  associateId: { type: DataTypes.INTEGER, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  // Account lockout fields for security
  failedLoginAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lockedUntil: { type: DataTypes.DATE, allowNull: true }, // null means not locked
}, {
  timestamps: true,
});

module.exports = User;
