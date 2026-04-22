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
  simulateCredit,
};
