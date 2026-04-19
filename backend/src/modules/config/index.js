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
  createListTnaRates,
  createCreateTnaRate,
  createUpdateTnaRate,
  createDeleteTnaRate,
  createListLateFeePolicies,
  resolveLateFeePolicyForUser,
  createCreateLateFeePolicy,
  createUpdateLateFeePolicy,
  createDeleteLateFeePolicy,
  createListInterestNodes,
  createCreateInterestNode,
  createUpdateInterestNode,
  createDeleteInterestNode,
  createGetTnaRateStats,
  createFindTnaRatesByUser,
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
    listTnaRates: createListTnaRates({ configRepository }),
    getTnaRateStats: createGetTnaRateStats({ configRepository }),
    findTnaRatesByUser: createFindTnaRatesByUser({ configRepository }),
    createTnaRate: createCreateTnaRate({ configRepository }),
    updateTnaRate: createUpdateTnaRate({ configRepository }),
    deleteTnaRate: createDeleteTnaRate({ configRepository }),
    listLateFeePolicies: createListLateFeePolicies({ configRepository }),
    resolveLateFeePolicyForUser: resolveLateFeePolicyForUser({ configRepository }),
    createLateFeePolicy: createCreateLateFeePolicy({ configRepository }),
    updateLateFeePolicy: createUpdateLateFeePolicy({ configRepository }),
    deleteLateFeePolicy: createDeleteLateFeePolicy({ configRepository }),
    listInterestNodes: createListInterestNodes({ configRepository }),
    createInterestNode: createCreateInterestNode({ configRepository }),
    updateInterestNode: createUpdateInterestNode({ configRepository }),
    deleteInterestNode: createDeleteInterestNode({ configRepository }),
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
