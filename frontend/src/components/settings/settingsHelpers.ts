import { tTerm } from '../../i18n/terminology';
import { formatCurrency as formatCurrencyValue, formatPercent as formatPercentValue } from '../../i18n/format';

// --- Types ---

export type SettingsTab = 'employees' | 'payment-methods' | 'rate-policies' | 'late-fee-policies';

export type PaymentMethodDraft = {
  name: string;
  description: string;
  type: 'bank_transfer' | 'cash' | 'card' | 'other';
};

export type RatePolicyDraft = {
  label: string;
  minAmount: string;
  maxAmount: string;
  annualEffectiveRate: string;
  priority: string;
  description: string;
};

export type LateFeePolicyDraft = {
  label: string;
  annualEffectiveRate: string;
  lateFeeMode: 'NONE' | 'SIMPLE' | 'COMPOUND';
  priority: string;
  description: string;
};

export type EmployeeDraft = {
  name: string;
  email: string;
  password: string;
};

export const EMPTY_RATE_POLICY: RatePolicyDraft = {
  label: '',
  minAmount: '',
  maxAmount: '',
  annualEffectiveRate: '',
  priority: '100',
  description: '',
};

export const DEFAULT_LOW_AMOUNT_LIMIT = 1000000;
export const DEFAULT_HIGH_AMOUNT_START = 1000001;

// --- Label Helpers ---

export const getPaymentMethodTypeLabel = (type: unknown) => {
  const normalizedType = String(type || 'other').trim().toLowerCase();

  if (normalizedType === 'bank_transfer') return tTerm('settings.paymentMethods.type.bankTransfer');
  if (normalizedType === 'cash') return tTerm('settings.paymentMethods.type.cash');
  if (normalizedType === 'card') return tTerm('settings.paymentMethods.type.card');

  return tTerm('settings.paymentMethods.type.other');
};

export const getLateFeeModeLabel = (mode: unknown) => {
  const normalizedMode = String(mode || 'SIMPLE').toUpperCase();

  if (normalizedMode === 'NONE') return tTerm('settings.lateFee.type.none');
  if (normalizedMode === 'COMPOUND') return tTerm('settings.lateFee.type.compound');

  return tTerm('settings.lateFee.type.simple');
};

export const getMethodName = (method: any) => method?.name || method?.label || method?.key || tTerm('settings.paymentMethods.methodUnnamed');

export const getMethodTypeLabel = (type: unknown) => getPaymentMethodTypeLabel(type);

// --- Formatting ---

export const normalizeComparable = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const formatCurrency = (value: unknown) => formatCurrencyValue(value);

export const formatRange = (minAmount: unknown, maxAmount: unknown) => {
  const hasMin = minAmount !== null && minAmount !== undefined && minAmount !== '';
  const hasMax = maxAmount !== null && maxAmount !== undefined && maxAmount !== '';

  if (!hasMin && !hasMax) return tTerm('settings.range.allAmounts');
  return `${hasMin ? formatCurrency(minAmount) : formatCurrencyValue(0)} - ${hasMax ? formatCurrency(maxAmount) : tTerm('settings.range.noCap')}`;
};

export const formatRate = (value: unknown) => `${formatPercentValue(value, { maximumFractionDigits: 2 })} EA`;

// --- Numeric Helpers ---

export const toOptionalDraftNumber = (value: string, fallback: number | null = null) => {
  if (value === '') return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : Number.NaN;
};

export const getRangeBoundary = (value: unknown, fallback: number) => {
  if (value === null || value === undefined || value === '') return fallback;
  return Number(value);
};

// --- Rate Policy Logic ---

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
  const priorityDiff = Number(left?.priority || 100) - Number(right?.priority || 100);
  if (priorityDiff !== 0) return priorityDiff;
  return getRangeBoundary(left?.minAmount, 0) - getRangeBoundary(right?.minAmount, 0);
});

export const findRatePolicyMatchesForAmount = (policies: any[], rawAmount: string) => {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount < 0) return [];

  return sortRatePoliciesForApplication(policies)
    .filter((policy) => (
      policy?.isActive !== false
      && amount >= getRangeBoundary(policy?.minAmount, 0)
      && amount <= getRangeBoundary(policy?.maxAmount, Number.POSITIVE_INFINITY)
    ));
};

export const getWinningPriorityConflicts = (matches: any[]) => {
  const orderedMatches = sortRatePoliciesForApplication(matches);
  const winningPriority = orderedMatches[0] ? Number(orderedMatches[0]?.priority || 100) : null;
  if (winningPriority === null) return [];
  return orderedMatches.filter((policy) => Number(policy?.priority || 100) === winningPriority);
};

export const getRatePolicyConflictPairs = (policies: any[]) => {
  const activePolicies = sortRatePoliciesForApplication(policies).filter((policy) => policy?.isActive !== false);
  const pairs: Array<[any, any]> = [];

  activePolicies.forEach((left, leftIndex) => {
    activePolicies.slice(leftIndex + 1).forEach((right) => {
      if (
        Number(left?.priority || 100) === Number(right?.priority || 100)
        && rangesOverlap(left, right)
      ) {
        pairs.push([left, right]);
      }
    });
  });

  return pairs;
};

