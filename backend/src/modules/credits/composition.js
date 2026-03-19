const { createLoanAccessPolicy } = require('../shared/loanAccessPolicy');
const { createLoanViewService } = require('./application/loanFinancials');
const { createRecoveryStatusGuard } = require('./application/recoveryStatusGuard');
const { createCreditsInfrastructure } = require('./infrastructure/repositories');

const pickCreditsPublicPorts = ({ loanAccessPolicy, loanViewService }) => ({
  loanAccessPolicy,
  loanViewService,
});

const createCreditsComposition = ({
  infrastructure = createCreditsInfrastructure(),
  loanAccessPolicy = createLoanAccessPolicy({ loanRepository: infrastructure.loanRepository }),
  loanViewService = createLoanViewService(),
  recoveryStatusGuard = createRecoveryStatusGuard({ loanViewService }),
} = {}) => ({
  ...infrastructure,
  loanAccessPolicy,
  loanViewService,
  recoveryStatusGuard,
});

module.exports = {
  createCreditsComposition,
  pickCreditsPublicPorts,
};
