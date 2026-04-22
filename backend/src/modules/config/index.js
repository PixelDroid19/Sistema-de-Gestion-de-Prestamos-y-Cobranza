const { createModule, resolveAuthContext } = require('@/modules/shared');
const {
  createListPaymentMethods,
  createListPaymentMethodsLegacy,
  createCreatePaymentMethod,
  createUpdatePaymentMethod,
  createDeletePaymentMethod,
  createListSettings,
  createUpsertSetting,
  createListAdminCatalogs,
  createListRoles,
} = require('./application/useCases');
const { configRepository } = require('./infrastructure/repositories');
const { createConfigRouter } = require('./presentation/router');

const createConfigModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const useCases = {
    listPaymentMethods: createListPaymentMethods({ configRepository }),
    listPaymentMethodsLegacy: createListPaymentMethodsLegacy({ configRepository }),
    createPaymentMethod: createCreatePaymentMethod({ configRepository }),
    updatePaymentMethod: createUpdatePaymentMethod({ configRepository }),
    deletePaymentMethod: createDeletePaymentMethod({ configRepository }),
    listSettings: createListSettings({ configRepository }),
    upsertSetting: createUpsertSetting({ configRepository }),
    listAdminCatalogs: createListAdminCatalogs(),
    listRoles: createListRoles(),
  };

  return createModule({
    name: 'config',
    basePath: '/api/config',
    router: createConfigRouter({ authMiddleware, useCases }),
  });
};

module.exports = {
  createConfigModule,
};
