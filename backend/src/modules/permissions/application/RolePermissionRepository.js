const { RolePermission, Permission } = require('@/models');

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
};

module.exports = {
  rolePermissionRepository,
};
