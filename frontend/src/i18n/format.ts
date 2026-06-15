import { getIntlLocaleTag } from './index';
import { tTerm } from './terminology';

type DateOptions = Intl.DateTimeFormatOptions;
type NumberOptions = Intl.NumberFormatOptions;

export const BASE_CURRENCY_CODE = 'COP' as const;
export const BASE_CURRENCY_SYMBOL = '$' as const;

export const getBaseCurrencyLabel = (): string => tTerm('common.currency.baseLabel');

const MIN_OPERATIONAL_YEAR = 1900;
const MAX_OPERATIONAL_YEAR = 2199;
const DATE_ONLY_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const ISO_OPERATIONAL_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:[T\s][0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\.[0-9]{1,3})?)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)?$/;

const toNumber = (value: unknown): number => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const hasOperationalYear = (date: Date): boolean => {
  const year = date.getUTCFullYear();
  return year >= MIN_OPERATIONAL_YEAR && year <= MAX_OPERATIONAL_YEAR;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) || !hasOperationalYear(value) ? null : value;
  }

  const normalizedValue = String(value).trim();
  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(normalizedValue);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    const isValidDateOnly = date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
    return isValidDateOnly && hasOperationalYear(date) ? date : null;
  }

  if (!ISO_OPERATIONAL_PATTERN.test(normalizedValue)) {
    return null;
  }

  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) || !hasOperationalYear(date) ? null : date;
};

export const isValidOperationalDateOnly = (value: unknown): boolean => {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value.trim())) {
    return false;
  }

  return toDate(value) !== null;
};

export const formatCurrency = (value: unknown, options: NumberOptions = {}): string => {
  return new Intl.NumberFormat(getIntlLocaleTag(), {
    ...options,
    style: 'currency',
    currency: BASE_CURRENCY_CODE,
    currencyDisplay: options.currencyDisplay ?? 'code',
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  }).format(toNumber(value)).replace(/\u00a0/g, ' ');
};

export const formatCompactCurrency = (value: unknown, options: NumberOptions = {}): string => {
  return formatCurrency(value, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
    ...options,
  });
};

export const formatNumber = (value: unknown, options: NumberOptions = {}): string => {
  return new Intl.NumberFormat(getIntlLocaleTag(), options).format(toNumber(value));
};

export const formatPercent = (value: unknown, options: NumberOptions = {}): string => {
  return `${formatNumber(value, options)}%`;
};

export const formatDate = (value: unknown, options: DateOptions = { dateStyle: 'medium', timeZone: 'UTC' }): string => {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(getIntlLocaleTag(), { timeZone: 'UTC', ...options }).format(date);
};

export const formatDateTime = (value: unknown, options: DateOptions = { dateStyle: 'medium', timeStyle: 'short' }): string => {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(getIntlLocaleTag(), options).format(date);
};
