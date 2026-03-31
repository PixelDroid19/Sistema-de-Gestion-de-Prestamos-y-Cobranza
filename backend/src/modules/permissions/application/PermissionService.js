const { permissionRepository } = require('./PermissionRepository');
const { rolePermissionRepository } = require('./RolePermissionRepository');
const { userPermissionRepository } = require('./UserPermissionRepository');
const { userRepository } = require('../../users/infrastructure/repositories');

const permissionService = {
  async listAll() {
    return permissionRepository.findAll();
  },

  async getByModule(module) {
    return permissionRepository.findByModule(module);
  },

  async getByUser(userId) {
    const [directPermissions, rolePermissions] = await Promise.all([
      userPermissionRepository.findByUser(userId),
      this._getRolePermissionsForUser(userId),
    ]);

    return {
      direct: directPermissions.map((up) => up.Permission),
      role: rolePermissions.map((rp) => rp.Permission),
    };
  },

  async getMyPermissions(actor) {
    if (!actor || !actor.id) {
      return { direct: [], role: [], resolved: [] };
    }

    const [directPermissions, rolePermissions] = await Promise.all([
      userPermissionRepository.findByUser(actor.id),
      this._getRolePermissionsForUser(actor.id),
    ]);

    const directPermNames = new Set(directPermissions.map((p) => p.Permission?.name));
    const rolePermNames = new Set(rolePermissions.map((p) => p.Permission?.name));

    const resolved = [...directPermNames, ...rolePermNames];

    return {
      direct: directPermissions.map((up) => up.Permission),
      role: rolePermissions.map((rp) => rp.Permission),
      resolved,
    };
  },

  async grant({ userId, permissionId, grantedBy }) {
    return userPermissionRepository.grant({ userId, permissionId, grantedBy });
  },

  async grantBatch({ userId, permissionIds, grantedBy }) {
    const results = await Promise.all(
      permissionIds.map((permissionId) =>
        userPermissionRepository.grant({ userId, permissionId, grantedBy })
      )
    );
    return results;
  },

  async revoke({ userId, permissionId }) {
    return userPermissionRepository.revoke(userId, permissionId);
  },

  async check(actor, permissionName) {
    if (!actor || !actor.id) {
      return false;
    }

    const directPermissions = await userPermissionRepository.findByUser(actor.id);
    const hasDirectPermission = directPermissions.some(
      (up) => up.Permission && up.Permission.name === permissionName
    );
    if (hasDirectPermission) {
      return true;
    }

    const rolePermissions = await this._getRolePermissionsForUser(actor.id);
    const hasRolePermission = rolePermissions.some(
      (rp) => rp.Permission && rp.Permission.name === permissionName
    );
    if (hasRolePermission) {
      return true;
    }

    return false;
  },

  async checkMultiple(actor, permissionNames) {
    if (!actor || !actor.id) {
      return { granted: [], denied: permissionNames };
    }

    const [directPermissions, rolePermissions] = await Promise.all([
      userPermissionRepository.findByUser(actor.id),
      this._getRolePermissionsForUser(actor.id),
    ]);

    const directPermNames = new Set(directPermissions.map((p) => p.Permission?.name));
    const rolePermNames = new Set(rolePermissions.map((p) => p.Permission?.name));

    const granted = permissionNames.filter(
      (name) => directPermNames.has(name) || rolePermNames.has(name)
    );
    const denied = permissionNames.filter(
      (name) => !directPermNames.has(name) && !rolePermNames.has(name)
    );

    return { granted, denied };
  },

  async _getRolePermissionsForUser(userId) {
    const user = await userRepository.findById(userId);
    if (!user || !user.role) {
      return [];
    }
    return rolePermissionRepository.findByRole(user.role);
  },
};

module.exports = {
  permissionService,
};
