const {
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
} = require('./dag/lateFeeMode');

const resolvePolicyAdjustedInput = async ({ input, policyResolver }) => {
  if (!policyResolver || typeof policyResolver.resolve !== 'function') {
    return {
      calculationInput: input,
      policySnapshot: null,
    };
  }

  return policyResolver.resolve({ input });
};

const withPolicySnapshot = (result, policySnapshot) => {
  if (!policySnapshot) {
    return result;
  }

  return {
    ...result,
    policySnapshot,
  };
};

/**
 * Create the public credit calculation service used by HTTP calculations.
 * @param {{ calculationService: object, policyResolver?: object }} [dependencies]
 * @returns {{ calculate(input: object): Promise<object>, calculateDetailed(input: object): Promise<object> }}
 */
const createCreditCalculationService = ({ calculationService, policyResolver } = {}) => {
  if (!calculationService) {
    throw new Error('createCreditCalculationService requires calculationService. DAG is the single source of truth.');
  }

  return {
    async calculate(input) {
      const policyContext = await resolvePolicyAdjustedInput({ input, policyResolver });
      const execution = await calculationService.calculate(policyContext.calculationInput);
      return {
        ...withPolicySnapshot(execution.result, policyContext.policySnapshot),
        graphVersionId: execution.graphVersionId ?? null,
      };
    },
    async calculateDetailed(input) {
      const policyContext = await resolvePolicyAdjustedInput({ input, policyResolver });
      const execution = await calculationService.calculate(policyContext.calculationInput);
      return {
        ...execution,
        result: withPolicySnapshot(execution.result, policyContext.policySnapshot),
      };
    },
  };
};

module.exports = {
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
  createCreditCalculationService,
  resolvePolicyAdjustedInput,
};
