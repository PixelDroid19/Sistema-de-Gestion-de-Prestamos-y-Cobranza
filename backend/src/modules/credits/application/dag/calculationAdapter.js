/**
 * Calculation Adapter — the single entry point for credit calculation numbers.
 *
 * DAG is the single source of truth. There is no legacy fallback.
 */

const { DEFAULT_SCOPE_KEY } = require('./scopeRegistry');

const addOneMonthClamped = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfTargetMonth)));
};

const resolveDefaultFirstPaymentDate = () => {
  const now = new Date();
  return addOneMonthClamped(now).toISOString();
};

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
    startDate: resolveDefaultFirstPaymentDate(),
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
