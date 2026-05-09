const { roundCurrency, normalizeTolerance, compareWithinTolerance } = require('./precision');
const {
  SUPPORTED_CALCULATION_METHODS,
  SUPPORTED_METHOD_KEYS,
  normalizeCalculationMethod,
  assertSupportedCalculationMethod,
} = require('./calculationMethods');
const {
  SUPPORTED_LATE_FEE_MODES,
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
  calculateLateFee,
} = require('./lateFeeCalculator');
const {
  calculateInstallmentAmount,
  buildAmortizationSchedule,
  summarizeSchedule,
  cloneSchedule,
  addMonths,
  resolveFirstPaymentDate,
} = require('./amortizationMethods');
const {
  DEFAULT_CALCULATION_SCOPE_KEY,
  DEFAULT_CALCULATION_PROFILE,
  DEFAULT_PROFILE_PARAMETERS,
  normalizeProfile,
  assertActiveProfile,
} = require('./calculationProfiles');
const { buildCalculationExplanation } = require('./calculationExplainer');
const { buildPolicySnapshot } = require('./policySnapshotBuilder');
const { calculateCredit, normalizeCreditCalculationInput } = require('./creditCalculationEngine');
const { createProfileBackedCalculationService } = require('./profileBackedCalculationService');

module.exports = {
  roundCurrency,
  normalizeTolerance,
  compareWithinTolerance,
  SUPPORTED_CALCULATION_METHODS,
  SUPPORTED_METHOD_KEYS,
  normalizeCalculationMethod,
  assertSupportedCalculationMethod,
  SUPPORTED_LATE_FEE_MODES,
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
  calculateLateFee,
  calculateInstallmentAmount,
  buildAmortizationSchedule,
  summarizeSchedule,
  cloneSchedule,
  addMonths,
  resolveFirstPaymentDate,
  DEFAULT_CALCULATION_SCOPE_KEY,
  DEFAULT_CALCULATION_PROFILE,
  DEFAULT_PROFILE_PARAMETERS,
  normalizeProfile,
  assertActiveProfile,
  buildCalculationExplanation,
  buildPolicySnapshot,
  calculateCredit,
  normalizeCreditCalculationInput,
  createProfileBackedCalculationService,
};
