const { paymentValidation } = require('../../middleware/validation');
const { createModule, resolveAuthContext } = require('../shared');
const { createCreditsPublicPorts } = require('../credits/public');
const {
  createListPayments,
  createCreatePayment,
  createCreatePartialPayment,
  createCreateCapitalPayment,
  createAnnulInstallment,
  createListPaymentsByLoan,
} = require('./application/useCases');
const { paymentRepository } = require('./infrastructure/repositories');
const { createPayoutsRouter } = require('./presentation/router');

/**
 * Compose the payouts module entrypoint from payment and loan public seams.
 */
const createPayoutsModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const { loanAccessPolicy, paymentApplicationService } = createCreditsPublicPorts({ sharedRuntime });
  const useCases = {
    listPayments: createListPayments({ paymentRepository }),
    createPayment: createCreatePayment({ paymentApplicationService, loanAccessPolicy }),
    createPartialPayment: createCreatePartialPayment({ paymentApplicationService, loanAccessPolicy }),
    createCapitalPayment: createCreateCapitalPayment({ paymentApplicationService, loanAccessPolicy }),
    annulInstallment: createAnnulInstallment({ paymentApplicationService, loanAccessPolicy }),
    listPaymentsByLoan: createListPaymentsByLoan({ paymentRepository, loanAccessPolicy }),
  };

  return createModule({
    name: 'payouts',
    basePath: '/api/payments',
    router: createPayoutsRouter({ authMiddleware, paymentValidation, useCases }),
  });
};

module.exports = {
  createPayoutsModule,
};
