const { paymentValidation } = require('../../middleware/validation');
const { createPaymentApplicationService } = require('../../services/paymentApplicationService');
const { createAuthMiddleware } = require('../shared/auth');
const { createJwtTokenService } = require('../shared/auth/tokenService');
const { createModule } = require('../shared');
const { createCreditsPublicPorts } = require('../credits/public');
const { createListPayments, createCreatePayment, createListPaymentsByLoan } = require('./application/useCases');
const { paymentRepository } = require('./infrastructure/repositories');
const { createPayoutsRouter } = require('./presentation/router');

const createPayoutsModule = () => {
  const authMiddleware = createAuthMiddleware({ tokenService: createJwtTokenService() });
  const { loanAccessPolicy, loanViewService } = createCreditsPublicPorts();
  const paymentApplicationService = createPaymentApplicationService({ loanViewService });
  const useCases = {
    listPayments: createListPayments({ paymentRepository }),
    createPayment: createCreatePayment({ paymentApplicationService, loanAccessPolicy }),
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
