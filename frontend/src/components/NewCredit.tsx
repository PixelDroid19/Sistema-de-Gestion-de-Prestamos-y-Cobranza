import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, CalendarDays, CheckCircle2, ChevronDown, Clock3, Loader2, RotateCcw, Save, ShieldCheck, User, Wallet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { formatCurrency as formatCurrencyValue, formatDate as formatLocaleDate, formatNumber, formatPercent, isValidOperationalDateOnly } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { useLoans } from '../services/loanService';
import { useCustomers } from '../services/customerService';
import { toast } from '../lib/toast';
import { extractValidationErrors } from '../services/apiErrors';
import { useConfig } from '../services/configService';
import { useSessionStore } from '../store/sessionStore';
import {
  DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
  useActiveCreditSimulation,
} from './hooks/useActiveCreditSimulation';
import type { CreditCalculationInput } from '../types/creditCalculation';
import { QuickGuideButton } from './shared/HelpSupport';
import {
  ActionButton,
  DataTableSurface,
  FormField,
  IconActionButton,
  InsightStrip,
  PageHeader,
  PageShell,
  SelectInput,
  StatusChip,
} from './shared/Surfaces';

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
const formatMoney = (value: number) => formatCurrencyValue(Number.isFinite(value) ? value : 0);
const formatPolicyRate = (value: unknown) => `${formatPercent(value, { maximumFractionDigits: 2 })} EA`;
const formatPolicyRange = (minAmount: unknown, maxAmount: unknown) => {
  const hasMin = minAmount !== null && minAmount !== undefined && minAmount !== '';
  const hasMax = maxAmount !== null && maxAmount !== undefined && maxAmount !== '';

  if (!hasMin && !hasMax) return tTerm('newCredit.range.allAmounts');
  return `${hasMin ? formatMoney(Number(minAmount)) : formatMoney(0)} - ${hasMax ? formatMoney(Number(maxAmount)) : tTerm('newCredit.range.noCap')}`;
};
const getRangeBoundary = (value: unknown, fallback: number) => {
  if (value === null || value === undefined || value === '') return fallback;
  return Number(value);
};
const sortRatePoliciesForApplication = (policies: any[]) => [...policies].sort((left, right) => {
  const minDiff = getRangeBoundary(left?.minAmount, 0) - getRangeBoundary(right?.minAmount, 0);
  if (minDiff !== 0) return minDiff;
  return getRangeBoundary(left?.maxAmount, Number.POSITIVE_INFINITY)
    - getRangeBoundary(right?.maxAmount, Number.POSITIVE_INFINITY);
});
const findRatePolicyMatchesForAmount = (policies: any[], rawAmount: unknown) => {
  const amount = Number(rawAmount || 0);
  if (!Number.isFinite(amount) || amount < 0) return [];

  return sortRatePoliciesForApplication(policies)
    .filter((policy) => (
      policy?.isActive !== false
      && amount >= getRangeBoundary(policy?.minAmount, 0)
      && amount <= getRangeBoundary(policy?.maxAmount, Number.POSITIVE_INFINITY)
    ));
};
const getRatePolicyConflictsForAmount = (matches: any[]) => {
  const orderedMatches = sortRatePoliciesForApplication(matches);
  return orderedMatches.length > 1 ? orderedMatches : [];
};
const lateFeePriorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
const normalizePolicyPriority = (value: unknown) => {
  const normalizedValue = String(value || 'medium').trim().toLowerCase();
  return normalizedValue === 'high' || normalizedValue === 'medium' || normalizedValue === 'low'
    ? normalizedValue
    : 'medium';
};
const formatAmountInputDisplay = (value: number) => formatNumber(Number.isFinite(value) ? value : 0, { maximumFractionDigits: 0 });
const parseDigitsToAmount = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
};
const formatDueDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return formatLocaleDate(date, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) || '-';
};
const formatScheduleStatus = (status?: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') return tTerm('schedule.status.pending');
  if (normalized === 'paid' || normalized === 'settled') return tTerm('credits.modal.status.paid');
  if (normalized === 'overdue' || normalized === 'defaulted') return tTerm('credits.modal.status.overdue');
  if (normalized === 'cancelled' || normalized === 'annulled') return tTerm('schedule.status.annulled');
  return status || '-';
};

const lateFeeModeLabelKeys: Record<NonNullable<CreditCalculationInput['lateFeeMode']>, 'simulator.lateFee.mode.none' | 'simulator.lateFee.mode.simple' | 'simulator.lateFee.mode.compound' | 'simulator.lateFee.mode.flat' | 'simulator.lateFee.mode.tiered'> = {
  NONE: 'simulator.lateFee.mode.none',
  SIMPLE: 'simulator.lateFee.mode.simple',
  COMPOUND: 'simulator.lateFee.mode.compound',
  FLAT: 'simulator.lateFee.mode.flat',
  TIERED: 'simulator.lateFee.mode.tiered',
};

