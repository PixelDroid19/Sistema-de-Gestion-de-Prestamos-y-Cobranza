import { formatCurrency as formatCurrencyValue, formatPercent as formatPercentValue } from '../i18n/format';
import { tTerm } from '../i18n/terminology';

export const getRangeBoundary = (value: unknown, fallback: number) => {
  if (value === null || value === undefined || value === '') return fallback;
  return Number(value);
};

export const rangesOverlap = (
  left: { minAmount?: unknown; maxAmount?: unknown },
  right: { minAmount?: unknown; maxAmount?: unknown },
) => {
  const leftMin = getRangeBoundary(left.minAmount, 0);
  const leftMax = getRangeBoundary(left.maxAmount, Number.POSITIVE_INFINITY);
  const rightMin = getRangeBoundary(right.minAmount, 0);
  const rightMax = getRangeBoundary(right.maxAmount, Number.POSITIVE_INFINITY);

  return leftMin <= rightMax && rightMin <= leftMax;
};

export const sortRatePoliciesForApplication = (policies: any[]) => [...policies].sort((left, right) => {
  const minDiff = getRangeBoundary(left?.minAmount, 0) - getRangeBoundary(right?.minAmount, 0);
  if (minDiff !== 0) return minDiff;

  const maxDiff = getRangeBoundary(left?.maxAmount, Number.POSITIVE_INFINITY)
    - getRangeBoundary(right?.maxAmount, Number.POSITIVE_INFINITY);
  if (maxDiff !== 0) return maxDiff;

  return String(left?.label || '').localeCompare(String(right?.label || ''));
});

export const findRatePolicyMatchesForAmount = (policies: any[], rawAmount: unknown) => {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount < 0) return [];

  return sortRatePoliciesForApplication(policies)
    .filter((policy) => (
      policy?.isActive !== false
      && amount >= getRangeBoundary(policy?.minAmount, 0)
      && amount <= getRangeBoundary(policy?.maxAmount, Number.POSITIVE_INFINITY)
    ));
};

export const getRatePolicyConflictsForAmount = (matches: any[]) => {
  const orderedMatches = sortRatePoliciesForApplication(matches);
  return orderedMatches.length > 1 ? orderedMatches : [];
};

// Espeja la celda "Interés equivalente" del simulador: TNA / 12 (nominal), no efectiva compuesta.
export const getEquivalentMonthlyRate = (annualRate: unknown) => Number(annualRate || 0) / 12;

export const formatRange = (minAmount: unknown, maxAmount: unknown) => {
  const hasMin = minAmount !== null && minAmount !== undefined && minAmount !== '';
  const hasMax = maxAmount !== null && maxAmount !== undefined && maxAmount !== '';

  if (!hasMin && !hasMax) return tTerm('settings.range.allAmounts');
  return `${hasMin ? formatCurrencyValue(minAmount) : formatCurrencyValue(0)} - ${hasMax ? formatCurrencyValue(maxAmount) : tTerm('settings.range.noCap')}`;
};

export const formatRate = (value: unknown) => `${formatPercentValue(value, { maximumFractionDigits: 2 })} TNA`;

export const formatMonthlyRate = (value: unknown) => (
  `${formatPercentValue(getEquivalentMonthlyRate(value), { maximumFractionDigits: 2 })} mensual`
);
