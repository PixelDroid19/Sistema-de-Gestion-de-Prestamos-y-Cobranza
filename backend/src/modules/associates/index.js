const { associateValidation } = require('../../middleware/validation');
const { createModule, resolveAuthContext } = require('../shared');
const {
  createListAssociates,
  createCreateAssociate,
  createGetAssociateById,
  createUpdateAssociate,
  createDeleteAssociate,
  createListAssociatePortalSummary,
  createCreateAssociateContribution,
  createCreateProfitDistribution,
  createCreateAssociateReinvestment,
  createCreateProportionalProfitDistribution,
} = require('./application/useCases');
const { associateRepository } = require('./infrastructure/repositories');
const { createAssociatesRouter } = require('./presentation/router');

/**
 * Compose the associates module entrypoint and its router dependencies.
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createAssociatesModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const useCases = {
    listAssociates: createListAssociates({ associateRepository }),
    createAssociate: createCreateAssociate({ associateRepository }),
    getAssociateById: createGetAssociateById({ associateRepository }),
    updateAssociate: createUpdateAssociate({ associateRepository }),
    deleteAssociate: createDeleteAssociate({ associateRepository }),
    listAssociatePortalSummary: createListAssociatePortalSummary({ associateRepository }),
    createAssociateContribution: createCreateAssociateContribution({ associateRepository }),
    createProfitDistribution: createCreateProfitDistribution({ associateRepository }),
    createAssociateReinvestment: createCreateAssociateReinvestment({ associateRepository }),
    createProportionalProfitDistribution: createCreateProportionalProfitDistribution({ associateRepository }),
  };

  return createModule({
    name: 'associates',
    basePath: '/api/associates',
    router: createAssociatesRouter({ associateValidation, authMiddleware, useCases }),
  });
};

module.exports = {
  createAssociatesModule,
};
