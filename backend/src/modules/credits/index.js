const { loanValidation } = require('../../middleware/validation');
const { createModule, resolveAuthContext } = require('../shared');
const {
  createListLoans,
  createCreateSimulation,
  createLoadDagWorkbenchGraph,
  createSaveDagWorkbenchGraph,
  createValidateDagWorkbenchGraph,
  createSimulateDagWorkbenchGraph,
  createGetDagWorkbenchSummary,
  createListDagWorkbenchGraphs,
  createGetDagWorkbenchGraphDetails,
  createActivateDagWorkbenchGraph,
  createDeactivateDagWorkbenchGraph,
  createDeleteDagWorkbenchGraph,
  createGetLoanById,
  createCreateLoan,
  createListLoansByCustomer,
  createUpdateLoanStatus,
  createUpdateRecoveryStatus,
  createDeleteLoan,
  createListLoanAttachments,
  createCreateLoanAttachment,
  createDownloadLoanAttachment,
  createListLoanAlerts,
  createGetPaymentCalendar,
  createGetPayoffQuote,
  createExecutePayoff,
  createListPromisesToPay,
  createCreatePromiseToPay,
  createCreateLoanFollowUp,
  createUpdateLoanAlertStatus,
  createUpdatePromiseToPayStatus,
  createDownloadPromiseToPay,
  createGetLoanStatistics,
  createGetDuePayments,
  createSearchLoans,
  createUpdateLateFeeRate,
} = require('./application/useCases');
const { createAttachmentUpload } = require('./presentation/attachmentUpload');
const { createCreditsComposition } = require('./composition');
const { createCreditsRouter } = require('./presentation/router');
const { listDagWorkbenchScopes } = require('./application/dag/scopeRegistry');

/**
 * Compose the credits module entrypoint from shared policy, services, and router seams.
 * @param {{ sharedRuntime?: object, auditService?: object }} [options]
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createCreditsModule = ({ sharedRuntime, auditService } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const {
    loanRepository,
    customerRepository,
    _userRepository,
    attachmentRepository,
    alertRepository,
    promiseRepository,
    creditDomainService,
    loanCreationService,
    notificationPort,
    attachmentStorage,
    loanAccessPolicy,
    recoveryStatusGuard,
    loanViewService,
    paymentApplicationService,
    dagWorkbenchService,
  } = createCreditsComposition({ sharedRuntime });
  const attachmentUpload = createAttachmentUpload({ storage: attachmentStorage });
  const useCases = {
    listLoans: createListLoans({ loanRepository, loanAccessPolicy }),
    createSimulation: createCreateSimulation({ creditDomainService }),
    listDagWorkbenchScopes: async () => ({ scopes: listDagWorkbenchScopes() }),
    loadDagWorkbenchGraph: createLoadDagWorkbenchGraph({ dagWorkbenchService }),
    saveDagWorkbenchGraph: createSaveDagWorkbenchGraph({ dagWorkbenchService }),
    validateDagWorkbenchGraph: createValidateDagWorkbenchGraph({ dagWorkbenchService }),
    simulateDagWorkbenchGraph: createSimulateDagWorkbenchGraph({ dagWorkbenchService }),
    getDagWorkbenchSummary: createGetDagWorkbenchSummary({ dagWorkbenchService }),
    listDagWorkbenchGraphs: createListDagWorkbenchGraphs({ dagWorkbenchService }),
    getDagWorkbenchGraphDetails: createGetDagWorkbenchGraphDetails({ dagWorkbenchService }),
    activateDagWorkbenchGraph: createActivateDagWorkbenchGraph({ dagWorkbenchService }),
    deactivateDagWorkbenchGraph: createDeactivateDagWorkbenchGraph({ dagWorkbenchService }),
    deleteDagWorkbenchGraph: createDeleteDagWorkbenchGraph({ dagWorkbenchService }),
    getLoanById: createGetLoanById({ loanRepository, loanAccessPolicy, loanViewService }),
    createLoan: createCreateLoan({ loanCreationService, auditService }),
    listLoansByCustomer: createListLoansByCustomer({ customerRepository, loanRepository }),
    updateLoanStatus: createUpdateLoanStatus({ loanRepository, loanAccessPolicy, auditService }),
    updateRecoveryStatus: createUpdateRecoveryStatus({ loanRepository, loanAccessPolicy, recoveryStatusGuard, auditService }),
    deleteLoan: createDeleteLoan({ loanRepository, loanAccessPolicy, auditService }),
    listLoanAttachments: createListLoanAttachments({ attachmentRepository, loanAccessPolicy }),
    createLoanAttachment: createCreateLoanAttachment({ attachmentRepository, attachmentStorage, loanAccessPolicy, auditService }),
    downloadLoanAttachment: createDownloadLoanAttachment({ attachmentRepository, attachmentStorage, loanAccessPolicy }),
    listLoanAlerts: createListLoanAlerts({ alertRepository, loanAccessPolicy, loanViewService }),
    getPaymentCalendar: createGetPaymentCalendar({ alertRepository, loanAccessPolicy, loanViewService }),
    getPayoffQuote: createGetPayoffQuote({ loanAccessPolicy, loanViewService }),
    executePayoff: createExecutePayoff({ loanAccessPolicy, paymentApplicationService, auditService }),
    listPromisesToPay: createListPromisesToPay({ promiseRepository, loanAccessPolicy }),
    createPromiseToPay: createCreatePromiseToPay({ promiseRepository, loanAccessPolicy, auditService }),
    createLoanFollowUp: createCreateLoanFollowUp({ alertRepository, loanAccessPolicy, notificationPort }),
    updateLoanAlertStatus: createUpdateLoanAlertStatus({ alertRepository, loanAccessPolicy }),
    updatePromiseToPayStatus: createUpdatePromiseToPayStatus({ promiseRepository, loanAccessPolicy, notificationPort, auditService }),
    downloadPromiseToPay: createDownloadPromiseToPay({ promiseRepository, loanAccessPolicy }),
    getLoanStatistics: createGetLoanStatistics({ loanRepository }),
    getDuePayments: createGetDuePayments({ loanRepository, alertRepository, loanViewService }),
    searchLoans: createSearchLoans({ loanRepository }),
    updateLateFeeRate: createUpdateLateFeeRate({ loanRepository, loanAccessPolicy, auditService }),
  };

  return createModule({
    name: 'credits',
    basePath: '/api/loans',
    router: createCreditsRouter({ authMiddleware, attachmentUpload, loanValidation, useCases }),
  });
};

module.exports = {
  createCreditsModule,
};
