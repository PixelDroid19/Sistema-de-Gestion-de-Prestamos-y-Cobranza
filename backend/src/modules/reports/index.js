const { createModule, resolveAuthContext } = require('@/modules/shared');
const { createCreditsPublicPorts } = require('@/modules/credits/public');
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
  createGetCustomerProfitabilityReport,
  createExportCustomerProfitabilityReport,
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
  createExportFinancialAnalyticsReport,
  createExportCreditsExcel,
  createExportCreditsPdf,
  createExportPayoutsExcel,
  createExportPayoutsPdf,
  createGetPayoutsReport,
  createGetPaymentSchedule,
  createGetMonthlyCashFlow,
  createGetDailyCashFlow,
  createGetAnnualCashFlow,
  createExportMonthlyCashFlowExcel,
  createExportMonthlyCashFlowPdf,
  createExportOperatingExpensesReport,
  createGetCreditHistoryAuditReport,
  createListCreditHistoryFinancialProducts,
  createExportCreditHistoryAuditExcel,
  createExportCreditHistoryAuditPdf,
} = require('./application/useCases');
const { reportRepository, paymentRepository } = require('./infrastructure/repositories');
const { createReportsRouter } = require('./presentation/router');

/**
 * Compose the reports module entrypoint from reporting repositories and credit read models.
 * @param {{ sharedRuntime?: object }} [options]
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createReportsModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const { loanViewService, loanAccessPolicy, alertRepository, promiseRepository } = createCreditsPublicPorts({ sharedRuntime });
  const getCreditEarnings = createGetCreditEarnings({ reportRepository });
  const getInterestEarnings = createGetInterestEarnings({ paymentRepository });
  const getMonthlyEarnings = createGetMonthlyEarnings({ reportRepository });
  const getMonthlyInterest = createGetMonthlyInterest({ paymentRepository });
  const getPerformanceAnalysis = createGetPerformanceAnalysis({ reportRepository });
  const getExecutiveDashboard = createGetExecutiveDashboard({ reportRepository, paymentRepository });
  const getComprehensiveAnalytics = createGetComprehensiveAnalytics({ reportRepository, paymentRepository });
  const getComparativeAnalysis = createGetComparativeAnalysis({ reportRepository });
  const getForecastAnalysis = createGetForecastAnalysis({ reportRepository });
  const getNextMonthProjection = createGetNextMonthProjection({ reportRepository });
  const exportFinancialAnalyticsReport = createExportFinancialAnalyticsReport({
    getComprehensiveAnalytics,
    getComparativeAnalysis,
    getForecastAnalysis,
    getNextMonthProjection,
  });
  const useCases = {
    getRecoveredLoans: createGetRecoveredLoans({ reportRepository, paymentRepository, loanViewService }),
    getOutstandingLoans: createGetOutstandingLoans({ reportRepository, paymentRepository, loanViewService }),
    getRecoveryReport: createGetRecoveryReport({ reportRepository, paymentRepository, loanViewService }),
    getDashboardSummary: createGetDashboardSummary({ reportRepository, paymentRepository, loanViewService }),
    getCustomerHistory: createGetCustomerHistory({ reportRepository }),
    getCustomerCreditProfile: createGetCustomerCreditProfile({ reportRepository }),
    getCustomerCreditHistory: createGetCustomerCreditHistory({ reportRepository, paymentRepository, loanViewService, loanAccessPolicy, alertRepository, promiseRepository }),
    exportCustomerHistory: createExportCustomerHistory({ reportRepository }),
    exportCustomerCreditProfile: createExportCustomerCreditProfile({ reportRepository }),
    exportCustomerCreditHistory: createExportCustomerCreditHistory({ paymentRepository, loanViewService, loanAccessPolicy, alertRepository, promiseRepository }),
    exportRecoveryReport: createExportRecoveryReport({ reportRepository, paymentRepository, loanViewService }),
    getCustomerProfitabilityReport: createGetCustomerProfitabilityReport({ reportRepository }),
    exportCustomerProfitabilityReport: createExportCustomerProfitabilityReport({ reportRepository }),
    getLoanProfitabilityReport: createGetLoanProfitabilityReport({ reportRepository }),
    // New financial analytics use cases
    getCreditEarnings,
    getInterestEarnings,
    getMonthlyEarnings,
    getMonthlyInterest,
    getPerformanceAnalysis,
    getExecutiveDashboard,
    getComprehensiveAnalytics,
    getComparativeAnalysis,
    getForecastAnalysis,
    getNextMonthProjection,
    exportFinancialAnalyticsReport,
    // Credits Excel export and summary
    exportCreditsExcel: createExportCreditsExcel({ reportRepository, paymentRepository, loanViewService }),
    exportCreditsPdf: createExportCreditsPdf({ reportRepository, paymentRepository, loanViewService }),
    exportPayoutsExcel: createExportPayoutsExcel({ paymentRepository }),
    exportPayoutsPdf: createExportPayoutsPdf({ paymentRepository }),
    // Enhanced reports - payouts and payment schedule
    getPayoutsReport: createGetPayoutsReport({ reportRepository, paymentRepository }),
    getPaymentSchedule: createGetPaymentSchedule({ loanAccessPolicy, paymentRepository }),
    getMonthlyCashFlow: createGetMonthlyCashFlow({ reportRepository }),
    getDailyCashFlow: createGetDailyCashFlow({ reportRepository }),
    getAnnualCashFlow: createGetAnnualCashFlow({ reportRepository }),
    exportMonthlyCashFlowExcel: createExportMonthlyCashFlowExcel({ reportRepository }),
    exportMonthlyCashFlowPdf: createExportMonthlyCashFlowPdf({ reportRepository }),
    exportOperatingExpensesReport: createExportOperatingExpensesReport({ reportRepository }),
    listCreditHistoryFinancialProducts: createListCreditHistoryFinancialProducts({ reportRepository }),
    getCreditHistoryAuditReport: createGetCreditHistoryAuditReport({ reportRepository }),
    exportCreditHistoryAuditExcel: createExportCreditHistoryAuditExcel({ reportRepository }),
    exportCreditHistoryAuditPdf: createExportCreditHistoryAuditPdf({ reportRepository }),
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
