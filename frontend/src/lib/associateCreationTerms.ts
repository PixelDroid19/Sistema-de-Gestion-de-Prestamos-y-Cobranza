export type AssociateInterestType = 'annual' | 'monthly';

export type FirstPaymentTerms = {
  day: string;
  month: string;
};

type ConfiguredPaymentTerms = {
  interestType: AssociateInterestType;
  paymentDay: number;
  paymentMonth: number;
  today?: Date;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MIN_INVESTMENT_TERM_MONTHS = 1;
export const MAX_INVESTMENT_TERM_MONTHS = 120;

const formatDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const toBogotaDateOnly = (now: Date): Date => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
  ));
};

const addUtcDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const addUtcMonths = (date: Date, months: number): Date => {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDayOfTargetMonth = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  result.setUTCDate(Math.min(date.getUTCDate(), lastDayOfTargetMonth));
  return result;
};

const isSupportedPaymentDay = (day: number): boolean => (
  Number.isInteger(day) && day >= 1 && day <= 28
);

export const getDefaultFirstPaymentDate = (
  _interestType: AssociateInterestType,
  today = new Date(),
): string => {
  const baseDate = toBogotaDateOnly(today);
  const dueDate = new Date(baseDate);
  dueDate.setUTCDate(Math.min(baseDate.getUTCDate(), 28));

  dueDate.setUTCMonth(dueDate.getUTCMonth() + 1);

  return formatDateOnly(dueDate);
};

export const getFirstPaymentDateBounds = (
  interestType: AssociateInterestType,
  today = new Date(),
): { min: string; max: string } => ({
  min: formatDateOnly(addUtcDays(toBogotaDateOnly(today), 1)),
  max: getDefaultFirstPaymentDate(interestType, today),
});

export const getNextConfiguredPaymentDate = ({
  paymentDay,
  today = new Date(),
}: ConfiguredPaymentTerms): string => {
  const baseDate = toBogotaDateOnly(today);
  const normalizedDay = isSupportedPaymentDay(paymentDay) ? paymentDay : 1;
  const dueDate = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), normalizedDay));

  if (dueDate.getTime() <= baseDate.getTime()) {
    dueDate.setUTCMonth(dueDate.getUTCMonth() + 1);
  }

  return formatDateOnly(dueDate);
};

export const parseFirstPaymentTerms = (value: string): FirstPaymentTerms | null => {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (formatDateOnly(date) !== value || !isSupportedPaymentDay(day)) {
    return null;
  }

  return { day: String(day), month: String(month) };
};

export const parseInvestmentTermMonths = (value: string): number | null => {
  const normalizedValue = String(value || '').trim();
  if (!/^\d{1,3}$/.test(normalizedValue)) {
    return null;
  }

  const months = Number(normalizedValue);
  return Number.isInteger(months)
    && months >= MIN_INVESTMENT_TERM_MONTHS
    && months <= MAX_INVESTMENT_TERM_MONTHS
    ? months
    : null;
};

export const getInvestmentMaturityDate = (
  firstPaymentDate: string,
  investmentTermMonths: number,
): string | null => {
  if (!parseFirstPaymentTerms(firstPaymentDate)) {
    return null;
  }

  if (
    !Number.isInteger(investmentTermMonths)
    || investmentTermMonths < MIN_INVESTMENT_TERM_MONTHS
    || investmentTermMonths > MAX_INVESTMENT_TERM_MONTHS
  ) {
    return null;
  }

  const [year, month, day] = firstPaymentDate.split('-').map(Number);
  return formatDateOnly(addUtcMonths(new Date(Date.UTC(year, month - 1, day)), investmentTermMonths - 1));
};

export const isFirstPaymentDateWithinBounds = (
  value: string,
  interestType: AssociateInterestType,
  today = new Date(),
): boolean => {
  if (!parseFirstPaymentTerms(value)) {
    return false;
  }

  const { min, max } = getFirstPaymentDateBounds(interestType, today);
  return value >= min && value <= max;
};

export const calculatePeriodicReturn = (
  capital: number,
  rate: number,
  interestType: AssociateInterestType = 'annual',
): number => {
  if (!Number.isFinite(capital) || !Number.isFinite(rate) || capital <= 0 || rate < 0) {
    return 0;
  }

  const monthlyRate = interestType === 'annual' ? rate / 12 : rate;
  return Math.round(((capital * monthlyRate) / 100) * 100) / 100;
};
