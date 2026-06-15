const { permissionRepository } = require('../application/PermissionRepository');
const { userPermissionRepository } = require('../application/UserPermissionRepository');
const { rolePermissionRepository } = require('../application/RolePermissionRepository');

module.exports = {
  permissionRepository,
  userPermissionRepository,
  rolePermissionRepository,
};
