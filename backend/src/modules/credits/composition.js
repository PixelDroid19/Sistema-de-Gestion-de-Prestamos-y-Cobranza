const { createLoanAccessPolicy } = require('@/modules/shared/loanAccessPolicy');
const { createPaymentApplicationService } = require('./application/paymentApplicationService');
const { createLoanViewService } = require('./application/loanFinancials');
const { createRecoveryStatusGuard } = require('./application/recoveryStatusGuard');
const { createCreditsInfrastructure } = require('./infrastructure/repositories');
const { createOutboxEventRepository } = require('./infrastructure/outboxEventRepository');
const { createEventPublisher } = require('./application/eventPublisher');

/**
 * Select the credit ports that other modules are allowed to depend on.
 * @param {{ loanAccessPolicy: object, loanViewService: object, paymentApplicationService: object, attachmentStorage: object }} composition
 * @returns {{ loanAccessPolicy: object, loanViewService: object, paymentApplicationService: object, attachmentStorage: object, alertRepository: object, promiseRepository: object }}
 */
const pickCreditsPublicPorts = ({ loanAccessPolicy, loanViewService, paymentApplicationService, attachmentStorage, alertRepository, promiseRepository }) => ({
  loanAccessPolicy,
  loanViewService,
  paymentApplicationService,
  attachmentStorage,
  alertRepository,
  promiseRepository,
});

/**
 * Compose the credits module infrastructure, shared policy, and domain helpers.
 * @param {{ sharedRuntime?: object, infrastructure?: object, loanAccessPolicy?: object, loanViewService?: object, recoveryStatusGuard?: object, paymentApplicationService?: object }} [options]
 * @returns {object}
 */
const createCreditsComposition = ({
  sharedRuntime,
  infrastructure = createCreditsInfrastructure(),
  loanAccessPolicy = createLoanAccessPolicy({ loanRepository: infrastructure.loanRepository }),
  loanViewService = createLoanViewService(),
  recoveryStatusGuard = createRecoveryStatusGuard({ loanViewService }),
  eventPublisher = createEventPublisher(),
  paymentApplicationService = createPaymentApplicationService({
    loanViewService,
    notificationPort: infrastructure.notificationPort,
    eventPublisher,
  }),
  outboxEventRepository = createOutboxEventRepository(),
} = {}) => {
  const composition = {
    ...infrastructure,
    loanAccessPolicy,
    loanViewService,
    recoveryStatusGuard,
    paymentApplicationService,
    outboxEventRepository,
  };

  sharedRuntime?.registerModulePorts?.('credits', pickCreditsPublicPorts(composition));

  return composition;
};

module.exports = {
  createCreditsComposition,
  pickCreditsPublicPorts,
};