export const buildRateCoverageCheck = (label: string, amount: number, matches: any[]) => {
  const conflicts = getWinningPriorityConflicts(matches);
  const hasConflict = conflicts.length > 1;
  const policy = hasConflict ? null : sortRatePoliciesForApplication(matches)[0] || null;

  return {
    label,
    amount,
    policy,
    matches,
    conflicts,
    hasConflict,
    status: hasConflict
      ? tTerm('settings.coverage.status.conflict')
      : policy
        ? tTerm('settings.coverage.status.rule', { rate: formatRate(policy.annualEffectiveRate), label: policy.label })
        : tTerm('settings.coverage.status.noRuleActive'),
  };
};

// --- Validation ---

export const validatePercent = (value: string, label: string) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    return tTerm('settings.validation.percentRange', { label });
  }
  return null;
};

export const validatePriority = (value: string) => {
  const numericValue = Number(value || 100);
  if (!Number.isInteger(numericValue) || numericValue < 0) {
    return tTerm('settings.validation.priority');
  }
  return null;
};

export const validatePaymentMethodDraft = (draft: PaymentMethodDraft, paymentMethods: any[]) => {
  const name = draft.name.trim();
  if (!name) return tTerm('settings.validation.paymentMethod.nameRequired');

  const normalizedName = normalizeComparable(name);
  const duplicate = paymentMethods.some((method) => (
    normalizeComparable(getMethodName(method)) === normalizedName
    || normalizeComparable(method?.key) === normalizedName
  ));

  if (duplicate) {
    return tTerm('settings.validation.paymentMethod.duplicate');
  }

  return null;
};

export const validateRatePolicyDraft = (draft: RatePolicyDraft, ratePolicies: any[], currentId: unknown = null) => {
  const label = draft.label.trim();
  if (!label) return tTerm('settings.validation.rate.labelRequired');

  const percentError = validatePercent(draft.annualEffectiveRate, tTerm('settings.rate.field.annualRate'));
  if (percentError) return percentError;

  const priorityError = validatePriority(draft.priority);
  if (priorityError) return priorityError;

  const minAmount = toOptionalDraftNumber(draft.minAmount, 0);
  const maxAmount = toOptionalDraftNumber(draft.maxAmount, null);
  if (!Number.isFinite(minAmount) || (maxAmount !== null && !Number.isFinite(maxAmount))) {
    return tTerm('settings.validation.rate.amountNumeric');
  }
  const normalizedMinAmount = Number(minAmount);
  const normalizedMaxAmount = maxAmount === null ? null : Number(maxAmount);
  if (normalizedMinAmount < 0 || (normalizedMaxAmount !== null && normalizedMaxAmount < 0)) {
    return tTerm('settings.validation.rate.amountNegative');
  }
  if (normalizedMaxAmount !== null && normalizedMinAmount > normalizedMaxAmount) {
    return tTerm('settings.validation.rate.minGreater');
  }

  const normalizedLabel = normalizeComparable(label);
  const duplicateLabel = ratePolicies.some((policy) => (
    String(policy?.id) !== String(currentId ?? '')
    && normalizeComparable(policy?.label) === normalizedLabel
  ));
  if (duplicateLabel) {
    return tTerm('settings.validation.rate.duplicateLabel');
  }

  const priority = Number(draft.priority || 100);
  const overlap = ratePolicies.some((policy) => (
    String(policy?.id) !== String(currentId ?? '')
    && policy?.isActive !== false
    && Number(policy?.priority || 100) === priority
    && rangesOverlap({ minAmount: normalizedMinAmount, maxAmount: normalizedMaxAmount }, policy)
  ));
  if (overlap) {
    return tTerm('settings.validation.rate.overlap');
  }

  return null;
};

export const validateLateFeePolicyDraft = (draft: LateFeePolicyDraft, lateFeePolicies: any[]) => {
  const label = draft.label.trim();
  if (!label) return tTerm('settings.validation.lateFee.labelRequired');

  const percentError = validatePercent(draft.annualEffectiveRate, tTerm('settings.lateFee.field.rate'));
  if (percentError) return percentError;

  const priorityError = validatePriority(draft.priority);
  if (priorityError) return priorityError;

  const normalizedLabel = normalizeComparable(label);
  const duplicateLabel = lateFeePolicies.some((policy) => normalizeComparable(policy?.label) === normalizedLabel);
  if (duplicateLabel) {
    return tTerm('settings.validation.lateFee.duplicateLabel');
  }

  const priority = Number(draft.priority || 100);
  const duplicatePriority = lateFeePolicies.some((policy) => (
    policy?.isActive !== false
    && Number(policy?.priority || 100) === priority
  ));
  if (duplicatePriority) {
    return tTerm('settings.validation.lateFee.duplicatePriority');
  }

  return null;
};

// --- Payload Builders ---

export const buildRatePayload = (policy: RatePolicyDraft) => ({
  ...policy,
  annualEffectiveRate: Number(policy.annualEffectiveRate),
  minAmount: policy.minAmount === '' ? null : Number(policy.minAmount),
  maxAmount: policy.maxAmount === '' ? null : Number(policy.maxAmount),
  priority: Number(policy.priority || 100),
  isActive: true,
});

export const buildLateFeePayload = (policy: LateFeePolicyDraft) => ({
  ...policy,
  annualEffectiveRate: Number(policy.annualEffectiveRate),
  priority: Number(policy.priority || 100),
  isActive: true,
});
