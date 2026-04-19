const { createLoanAccessPolicy } = require('@/modules/shared/loanAccessPolicy');
const { createPaymentApplicationService } = require('./application/paymentApplicationService');
const { createLoanViewService } = require('./application/loanFinancials');
const { createRecoveryStatusGuard } = require('./application/recoveryStatusGuard');
const { createCreditsDagConfig } = require('./application/dag/config');
const { createDagWorkbenchService } = require('./application/dag/workbenchService');
const { createCreditsInfrastructure } = require('./infrastructure/repositories');
const { createPaymentRouter } = require('./presentation/paymentRouter');
const { createOutboxEventRepository } = require('./infrastructure/outboxEventRepository');

/**
 * Select the credit ports that other modules are allowed to depend on.
 * @param {{ loanAccessPolicy: object, loanViewService: object, paymentApplicationService: object, attachmentStorage: object }} composition
 * @returns {{ loanAccessPolicy: object, loanViewService: object, paymentApplicationService: object, attachmentStorage: object }}
 */
const pickCreditsPublicPorts = ({ loanAccessPolicy, loanViewService, paymentApplicationService, attachmentStorage, creditsDagConfig, dagWorkbenchService }) => ({
  loanAccessPolicy,
  loanViewService,
  paymentApplicationService,
  attachmentStorage,
  creditsDagConfig,
  dagWorkbenchService,
});

/**
 * Compose the credits module infrastructure, shared policy, and domain helpers.
 * @param {{ sharedRuntime?: object, infrastructure?: object, loanAccessPolicy?: object, loanViewService?: object, recoveryStatusGuard?: object, paymentApplicationService?: object }} [options]
 * @returns {object}
 */
const createCreditsComposition = ({
  sharedRuntime,
  dagConfig = createCreditsDagConfig(),
  infrastructure = createCreditsInfrastructure({ dagConfig }),
  loanAccessPolicy = createLoanAccessPolicy({ loanRepository: infrastructure.loanRepository }),
  loanViewService = createLoanViewService(),
  recoveryStatusGuard = createRecoveryStatusGuard({ loanViewService }),
  paymentApplicationService = createPaymentApplicationService({ loanViewService }),
  dagWorkbenchService = createDagWorkbenchService({
    dagConfig,
    dagGraphRepository: infrastructure.dagGraphRepository,
    dagSimulationSummaryRepository: infrastructure.dagSimulationSummaryRepository,
    graphExecutor: infrastructure.graphExecutor,
  }),
  outboxEventRepository = createOutboxEventRepository(),
  paymentRouter = createPaymentRouter({ paymentApplicationService }),
} = {}) => {
  const composition = {
    ...infrastructure,
    creditsDagConfig: dagConfig,
    loanAccessPolicy,
    loanViewService,
    recoveryStatusGuard,
    paymentApplicationService,
    dagWorkbenchService,
    outboxEventRepository,
    paymentRouter,
  };

  sharedRuntime?.registerModulePorts?.('credits', pickCreditsPublicPorts(composition));

  return composition;
};

module.exports = {
  createCreditsComposition,
  pickCreditsPublicPorts,
};
