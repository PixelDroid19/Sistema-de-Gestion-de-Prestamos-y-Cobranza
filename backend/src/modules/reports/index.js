const { createModule, resolveAuthContext } = require('@/modules/shared');
const { createCreditsPublicPorts } = require('@/modules/credits/public');
const {
  createGetOutstandingLoans,
  createExportOutstandingReport,
  createGetDashboardSummary,
  createGetCustomerHistory,
  createGetCustomerCreditProfile,
  createGetCustomerCreditHistory,
  createExportCustomerCreditHistory,
  createExportCreditsExcel,
  createExportPayoutsExcel,
  createExportPayoutsPdf,
  createGetPayoutsReport,
  createGetPaymentSchedule,
  createGetMonthlyCashFlow,
  createExportMonthlyCashFlowExcel,
  createExportMonthlyCashFlowPdf,
  createExportOperatingExpensesReport,
  createGetCreditHistoryAuditReport,
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
  const useCases = {
    getOutstandingLoans: createGetOutstandingLoans({ reportRepository, paymentRepository, loanViewService }),
    exportOutstandingReport: createExportOutstandingReport({ reportRepository, paymentRepository, loanViewService }),
    getDashboardSummary: createGetDashboardSummary({ reportRepository, paymentRepository, loanViewService }),
    getCustomerHistory: createGetCustomerHistory({ reportRepository }),
    getCustomerCreditProfile: createGetCustomerCreditProfile({ reportRepository }),
    getCustomerCreditHistory: createGetCustomerCreditHistory({ reportRepository, paymentRepository, loanViewService, loanAccessPolicy, alertRepository, promiseRepository }),
    exportCustomerCreditHistory: createExportCustomerCreditHistory({ paymentRepository, loanViewService, loanAccessPolicy, alertRepository, promiseRepository }),
    // Credits Excel export and summary
    exportCreditsExcel: createExportCreditsExcel({ reportRepository, paymentRepository, loanViewService }),
    exportPayoutsExcel: createExportPayoutsExcel({ paymentRepository }),
    exportPayoutsPdf: createExportPayoutsPdf({ paymentRepository }),
    // Enhanced reports - payouts and payment schedule
    getPayoutsReport: createGetPayoutsReport({ reportRepository, paymentRepository }),
    getPaymentSchedule: createGetPaymentSchedule({ loanAccessPolicy, paymentRepository }),
    getMonthlyCashFlow: createGetMonthlyCashFlow({ reportRepository }),
    exportMonthlyCashFlowExcel: createExportMonthlyCashFlowExcel({ reportRepository }),
    exportMonthlyCashFlowPdf: createExportMonthlyCashFlowPdf({ reportRepository }),
    exportOperatingExpensesReport: createExportOperatingExpensesReport({ reportRepository }),
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
