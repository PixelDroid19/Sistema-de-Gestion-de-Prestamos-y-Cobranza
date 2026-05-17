import { getIntlLocaleTag } from './index';

type DateOptions = Intl.DateTimeFormatOptions;
type NumberOptions = Intl.NumberFormatOptions;

const toNumber = (value: unknown): number => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatCurrency = (value: unknown, options: NumberOptions = {}): string => {
  return new Intl.NumberFormat(getIntlLocaleTag(), {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
    ...options,
  }).format(toNumber(value));
};

export const formatNumber = (value: unknown, options: NumberOptions = {}): string => {
  return new Intl.NumberFormat(getIntlLocaleTag(), options).format(toNumber(value));
};

export const formatPercent = (value: unknown, options: NumberOptions = {}): string => {
  return `${formatNumber(value, options)}%`;
};

export const formatDate = (value: unknown, options: DateOptions = { dateStyle: 'medium' }): string => {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(getIntlLocaleTag(), options).format(date);
};

export const formatDateTime = (value: unknown, options: DateOptions = { dateStyle: 'medium', timeStyle: 'short' }): string => {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(getIntlLocaleTag(), options).format(date);
};