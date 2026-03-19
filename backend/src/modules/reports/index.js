const { createAuthMiddleware } = require('../shared/auth');
const { createJwtTokenService } = require('../shared/auth/tokenService');
const { createModule } = require('../shared');
const { createCreditsPublicPorts } = require('../credits/public');
const {
  createGetRecoveredLoans,
  createGetOutstandingLoans,
  createGetRecoveryReport,
  createGetDashboardSummary,
  createGetCustomerHistory,
  createGetCustomerCreditHistory,
  createExportRecoveryReport,
  createGetAssociateProfitabilityReport,
  createExportAssociateProfitabilityReport,
} = require('./application/useCases');
const { reportRepository, paymentRepository } = require('./infrastructure/repositories');
const { associateRepository } = require('../associates/infrastructure/repositories');
const { createReportsRouter } = require('./presentation/router');

/**
 * Compose the reports module entrypoint from reporting repositories and credit read models.
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createReportsModule = () => {
  const authMiddleware = createAuthMiddleware({ tokenService: createJwtTokenService() });
  const { loanViewService, loanAccessPolicy } = createCreditsPublicPorts();
  const useCases = {
    getRecoveredLoans: createGetRecoveredLoans({ reportRepository, paymentRepository, loanViewService }),
    getOutstandingLoans: createGetOutstandingLoans({ reportRepository, paymentRepository, loanViewService }),
    getRecoveryReport: createGetRecoveryReport({ reportRepository, paymentRepository, loanViewService }),
    getDashboardSummary: createGetDashboardSummary({ reportRepository, paymentRepository, loanViewService }),
    getCustomerHistory: createGetCustomerHistory({ reportRepository }),
    getCustomerCreditHistory: createGetCustomerCreditHistory({ reportRepository, paymentRepository, loanViewService, loanAccessPolicy }),
    exportRecoveryReport: createExportRecoveryReport({ reportRepository, paymentRepository, loanViewService }),
    getAssociateProfitabilityReport: createGetAssociateProfitabilityReport({ associateRepository }),
    exportAssociateProfitabilityReport: createExportAssociateProfitabilityReport({ reportRepository, associateRepository }),
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
