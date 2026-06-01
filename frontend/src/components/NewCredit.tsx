import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, CalendarDays, CheckCircle2, Clock3, DollarSign, Loader2, RotateCcw, Save, User, Wallet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { formatCurrency as formatCurrencyValue, formatDate as formatLocaleDate, isValidOperationalDateOnly } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { useLoans } from '../services/loanService';
import { useCustomers } from '../services/customerService';
import { toast } from '../lib/toast';
import { extractValidationErrors } from '../services/apiErrors';
import { formatScheduleStatusLabel } from '../lib/scheduleStatusLabels';
import { useConfig } from '../services/configService';
import { useSessionStore } from '../store/sessionStore';
import {
  DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
  useActiveCreditSimulation,
} from './hooks/useActiveCreditSimulation';
import type { CreditCalculationInput } from '../types/creditCalculation';
import { QuickGuideButton } from './shared/HelpSupport';
import {
  FloatingActionDock,
  floatingActionDockButtonClass,
  floatingActionDockIconButtonClass,
} from './shared/FloatingActionDock';
import {
  ActionButton,
  FormField,
  IconActionButton,
  InsightStrip,
  PageHeader,
  PageShell,
  StatusChip,
} from './shared/Surfaces';
import { AppTable } from './shared/tables';
import { OperationalInput, OperationalSelect } from './shared/FormControls';
import { getLocalDateInputValue } from '../lib/dateInput';

