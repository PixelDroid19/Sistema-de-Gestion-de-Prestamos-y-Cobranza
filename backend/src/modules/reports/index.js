const { createModule, resolveAuthContext } = require('../shared');
const { createCreditsPublicPorts } = require('../credits/public');
const {
  createGetRecoveredLoans,
  createGetOutstandingLoans,
  createGetRecoveryReport,
  createGetDashboardSummary,
  createGetCustomerHistory,
  createGetCustomerCreditProfile,
  createGetCustomerCreditHistory,
  createExportRecoveryReport,
  createGetAssociateProfitabilityReport,
  createExportAssociateProfitabilityReport,
  createGetCustomerProfitabilityReport,
  createGetLoanProfitabilityReport,
} = require('./application/useCases');
const { reportRepository, paymentRepository } = require('./infrastructure/repositories');
const { associateRepository } = require('../associates/infrastructure/repositories');
const { createReportsRouter } = require('./presentation/router');

/**
 * Compose the reports module entrypoint from reporting repositories and credit read models.
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createReportsModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const { loanViewService, loanAccessPolicy } = createCreditsPublicPorts({ sharedRuntime });
  const useCases = {
    getRecoveredLoans: createGetRecoveredLoans({ reportRepository, paymentRepository, loanViewService }),
    getOutstandingLoans: createGetOutstandingLoans({ reportRepository, paymentRepository, loanViewService }),
    getRecoveryReport: createGetRecoveryReport({ reportRepository, paymentRepository, loanViewService }),
    getDashboardSummary: createGetDashboardSummary({ reportRepository, paymentRepository, loanViewService }),
    getCustomerHistory: createGetCustomerHistory({ reportRepository }),
    getCustomerCreditProfile: createGetCustomerCreditProfile({ reportRepository }),
    getCustomerCreditHistory: createGetCustomerCreditHistory({ reportRepository, paymentRepository, loanViewService, loanAccessPolicy }),
    exportRecoveryReport: createExportRecoveryReport({ reportRepository, paymentRepository, loanViewService }),
    getAssociateProfitabilityReport: createGetAssociateProfitabilityReport({ associateRepository }),
    exportAssociateProfitabilityReport: createExportAssociateProfitabilityReport({ reportRepository, associateRepository }),
    getCustomerProfitabilityReport: createGetCustomerProfitabilityReport({ reportRepository }),
    getLoanProfitabilityReport: createGetLoanProfitabilityReport({ reportRepository }),
  };

  return createModule({
    name: 'reports',
    basePath: '/api/reports',
    router: createReportsRouter({ authMiddleware, useCases }),
  });
};

module.exports = {
  createReportsModule,
};
