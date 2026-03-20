const { createLoanAccessPolicy } = require('../shared/loanAccessPolicy');
const { createPaymentApplicationService } = require('./application/paymentApplicationService');
const { createLoanViewService } = require('./application/loanFinancials');
const { createRecoveryStatusGuard } = require('./application/recoveryStatusGuard');
const { createCreditsInfrastructure } = require('./infrastructure/repositories');

/**
 * Select the credit ports that other modules are allowed to depend on.
 * @param {{ loanAccessPolicy: object, loanViewService: object, paymentApplicationService: object }} composition
 * @returns {{ loanAccessPolicy: object, loanViewService: object, paymentApplicationService: object }}
 */
const pickCreditsPublicPorts = ({ loanAccessPolicy, loanViewService, paymentApplicationService }) => ({
  loanAccessPolicy,
  loanViewService,
  paymentApplicationService,
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
  paymentApplicationService = createPaymentApplicationService({ loanViewService }),
} = {}) => {
  const composition = {
    ...infrastructure,
    loanAccessPolicy,
    loanViewService,
    recoveryStatusGuard,
    paymentApplicationService,
  };

  sharedRuntime?.registerModulePorts?.('credits', pickCreditsPublicPorts(composition));

  return composition;
};

module.exports = {
  createCreditsComposition,
  pickCreditsPublicPorts,
};
