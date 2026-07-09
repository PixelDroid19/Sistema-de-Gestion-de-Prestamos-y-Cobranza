const { associateValidation } = require('@/middleware/validation');
const { createModule, resolveAuthContext } = require('@/modules/shared');
const {
  createListAssociates,
  createCreateAssociate,
  createGetAssociateById,
  createUpdateAssociate,
  createDeleteAssociate,
  createListAssociateFinancialDetails,
  createGetAssociateTracking,
  createCreateAssociateContribution,
  createCreateProfitDistribution,
  createCreateAssociateCapitalReturn,
  createCreateAssociateReinvestment,
  createGetAssociateInstallments,
  createPayAssociateInstallment,
  createGetAssociateCalendar,
} = require('./application/useCases');
const {
  createExportAssociatesExcel,
  createExportAssociatesPdf,
  createGetAssociateFinancialSummary,
  createExportAssociateFinancialSummary,
} = require('./application/reportingUseCases');
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
    getAssociateFinancialDetails: createListAssociateFinancialDetails({ associateRepository }),
    getAssociateTracking: createGetAssociateTracking({ associateRepository }),
    exportAssociatesExcel: createExportAssociatesExcel({ associateRepository }),
    exportAssociatesPdf: createExportAssociatesPdf({ associateRepository }),
    getAssociateFinancialSummary: createGetAssociateFinancialSummary({ associateRepository }),
    exportAssociateFinancialSummary: createExportAssociateFinancialSummary({ associateRepository }),
    createAssociateContribution: createCreateAssociateContribution({ associateRepository, auditService }),
    createProfitDistribution: createCreateProfitDistribution({ associateRepository, auditService }),
    createAssociateCapitalReturn: createCreateAssociateCapitalReturn({ associateRepository, auditService }),
    createAssociateReinvestment: createCreateAssociateReinvestment({ associateRepository, auditService }),
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
