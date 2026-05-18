const { ValidationError } = require('@/utils/errorHandler');

const MIN_OPERATIONAL_YEAR = 1900;
const MAX_OPERATIONAL_YEAR = 2199;
const DATE_ONLY_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const ISO_OPERATIONAL_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:[T\s][0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\.[0-9]{1,3})?)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)?$/;

const assertOperationalYear = (date, field) => {
  const year = date.getUTCFullYear();
  if (year < MIN_OPERATIONAL_YEAR || year > MAX_OPERATIONAL_YEAR) {
    throw new ValidationError(`${field} must be between years ${MIN_OPERATIONAL_YEAR} and ${MAX_OPERATIONAL_YEAR}`);
  }
};

const parseDateOnlyParts = (value) => {
  const match = DATE_ONLY_PATTERN.exec(String(value || '').trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

const buildUtcDateOnly = ({ year, month, day }, field) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new ValidationError(`${field} must be a valid YYYY-MM-DD date`);
  }

  assertOperationalYear(date, field);
  return date;
};

const normalizeDateOnly = (value, field = 'date') => {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${field} is required`);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ValidationError(`${field} must be a valid date`);
    }
    const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    assertOperationalYear(date, field);
    return date;
  }

  const normalizedValue = String(value).trim();
  const parts = parseDateOnlyParts(normalizedValue)
    || (ISO_OPERATIONAL_PATTERN.test(normalizedValue) ? parseDateOnlyParts(normalizedValue.slice(0, 10)) : null);
  if (!parts) {
    throw new ValidationError(`${field} must be a valid YYYY-MM-DD date`);
  }

  return buildUtcDateOnly(parts, field);
};

const normalizeOptionalDateOnlyString = (value, field = 'date') => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return normalizeDateOnly(value, field).toISOString().slice(0, 10);
};

const normalizeOperationalDate = (value, field = 'date') => {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${field} is required`);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ValidationError(`${field} must be a valid date`);
    }
    assertOperationalYear(value, field);
    return new Date(value.getTime());
  }

  const normalizedValue = String(value).trim();
  if (!ISO_OPERATIONAL_PATTERN.test(normalizedValue)) {
    throw new ValidationError(`${field} must be a valid ISO date`);
  }

  const dateOnlyParts = parseDateOnlyParts(normalizedValue);
  const parsed = dateOnlyParts
    ? buildUtcDateOnly(dateOnlyParts, field)
    : new Date(normalizedValue);

  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${field} must be a valid ISO date`);
  }

  assertOperationalYear(parsed, field);
  return parsed;
};

const normalizeOptionalOperationalDate = (value, field = 'date') => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return normalizeOperationalDate(value, field);
};

const isValidOptionalOperationalDate = (value) => {
  try {
    normalizeOptionalOperationalDate(value);
    return true;
  } catch (_error) {
    return false;
  }
};

const isValidDateOnly = (value) => {
  try {
    normalizeDateOnly(value);
    return true;
  } catch (_error) {
    return false;
  }
};

const toDateOnlyOrNull = (value) => {
  try {
    return normalizeOperationalDate(value).toISOString().slice(0, 10);
  } catch (_error) {
    return null;
  }
};

const toOperationalDateOrNull = (value) => {
  try {
    return normalizeOperationalDate(value);
  } catch (_error) {
    return null;
  }
};

module.exports = {
  MAX_OPERATIONAL_YEAR,
  MIN_OPERATIONAL_YEAR,
  isValidDateOnly,
  isValidOptionalOperationalDate,
  normalizeDateOnly,
  normalizeOperationalDate,
  normalizeOptionalDateOnlyString,
  normalizeOptionalOperationalDate,
  toDateOnlyOrNull,
  toOperationalDateOrNull,
};
