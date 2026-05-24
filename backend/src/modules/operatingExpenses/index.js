const { createModule, resolveAuthContext } = require('@/modules/shared');
const {
  createListOperatingExpenses,
  createCreateOperatingExpense,
  createAnnulOperatingExpense,
} = require('./application/useCases');
const { operatingExpenseRepository } = require('./infrastructure/repositories');
const { createOperatingExpensesRouter } = require('./presentation/router');

/**
 * Compose the operating expenses module for traceable administrative cash outflows.
 * @param {{ sharedRuntime?: object }} [options]
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createOperatingExpensesModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const useCases = {
    listOperatingExpenses: createListOperatingExpenses({ operatingExpenseRepository }),
    createOperatingExpense: createCreateOperatingExpense({ operatingExpenseRepository }),
    annulOperatingExpense: createAnnulOperatingExpense({ operatingExpenseRepository }),
  };

  return createModule({
    name: 'operatingExpenses',
    basePath: '/api/operating-expenses',
    router: createOperatingExpensesRouter({ authMiddleware, useCases }),
  });
};

module.exports = {
  createOperatingExpensesModule,
};
