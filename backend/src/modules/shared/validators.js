/**
 * Shared domain validation primitives.
 *
 * These are pure validation functions (no Express dependency) that can be
 * reused across middleware, application services, and domain layers.
 *
 * HTTP-layer middleware validators remain in @/middleware/validation.js and
 * compose these primitives where needed.
 *
 * @module shared/validators
 */

/**
 * Validate a basic email address shape.
 * @param {string} email
 * @returns {boolean}
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate an E.164-like phone number payload.
 * @param {string} phone
 * @returns {boolean}
 */
const validatePhone = (phone) => {
  const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate positive monetary amounts.
 * @param {number} amount
 * @returns {boolean}
 */
const validateAmount = (amount) => {
  return typeof amount === 'number' && amount > 0;
};

/**
 * Validate percentage rates (0-100 inclusive) without accepting JavaScript
 * exponent or partial-number coercions.
 * @param {number|string} rate
 * @returns {boolean}
 */
const validateInterestRate = (rate) => {
  if (typeof rate !== 'number' && typeof rate !== 'string') {
    return false;
  }

  const normalizedRate = typeof rate === 'string' ? rate.trim() : String(rate);
  if (!/^\d+(\.\d+)?$/.test(normalizedRate)) {
    return false;
  }

  const numericRate = Number(normalizedRate);
  return Number.isFinite(numericRate) && numericRate >= 0 && numericRate <= 100;
};

/**
 * Validate supported loan terms in months.
 * @param {number} term
 * @returns {boolean}
 */
const validateTermMonths = (term) => {
  return Number.isInteger(term) && term > 0 && term <= 360;
};

/**
 * Validate positive integer identifiers (route params or bodies).
 * @param {string|number} value
 * @returns {boolean}
 */
const validateIntegerId = (value) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+$/.test(normalizedValue)) {
    return false;
  }

  const numericValue = Number(normalizedValue);
  return Number.isSafeInteger(numericValue) && numericValue > 0;
};

/**
 * Validate an optional date input (null/undefined/empty are valid).
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
const validateOptionalDateInput = (value) => {
  const { isValidOptionalOperationalDate } = require('@/modules/shared/dateUtils');
  return isValidOptionalOperationalDate(value);
};

/**
 * Validate an idempotency key (8-160 chars string, optional).
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
const validateIdempotencyKey = (value) => {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  return typeof value === 'string'
    && value.trim().length >= 8
    && value.trim().length <= 160;
};

/**
 * Validate a numeric value falls within an integer range (optional).
 * @param {number|string|null|undefined} value
 * @param {number} min
 * @param {number} max
 * @returns {boolean}
 */
const validateIntegerRange = (value, min, max) => {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+$/.test(normalizedValue)) {
    return false;
  }

  const numericValue = Number(normalizedValue);
  return Number.isInteger(numericValue) && numericValue >= min && numericValue <= max;
};

/**
 * Validate a participation percentage (0-100, up to 4 decimals, optional).
 * @param {number|string|null|undefined} value
 * @returns {boolean}
 */
const validateParticipationPercentage = (value) => {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  const { hasDecimalPrecision } = require('@/modules/shared/money');
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    && numericValue >= 0
    && numericValue <= 100
    && hasDecimalPrecision(value, 4);
};

/**
 * Validate an associate interest rate (0-100, up to 4 decimals, optional).
 * @param {number|string|null|undefined} value
 * @returns {boolean}
 */
const validateAssociateInterestRate = (value) => {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  const { hasDecimalPrecision } = require('@/modules/shared/money');
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    && numericValue >= 0
    && numericValue <= 100
    && hasDecimalPrecision(value, 4);
};

module.exports = {
  validateEmail,
  validatePhone,
  validateAmount,
  validateInterestRate,
  validateTermMonths,
  validateIntegerId,
  validateOptionalDateInput,
  validateIdempotencyKey,
  validateIntegerRange,
  validateParticipationPercentage,
  validateAssociateInterestRate,
};
