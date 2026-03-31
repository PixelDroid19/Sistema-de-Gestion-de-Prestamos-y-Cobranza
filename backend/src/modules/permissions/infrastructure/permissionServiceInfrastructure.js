const { permissionService } = require('../application/permissionService');

const createPermissionServiceForMiddleware = () => {
  return {
    async check(actor, permissionName) {
      return permissionService.check(actor, permissionName);
    },
    async checkMultiple(actor, permissionNames) {
      return permissionService.checkMultiple(actor, permissionNames);
    },
  };
};

module.exports = {
  createPermissionServiceForMiddleware,
};
