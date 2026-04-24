const {
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
  createCreditCalculationService,
} = require('./creditCalculationService');

const createCreditSimulationService = (deps) => {
  const service = createCreditCalculationService(deps);
  return {
    simulate: service.calculate,
    simulateDetailed: service.calculateDetailed,
  };
};

module.exports = {
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
  createCreditCalculationService,
  createCreditSimulationService,
};
