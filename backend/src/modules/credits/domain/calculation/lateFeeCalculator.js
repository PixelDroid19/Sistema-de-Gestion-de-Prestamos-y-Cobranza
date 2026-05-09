const { ValidationError } = require('@/utils/errorHandler');
const { roundCurrency } = require('./precision');

const SUPPORTED_LATE_FEE_MODES = new Set(['NONE', 'SIMPLE', 'COMPOUND', 'FLAT', 'TIERED']);
const UNSUPPORTED_LATE_FEE_MODES = new Set(['SIMPLE_DAILY', 'COMPOUND_DAILY', 'FIXED_FEE']);

const normalizeLateFeeMode = (mode) => (typeof mode === 'string' && mode.trim()
  ? mode.trim().toUpperCase()
  : 'NONE');

const assertSupportedLateFeeMode = (mode) => {
  const normalizedMode = normalizeLateFeeMode(mode);

  if (UNSUPPORTED_LATE_FEE_MODES.has(normalizedMode) || !SUPPORTED_LATE_FEE_MODES.has(normalizedMode)) {
    throw new ValidationError(`Modo de mora invalido: ${normalizedMode}. Usa NONE, SIMPLE, COMPOUND, FLAT o TIERED.`);
  }

  return normalizedMode;
};

const calculateLateFee = ({
  overdueAmount,
  daysOverdue,
  feeMode,
  annualRate = 0,
  flatFeePerDay = 0,
  baseRate = 0,
}) => {
  const mode = assertSupportedLateFeeMode(feeMode);
  const principal = Number(overdueAmount) || 0;
  const days = Number(daysOverdue) || 0;

  if (mode === 'NONE' || principal <= 0 || days <= 0) {
    return roundCurrency(0);
  }

  if (mode === 'SIMPLE') {
    return roundCurrency(principal * (Number(annualRate) / 100 / 365) * days);
  }

  if (mode === 'COMPOUND') {
    const dailyRate = Number(annualRate) / 100 / 365;
    return roundCurrency(principal * (Math.pow(1 + dailyRate, days) - 1));
  }

  if (mode === 'FLAT') {
    return roundCurrency((Number(flatFeePerDay) || 0) * days);
  }

  const baseDailyRate = (Number(baseRate) || 0) / 100 / 365;
  const tier1Days = Math.min(days, 30);
  const tier2Days = days > 30 ? Math.min(days - 30, 30) : 0;
  const tier3Days = days > 60 ? days - 60 : 0;
  const fee = (principal * baseDailyRate * tier1Days)
    + (principal * (baseDailyRate * 1.5) * tier2Days)
    + (principal * (baseDailyRate * 2) * tier3Days);

  return roundCurrency(fee);
};

module.exports = {
  SUPPORTED_LATE_FEE_MODES,
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
  calculateLateFee,
};
