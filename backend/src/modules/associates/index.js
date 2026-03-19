const { associateValidation } = require('../../middleware/validation');
const { createAuthMiddleware } = require('../shared/auth');
const { createJwtTokenService } = require('../shared/auth/tokenService');
const { createModule } = require('../shared');
const {
  createListAssociates,
  createCreateAssociate,
  createGetAssociateById,
  createUpdateAssociate,
  createDeleteAssociate,
} = require('./application/useCases');
const { associateRepository } = require('./infrastructure/repositories');
const { createAssociatesRouter } = require('./presentation/router');

const createAssociatesModule = () => {
  const authMiddleware = createAuthMiddleware({ tokenService: createJwtTokenService() });
  const useCases = {
    listAssociates: createListAssociates({ associateRepository }),
    createAssociate: createCreateAssociate({ associateRepository }),
    getAssociateById: createGetAssociateById({ associateRepository }),
    updateAssociate: createUpdateAssociate({ associateRepository }),
    deleteAssociate: createDeleteAssociate({ associateRepository }),
  };

  return createModule({
    name: 'associates',
    basePath: '/api/associates',
    router: createAssociatesRouter({ associateValidation, authMiddleware, useCases }),
  });
};

module.exports = {
  createAssociatesModule,
};
