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

const isSupportedPaymentDay = (day: number): boolean => (
  Number.isInteger(day) && day >= 1 && day <= 28
);

export const getDefaultFirstPaymentDate = (
  interestType: AssociateInterestType,
  today = new Date(),
): string => {
  const baseDate = toBogotaDateOnly(today);
  const dueDate = new Date(baseDate);
  dueDate.setUTCDate(Math.min(baseDate.getUTCDate(), 28));

  if (interestType === 'annual') {
    dueDate.setUTCFullYear(dueDate.getUTCFullYear() + 1);
  } else {
    dueDate.setUTCMonth(dueDate.getUTCMonth() + 1);
  }

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
  interestType,
  paymentDay,
  paymentMonth,
  today = new Date(),
}: ConfiguredPaymentTerms): string => {
  const baseDate = toBogotaDateOnly(today);
  const normalizedDay = isSupportedPaymentDay(paymentDay) ? paymentDay : 1;
  const normalizedMonth = Number.isInteger(paymentMonth) && paymentMonth >= 1 && paymentMonth <= 12
    ? paymentMonth
    : 1;
  const dueDate = interestType === 'annual'
    ? new Date(Date.UTC(baseDate.getUTCFullYear(), normalizedMonth - 1, normalizedDay))
    : new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), normalizedDay));

  if (dueDate.getTime() <= baseDate.getTime()) {
    if (interestType === 'annual') {
      dueDate.setUTCFullYear(dueDate.getUTCFullYear() + 1);
    } else {
      dueDate.setUTCMonth(dueDate.getUTCMonth() + 1);
    }
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

export const calculatePeriodicReturn = (capital: number, rate: number): number => {
  if (!Number.isFinite(capital) || !Number.isFinite(rate) || capital <= 0 || rate < 0) {
    return 0;
  }

  return Math.round(((capital * rate) / 100) * 100) / 100;
};
