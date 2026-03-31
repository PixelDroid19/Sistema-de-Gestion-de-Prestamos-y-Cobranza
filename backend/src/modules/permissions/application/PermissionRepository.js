const { Permission } = require('../../../models');

const serializePermission = (permission) => {
  if (!permission) return null;
  return typeof permission.toJSON === 'function' ? permission.toJSON() : permission;
};

const permissionRepository = {
  async findAll() {
    const permissions = await Permission.findAll({
      order: [['module', 'ASC'], ['name', 'ASC']],
    });
    return permissions.map(serializePermission);
  },

  async findById(id) {
    const permission = await Permission.findByPk(id);
    return serializePermission(permission);
  },

  async findByName(name) {
    const permission = await Permission.findOne({
      where: { name },
    });
    return serializePermission(permission);
  },

  async findByModule(module) {
    const permissions = await Permission.findAll({
      where: { module },
      order: [['name', 'ASC']],
    });
    return permissions.map(serializePermission);
  },

  async create({ name, module, description }) {
    const permission = await Permission.create({ name, module, description });
    return serializePermission(permission);
  },
};

module.exports = {
  permissionRepository,
};
