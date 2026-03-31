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
  createGetAssociateInstallments,
  createPayAssociateInstallment,
  createGetAssociateCalendar,
} = require('./application/useCases');
const { associateRepository } = require('./infrastructure/repositories');
const { createAssociatesRouter } = require('./presentation/router');

/**
 * Compose the associates module entrypoint and its router dependencies.
 * @param {{ sharedRuntime?: object, auditService?: object }} [options]
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createAssociatesModule = ({ sharedRuntime, auditService } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const useCases = {
    listAssociates: createListAssociates({ associateRepository }),
    createAssociate: createCreateAssociate({ associateRepository, auditService }),
    getAssociateById: createGetAssociateById({ associateRepository }),
    updateAssociate: createUpdateAssociate({ associateRepository, auditService }),
    deleteAssociate: createDeleteAssociate({ associateRepository, auditService }),
    listAssociatePortalSummary: createListAssociatePortalSummary({ associateRepository }),
    createAssociateContribution: createCreateAssociateContribution({ associateRepository, auditService }),
    createProfitDistribution: createCreateProfitDistribution({ associateRepository, auditService }),
    createAssociateReinvestment: createCreateAssociateReinvestment({ associateRepository, auditService }),
    createProportionalProfitDistribution: createCreateProportionalProfitDistribution({ associateRepository, auditService }),
    getAssociateInstallments: createGetAssociateInstallments({ associateRepository }),
    payAssociateInstallment: createPayAssociateInstallment({ associateRepository, auditService }),
    getAssociateCalendar: createGetAssociateCalendar({ associateRepository }),
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
