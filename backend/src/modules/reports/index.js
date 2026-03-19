const { createAuthMiddleware } = require('../shared/auth');
const { createJwtTokenService } = require('../shared/auth/tokenService');
const { createModule } = require('../shared');
const { createCreditsPublicPorts } = require('../credits/public');
const {
  createGetRecoveredLoans,
  createGetOutstandingLoans,
  createGetRecoveryReport,
} = require('./application/useCases');
const { reportRepository, paymentRepository } = require('./infrastructure/repositories');
const { createReportsRouter } = require('./presentation/router');

const createReportsModule = () => {
  const authMiddleware = createAuthMiddleware({ tokenService: createJwtTokenService() });
  const { loanViewService } = createCreditsPublicPorts();
  const useCases = {
    getRecoveredLoans: createGetRecoveredLoans({ reportRepository, paymentRepository, loanViewService }),
    getOutstandingLoans: createGetOutstandingLoans({ reportRepository, paymentRepository, loanViewService }),
    getRecoveryReport: createGetRecoveryReport({ reportRepository, paymentRepository, loanViewService }),
  };

  return createModule({
    name: 'reports',
    basePath: '/api/reports',
    router: createReportsRouter({ authMiddleware, useCases }),
  });
};

module.exports = {
  createReportsModule,
};
