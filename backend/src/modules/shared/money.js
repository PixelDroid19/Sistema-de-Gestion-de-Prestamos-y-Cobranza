/**
 * Centralized monetary utility functions.
 *
 * All currency rounding, formatting, and precision operations throughout the
 * backend MUST use this module to ensure consistent behavior.
 *
 * Currency values are stored as IEEE-754 doubles. We round to 2 decimal places
 * at every persistence and presentation boundary.
 *
 * @module shared/money
 */

/**
 * Round a numeric value to 2 decimal places (banker-safe currency rounding).
 * @param {number|string} value - Raw numeric value.
 * @returns {number} Value rounded to 2 decimals.
 */
const roundCurrency = (value) => Number.parseFloat((Number(value) || 0).toFixed(2));

/**
 * Format a numeric value as a currency string with exactly 2 decimal places.
 * @param {number|string} value - Raw numeric value.
 * @returns {string} Formatted string e.g. "1234.56".
 */
const formatCurrency = (value) => roundCurrency(value).toFixed(2);

/**
 * Check whether a numeric/string value has at most N decimal places.
 * @param {number|string} value - The value to check.
 * @param {number} maxDecimals - Maximum allowed decimal places.
 * @returns {boolean}
 */
const hasDecimalPrecision = (value, maxDecimals) => {
  const stringValue = typeof value === 'string' ? value.trim() : String(value);
  return /^\d+(\.\d+)?$/.test(stringValue)
    && ((stringValue.split('.')[1] || '').length <= maxDecimals);
};

/**
 * Validate that a value represents a valid currency amount (up to 2 decimals).
 * @param {number|string} value
 * @returns {boolean}
 */
const validateCurrencyPrecision = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return false;
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
    return false;
  }

  return (normalizedValue.split('.')[1] || '').length <= 2;
};

/**
 * Parse a positive currency amount from operator/API input without accepting
 * JavaScript partial-number coercions such as "250abc" or exponent notation.
 * @param {number|string} value
 * @returns {number|null} Rounded positive amount, or null when invalid.
 */
const parsePositiveCurrencyAmount = (value) => {
  if (!validateCurrencyPrecision(value)) {
    return null;
  }

  const amount = Number(typeof value === 'string' ? value.trim() : value);
  return Number.isFinite(amount) && amount > 0 ? roundCurrency(amount) : null;
};

/**
 * Normalize a tolerance value, falling back to a default if invalid.
 * @param {number|string} value
 * @param {number} [fallback=0.01]
 * @returns {number}
 */
const normalizeTolerance = (value, fallback = 0.01) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/**
 * Compare two numeric values within a tolerance (for floating-point safe equality).
 * @param {number} left
 * @param {number} right
 * @param {number} [tolerance=0.01]
 * @returns {boolean}
 */
const compareWithinTolerance = (left, right, tolerance = 0.01) => {
  const normalizedTolerance = normalizeTolerance(tolerance);
  return Math.abs(Number(left || 0) - Number(right || 0)) <= normalizedTolerance + Number.EPSILON;
};

module.exports = {
  roundCurrency,
  formatCurrency,
  hasDecimalPrecision,
  validateCurrencyPrecision,
  parsePositiveCurrencyAmount,
  normalizeTolerance,
  compareWithinTolerance,
};
