const { UserPermission, Permission } = require('../../../models');

const serializeUserPermission = (up) => {
  if (!up) return null;
  if (typeof up.toJSON === 'function') {
    const json = up.toJSON();
    if (json.Permission) {
      json.Permission = typeof json.Permission.toJSON === 'function' 
        ? json.Permission.toJSON() 
        : json.Permission;
    }
    return json;
  }
  return up;
};

const userPermissionRepository = {
  async findByUser(userId) {
    const userPermissions = await UserPermission.findAll({
      where: { userId },
      include: [{ model: Permission }],
    });
    return userPermissions.map(serializeUserPermission);
  },

  async findByUserAndPermission(userId, permissionId) {
    const up = await UserPermission.findOne({
      where: { userId, permissionId },
    });
    return serializeUserPermission(up);
  },

  async grant({ userId, permissionId, grantedBy }) {
    const [up] = await UserPermission.findOrCreate({
      where: { userId, permissionId },
      defaults: { userId, permissionId, grantedBy },
    });
    return serializeUserPermission(up);
  },

  async revoke(userId, permissionId) {
    const deleted = await UserPermission.destroy({
      where: { userId, permissionId },
    });
    return deleted > 0;
  },

  async revokeAllForUser(userId) {
    const deleted = await UserPermission.destroy({
      where: { userId },
    });
    return deleted;
  },
};

module.exports = {
  userPermissionRepository,
};
