/**
 * Calculation Adapter — the single entry point for credit simulation numbers.
 *
 * DAG is the single source of truth. There is no legacy fallback.
 */

const { DEFAULT_SCOPE_KEY } = require('./scopeRegistry');

const normalizeCalculationInput = (input = {}) => {
  const rawStartDate = input.startDate;

  if (rawStartDate !== undefined && rawStartDate !== null && rawStartDate !== '') {
    const parsedStartDate = new Date(rawStartDate);
    if (!Number.isNaN(parsedStartDate.getTime())) {
      return input;
    }
  }

  return {
    ...input,
    startDate: new Date().toISOString(),
  };
};

/**
 * @param {object} opts
 * @param {object} [opts.graphExecutor]       - createGraphExecutor instance (has .execute)
 * @param {string} [opts.scopeKey]
 */
const createCreditsCalculationService = ({
  graphExecutor = null,
  scopeKey = DEFAULT_SCOPE_KEY,
} = {}) => {
  if (!graphExecutor) {
    throw new Error('graphExecutor is required. DAG is the single source of truth.');
  }

  return {
    async calculate(input) {
      const normalizedInput = normalizeCalculationInput(input);

      const execution = await graphExecutor.execute({
        scopeKey,
        contractVars: normalizedInput,
      });

      return {
        result: execution.result,
        graphVersionId: execution.graphVersionId ?? null,
      };
    },
  };
};

module.exports = {
  createCreditsCalculationService,
};
