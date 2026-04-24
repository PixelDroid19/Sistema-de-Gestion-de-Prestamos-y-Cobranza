const {
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
} = require('./dag/lateFeeMode');

const createCreditCalculationService = ({ calculationService } = {}) => {
  if (!calculationService) {
    throw new Error('createCreditCalculationService requires calculationService. DAG is the single source of truth.');
  }

  return {
    async calculate(input) {
      const execution = await calculationService.calculate(input);
      return {
        ...execution.result,
        graphVersionId: execution.graphVersionId ?? null,
      };
    },
    async calculateDetailed(input) {
      return calculationService.calculate(input);
    },
  };
};

module.exports = {
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
  createCreditCalculationService,
};
