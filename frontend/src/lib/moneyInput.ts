const DECIMAL_MONEY_PATTERN = /^(?:\d+|\d+\.\d{1,2}|\.\d{1,2})$/;
const DECIMAL_RATE_PATTERN = /^(?:\d+|\d+\.\d+)$/;

/**
 * Parses operator-entered money values from numeric inputs without accepting
 * JavaScript's partial-number coercions such as `100abc`.
 */
export const parsePositiveMoneyInput = (value: unknown): number | null => {
  const normalizedValue = String(value ?? '').trim();
  if (!DECIMAL_MONEY_PATTERN.test(normalizedValue)) {
    return null;
  }

  const amount = Number(normalizedValue);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

/**
 * Parses operator-entered positive integer counts without accepting JavaScript
 * coercions such as `1e2`, decimal text, or mixed alphanumeric values.
 */
export const parsePositiveIntegerInput = (value: unknown): number | null => {
  const normalizedValue = String(value ?? '').trim();
  if (!/^\d+$/.test(normalizedValue)) {
    return null;
  }

  const amount = Number(normalizedValue);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
};

/**
 * Parses percentage rates without accepting exponent notation, partial text, or
 * values outside the inclusive 0-100 range used by rate configuration fields.
 */
export const parsePercentageRateInput = (value: unknown): number | null => {
  const normalizedValue = String(value ?? '').trim();
  if (!DECIMAL_RATE_PATTERN.test(normalizedValue)) {
    return null;
  }

  const rate = Number(normalizedValue);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : null;
};

/**
 * Parses operator-entered percentage values with a fixed maximum decimal
 * precision, without accepting exponent notation or partial numeric text.
 */
export const parsePercentageWithPrecisionInput = (value: unknown, maxDecimals: number): number | null => {
  if (!Number.isSafeInteger(maxDecimals) || maxDecimals < 0) {
    return null;
  }

  const normalizedValue = String(value ?? '').trim();
  const decimalPattern = maxDecimals === 0
    ? /^\d+$/
    : new RegExp(`^(?:\\d+|\\d+\\.\\d{1,${maxDecimals}})$`);

  if (!decimalPattern.test(normalizedValue)) {
    return null;
  }

  const percentage = Number(normalizedValue);
  return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100 ? percentage : null;
};
