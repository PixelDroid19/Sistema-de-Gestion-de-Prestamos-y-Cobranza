const { UserPermission, Permission } = require('@/models');

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
  runInTransaction(work) {
    return UserPermission.sequelize.transaction((transaction) => work({ transaction }));
  },

  async findByUser(userId, options = {}) {
    const userPermissions = await UserPermission.findAll({
      where: { userId },
      include: [{ model: Permission }],
      ...options,
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

  async grantMany({ userId, permissionIds, grantedBy }, options = {}) {
    if (permissionIds.length === 0) return 0;
    const created = await UserPermission.bulkCreate(
      permissionIds.map((permissionId) => ({ userId, permissionId, grantedBy })),
      options,
    );
    return created.length;
  },

  async revokeAllForUser(userId, options = {}) {
    const deleted = await UserPermission.destroy({
      where: { userId },
      ...options,
    });
    return deleted;
  },
};

module.exports = {
  userPermissionRepository,
};
