const {
  roundCurrency,
  calculateInstallmentAmount,
  buildAmortizationSchedule,
  summarizeSchedule,
  cloneSchedule,
  addMonths,
  calculateLateFee,
  normalizeCalculationMethod,
  assertSupportedCalculationMethod,
} = require('@/modules/credits/domain/calculation');

module.exports = {
  roundCurrency,
  calculateInstallmentAmount,
  buildAmortizationSchedule,
  summarizeSchedule,
  cloneSchedule,
  addMonths,
  calculateLateFee,
  normalizeCalculationMethod,
  assertSupportedCalculationMethod,
};
