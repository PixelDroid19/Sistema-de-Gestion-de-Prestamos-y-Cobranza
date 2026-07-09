const { ValidationError } = require('@/utils/errorHandler');

const MIN_OPERATIONAL_YEAR = 1900;
const MAX_OPERATIONAL_YEAR = 2199;
const DATE_ONLY_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const ISO_OPERATIONAL_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:[T\s][0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\.[0-9]{1,3})?)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)?$/;

const DATE_FIELD_LABELS = {
  asOfDate: 'La fecha de consulta',
  contributionDate: 'La fecha del aporte',
  distributionDate: 'La fecha de distribución',
  dueDate: 'La fecha de vencimiento',
  endDate: 'La fecha final',
  expenseDate: 'La fecha del gasto',
  fromDate: 'La fecha inicial',
  'Loan start date': 'La fecha inicial',
  paymentDate: 'La fecha de pago',
  'Promise date': 'La fecha prometida',
  'Promise expiration date': 'La fecha de consulta',
  promisedDate: 'La fecha prometida',
  reinvestmentDate: 'La fecha de reinversión',
  'Schedule due date': 'La fecha de vencimiento',
  startDate: 'La fecha inicial',
  toDate: 'La fecha final',
};

const buildDateFieldLabel = (field = 'date') => DATE_FIELD_LABELS[field] || 'La fecha';
const buildDateFormatMessage = (field) => `${buildDateFieldLabel(field)} debe tener formato AAAA-MM-DD`;
const buildOperationalDateMessage = (field) => `${buildDateFieldLabel(field)} debe ser una fecha operativa válida`;
const buildRequiredDateMessage = (field) => `${buildDateFieldLabel(field)} es obligatoria`;
const buildDateRangeMessage = (fromField = 'fromDate', toField = 'toDate') => (
  `${buildDateFieldLabel(fromField)} debe ser anterior o igual a ${buildDateFieldLabel(toField).toLowerCase()}`
);

const assertOperationalYear = (date, field) => {
  const year = date.getUTCFullYear();
  if (year < MIN_OPERATIONAL_YEAR || year > MAX_OPERATIONAL_YEAR) {
    throw new ValidationError(`${buildDateFieldLabel(field)} debe estar entre los años ${MIN_OPERATIONAL_YEAR} y ${MAX_OPERATIONAL_YEAR}`);
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
    throw new ValidationError(buildDateFormatMessage(field));
  }

  assertOperationalYear(date, field);
  return date;
};

const normalizeDateOnly = (value, field = 'date') => {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(buildRequiredDateMessage(field));
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ValidationError(buildOperationalDateMessage(field));
    }
    const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    assertOperationalYear(date, field);
    return date;
  }

  const normalizedValue = String(value).trim();
  const parts = parseDateOnlyParts(normalizedValue)
    || (ISO_OPERATIONAL_PATTERN.test(normalizedValue) ? parseDateOnlyParts(normalizedValue.slice(0, 10)) : null);
  if (!parts) {
    throw new ValidationError(buildDateFormatMessage(field));
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
    throw new ValidationError(buildRequiredDateMessage(field));
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ValidationError(buildOperationalDateMessage(field));
    }
    assertOperationalYear(value, field);
    return new Date(value.getTime());
  }

  const normalizedValue = String(value).trim();
  if (!ISO_OPERATIONAL_PATTERN.test(normalizedValue)) {
    throw new ValidationError(buildOperationalDateMessage(field));
  }

  const dateOnlyParts = parseDateOnlyParts(normalizedValue);
  const parsed = dateOnlyParts
    ? buildUtcDateOnly(dateOnlyParts, field)
    : new Date(normalizedValue);

  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(buildOperationalDateMessage(field));
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
  buildDateFormatMessage,
  isValidDateOnly,
  isValidOptionalOperationalDate,
  buildDateRangeMessage,
  normalizeDateOnly,
  normalizeOperationalDate,
  normalizeOptionalDateOnlyString,
  normalizeOptionalOperationalDate,
  toDateOnlyOrNull,
  toOperationalDateOrNull,
};
