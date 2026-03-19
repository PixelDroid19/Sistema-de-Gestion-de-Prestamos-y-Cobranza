const { createLoanAccessPolicy } = require('../shared/loanAccessPolicy');
const { createPaymentApplicationService } = require('../../services/paymentApplicationService');
const { createLoanViewService } = require('./application/loanFinancials');
const { createRecoveryStatusGuard } = require('./application/recoveryStatusGuard');
const { createCreditsInfrastructure } = require('./infrastructure/repositories');

/**
 * Select the credit ports that other modules are allowed to depend on.
 * @param {{ loanAccessPolicy: object, loanViewService: object }} composition
 * @returns {{ loanAccessPolicy: object, loanViewService: object }}
 */
const pickCreditsPublicPorts = ({ loanAccessPolicy, loanViewService }) => ({
  loanAccessPolicy,
  loanViewService,
});

/**
 * Compose the credits module infrastructure, shared policy, and domain helpers.
 * @param {{ infrastructure?: object, loanAccessPolicy?: object, loanViewService?: object, recoveryStatusGuard?: object, paymentApplicationService?: object }} [options]
 * @returns {object}
 */
const createCreditsComposition = ({
  infrastructure = createCreditsInfrastructure(),
  loanAccessPolicy = createLoanAccessPolicy({ loanRepository: infrastructure.loanRepository }),
  loanViewService = createLoanViewService(),
  recoveryStatusGuard = createRecoveryStatusGuard({ loanViewService }),
  paymentApplicationService = createPaymentApplicationService({ loanViewService }),
} = {}) => ({
  ...infrastructure,
  loanAccessPolicy,
  loanViewService,
  recoveryStatusGuard,
  paymentApplicationService,
});

module.exports = {
  createCreditsComposition,
  pickCreditsPublicPorts,
};
