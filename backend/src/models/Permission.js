const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const { PERMISSION_MODULES } = require('@/db/seeds/permissions_catalog');

const Permission = sequelize.define('Permission', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  module: { type: DataTypes.ENUM(...PERMISSION_MODULES), allowNull: false },
  description: { type: DataTypes.STRING, allowNull: true },
}, {
  timestamps: true,
});

module.exports = Permission;
module.exports.PERMISSION_MODULES = PERMISSION_MODULES;
