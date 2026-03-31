const { permissionRepository } = require('../application/PermissionRepository');
const { rolePermissionRepository } = require('../application/RolePermissionRepository');
const { userPermissionRepository } = require('../application/UserPermissionRepository');
const { permissionService } = require('../application/PermissionService');

module.exports = {
  permissionRepository,
  rolePermissionRepository,
  userPermissionRepository,
  permissionService,
};
