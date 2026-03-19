const { ValidationError } = require('../utils/errorHandler');
const {
  buildAmortizationSchedule,
  summarizeSchedule,
} = require('./creditFormulaHelpers');

const UNSUPPORTED_LATE_FEE_MODES = new Set(['LINEAR', 'EFFECTIVE', 'SMART HYBRID']);

const normalizeLateFeeMode = (mode) => (typeof mode === 'string' && mode.trim()
  ? mode.trim().toUpperCase()
  : 'NONE');

/**
 * Reject unsupported late-fee modes before financial processing.
 * @param {string|undefined|null} lateFeeMode
 */
const assertSupportedLateFeeMode = (lateFeeMode) => {
  const normalizedMode = normalizeLateFeeMode(lateFeeMode);

  if (UNSUPPORTED_LATE_FEE_MODES.has(normalizedMode)) {
    throw new ValidationError(`Late fee mode '${normalizedMode}' is not supported`);
  }

  return normalizedMode;
};

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

module.exports = {
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
  simulateCredit,
};
