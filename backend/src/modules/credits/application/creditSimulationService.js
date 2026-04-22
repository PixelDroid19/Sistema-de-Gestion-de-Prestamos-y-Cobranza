const {
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
} = require('./dag/lateFeeMode');

const createCreditSimulationService = ({ calculationService } = {}) => {
  if (!calculationService) {
    throw new Error('createCreditSimulationService requires calculationService. DAG is the single source of truth.');
  }

  return {
    async simulate(input) {
      const execution = await calculationService.calculate(input);
      return {
        ...execution.result,
        graphVersionId: execution.graphVersionId ?? null,
      };
    },
    async simulateDetailed(input) {
      return calculationService.calculate(input);
    },
  };
};

module.exports = {
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
  createCreditSimulationService,
};