const formatMoney = (value: number) => formatCurrencyValue(Number.isFinite(value) ? value : 0);
const getSafeCreditCreationFieldError = (field: unknown): { field: string; message: string } | null => {
  const normalizedField = String(field || '').trim().replace(/[_-]/g, '').toLowerCase();
  if (['customer', 'customerid', 'borrower', 'borrowerid'].includes(normalizedField)) {
    return {
      field: 'customerId',
      message: tTerm('newCredit.error.customerRequired'),
    };
  }

  return null;
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
const formatDueDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return formatLocaleDate(date, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) || '-';
};
const sortLateFeePoliciesForApplication = (policies: any[]) => [...policies].sort((left, right) => (
  (lateFeePriorityOrder[normalizePolicyPriority(left?.priority)] ?? lateFeePriorityOrder.medium)
  - (lateFeePriorityOrder[normalizePolicyPriority(right?.priority)] ?? lateFeePriorityOrder.medium)
));
const getLateFeePolicyConflicts = (policies: any[]) => {
  const activePolicies = sortLateFeePoliciesForApplication(policies)
    .filter((policy) => policy?.isActive !== false);

  if (activePolicies.length === 0) {
    return [];
  }

  const selectedPriority = normalizePolicyPriority(activePolicies[0]?.priority);
  const samePriorityPolicies = activePolicies
    .filter((policy) => normalizePolicyPriority(policy?.priority) === selectedPriority);

  return samePriorityPolicies.length > 1 ? samePriorityPolicies : [];
};

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

  return composedName || entity?.email || tTerm('credits.label.customerFallback');
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
  const initialCalculationInput = useMemo<CreditCalculationInput>(() => ({
    ...DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
    ...routeState?.calculationInput,
    rateSource: 'policy',
    lateFeeSource: 'policy',
    startDate: routeState?.calculationInput?.startDate || getLocalDateInputValue(),
  }), [routeState?.calculationInput]);

  const {
    input,
    result,
    error: calculationError,
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

  const ambiguousLateFeePolicies = useMemo<any[]>(
    () => getLateFeePolicyConflicts(lateFeePolicies),
    [lateFeePolicies],
  );
  const hasAmbiguousLateFeePolicy = canReadFinancialConfig && ambiguousLateFeePolicies.length > 1;
  const activeLateFeePolicies = useMemo<any[]>(
    () => sortLateFeePoliciesForApplication(lateFeePolicies).filter((policy) => policy?.isActive !== false),
    [lateFeePolicies],
  );
  const hasAnyActiveLateFeePolicy = activeLateFeePolicies.length > 0;
  const resolvedLateFeePolicy = useMemo<any>(() => (
    hasAmbiguousLateFeePolicy ? null : activeLateFeePolicies[0] || null
  ), [activeLateFeePolicies, hasAmbiguousLateFeePolicy]);
  useEffect(() => {
    const nextInput: Partial<CreditCalculationInput> = {};

    if (resolvedRatePolicy?.annualEffectiveRate != null) {
      nextInput.interestRate = Number(resolvedRatePolicy.annualEffectiveRate);
      nextInput.rateSource = 'policy';
    }

    if (resolvedLateFeePolicy?.lateFeeMode) {
      nextInput.lateFeeMode = String(resolvedLateFeePolicy.lateFeeMode) as CreditCalculationInput['lateFeeMode'];
      nextInput.annualLateFeeRate = Number(resolvedLateFeePolicy.annualEffectiveRate || 0);
      nextInput.lateFeeSource = 'policy';
    }

    if (Object.keys(nextInput).length > 0) {
      setInput(nextInput);
    }
  }, [resolvedLateFeePolicy, resolvedRatePolicy, setInput]);

  const calculationPolicySnapshot = result?.policySnapshot as Record<string, unknown> | null | undefined;
  const calculationRateSource = String(calculationPolicySnapshot?.rateSource || '');
  const calculationLateFeeSource = String(calculationPolicySnapshot?.lateFeeSource || '');
  const calculationAppliedLateFeeRate = Number(calculationPolicySnapshot?.appliedAnnualLateFeeRate ?? result?.inputs?.annualLateFeeRate ?? input.annualLateFeeRate ?? 0);
  const calculationAppliedLateFeeMode = String(calculationPolicySnapshot?.appliedLateFeeMode || result?.inputs?.lateFeeMode || input.lateFeeMode || 'SIMPLE') as CreditCalculationInput['lateFeeMode'];
  const hasPolicyBackedCalculation = Boolean(result && !isResultStale && calculationRateSource === 'policy');
  const isRatePolicyResolving = canReadFinancialConfig && isConfigLoading;
  const isLateFeePolicyResolving = canReadFinancialConfig && isConfigLoading;
  const resolvedLateFeeSource = 'policy';
  const canValidateWithCurrentPolicy = canReadFinancialConfig
    ? !isRatePolicyResolving
      && !isLateFeePolicyResolving
      && Boolean(resolvedRatePolicy)
      && Boolean(resolvedLateFeePolicy)
      && !hasAmbiguousRatePolicy
      && !hasAmbiguousLateFeePolicy
    : true;
  const isRatePolicyReady = canReadFinancialConfig ? !isRatePolicyResolving && Boolean(resolvedRatePolicy) && !hasAmbiguousRatePolicy : hasPolicyBackedCalculation;
  const isLateFeePolicyReady = canReadFinancialConfig
    ? !isLateFeePolicyResolving && Boolean(resolvedLateFeePolicy) && !hasAmbiguousLateFeePolicy
    : calculationLateFeeSource === 'policy';
  const annualLateFeeRate = Number(
    result?.inputs?.annualLateFeeRate
    ?? input.annualLateFeeRate
    ?? resolvedLateFeePolicy?.annualEffectiveRate
    ?? 0,
  );
  const hasValidatedResult = Boolean(result) && !isResultStale;
  const canRegister = Boolean(borrower.customerId) && isRatePolicyReady && isLateFeePolicyReady && hasValidatedResult && !isSubmitting && !isSimulating;
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
    setInput(partialInput);
  };

  const resetCalculation = () => {
    setInput({
      ...DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
      rateSource: 'policy',
      lateFeeSource: 'policy',
      startDate: getLocalDateInputValue(),
    });
  };

  const handleValidateCredit = () => {
    if (input.startDate && !isValidOperationalDateOnly(input.startDate)) {
      toast.error({ title: tTerm('newCredit.validation.startDate') });
      return;
    }

    if (hasAmbiguousLateFeePolicy) {
      toast.error({
        title: tTerm('newCredit.toast.lateFeeConflict.title'),
        description: tTerm('newCredit.toast.lateFeeConflict.validate'),
      });
      return;
    }

    if (canReadFinancialConfig && !isLateFeePolicyResolving && !hasAnyActiveLateFeePolicy) {
      toast.error({
        title: tTerm('newCredit.toast.lateFeePolicyMissing.title'),
        description: tTerm('newCredit.toast.lateFeePolicyMissing.validate'),
      });
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

      if (hasAmbiguousLateFeePolicy) {
        toast.error({
          title: tTerm('newCredit.toast.lateFeeConflict.title'),
          description: tTerm('newCredit.toast.lateFeeConflict.validate'),
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

    if (!isLateFeePolicyReady) {
      if (hasAmbiguousLateFeePolicy) {
        toast.error({
          title: tTerm('newCredit.toast.lateFeeConflict.title'),
          description: tTerm('newCredit.toast.lateFeeConflict.register'),
        });
        return;
      }

      toast.error({
        title: tTerm('newCredit.toast.lateFeePolicyMissing.title'),
        description: tTerm('newCredit.toast.lateFeePolicyMissing.register'),
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
      toast.success({ description: tTerm('newCredit.toast.success') });

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
          const safeFieldError = getSafeCreditCreationFieldError(err.field);
          if (safeFieldError) {
            fieldErrs[safeFieldError.field] = safeFieldError.message;
          }
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
    <FloatingActionDock
      layout="new-credit"
      ariaLabel={tTerm('newCredit.aria.actionDock')}
      data-tour="new-credit-action-dock"
    >
      <IconActionButton
        onClick={resetCalculation}
        disabled={isSimulating}
        label={tTerm('newCredit.action.reset')}
        title={tTerm('newCredit.action.reset')}
        icon={<RotateCcw size={16} />}
        className={floatingActionDockIconButtonClass}
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
            : hasAmbiguousLateFeePolicy
              ? tTerm('newCredit.action.validate.title.lateFeeConflict')
            : tTerm('newCredit.action.validate.title.missing')}
        icon={isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
        fullWidth
        className={floatingActionDockButtonClass}
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
        className={floatingActionDockButtonClass}
      >
        <span className="hidden sm:inline">{tTerm('newCredit.action.register')}</span>
        <span className="sm:hidden">{tTerm('newCredit.action.register.short')}</span>
      </ActionButton>
    </FloatingActionDock>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="pb-44"
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
                <OperationalSelect
                  id="customerId"
                  name="customerId"
                  aria-label={tTerm('newCredit.field.customer')}
                  data-tour="new-credit-customer-select"
                  value={borrower.customerId}
                  onChange={handleBorrowerChange}
                  invalid={!!borrowerErrors.customerId}
                  icon={<User size={18} />}
                >
                  <option value="">{tTerm('newCredit.placeholder.customer')}</option>
                  {customers.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {getDisplayName(customer)} · CUS-{String(customer.id).padStart(4, '0')}
                    </option>
                  ))}
                </OperationalSelect>
              </FormField>

              <FormField label={tTerm('simulator.form.amount')}>
                <OperationalInput
                  variant="money"
                  value={input.amount}
                  onValueChange={(value) => handleCalculationInputChange({ amount: Number(value) || 0 })}
                  icon={<DollarSign size={18} />}
                />
              </FormField>

              <div className="new-credit-field-grid">
                <FormField label={tTerm('simulator.field.termMonths')}>
                  <OperationalInput
                    variant="number"
                    min="1"
                    value={input.termMonths}
                    onValueChange={(value) => handleCalculationInputChange({ termMonths: Number(value) || 0 })}
                    placeholder={tTerm('newCredit.placeholder.term')}
                  />
                </FormField>

                <FormField label={tTerm('simulator.form.firstPaymentDate')}>
                  <OperationalInput
                    variant="date"
                    value={input.startDate || ''}
                    onValueChange={(value) => handleCalculationInputChange({ startDate: String(value || '') || undefined })}
                  />
                </FormField>
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
                    <AppTable
                      variant="financial"
                      visibleFrom="always"
                      horizontalScroll
                      minWidthClassName="min-w-[880px]"
                      surfaceClassName="new-credit-schedule-table mt-4"
                    >
                        <colgroup>
                          <col style={{ width: '6%' }} />
                          <col style={{ width: '20%' }} />
                          <col style={{ width: '13%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '22%' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th className="text-center">{tTerm('simulator.schedule.header.number')}</th>
                            <th>{tTerm('schedule.table.header.dueDate')}</th>
                            <th className="text-right">{tTerm('simulator.schedule.header.payment')}</th>
                            <th className="text-right">{tTerm('simulator.schedule.header.interest')}</th>
                            <th className="text-right">{tTerm('simulator.schedule.header.principal')}</th>
                            <th className="text-right">{tTerm('simulator.schedule.header.balance')}</th>
                            <th className="text-center">{tTerm('schedule.table.header.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.schedule.length > 0 ? result.schedule.map((row) => (
                            <tr key={row.installmentNumber}>
                              <td className="text-center font-medium text-text-secondary">{row.installmentNumber}</td>
                              <td className="text-text-secondary">{formatDueDate(row.dueDate)}</td>
                              <td className="text-right font-medium text-text-primary">{formatMoney(row.scheduledPayment)}</td>
                              <td className="text-right text-text-secondary">{formatMoney(row.interestComponent)}</td>
                              <td className="text-right font-medium text-emerald-600 dark:text-emerald-400">{formatMoney(row.principalComponent)}</td>
                              <td className="text-right font-medium text-text-primary">{formatMoney(row.remainingBalance)}</td>
                              <td className="text-center text-text-secondary">{formatScheduleStatusLabel(row.status)}</td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={7} className="table-empty-state">
                                {tTerm('newCredit.schedule.empty')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {scheduleTotals && (
                          <tfoot>
                            <tr>
                              <td className="text-center font-semibold text-text-primary">{scheduleTotals.installmentCount}</td>
                              <td className="font-semibold text-text-primary">{tTerm('newCredit.schedule.totals')}</td>
                              <td className="text-right font-semibold text-text-primary">{formatMoney(scheduleTotals.totalScheduledPayment)}</td>
                              <td className="text-right font-semibold text-text-primary">{formatMoney(scheduleTotals.totalInterest)}</td>
                              <td className="text-right font-semibold text-text-primary">{formatMoney(scheduleTotals.totalPrincipal)}</td>
                              <td className="text-right font-semibold text-text-primary">{formatMoney(scheduleTotals.finalBalance)}</td>
                              <td className="text-center font-semibold text-text-primary">{tTerm('newCredit.schedule.pendingCount', { count: scheduleTotals.pendingCount })}</td>
                            </tr>
                          </tfoot>
                        )}
                    </AppTable>
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
