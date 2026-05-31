const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const { ADMINISTRATIVE_LOGIN_ROLES } = require('@/modules/shared/roles');

const RolePermission = sequelize.define('RolePermission', {
  role: {
    type: DataTypes.ENUM(...ADMINISTRATIVE_LOGIN_ROLES),
    allowNull: false,
    validate: {
      notNull: { msg: 'La relación entre rol y permiso debe incluir ambos datos' },
    },
  },
  permissionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: { msg: 'La relación entre rol y permiso debe incluir ambos datos' },
    },
  },
}, {
  timestamps: false,
  primaryKey: true,
  validate: {
    compositePrimaryKey() {
      if (!this.role || !this.permissionId) {
        throw new Error('La relación entre rol y permiso debe incluir ambos datos');
      }
    },
  },
});

module.exports = RolePermission;
