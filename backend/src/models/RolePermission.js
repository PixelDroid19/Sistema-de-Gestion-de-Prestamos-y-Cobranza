const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const { ADMINISTRATIVE_LOGIN_ROLES } = require('@/modules/shared/roles');

const RolePermission = sequelize.define('RolePermission', {
  role: {
    type: DataTypes.ENUM(...ADMINISTRATIVE_LOGIN_ROLES),
    allowNull: false,
  },
  permissionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  timestamps: false,
  primaryKey: true,
  validate: {
    compositePrimaryKey() {
      if (!this.role || !this.permissionId) {
        throw new Error('Composite primary key requires both role and permissionId');
      }
    },
  },
});

module.exports = RolePermission;
