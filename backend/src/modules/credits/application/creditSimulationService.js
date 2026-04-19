const {
  buildAmortizationSchedule,
  summarizeSchedule,
} = require('./creditFormulaHelpers');
const {
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
} = require('./dag/lateFeeMode');

/**
 * Generate the canonical backend simulation for a credit request.
 * @param {{ amount: number, interestRate: number, termMonths: number, startDate?: string|Date, lateFeeMode?: string }} input
 * @returns {{ lateFeeMode: string, schedule: Array<object>, summary: object }}
 */
const simulateCredit = (input) => {
  const lateFeeMode = assertSupportedLateFeeMode(input.lateFeeMode);
  const schedule = buildAmortizationSchedule(input);
  const summary = summarizeSchedule(schedule);

  return {
    lateFeeMode,
    schedule,
    summary,
  };
};

const createCreditSimulationService = ({ calculationService } = {}) => ({
  async simulate(input) {
    if (!calculationService) {
      return { ...simulateCredit(input), graphVersionId: null };
    }

    const execution = await calculationService.calculate(input);
    return {
      ...execution.result,
      graphVersionId: execution.graphVersionId ?? null,
    };
  },
  async simulateDetailed(input) {
    if (!calculationService) {
      return {
        selectedSource: 'legacy',
        fallbackReason: null,
        parity: { passed: true, mismatches: [] },
        result: simulateCredit(input),
        graphVersionId: null,
      };
    }

    return calculationService.calculate(input);
  },
});

module.exports = {
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
  createCreditSimulationService,
  simulateCredit,
};
