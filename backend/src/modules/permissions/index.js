const { createModule, resolveAuthContext } = require('@/modules/shared');
const {
  createListPermissions,
  createGetPermissionsByModule,
  createGetUserPermissions,
  createGetMyPermissions,
  createGrantPermission,
  createGrantBatchPermissions,
  createRevokePermission,
  createCheckPermission,
  createCheckMultiplePermissions,
} = require('./application/useCases');
const { permissionRepository } = require('./application/PermissionRepository');
const { userPermissionRepository } = require('./application/UserPermissionRepository');
const { rolePermissionRepository } = require('./application/RolePermissionRepository');
const { userRepository } = require('@/modules/users/infrastructure/repositories');
const { createPermissionsRouter } = require('./presentation/router');

const createPermissionsModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);

  const useCases = {
    listPermissions: createListPermissions({ permissionRepository }),
    getPermissionsByModule: createGetPermissionsByModule({ permissionRepository }),
    getUserPermissions: createGetUserPermissions({
      permissionRepository,
      userPermissionRepository,
      rolePermissionRepository,
      userRepository,
    }),
    getMyPermissions: createGetMyPermissions({
      permissionRepository,
      userPermissionRepository,
      rolePermissionRepository,
      userRepository,
    }),
    grantPermission: createGrantPermission({
      permissionRepository,
      userPermissionRepository,
      userRepository,
    }),
    grantBatchPermissions: createGrantBatchPermissions({
      permissionRepository,
      userPermissionRepository,
      userRepository,
    }),
    revokePermission: createRevokePermission({
      permissionRepository,
      userPermissionRepository,
      userRepository,
    }),
    checkPermission: createCheckPermission({
      permissionRepository,
      userPermissionRepository,
      rolePermissionRepository,
      userRepository,
    }),
    checkMultiplePermissions: createCheckMultiplePermissions({
      permissionRepository,
      userPermissionRepository,
      rolePermissionRepository,
      userRepository,
    }),
  };

  return createModule({
    name: 'permissions',
    basePath: '/api/permissions',
    router: createPermissionsRouter({ authMiddleware, useCases }),
  });
};

module.exports = {
  createPermissionsModule,
};
