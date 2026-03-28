const { ValidationError } = require('../../../../utils/errorHandler');

const UNSUPPORTED_LATE_FEE_MODES = new Set(['SIMPLE_DAILY', 'COMPOUND_DAILY', 'FIXED_FEE']);

const normalizeLateFeeMode = (mode) => (typeof mode === 'string' && mode.trim()
  ? mode.trim().toUpperCase()
  : 'NONE');

const assertSupportedLateFeeMode = (lateFeeMode) => {
  const normalizedMode = normalizeLateFeeMode(lateFeeMode);

  if (UNSUPPORTED_LATE_FEE_MODES.has(normalizedMode)) {
    throw new ValidationError(`Late fee mode '${normalizedMode}' is not supported`);
  }

  return normalizedMode;
};

module.exports = {
  UNSUPPORTED_LATE_FEE_MODES,
  normalizeLateFeeMode,
  assertSupportedLateFeeMode,
};
