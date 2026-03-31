const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const UserPermission = sequelize.define('UserPermission', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  permissionId: { type: DataTypes.INTEGER, allowNull: false },
  grantedBy: { type: DataTypes.INTEGER, allowNull: false },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  timestamps: true,
  updatedAt: false,
});

module.exports = UserPermission;