const getLateFeeModeLabel = (value?: CreditCalculationInput['lateFeeMode']) => tTerm(lateFeeModeLabelKeys[value || 'SIMPLE']);

const lateFeeModeDescriptions: Record<string, { trigger: string; formula: string; effect: string }> = {
  NONE: {
    trigger: tTerm('newCredit.lateFee.description.none.trigger'),
    formula: tTerm('newCredit.lateFee.description.none.formula'),
    effect: tTerm('newCredit.lateFee.description.none.effect'),
  },
  SIMPLE: {
    trigger: tTerm('newCredit.lateFee.description.simple.trigger'),
    formula: tTerm('newCredit.lateFee.description.simple.formula'),
    effect: tTerm('newCredit.lateFee.description.simple.effect'),
  },
  COMPOUND: {
    trigger: tTerm('newCredit.lateFee.description.compound.trigger'),
    formula: tTerm('newCredit.lateFee.description.compound.formula'),
    effect: tTerm('newCredit.lateFee.description.compound.effect'),
  },
  FLAT: {
    trigger: tTerm('newCredit.lateFee.description.flat.trigger'),
    formula: tTerm('newCredit.lateFee.description.flat.formula'),
    effect: tTerm('newCredit.lateFee.description.flat.effect'),
  },
  TIERED: {
    trigger: tTerm('newCredit.lateFee.description.tiered.trigger'),
    formula: tTerm('newCredit.lateFee.description.tiered.formula'),
    effect: tTerm('newCredit.lateFee.description.tiered.effect'),
  },
};

const addMonthsAsIsoDate = (date: Date, months: number) => {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  const day = date.getDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toIsoDate(new Date(Date.UTC(year, month, Math.min(day, lastDayOfTargetMonth))));
};

const nextMonthAsIsoDate = () => addMonthsAsIsoDate(new Date(), 1);

type NewCreditLocationState = {
  calculationInput?: Partial<CreditCalculationInput>;
  source?: 'credit-calculator';
};

