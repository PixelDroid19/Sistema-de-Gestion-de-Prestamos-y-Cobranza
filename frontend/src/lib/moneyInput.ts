const DECIMAL_MONEY_PATTERN = /^(?:\d+|\d+\.\d{1,2}|\.\d{1,2})$/;
const DECIMAL_RATE_PATTERN = /^(?:\d+|\d+\.\d+)$/;
const FORMATTED_WHOLE_MONEY_FORBIDDEN_PATTERN = /[A-Za-z+\-]/;

type NumericRangeOptions = {
  allowZero?: boolean;
  min?: number;
  max?: number;
  maxDigits?: number;
};

type DecimalOptions = NumericRangeOptions & {
  maxDecimals?: number;
};

const isWithinRange = (value: number, options: NumericRangeOptions = {}) => {
  if (!Number.isFinite(value)) return false;
  if (!options.allowZero && value === 0) return false;
  if (options.min !== undefined && value < options.min) return false;
  if (options.max !== undefined && value > options.max) return false;
  return true;
};

const exceedsUpperBound = (value: number, options: NumericRangeOptions = {}) => (
  Number.isFinite(value)
  && options.max !== undefined
  && value > options.max
);

export const formatDigitGroups = (digits: string): string => {
  if (!/^\d+$/.test(digits)) {
    return '';
  }

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const normalizeTextInput = (value: unknown, options: { trim?: boolean; maxLength?: number } = {}): string => {
  const rawValue = String(value ?? '');
  const normalizedValue = options.trim ? rawValue.trim() : rawValue;
  return options.maxLength && options.maxLength >= 0
    ? normalizedValue.slice(0, options.maxLength)
    : normalizedValue;
};

export const normalizeIntegerInput = (value: unknown, options: NumericRangeOptions = {}): string | null => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '';
  if (!/^\d+$/.test(rawValue)) return null;

  const digits = rawValue.replace(/^0+(?=\d)/, '');
  if (options.maxDigits && digits.length > options.maxDigits) return null;

  const numericValue = Number(digits);
  if (!Number.isSafeInteger(numericValue)) return null;
  if (exceedsUpperBound(numericValue, options)) return null;

  return digits;
};

export const normalizeDecimalInput = (value: unknown, options: DecimalOptions = {}): string | null => {
  const rawValue = String(value ?? '').trim().replace(',', '.');
  const maxDecimals = options.maxDecimals ?? 2;
  if (!rawValue) return '';
  if (!Number.isSafeInteger(maxDecimals) || maxDecimals < 0) return null;

  const decimalPattern = maxDecimals === 0
    ? /^\d+$/
    : new RegExp(`^(?:\\d+|\\d+\\.\\d{0,${maxDecimals}}|\\.\\d{0,${maxDecimals}})$`);
  if (!decimalPattern.test(rawValue)) return null;

  const [wholePart, decimalPart = ''] = rawValue.split('.');
  const normalizedWhole = (wholePart || '0').replace(/^0+(?=\d)/, '');
  if (options.maxDigits && normalizedWhole.length > options.maxDigits) return null;

  const normalizedValue = rawValue.includes('.')
    ? `${normalizedWhole}.${decimalPart}`
    : normalizedWhole;
  const numericValue = Number(normalizedValue);
  if (exceedsUpperBound(numericValue, options)) return null;

  return normalizedValue;
};

export const normalizePercentInput = (value: unknown, options: DecimalOptions = {}): string | null => (
  normalizeDecimalInput(value, {
    ...options,
    allowZero: options.allowZero ?? true,
    min: options.min ?? 0,
    max: options.max ?? 100,
    maxDecimals: options.maxDecimals ?? 4,
    maxDigits: options.maxDigits ?? 3,
  })
);

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

export const normalizeWholeMoneyInput = (value: unknown): string | null => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }

  if (FORMATTED_WHOLE_MONEY_FORBIDDEN_PATTERN.test(rawValue)) {
    return null;
  }

  const digits = rawValue.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits;
};

export const formatWholeMoneyInput = (value: unknown): string => {
  const normalizedValue = normalizeWholeMoneyInput(value);
  if (normalizedValue === null || normalizedValue === '') {
    return '';
  }
  return formatDigitGroups(normalizedValue);
};

export const parseFormattedPositiveMoneyInput = (value: unknown): number | null => {
  const normalizedValue = normalizeWholeMoneyInput(value);
  if (normalizedValue === null || normalizedValue === '') {
    return null;
  }

  const amount = Number(normalizedValue);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
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
