const { RolePermission, Permission } = require('../../../models');

const serializeRolePermission = (rp) => {
  if (!rp) return null;
  if (typeof rp.toJSON === 'function') {
    const json = rp.toJSON();
    if (json.Permission) {
      json.Permission = typeof json.Permission.toJSON === 'function' 
        ? json.Permission.toJSON() 
        : json.Permission;
    }
    return json;
  }
  return rp;
};

const rolePermissionRepository = {
  async findByRole(role) {
    const rolePermissions = await RolePermission.findAll({
      where: { role },
      include: [{ model: Permission }],
    });
    return rolePermissions.map(serializeRolePermission);
  },

  async hasPermission(role, permissionId) {
    const rp = await RolePermission.findOne({
      where: { role, permissionId },
    });
    return rp !== null;
  },

  async grantPermission(role, permissionId) {
    const [rp] = await RolePermission.findOrCreate({
      where: { role, permissionId },
      defaults: { role, permissionId },
    });
    return serializeRolePermission(rp);
  },

  async revokePermission(role, permissionId) {
    const deleted = await RolePermission.destroy({
      where: { role, permissionId },
    });
    return deleted > 0;
  },

  async getRolesWithPermission(permissionId) {
    const rolePermissions = await RolePermission.findAll({
      where: { permissionId },
    });
    return rolePermissions.map((rp) => rp.role);
  },
};

module.exports = {
  rolePermissionRepository,
};
