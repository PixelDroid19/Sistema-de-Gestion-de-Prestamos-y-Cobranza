const { loanValidation } = require('../../middleware/validation');
const { createAuthMiddleware } = require('../shared/auth');
const { createJwtTokenService } = require('../shared/auth/tokenService');
const { createModule } = require('../shared');
const {
  createListLoans,
  createCreateSimulation,
  createGetLoanById,
  createCreateLoan,
  createListLoansByCustomer,
  createListLoansByAgent,
  createUpdateLoanStatus,
  createAssignAgent,
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
  createDownloadPromiseToPay,
} = require('./application/useCases');
const { createAttachmentUpload } = require('./presentation/attachmentUpload');
const { createCreditsComposition } = require('./composition');
const { createCreditsRouter } = require('./presentation/router');

/**
 * Compose the credits module entrypoint from shared policy, services, and router seams.
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createCreditsModule = () => {
  const authMiddleware = createAuthMiddleware({ tokenService: createJwtTokenService() });
  const {
    loanRepository,
    customerRepository,
    agentRepository,
    userRepository,
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
  } = createCreditsComposition();
  const attachmentUpload = createAttachmentUpload({ storage: attachmentStorage });
  const useCases = {
    listLoans: createListLoans({ loanRepository, loanAccessPolicy }),
    createSimulation: createCreateSimulation({ creditDomainService }),
    getLoanById: createGetLoanById({ loanRepository, loanAccessPolicy }),
    createLoan: createCreateLoan({ loanCreationService }),
    listLoansByCustomer: createListLoansByCustomer({ customerRepository, loanRepository }),
    listLoansByAgent: createListLoansByAgent({ agentRepository, loanRepository }),
    updateLoanStatus: createUpdateLoanStatus({ loanRepository, loanAccessPolicy }),
    assignAgent: createAssignAgent({ loanRepository, agentRepository, userRepository, notificationPort }),
    updateRecoveryStatus: createUpdateRecoveryStatus({ loanRepository, loanAccessPolicy, recoveryStatusGuard }),
    deleteLoan: createDeleteLoan({ loanRepository, loanAccessPolicy }),
    listLoanAttachments: createListLoanAttachments({ attachmentRepository, loanAccessPolicy }),
    createLoanAttachment: createCreateLoanAttachment({ attachmentRepository, attachmentStorage, loanAccessPolicy }),
    downloadLoanAttachment: createDownloadLoanAttachment({ attachmentRepository, attachmentStorage, loanAccessPolicy }),
    listLoanAlerts: createListLoanAlerts({ alertRepository, loanAccessPolicy, loanViewService }),
    getPaymentCalendar: createGetPaymentCalendar({ alertRepository, loanAccessPolicy, loanViewService }),
    getPayoffQuote: createGetPayoffQuote({ loanAccessPolicy, loanViewService }),
    executePayoff: createExecutePayoff({ loanAccessPolicy, paymentApplicationService }),
    listPromisesToPay: createListPromisesToPay({ promiseRepository, loanAccessPolicy }),
    createPromiseToPay: createCreatePromiseToPay({ promiseRepository, loanAccessPolicy }),
    downloadPromiseToPay: createDownloadPromiseToPay({ promiseRepository, loanAccessPolicy }),
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
