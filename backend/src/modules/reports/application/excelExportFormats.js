const MONEY_FORMAT = '"$" #,##0.00;[Red]-"$" #,##0.00;"-"';
const MONEY_FORMAT_COMPACT = '"$"#,##0.00';
const PERCENT_FORMAT = '0.00%';
const DATE_FORMAT = 'dd/mm/yyyy';
const DATE_TIME_FORMAT = 'dd/mm/yyyy h:mm AM/PM';
const INTEGER_FORMAT = '#,##0';
const TNA_FORMAT = '0.00"%"';

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const formattedRow = (row, formats = {}) => ({
  ...row,
  __formats: Object.entries(formats).reduce((acc, [key, numFmt]) => {
    if (numFmt) {
      acc[key] = { numFmt };
    }
    return acc;
  }, {}),
});

const summaryRow = (section, indicator, value, valueFormat) => formattedRow(
  { section, indicator, value },
  { value: valueFormat },
);

const creditInfoRow = (campo, valor, valueFormat) => formattedRow(
  { campo, valor },
  { valor: valueFormat },
);

const indicatorRow = (indicator, value, valueFormat, valueKey = 'value') => formattedRow(
  { indicator, value },
  valueFormat ? { [valueKey]: valueFormat } : {},
);

const dashboardRow = (indicador, valor, valueFormat) => formattedRow(
  { indicador, valor },
  valueFormat ? { valor: valueFormat } : {},
);

const toExcelDate = (value) => {
  if (!value || value === 'N/A') {
    return '';
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date;
};

const toExcelDateTime = (value) => {
  if (!value) {
    return new Date();
  }

  return toExcelDate(value) || new Date();
};

const parseExcelNumber = (value, { isPercentFormat = false } = {}) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== 'string') {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || /^n\/?a$/i.test(trimmed)) {
    return 0;
  }

  const hasPercentSymbol = trimmed.includes('%');
  const isParenthesesNegative = /^\(.*\)$/.test(trimmed);
  let sanitized = trimmed
    .replace(/[^\d,.\-()]/g, '')
    .replace(/[()]/g, '');

  if (!sanitized || sanitized === '-' || sanitized === '.' || sanitized === ',') {
    return 0;
  }

  const lastComma = sanitized.lastIndexOf(',');
  const lastDot = sanitized.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    sanitized = lastComma > lastDot
      ? sanitized.replace(/\./g, '').replace(',', '.')
      : sanitized.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const parts = sanitized.split(',');
    const lastPart = parts[parts.length - 1];
    sanitized = parts.length === 2 && lastPart.length <= 2
      ? `${parts[0]}.${lastPart}`
      : sanitized.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const parts = sanitized.split('.');
    const lastPart = parts[parts.length - 1];
    if (parts.length > 2 && lastPart.length === 3) {
      sanitized = sanitized.replace(/\./g, '');
    } else if (parts.length > 2) {
      sanitized = `${parts.slice(0, -1).join('')}.${lastPart}`;
    }
  }

  const parsed = Number(sanitized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  const signedValue = isParenthesesNegative ? -Math.abs(parsed) : parsed;
  return isPercentFormat && hasPercentSymbol ? signedValue / 100 : signedValue;
};

const parseExcelMoney = (value) => roundMoney(parseExcelNumber(value));
const parseExcelPercent = (value) => parseExcelNumber(value, { isPercentFormat: true });

const isDateExcelFormat = (numFmt) => {
  const format = String(numFmt || '').toLowerCase();
  return /(dd|mm|yyyy|yy|hh|ss)/.test(format);
};

const isNumericExcelFormat = (numFmt) => {
  const format = String(numFmt || '').toLowerCase();
  return Boolean(format)
    && /[#0]/.test(format)
    && !isDateExcelFormat(format);
};

module.exports = {
  MONEY_FORMAT,
  MONEY_FORMAT_COMPACT,
  PERCENT_FORMAT,
  DATE_FORMAT,
  DATE_TIME_FORMAT,
  INTEGER_FORMAT,
  TNA_FORMAT,
  formattedRow,
  summaryRow,
  creditInfoRow,
  indicatorRow,
  dashboardRow,
  roundMoney,
  toExcelDate,
  toExcelDateTime,
  parseExcelNumber,
  parseExcelMoney,
  parseExcelPercent,
  isDateExcelFormat,
  isNumericExcelFormat,
};
