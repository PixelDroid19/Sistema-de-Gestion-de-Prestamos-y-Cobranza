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
  createExportCustomerHistory,
  createExportCustomerCreditProfile,
  createExportCustomerCreditHistory,
  createExportRecoveryReport,
  createGetAssociateProfitabilityReport,
  createExportAssociateProfitabilityReport,
  createGetCustomerProfitabilityReport,
  createGetLoanProfitabilityReport,
  createGetCreditEarnings,
  createGetInterestEarnings,
  createGetMonthlyEarnings,
  createGetMonthlyInterest,
  createGetPerformanceAnalysis,
  createGetExecutiveDashboard,
  createGetComprehensiveAnalytics,
  createGetComparativeAnalysis,
  createGetForecastAnalysis,
  createGetNextMonthProjection,
  createExportCreditsExcel,
  createGetCreditsSummary,
  createExportAssociatesExcel,
  createGetPayoutsReport,
  createGetPaymentSchedule,
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
    exportCustomerHistory: createExportCustomerHistory({ reportRepository }),
    exportCustomerCreditProfile: createExportCustomerCreditProfile({ reportRepository }),
    exportCustomerCreditHistory: createExportCustomerCreditHistory({ paymentRepository, loanViewService, loanAccessPolicy }),
    exportRecoveryReport: createExportRecoveryReport({ reportRepository, paymentRepository, loanViewService }),
    getAssociateProfitabilityReport: createGetAssociateProfitabilityReport({ associateRepository }),
    exportAssociateProfitabilityReport: createExportAssociateProfitabilityReport({ reportRepository, associateRepository }),
    getCustomerProfitabilityReport: createGetCustomerProfitabilityReport({ reportRepository }),
    getLoanProfitabilityReport: createGetLoanProfitabilityReport({ reportRepository }),
    // New financial analytics use cases
    getCreditEarnings: createGetCreditEarnings({ reportRepository }),
    getInterestEarnings: createGetInterestEarnings({ paymentRepository }),
    getMonthlyEarnings: createGetMonthlyEarnings({ reportRepository }),
    getMonthlyInterest: createGetMonthlyInterest({ paymentRepository }),
    getPerformanceAnalysis: createGetPerformanceAnalysis({ reportRepository }),
    getExecutiveDashboard: createGetExecutiveDashboard({ reportRepository, paymentRepository }),
    getComprehensiveAnalytics: createGetComprehensiveAnalytics({ reportRepository, paymentRepository }),
    getComparativeAnalysis: createGetComparativeAnalysis({ reportRepository }),
    getForecastAnalysis: createGetForecastAnalysis({ reportRepository }),
    getNextMonthProjection: createGetNextMonthProjection({ reportRepository }),
    // Credits Excel export and summary
    exportCreditsExcel: createExportCreditsExcel({ reportRepository, paymentRepository, loanViewService }),
    getCreditsSummary: createGetCreditsSummary({ reportRepository, paymentRepository, loanViewService }),
    exportAssociatesExcel: createExportAssociatesExcel({ associateRepository, reportRepository }),
    // Enhanced reports - payouts and payment schedule
    getPayoutsReport: createGetPayoutsReport({ reportRepository, paymentRepository }),
    getPaymentSchedule: createGetPaymentSchedule({ loanAccessPolicy }),
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