const getDisplayName = (entity: any) => {
  if (entity?.name) return entity.name;

  const composedName = [entity?.firstName, entity?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return composedName || entity?.email || `#${entity?.id}`;
};

export default function NewCredit({ onBack }: { onBack: () => void }) {
  const { locale } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state || null) as NewCreditLocationState | null;
  const { user } = useSessionStore();
  const canReadFinancialConfig = user?.role === 'admin';
  const { createLoan } = useLoans();
  const { data: customersData } = useCustomers({ pageSize: 100 });
  const { ratePolicies, lateFeePolicies, isLoading: isConfigLoading } = useConfig({ enabled: canReadFinancialConfig });

  const customers = Array.isArray(customersData?.data?.customers)
    ? customersData.data.customers
    : Array.isArray(customersData?.data)
      ? customersData.data
      : [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [borrowerErrors, setBorrowerErrors] = useState<Record<string, string>>({});
  const [borrower, setBorrower] = useState({
    customerId: '',
  });
  const [lateFeeWasEdited, setLateFeeWasEdited] = useState(Boolean(routeState?.calculationInput?.lateFeeMode));
  const initialCalculationInput = useMemo<CreditCalculationInput>(() => ({
    ...DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
    ...routeState?.calculationInput,
    rateSource: 'policy',
    startDate: routeState?.calculationInput?.startDate || nextMonthAsIsoDate(),
  }), [routeState?.calculationInput]);

  const {
    input,
    result,
    error: calculationError,
    fieldErrors: calculationFieldErrors,
    isSimulating,
    isResultStale,
    setInput,
    simulate,
  } = useActiveCreditSimulation({
    initialInput: initialCalculationInput,
    autoRun: Boolean(routeState?.calculationInput),
  });

  const resolvedRatePolicyMatches = useMemo<any[]>(
    () => findRatePolicyMatchesForAmount(ratePolicies, input.amount),
    [input.amount, ratePolicies],
  );
  const ambiguousRatePolicyMatches = useMemo<any[]>(
    () => getRatePolicyConflictsForAmount(resolvedRatePolicyMatches),
    [resolvedRatePolicyMatches],
  );
  const hasAmbiguousRatePolicy = canReadFinancialConfig && ambiguousRatePolicyMatches.length > 1;
  const resolvedRatePolicy = useMemo<any>(() => (
    hasAmbiguousRatePolicy ? null : sortRatePoliciesForApplication(resolvedRatePolicyMatches)[0] || null
  ), [hasAmbiguousRatePolicy, resolvedRatePolicyMatches]);

  const resolvedLateFeePolicy = useMemo<any>(() => (
    lateFeePolicies
      .filter((policy: any) => policy.isActive)
      .sort((left: any, right: any) => (
        (lateFeePriorityOrder[normalizePolicyPriority(left.priority)] ?? lateFeePriorityOrder.medium)
        - (lateFeePriorityOrder[normalizePolicyPriority(right.priority)] ?? lateFeePriorityOrder.medium)
      ))[0] || null
  ), [lateFeePolicies]);

  useEffect(() => {
    const nextInput: Partial<CreditCalculationInput> = {};

    if (resolvedRatePolicy?.annualEffectiveRate != null) {
      nextInput.interestRate = Number(resolvedRatePolicy.annualEffectiveRate);
      nextInput.rateSource = 'policy';
    }

    if (!lateFeeWasEdited && resolvedLateFeePolicy?.lateFeeMode) {
      nextInput.lateFeeMode = String(resolvedLateFeePolicy.lateFeeMode) as CreditCalculationInput['lateFeeMode'];
      nextInput.annualLateFeeRate = Number(resolvedLateFeePolicy.annualEffectiveRate || 0);
      nextInput.lateFeeSource = 'policy';
    }

    if (Object.keys(nextInput).length > 0) {
      setInput(nextInput);
    }
  }, [lateFeeWasEdited, resolvedLateFeePolicy, resolvedRatePolicy, setInput]);

  const calculationPolicySnapshot = result?.policySnapshot as Record<string, unknown> | null | undefined;
  const calculationRateSource = String(calculationPolicySnapshot?.rateSource || '');
  const calculationLateFeeSource = String(calculationPolicySnapshot?.lateFeeSource || '');
  const calculationRatePolicyLabel = String(calculationPolicySnapshot?.ratePolicyLabel || '');
  const calculationAppliedInterestRate = Number(calculationPolicySnapshot?.appliedInterestRate ?? result?.inputs?.interestRate ?? input.interestRate);
  const calculationAppliedLateFeeRate = Number(calculationPolicySnapshot?.appliedAnnualLateFeeRate ?? result?.inputs?.annualLateFeeRate ?? input.annualLateFeeRate ?? 0);
  const calculationAppliedLateFeeMode = String(calculationPolicySnapshot?.appliedLateFeeMode || result?.inputs?.lateFeeMode || input.lateFeeMode || 'SIMPLE') as CreditCalculationInput['lateFeeMode'];
  const hasPolicyBackedCalculation = Boolean(result && !isResultStale && calculationRateSource === 'policy');
  const resolvedRateSource = 'policy';
  const isRatePolicyResolving = canReadFinancialConfig && isConfigLoading;
  const isLateFeePolicyResolving = canReadFinancialConfig && isConfigLoading && !lateFeeWasEdited;
  const resolvedLateFeeSource = canReadFinancialConfig
    ? (lateFeeWasEdited || !resolvedLateFeePolicy ? 'manual' : 'policy')
    : (calculationLateFeeSource === 'policy' ? 'policy' : 'manual');
  const canValidateWithCurrentPolicy = canReadFinancialConfig ? !isRatePolicyResolving && Boolean(resolvedRatePolicy) && !hasAmbiguousRatePolicy : true;
  const isRatePolicyReady = canReadFinancialConfig ? !isRatePolicyResolving && Boolean(resolvedRatePolicy) && !hasAmbiguousRatePolicy : hasPolicyBackedCalculation;
  const annualLateFeeRate = Number(
    result?.inputs?.annualLateFeeRate
    ?? input.annualLateFeeRate
    ?? resolvedLateFeePolicy?.annualEffectiveRate
    ?? 0,
  );
  const visibleRatePolicyLabel = canReadFinancialConfig
    ? isRatePolicyResolving
      ? tTerm('newCredit.badge.rate.loading')
      : resolvedRatePolicy?.label || tTerm('newCredit.badge.rate.missing')
    : calculationRatePolicyLabel || tTerm('newCredit.rate.appliedOnValidation');
  const visibleRatePolicyRange = canReadFinancialConfig && resolvedRatePolicy
    ? formatPolicyRange(resolvedRatePolicy.minAmount, resolvedRatePolicy.maxAmount)
    : null;
  const visibleRatePolicyExplanation = canReadFinancialConfig
    ? isRatePolicyResolving
      ? tTerm('newCredit.rate.explanation.loading')
      : hasAmbiguousRatePolicy
      ? tTerm('newCredit.rate.explanation.conflict', {
        amount: formatMoney(Number(input.amount || 0)),
        labels: ambiguousRatePolicyMatches.map((policy) => policy.label).join(' y '),
      })
      : resolvedRatePolicy
      ? tTerm('newCredit.rate.explanation.resolved', {
        amount: formatMoney(Number(input.amount || 0)),
        label: resolvedRatePolicy.label,
        range: visibleRatePolicyRange || '',
      })
      : tTerm('newCredit.rate.explanation.none', { amount: formatMoney(Number(input.amount || 0)) })
    : hasPolicyBackedCalculation
      ? tTerm('newCredit.rate.explanation.backendApplied', { label: visibleRatePolicyLabel })
      : tTerm('newCredit.rate.explanation.validate');
  const rateSummaryValue = canReadFinancialConfig && isRatePolicyReady
    ? formatPolicyRate(resolvedRatePolicy?.annualEffectiveRate ?? input.interestRate ?? 0)
    : hasPolicyBackedCalculation
      ? formatPolicyRate(Number.isFinite(calculationAppliedInterestRate) ? calculationAppliedInterestRate : 0)
      : isRatePolicyResolving ? tTerm('newCredit.badge.loading') : hasAmbiguousRatePolicy ? tTerm('newCredit.badge.conflict') : canReadFinancialConfig ? tTerm('newCredit.badge.noPolicy') : tTerm('newCredit.badge.pendingValidation');
  const lateFeeModeLabel = getLateFeeModeLabel(input.lateFeeMode || resolvedLateFeePolicy?.lateFeeMode || 'SIMPLE');
  const selectedLateFeeMode = String(input.lateFeeMode || resolvedLateFeePolicy?.lateFeeMode || 'SIMPLE').toUpperCase();
  const lateFeeModeDescription = lateFeeModeDescriptions[selectedLateFeeMode] || lateFeeModeDescriptions.SIMPLE;
  const lateFeeSummaryDetail = isLateFeePolicyResolving
    ? tTerm('newCredit.lateFee.summary.loading')
    : resolvedLateFeeSource === 'policy' && resolvedLateFeePolicy
    ? tTerm('newCredit.lateFee.summary.policy', { label: resolvedLateFeePolicy.label })
    : tTerm('newCredit.lateFee.summary.manual');
  const lateFeeSummaryValue = isLateFeePolicyResolving ? tTerm('newCredit.lateFee.value.loading') : `${lateFeeModeLabel} · ${annualLateFeeRate}% EA`;
  const lateFeePolicyLabel = isLateFeePolicyResolving
    ? tTerm('newCredit.lateFee.policy.loading')
    : resolvedLateFeeSource === 'policy' && resolvedLateFeePolicy
    ? resolvedLateFeePolicy.label
    : tTerm('newCredit.lateFee.policy.manual');
  const lateFeeFieldHelper = isLateFeePolicyResolving
    ? tTerm('newCredit.lateFee.helper.loading')
    : resolvedLateFeePolicy
      ? tTerm('newCredit.lateFee.helper.policy', {
        label: resolvedLateFeePolicy.label,
        rate: formatPolicyRate(resolvedLateFeePolicy.annualEffectiveRate),
      })
      : tTerm('newCredit.lateFee.helper.none');
  const hasValidatedResult = Boolean(result) && !isResultStale;
  const canRegister = Boolean(borrower.customerId) && isRatePolicyReady && hasValidatedResult && !isSubmitting && !isSimulating;
  const isBorrowerReady = Boolean(borrower.customerId);
  const isRegistrationReady = isBorrowerReady && hasValidatedResult;
  const calculationRuleLabel = result?.calculationProfileVersionId != null
    ? tTerm('newCredit.summary.ruleVersion', { version: result.calculationProfileVersionId })
    : tTerm('newCredit.summary.activeRule');
  const summaryCards = useMemo(() => (result && !isResultStale ? [
    { id: 'new-credit-installment', label: tTerm('simulator.schedule.header.payment'), value: formatMoney(result.summary.installmentAmount), helper: tTerm('newCredit.summary.card.installmentHelper'), accent: 'teal' as const, icon: <Wallet size={18} /> },
    { id: 'new-credit-total', label: tTerm('simulator.summary.totalPayment.short'), value: formatMoney(result.summary.totalPayable), helper: tTerm('simulator.summary.card.helper.capitalInterest'), accent: 'blue' as const, icon: <Calculator size={18} /> },
    { id: 'new-credit-interest', label: tTerm('simulator.summary.totalInterest.short'), value: formatMoney(result.summary.totalInterest), helper: tTerm('newCredit.summary.card.interestHelper'), accent: 'rose' as const, icon: <Clock3 size={18} /> },
  ] : []), [result, isResultStale, locale]);
  const scheduleTotals = useMemo(() => {
    if (!result?.schedule?.length || isResultStale) return null;

    return result.schedule.reduce((acc, row, index, rows) => {
      acc.installmentCount += 1;
      acc.totalScheduledPayment += Number(row.scheduledPayment || 0);
      acc.totalInterest += Number(row.interestComponent || 0);
      acc.totalPrincipal += Number(row.principalComponent || 0);
      acc.finalBalance = index === rows.length - 1 ? Number(row.remainingBalance || 0) : acc.finalBalance;
      if (String(row.status || '').toLowerCase() === 'pending') {
        acc.pendingCount += 1;
      }
      return acc;
    }, {
      installmentCount: 0,
      totalScheduledPayment: 0,
      totalInterest: 0,
      totalPrincipal: 0,
      finalBalance: 0,
      pendingCount: 0,
    });
  }, [result, isResultStale]);
  const insightItems = [
    {
      id: 'customer',
      label: tTerm('newCredit.insight.customer.label'),
      value: isBorrowerReady ? tTerm('newCredit.status.ready') : tTerm('newCredit.status.pending'),
      helper: tTerm('newCredit.insight.customer.helper'),
      icon: <User size={16} />,
      accent: 'slate' as const,
    },
    {
      id: 'rate',
      label: tTerm('newCredit.insight.rate.label'),
      value: rateSummaryValue,
      helper: hasAmbiguousRatePolicy
        ? tTerm('newCredit.insight.rate.conflictHelper', { count: ambiguousRatePolicyMatches.length })
        : canReadFinancialConfig ? (resolvedRatePolicy?.label || tTerm('newCredit.insight.rate.default')) : (calculationRatePolicyLabel || tTerm('newCredit.insight.rate.default')),
      icon: <Wallet size={16} />,
      accent: hasAmbiguousRatePolicy ? 'rose' as const : 'blue' as const,
    },
    {
      id: 'late-fee',
      label: tTerm('newCredit.insight.lateFee.label'),
      value: lateFeeSummaryValue,
      helper: lateFeeSummaryDetail,
      icon: <Clock3 size={16} />,
      accent: 'amber' as const,
    },
    {
      id: 'validation',
      label: tTerm('newCredit.insight.validation.label'),
      value: hasValidatedResult ? calculationRuleLabel : tTerm('newCredit.status.pending'),
      helper: tTerm('newCredit.insight.validation.helper'),
      icon: <ShieldCheck size={16} />,
      accent: 'emerald' as const,
    },
  ];

  const handleBorrowerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = event.target;
    setBorrower((current) => ({ ...current, [name]: value }));
    setBorrowerErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleCalculationInputChange = (partialInput: Partial<CreditCalculationInput>) => {
    if (Object.prototype.hasOwnProperty.call(partialInput, 'interestRate')) {
      delete partialInput.interestRate;
      partialInput.rateSource = 'policy';
    }
    if (Object.prototype.hasOwnProperty.call(partialInput, 'lateFeeMode')) {
      setLateFeeWasEdited(true);
      partialInput.lateFeeSource = 'manual';
    }
    setInput(partialInput);
  };

  const handleNumberFieldChange = (field: 'termMonths' | 'interestRate') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value) || 0;
    handleCalculationInputChange({ [field]: nextValue });
  };

  const handleDateFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleCalculationInputChange({ startDate: event.target.value || undefined });
  };

  const handleAmountFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleCalculationInputChange({ amount: parseDigitsToAmount(event.target.value) });
  };

  const handleLateFeeModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    handleCalculationInputChange({ lateFeeMode: event.target.value as CreditCalculationInput['lateFeeMode'] });
  };

  const resetCalculation = () => {
    setLateFeeWasEdited(false);
    setInput({
      ...DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
      rateSource: 'policy',
      startDate: nextMonthAsIsoDate(),
    });
  };

  const handleValidateCredit = () => {
    if (input.startDate && !isValidOperationalDateOnly(input.startDate)) {
      toast.error({ title: tTerm('newCredit.validation.startDate') });
      return;
    }

    if (!canValidateWithCurrentPolicy) {
      if (hasAmbiguousRatePolicy) {
        toast.error({
          title: tTerm('newCredit.toast.conflict.title'),
          description: tTerm('newCredit.toast.conflict.validate'),
        });
        return;
      }

      toast.error({
        title: tTerm('newCredit.toast.policyMissing.title'),
        description: tTerm('newCredit.toast.policyMissing.validate'),
      });
      return;
    }

    void simulate();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!borrower.customerId) {
      setBorrowerErrors({ customerId: tTerm('newCredit.error.customerRequired') });
      toast.error({
        title: tTerm('newCredit.toast.customerMissing.title'),
        description: tTerm('newCredit.toast.customerMissing.description'),
      });
      return;
    }

    if (!hasValidatedResult) {
      toast.warning({
        title: tTerm('newCredit.toast.validationRequired.title'),
        description: tTerm('newCredit.toast.validationRequired.description'),
      });
      return;
    }

    if (!isRatePolicyReady) {
      if (hasAmbiguousRatePolicy) {
        toast.error({
          title: tTerm('newCredit.toast.conflict.title'),
          description: tTerm('newCredit.toast.conflict.register'),
        });
        return;
      }

      toast.error({
        title: tTerm('newCredit.toast.policyMissing.title'),
        description: tTerm('newCredit.toast.policyMissing.register'),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createLoan.mutateAsync({
        customerId: Number(borrower.customerId),
        amount: Number(input.amount),
        interestRate: Number(result?.inputs?.interestRate ?? resolvedRatePolicy?.annualEffectiveRate ?? input.interestRate),
        termMonths: Number(input.termMonths),
        startDate: input.startDate,
        lateFeeMode: calculationAppliedLateFeeMode || input.lateFeeMode || 'SIMPLE',
        annualLateFeeRate: Number.isFinite(calculationAppliedLateFeeRate) ? calculationAppliedLateFeeRate : annualLateFeeRate,
        rateSource: 'policy',
        lateFeeSource: resolvedLateFeeSource,
      });
      const createdLoanId = Number(response?.data?.loan?.id);
      const versionLabel = result?.calculationProfileVersionId != null
        ? tTerm('newCredit.toast.success.versionLabel', { version: result.calculationProfileVersionId })
        : tTerm('newCredit.toast.success.activeRuleLabel');
      toast.success({ description: tTerm('newCredit.toast.success', { versionLabel }) });

      if (Number.isFinite(createdLoanId) && createdLoanId > 0) {
        navigate(`/credits/${createdLoanId}`);
        return;
      }

      onBack();
    } catch (error: any) {
      const validationErrors = extractValidationErrors(error);
      if (validationErrors.length > 0) {
        const fieldErrs: Record<string, string> = {};
        validationErrors.forEach((err: any) => {
          fieldErrs[err.field] = err.message;
        });
        setBorrowerErrors(fieldErrs);
        toast.validationErrors(validationErrors);
      } else {
        toast.apiErrorSafe(error, { domain: 'credits', action: 'credit.create' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionDock = (
    <div
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-2xl border border-border-strong bg-bg-surface/95 p-2 shadow-xl backdrop-blur sm:left-auto sm:right-6 sm:w-[31rem]"
      data-tour="new-credit-action-dock"
      aria-label={tTerm('newCredit.aria.actionDock')}
    >
      <IconActionButton
        onClick={resetCalculation}
        disabled={isSimulating}
        label={tTerm('newCredit.action.reset')}
        title={tTerm('newCredit.action.reset')}
        icon={<RotateCcw size={16} />}
        className="h-10 w-10 rounded-full"
      />
      <ActionButton
        data-tour="new-credit-validate"
        onClick={handleValidateCredit}
        disabled={isSimulating || isConfigLoading}
        isLoading={isSimulating}
        aria-label={tTerm('newCredit.action.validate')}
        title={canValidateWithCurrentPolicy
          ? tTerm('newCredit.action.validate.title.ready')
          : hasAmbiguousRatePolicy
            ? tTerm('newCredit.action.validate.title.conflict')
            : tTerm('newCredit.action.validate.title.missing')}
        icon={isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
        fullWidth
        className="h-10 min-w-0 rounded-full px-3"
      >
        {tTerm('newCredit.action.validate')}
      </ActionButton>
      <ActionButton
        type="submit"
        disabled={!canRegister}
        data-tour="new-credit-submit"
        isLoading={isSubmitting}
        aria-label={tTerm('newCredit.action.register')}
        title={canRegister ? tTerm('newCredit.action.register.title.ready') : tTerm('newCredit.action.register.title.blocked')}
        icon={isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        variant="primary"
        fullWidth
        className="h-10 min-w-0 rounded-full px-3"
      >
        <span className="hidden sm:inline">{tTerm('newCredit.action.register')}</span>
        <span className="sm:hidden">{tTerm('newCredit.action.register.short')}</span>
      </ActionButton>
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="pb-28"
      data-tour="new-credit-page"
    >
      <PageShell className="mx-auto max-w-[1280px] gap-5">
        <PageHeader
          tourId="new-credit-header"
          eyebrow={tTerm('newCredit.header.eyebrow')}
          title={(
            <span className="flex min-w-0 items-center gap-3">
              <IconActionButton
                onClick={onBack}
                label={tTerm('newCredit.header.back')}
                icon={<ArrowLeft size={20} />}
                className="shrink-0"
              />
              <span className="min-w-0 truncate">{tTerm('newCredit.header.title')}</span>
            </span>
          )}
          subtitle={tTerm('newCredit.header.subtitle')}
          actions={(
            <>
              <QuickGuideButton guideKey="new-credit" />
              <ActionButton onClick={onBack}>{tTerm('newCredit.action.cancel')}</ActionButton>
            </>
          )}
        />

        <section
          className="space-y-3"
          data-tour="new-credit-customer"
        >
          <h3 className="sr-only">{tTerm('newCredit.section.preparation')}</h3>
          <InsightStrip
            items={insightItems}
            aria-label={tTerm('newCredit.section.preparation.aria')}
            data-tour="new-credit-policy-summary"
          />
          {routeState?.source === 'credit-calculator' && (
            <div className="mt-3">
              <StatusChip tone="success" size="sm" icon={<CheckCircle2 size={13} />}>
                {tTerm('newCredit.badge.preloaded')}
              </StatusChip>
            </div>
          )}
        </section>

        <div aria-label={tTerm('newCredit.aria.floatingActions')}>
          {actionDock}
        </div>

        <section className="grid gap-6 rounded-[1.6rem] bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.08),_transparent_34%),radial-gradient(circle_at_top_left,_rgba(16,185,129,0.05),_transparent_28%)] p-0" data-tour="new-credit-simulation">
          <div className="grid gap-8 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.45fr)]">
            <div className="min-w-0 space-y-5 rounded-[1.6rem] border border-border-subtle bg-bg-surface px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:px-6" data-tour="new-credit-borrower">
              <div className="pb-1">
                <h3 className="text-[1.05rem] font-bold text-text-primary">{tTerm('newCredit.section.creditData')}</h3>
              </div>

              <FormField label={tTerm('newCredit.field.customer')} error={borrowerErrors.customerId}>
                <SelectInput
                  id="customerId"
                  name="customerId"
                  aria-label={tTerm('newCredit.field.customer')}
                  data-tour="new-credit-customer-select"
                  value={borrower.customerId}
                  onChange={handleBorrowerChange}
                  className={borrowerErrors.customerId ? 'border-red-400 focus:ring-red-500' : ''}
                  aria-invalid={!!borrowerErrors.customerId}
                >
                  <option value="">{tTerm('newCredit.placeholder.customer')}</option>
                  {customers.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {getDisplayName(customer)} · CUS-{String(customer.id).padStart(4, '0')}
                    </option>
                  ))}
                </SelectInput>
              </FormField>

              <FormField label={tTerm('simulator.form.amount')}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatAmountInputDisplay(input.amount)}
                    onChange={handleAmountFieldChange}
                    className="form-control pl-9"
                  />
                </div>
              </FormField>

              <FormField
                label={tTerm('simulator.field.rate.configured')}
                tooltip={tTerm('newCredit.field.configuredRate.tooltip')}
                helper={visibleRatePolicyExplanation}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={isRatePolicyResolving ? 'neutral' : hasAmbiguousRatePolicy ? 'danger' : isRatePolicyReady ? 'info' : 'warning'} size="sm">
                      {isRatePolicyResolving
                        ? tTerm('newCredit.badge.rate.loading')
                        : hasAmbiguousRatePolicy
                          ? tTerm('newCredit.badge.rate.conflict')
                          : isRatePolicyReady
                            ? tTerm('newCredit.badge.rate.configured', { label: visibleRatePolicyLabel })
                            : tTerm('newCredit.badge.rate.missing')}
                    </StatusChip>
                    {visibleRatePolicyRange && (
                      <StatusChip tone="neutral" size="sm">
                        {tTerm('newCredit.badge.rate.range', { range: visibleRatePolicyRange })}
                      </StatusChip>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      aria-label={tTerm('simulator.field.rate.configured')}
                      type="number"
                      value={Number.isFinite(Number(input.interestRate)) ? Number(input.interestRate) : 0}
                      onChange={handleNumberFieldChange('interestRate')}
                      className="form-control pr-10"
                      disabled
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">%</span>
                  </div>
                </div>
              </FormField>

              <FormField
                label={tTerm('simulator.field.termMonths')}
                tooltip={tTerm('newCredit.field.term.tooltip')}
              >
                <input
                  type="number"
                  min="1"
                  value={input.termMonths}
                  onChange={handleNumberFieldChange('termMonths')}
                  className="form-control"
                  placeholder={tTerm('newCredit.placeholder.term')}
                />
              </FormField>

              <FormField
                label={tTerm('simulator.form.firstPaymentDate')}
                tooltip={tTerm('newCredit.field.firstPaymentDate.tooltip')}
              >
                <div className="relative">
                  <input
                    type="date"
                    value={input.startDate || ''}
                    onChange={handleDateFieldChange}
                    className="form-control pr-10"
                  />
                  <CalendarDays size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                </div>
              </FormField>

              <FormField
                label={tTerm('simulator.form.lateFeeCalculation')}
                tooltip={tTerm('newCredit.field.lateFee.tooltip')}
                helper={lateFeeFieldHelper}
              >
                <SelectInput
                  data-tour="new-credit-late-fee-mode"
                  value={input.lateFeeMode || 'SIMPLE'}
                  onChange={handleLateFeeModeChange}
                >
                  <option value="NONE">{tTerm('simulator.lateFee.mode.none')}</option>
                  <option value="SIMPLE">{tTerm('simulator.lateFee.mode.simple')}</option>
                  <option value="COMPOUND">{tTerm('simulator.lateFee.mode.compound')}</option>
                  <option value="FLAT">{tTerm('simulator.lateFee.mode.flat')}</option>
                  <option value="TIERED">{tTerm('simulator.lateFee.mode.tiered')}</option>
                </SelectInput>
              </FormField>

              <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={isLateFeePolicyResolving ? 'neutral' : 'warning'} size="sm">
                    {isLateFeePolicyResolving ? tTerm('newCredit.lateFee.value.loading') : lateFeeModeLabel}
                  </StatusChip>
                  {!isLateFeePolicyResolving && (
                    <StatusChip tone="neutral" size="sm">{formatPolicyRate(annualLateFeeRate)}</StatusChip>
                  )}
                </div>
                <p className="mt-2 font-semibold text-text-primary dark:text-amber-50">
                  {tTerm('newCredit.lateFee.note')}
                </p>
                <dl className="mt-3 grid gap-3">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">{tTerm('newCredit.lateFee.when')}</dt>
                    <dd className="mt-1 text-text-secondary dark:text-amber-100/85">{lateFeeModeDescription.trigger}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">{tTerm('newCredit.lateFee.how')}</dt>
                    <dd className="mt-1 text-text-secondary dark:text-amber-100/85">{lateFeeModeDescription.formula}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">{tTerm('newCredit.lateFee.saved')}</dt>
                    <dd className="mt-1 text-text-secondary dark:text-amber-100/85">
                      {lateFeePolicyLabel}. {lateFeeModeDescription.effect}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="min-w-0 space-y-4 rounded-[1.6rem] border border-border-subtle bg-bg-surface px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:px-6">
              <div>
                <h3 className="text-[1.05rem] font-bold text-text-primary">{tTerm('simulator.section.summary.title')}</h3>
                <p className="mt-1 text-sm text-text-secondary">{tTerm('simulator.section.summary.subtitle')}</p>
              </div>

              {calculationError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {calculationError}
                </div>
              )}

              {result && !isResultStale ? (
                <>
                  <InsightStrip
                    aria-label={tTerm('newCredit.summary.aria')}
                    items={summaryCards}
                  />
                  <div className="mt-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-text-secondary" />
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">{tTerm('simulator.schedule.title')}</h4>
                          <p className="mt-1 text-xs text-text-secondary">{tTerm('simulator.schedule.subtitle')}</p>
                        </div>
                      </div>
                      <StatusChip tone="neutral" size="sm">{calculationRuleLabel}</StatusChip>
                    </div>
                    <DataTableSurface className="mt-4 overflow-x-auto">
                        <table className="min-w-[920px] w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-bg-base text-left text-[11px] uppercase tracking-[0.14em] text-text-secondary">
                            <tr>
                              <th className="w-16 px-4 py-3 text-center font-medium">{tTerm('simulator.schedule.header.payment')}</th>
                              <th className="px-4 py-3 font-medium">{tTerm('schedule.table.header.dueDate')}</th>
                              <th className="px-4 py-3 text-right font-medium">{tTerm('simulator.schedule.header.payment')}</th>
                              <th className="px-4 py-3 text-right font-medium">{tTerm('simulator.schedule.header.interest')}</th>
                              <th className="px-4 py-3 text-right font-medium">{tTerm('simulator.schedule.header.principal')}</th>
                              <th className="px-4 py-3 text-right font-medium">{tTerm('simulator.schedule.header.balance')}</th>
                              <th className="w-32 px-4 py-3 text-center font-medium">{tTerm('schedule.table.header.status')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-subtle bg-bg-surface">
                            {result.schedule.length > 0 ? result.schedule.map((row) => (
                              <tr key={row.installmentNumber}>
                                <td className="px-4 py-3 text-center font-medium text-text-primary">{row.installmentNumber}</td>
                                <td className="px-4 py-3 text-text-secondary">{formatDueDate(row.dueDate)}</td>
                                <td className="px-4 py-3 text-right text-text-primary">{formatMoney(row.scheduledPayment)}</td>
                                <td className="px-4 py-3 text-right text-text-primary">{formatMoney(row.interestComponent)}</td>
                                <td className="px-4 py-3 text-right text-text-primary">{formatMoney(row.principalComponent)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-text-primary">{formatMoney(row.remainingBalance)}</td>
                                <td className="px-4 py-3 text-center text-text-secondary">{formatScheduleStatus(row.status)}</td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-secondary">
                                  {tTerm('newCredit.schedule.empty')}
                                </td>
                              </tr>
                            )}
                          </tbody>
                          {scheduleTotals && (
                            <tfoot>
                              <tr>
                                <td className="px-4 py-3 text-center font-semibold text-text-primary">{scheduleTotals.installmentCount}</td>
                                <td className="px-4 py-3 font-semibold text-text-primary">{tTerm('newCredit.schedule.totals')}</td>
                                <td className="px-4 py-3 text-right font-semibold text-text-primary">{formatMoney(scheduleTotals.totalScheduledPayment)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-text-primary">{formatMoney(scheduleTotals.totalInterest)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-text-primary">{formatMoney(scheduleTotals.totalPrincipal)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-text-primary">{formatMoney(scheduleTotals.finalBalance)}</td>
                                <td className="px-4 py-3 text-center font-semibold text-text-primary">{tTerm('newCredit.schedule.pendingCount', { count: scheduleTotals.pendingCount })}</td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                    </DataTableSurface>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-1 flex min-h-[270px] items-center justify-center rounded-[1.3rem] border border-border-subtle bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <div>
                      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary shadow-[0_8px_20px_rgba(37,99,235,0.12)]">
                        <Calculator size={24} />
                      </span>
                      <h4 className="mt-5 text-[1.7rem] font-bold text-text-primary">{tTerm('newCredit.empty.title')}</h4>
                      <p className="mt-3 max-w-xl text-sm leading-7 text-text-secondary">
                        {tTerm('newCredit.empty.subtitle')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 rounded-[1rem] border border-border-subtle bg-bg-surface px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-text-secondary" />
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">{tTerm('simulator.schedule.title')}</h4>
                          <p className="mt-1 text-xs text-text-secondary">{tTerm('simulator.schedule.subtitle')}</p>
                        </div>
                      </div>
                      <ChevronDown size={16} className="text-text-secondary" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </PageShell>

    </form>
  );
}
