const { permissionRepository } = require('@/modules/permissions/application/PermissionRepository');
const { rolePermissionRepository } = require('@/modules/permissions/application/RolePermissionRepository');
const { userPermissionRepository } = require('@/modules/permissions/application/UserPermissionRepository');
const { permissionService } = require('@/modules/permissions/application/PermissionService');

module.exports = {
  permissionRepository,
  rolePermissionRepository,
  userPermissionRepository,
  permissionService,
};
