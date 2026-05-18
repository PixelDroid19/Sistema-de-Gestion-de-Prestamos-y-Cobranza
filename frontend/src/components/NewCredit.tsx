import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, CalendarDays, CheckCircle2, Clock3, DollarSign, Loader2, RotateCcw, Save, ShieldCheck, User, Wallet } from 'lucide-react';
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
  const rateInsightHelper = hasAmbiguousRatePolicy
    ? tTerm('newCredit.insight.rate.conflictHelper', { count: ambiguousRatePolicyMatches.length })
    : visibleRatePolicyRange
      ? tTerm('newCredit.insight.rate.helper', { rate: rateSummaryValue, range: visibleRatePolicyRange })
      : rateSummaryValue;
  const lateFeeModeLabel = getLateFeeModeLabel(input.lateFeeMode || resolvedLateFeePolicy?.lateFeeMode || 'SIMPLE');
  const lateFeeSummaryDetail = isLateFeePolicyResolving
    ? tTerm('newCredit.lateFee.summary.loading')
    : resolvedLateFeeSource === 'policy' && resolvedLateFeePolicy
    ? tTerm('newCredit.lateFee.summary.policy', { label: resolvedLateFeePolicy.label })
    : tTerm('newCredit.lateFee.summary.manual');
  const lateFeeSummaryValue = isLateFeePolicyResolving ? tTerm('newCredit.lateFee.value.loading') : `${lateFeeModeLabel} · ${annualLateFeeRate}% EA`;
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
      id: 'rate',
      label: tTerm('newCredit.insight.rate.label'),
      value: hasAmbiguousRatePolicy
        ? tTerm('newCredit.badge.rate.conflict')
        : isRatePolicyReady
          ? visibleRatePolicyLabel
          : rateSummaryValue,
      helper: rateInsightHelper,
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
      <PageShell className="new-credit-page mx-auto max-w-[1280px] !gap-4">
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

        <div aria-label={tTerm('newCredit.aria.floatingActions')}>
          {actionDock}
        </div>

        <section className="new-credit-workspace" data-tour="new-credit-simulation">
          <div className="new-credit-workspace-body">
          <div className="new-credit-panel new-credit-form-panel" data-tour="new-credit-borrower">
              <div className="new-credit-panel-heading">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <Calculator size={16} />
                  {tTerm('simulator.section.parameters')}
                </h4>
                {routeState?.source === 'credit-calculator' && (
                  <StatusChip tone="success" size="sm" icon={<CheckCircle2 size={13} />}>
                    {tTerm('newCredit.badge.preloaded')}
                  </StatusChip>
                )}
              </div>

              <FormField label={tTerm('newCredit.field.customer')} error={borrowerErrors.customerId}>
                <div className="new-credit-control-shell">
                  <span className="new-credit-control-icon" aria-hidden="true">
                    <User size={18} />
                  </span>
                  <SelectInput
                    id="customerId"
                    name="customerId"
                    aria-label={tTerm('newCredit.field.customer')}
                    data-tour="new-credit-customer-select"
                    value={borrower.customerId}
                    onChange={handleBorrowerChange}
                    className={`new-credit-control-select ${borrowerErrors.customerId ? 'border-red-400 focus:ring-red-500' : ''}`}
                    aria-invalid={!!borrowerErrors.customerId}
                  >
                    <option value="">{tTerm('newCredit.placeholder.customer')}</option>
                    {customers.map((customer: any) => (
                      <option key={customer.id} value={customer.id}>
                        {getDisplayName(customer)} · CUS-{String(customer.id).padStart(4, '0')}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </FormField>

              <FormField label={tTerm('simulator.form.amount')}>
                <div className="new-credit-control-shell">
                  <span className="new-credit-control-icon" aria-hidden="true">
                    <DollarSign size={18} />
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatAmountInputDisplay(input.amount)}
                    onChange={handleAmountFieldChange}
                    className="new-credit-control-input"
                  />
                </div>
              </FormField>

              <div className="new-credit-field-grid">
                <FormField label={tTerm('simulator.field.termMonths')}>
                  <div className="new-credit-control-shell">
                    <input
                      type="number"
                      min="1"
                      value={input.termMonths}
                      onChange={handleNumberFieldChange('termMonths')}
                      className="new-credit-control-input"
                      placeholder={tTerm('newCredit.placeholder.term')}
                    />
                  </div>
                </FormField>

                <FormField label={tTerm('simulator.form.firstPaymentDate')}>
                  <div className="new-credit-control-shell">
                    <input
                      type="date"
                      value={input.startDate || ''}
                      onChange={handleDateFieldChange}
                      className="new-credit-control-input"
                    />
                  </div>
                </FormField>
              </div>

              <div className="new-credit-config-summary" aria-label={tTerm('newCredit.section.preparation.aria')} data-tour="new-credit-policy-summary">
                {insightItems.map((item) => (
                  <div key={item.id} className={`new-credit-config-item new-credit-config-item--${item.accent ?? 'slate'}`}>
                    <span className="new-credit-config-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="new-credit-config-label">{item.label}</span>
                      <span className="new-credit-config-value">{item.value}</span>
                      {item.helper ? <span className="new-credit-config-helper">{item.helper}</span> : null}
                    </span>
                  </div>
                ))}
              </div>

          </div>

          <div className="new-credit-panel new-credit-preview-panel">
              <div className="new-credit-panel-heading">
                <h3 className="text-[1.05rem] font-bold text-text-primary">{tTerm('simulator.section.summary.title')}</h3>
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
                    className="new-credit-summary-strip"
                  />
                  <div className="mt-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-text-secondary" />
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">{tTerm('simulator.schedule.title')}</h4>
                        </div>
                      </div>
                    </div>
                    <DataTableSurface className="new-credit-schedule-table mt-4 overflow-x-auto">
                        <table className="min-w-[780px] w-full text-left text-sm whitespace-nowrap">
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
                <div className="new-credit-empty-preview">
                  <div className="w-full max-w-2xl">
                    <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary shadow-[0_8px_20px_rgba(37,99,235,0.12)]">
                      <Calculator size={22} />
                    </span>
                    <h4 className="mt-4 text-[1.35rem] font-bold text-text-primary">{tTerm('newCredit.empty.title')}</h4>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
                      {tTerm('newCredit.empty.subtitle')}
                    </p>
                  </div>
                </div>
              )}
          </div>
          </div>
        </section>
      </PageShell>

    </form>
  );
}
