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
} = require('./application/useCases');
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
    creditDomainService,
    loanCreationService,
    notificationPort,
    loanAccessPolicy,
    recoveryStatusGuard,
  } = createCreditsComposition();
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
  };

  return createModule({
    name: 'credits',
    basePath: '/api/loans',
    router: createCreditsRouter({ authMiddleware, loanValidation, useCases }),
  });
};

module.exports = {
  createCreditsModule,
};
