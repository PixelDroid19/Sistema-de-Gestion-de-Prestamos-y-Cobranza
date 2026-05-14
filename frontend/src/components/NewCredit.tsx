import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, CalendarDays, CheckCircle2, ChevronDown, Clock3, Loader2, RotateCcw, Save, ShieldCheck, User, Wallet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { getCalculationValueLabel } from '../lib/creditCalculationLabels';
import {
  ActionButton,
  DataTableSurface,
  FormField,
  IconActionButton,
  InsightStrip,
  MetricCard,
  PageHeader,
  PageShell,
  SelectInput,
  StatusChip,
} from './shared/Surfaces';

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
const formatMoney = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const formatPolicyRate = (value: unknown) => `${Number(value ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })}% EA`;
const formatPolicyRange = (minAmount: unknown, maxAmount: unknown) => {
  const hasMin = minAmount !== null && minAmount !== undefined && minAmount !== '';
  const hasMax = maxAmount !== null && maxAmount !== undefined && maxAmount !== '';

  if (!hasMin && !hasMax) return 'todos los montos';
  return `${hasMin ? formatMoney(Number(minAmount)) : '$0'} - ${hasMax ? formatMoney(Number(maxAmount)) : 'sin tope'}`;
};
const getRangeBoundary = (value: unknown, fallback: number) => {
  if (value === null || value === undefined || value === '') return fallback;
  return Number(value);
};
const sortRatePoliciesForApplication = (policies: any[]) => [...policies].sort((left, right) => {
  const priorityDiff = Number(left?.priority || 100) - Number(right?.priority || 100);
  if (priorityDiff !== 0) return priorityDiff;
  return getRangeBoundary(left?.minAmount, 0) - getRangeBoundary(right?.minAmount, 0);
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
const getWinningPriorityConflicts = (matches: any[]) => {
  const orderedMatches = sortRatePoliciesForApplication(matches);
  const winningPriority = orderedMatches[0] ? Number(orderedMatches[0]?.priority || 100) : null;
  if (winningPriority === null) return [];
  return orderedMatches.filter((policy) => Number(policy?.priority || 100) === winningPriority);
};
const formatAmountInputDisplay = (value: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
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
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
};
const formatScheduleStatus = (status?: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') return 'Pendiente';
  if (normalized === 'paid' || normalized === 'settled') return 'Pagada';
  if (normalized === 'overdue' || normalized === 'defaulted') return 'En mora';
  if (normalized === 'cancelled' || normalized === 'annulled') return 'Anulada';
  return status || '-';
};

const lateFeeModeDescriptions: Record<string, { trigger: string; formula: string; effect: string }> = {
  NONE: {
    trigger: 'No se cobra recargo aunque una cuota se atrase.',
    formula: 'Mora = $0.',
    effect: 'El crédito queda sin recargo de mora para vencimientos futuros.',
  },
  SIMPLE: {
    trigger: 'Se activa solo cuando una cuota queda vencida.',
    formula: 'Mora = saldo vencido x tasa diaria x días de atraso.',
    effect: 'No aumenta la cuota normal al crear el crédito; se calcula después si hay atraso.',
  },
  COMPOUND: {
    trigger: 'Se activa solo cuando una cuota queda vencida y acumula recargo por días de atraso.',
    formula: 'Mora = saldo vencido x tasa diaria compuesta por días vencidos.',
    effect: 'No se cobra desde el día uno; se calcula sobre deuda vencida si el cliente se atrasa.',
  },
  FLAT: {
    trigger: 'Se activa cuando una cuota queda vencida.',
    formula: 'Mora = cargo fijo definido por política.',
    effect: 'El cargo fijo se suma después del vencimiento, no al registrar el crédito.',
  },
  TIERED: {
    trigger: 'Se activa cuando una cuota queda vencida y cambia según los tramos configurados.',
    formula: 'Mora = recargo del tramo correspondiente a los días de atraso.',
    effect: 'El sistema aplica el tramo cuando exista atraso real.',
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
    () => getWinningPriorityConflicts(resolvedRatePolicyMatches),
    [resolvedRatePolicyMatches],
  );
  const hasAmbiguousRatePolicy = canReadFinancialConfig && ambiguousRatePolicyMatches.length > 1;
  const resolvedRatePolicy = useMemo<any>(() => (
    hasAmbiguousRatePolicy ? null : sortRatePoliciesForApplication(resolvedRatePolicyMatches)[0] || null
  ), [hasAmbiguousRatePolicy, resolvedRatePolicyMatches]);

  const resolvedLateFeePolicy = useMemo<any>(() => (
    lateFeePolicies
      .filter((policy: any) => policy.isActive)
      .sort((left: any, right: any) => Number(left.priority || 100) - Number(right.priority || 100))[0] || null
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
  const resolvedLateFeeSource = canReadFinancialConfig
    ? (lateFeeWasEdited || !resolvedLateFeePolicy ? 'manual' : 'policy')
    : (calculationLateFeeSource === 'policy' ? 'policy' : 'manual');
  const canValidateWithCurrentPolicy = canReadFinancialConfig ? Boolean(resolvedRatePolicy) && !hasAmbiguousRatePolicy : true;
  const isRatePolicyReady = canReadFinancialConfig ? Boolean(resolvedRatePolicy) && !hasAmbiguousRatePolicy : hasPolicyBackedCalculation;
  const annualLateFeeRate = Number(
    result?.inputs?.annualLateFeeRate
    ?? input.annualLateFeeRate
    ?? resolvedLateFeePolicy?.annualEffectiveRate
    ?? 0,
  );
  const visibleRatePolicyLabel = canReadFinancialConfig
    ? resolvedRatePolicy?.label || 'Sin política para este monto'
    : calculationRatePolicyLabel || 'Política aplicada al validar';
  const visibleRatePolicyRange = canReadFinancialConfig && resolvedRatePolicy
    ? formatPolicyRange(resolvedRatePolicy.minAmount, resolvedRatePolicy.maxAmount)
    : null;
  const visibleRatePolicyExplanation = canReadFinancialConfig
    ? hasAmbiguousRatePolicy
      ? `Hay varias tasas activas para ${formatMoney(Number(input.amount || 0))}: ${ambiguousRatePolicyMatches.map((policy) => policy.label).join(' y ')}. Edita o desactiva una en Configuración antes de validar.`
      : resolvedRatePolicy
      ? `Para ${formatMoney(Number(input.amount || 0))}, aplica "${resolvedRatePolicy.label}" porque cubre ${visibleRatePolicyRange}. Al registrar, esta tasa queda congelada en el crédito.`
      : `No hay una tasa activa que cubra ${formatMoney(Number(input.amount || 0))}. Configura un rango antes de registrar.`
    : hasPolicyBackedCalculation
      ? `El backend aplicó "${visibleRatePolicyLabel}" al validar. Esa tasa queda guardada al registrar.`
      : 'Valida el crédito para que el backend aplique la tasa vigente por rango.';
  const rateSourceLabel = hasAmbiguousRatePolicy ? 'Conflicto' : isRatePolicyReady ? 'Configuración' : canReadFinancialConfig ? 'Sin política' : 'Automática';
  const lateFeeSourceLabel = resolvedLateFeeSource === 'policy' ? 'Configuración' : 'Manual';
  const rateSummaryValue = canReadFinancialConfig && isRatePolicyReady
    ? formatPolicyRate(resolvedRatePolicy?.annualEffectiveRate ?? input.interestRate ?? 0)
    : hasPolicyBackedCalculation
      ? formatPolicyRate(Number.isFinite(calculationAppliedInterestRate) ? calculationAppliedInterestRate : 0)
      : hasAmbiguousRatePolicy ? 'Conflicto' : canReadFinancialConfig ? 'Sin política' : 'Pendiente de validar';
  const rateSummaryDetail = canReadFinancialConfig && isRatePolicyReady
    ? `${resolvedRatePolicy.label} · ${visibleRatePolicyRange}`
    : hasPolicyBackedCalculation
      ? calculationRatePolicyLabel || 'Política aplicada por el backend'
      : hasAmbiguousRatePolicy
        ? `${ambiguousRatePolicyMatches.length} reglas cubren este monto con el mismo orden.`
        : canReadFinancialConfig
        ? 'Crea o ajusta una política de tasa para este rango de monto.'
        : 'El backend aplicará la política activa por rango al validar.';
  const lateFeeModeLabel = getCalculationValueLabel(
    input.lateFeeMode || resolvedLateFeePolicy?.lateFeeMode || 'SIMPLE',
    'lateFeeMode',
  );
  const selectedLateFeeMode = String(input.lateFeeMode || resolvedLateFeePolicy?.lateFeeMode || 'SIMPLE').toUpperCase();
  const lateFeeModeDescription = lateFeeModeDescriptions[selectedLateFeeMode] || lateFeeModeDescriptions.SIMPLE;
  const lateFeeSummaryDetail = resolvedLateFeeSource === 'policy' && resolvedLateFeePolicy
    ? `${resolvedLateFeePolicy.label} · solo si hay atraso`
    : 'Ajustada en este crédito · solo si hay atraso';
  const lateFeeSummaryValue = `${lateFeeModeLabel} · ${annualLateFeeRate}% EA`;
  const lateFeePolicyLabel = resolvedLateFeeSource === 'policy' && resolvedLateFeePolicy
    ? resolvedLateFeePolicy.label
    : 'Definida en este crédito';
  const hasValidatedResult = Boolean(result) && !isResultStale;
  const canRegister = Boolean(borrower.customerId) && isRatePolicyReady && hasValidatedResult && !isSubmitting && !isSimulating;
  const isBorrowerReady = Boolean(borrower.customerId);
  const isRegistrationReady = isBorrowerReady && hasValidatedResult;
  const calculationRuleLabel = result?.calculationProfileVersionId != null
    ? `Regla v${result.calculationProfileVersionId}`
    : 'Regla activa';
  const readinessSummary = [
    {
      label: 'Cliente',
      status: isBorrowerReady ? 'Listo' : 'Pendiente',
      icon: User,
      tone: isBorrowerReady ? 'success' : 'neutral',
    },
    {
      label: 'Validación',
      status: hasValidatedResult ? 'Vigente' : result && isResultStale ? 'Revalidar' : 'Pendiente',
      icon: Calculator,
      tone: hasValidatedResult ? 'info' : result && isResultStale ? 'warning' : 'neutral',
    },
    {
      label: 'Registro',
      status: isRegistrationReady ? 'Disponible' : 'Bloqueado',
      icon: Save,
      tone: isRegistrationReady ? 'dark' : 'neutral',
    },
  ];
  const summaryCards = result && !isResultStale ? [
    { label: 'Cuota', value: formatMoney(result.summary.installmentAmount), accent: 'teal' as const },
    { label: 'Total', value: formatMoney(result.summary.totalPayable), accent: 'blue' as const },
    { label: 'Interés', value: formatMoney(result.summary.totalInterest), accent: 'rose' as const },
  ] : [];
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
      label: 'Cliente',
      value: isBorrowerReady ? 'Listo' : 'Pendiente',
      helper: 'Selecciona el cliente',
      icon: <User size={16} />,
      accent: 'slate' as const,
    },
    {
      id: 'rate',
      label: 'Tasa',
      value: rateSummaryValue,
      helper: hasAmbiguousRatePolicy
        ? `${ambiguousRatePolicyMatches.length} reglas activas se pisan`
        : canReadFinancialConfig ? (resolvedRatePolicy?.label || 'Crédito estándar') : (calculationRatePolicyLabel || 'Crédito estándar'),
      icon: <Wallet size={16} />,
      accent: hasAmbiguousRatePolicy ? 'rose' as const : 'blue' as const,
    },
    {
      id: 'late-fee',
      label: 'Mora',
      value: lateFeeSummaryValue,
      helper: lateFeeSummaryDetail,
      icon: <Clock3 size={16} />,
      accent: 'amber' as const,
    },
    {
      id: 'validation',
      label: 'Validación',
      value: hasValidatedResult ? calculationRuleLabel : 'Pendiente',
      helper: 'Regla congelada al registrar',
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
    if (!canValidateWithCurrentPolicy) {
      if (hasAmbiguousRatePolicy) {
        toast.error({
          title: 'Conflicto de tasas',
          description: 'Hay más de una política activa para este monto con el mismo orden. Corrige Configuración antes de validar.',
        });
        return;
      }

      toast.error({
        title: 'Falta política de tasa',
        description: 'Configura una política activa que cubra este monto antes de validar o registrar el crédito.',
      });
      return;
    }

    void simulate();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!borrower.customerId) {
      setBorrowerErrors({ customerId: 'Selecciona el cliente que recibirá el crédito.' });
      toast.error({
        title: 'Falta el cliente',
        description: 'Selecciona un cliente antes de registrar el crédito.',
      });
      return;
    }

    if (!hasValidatedResult) {
      toast.warning({
        title: 'Valida el crédito',
        description: 'Ejecuta la validación con la regla de cálculo activa antes de registrar el crédito real.',
      });
      return;
    }

    if (!isRatePolicyReady) {
      if (hasAmbiguousRatePolicy) {
        toast.error({
          title: 'Conflicto de tasas',
          description: 'No se puede registrar un crédito real mientras dos tasas activas cubran el mismo monto con el mismo orden.',
        });
        return;
      }

      toast.error({
        title: 'Falta política de tasa',
        description: 'No se puede registrar un crédito real sin una política de tasa activa para el monto.',
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
      const versionLabel = result?.calculationProfileVersionId != null ? ` regla de cálculo v${result.calculationProfileVersionId}` : ' regla de cálculo activa';
      toast.success({ description: `Crédito registrado con${versionLabel}.` });

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
      aria-label="Acciones del nuevo crédito"
    >
      <IconActionButton
        onClick={resetCalculation}
        disabled={isSimulating}
        label="Restablecer parámetros"
        title="Restablecer parámetros"
        icon={<RotateCcw size={16} />}
        className="h-10 w-10 rounded-full"
      />
      <ActionButton
        data-tour="new-credit-validate"
        onClick={handleValidateCredit}
        disabled={isSimulating || isConfigLoading}
        isLoading={isSimulating}
        aria-label="Validar crédito"
        title={canValidateWithCurrentPolicy
          ? 'Calcula la cuota, intereses y cronograma con la política de tasa activa.'
          : hasAmbiguousRatePolicy
            ? 'Corrige el conflicto de tasas en Configuración antes de validar.'
            : 'Primero crea una política de tasa que cubra este monto.'}
        icon={isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
        fullWidth
        className="h-10 min-w-0 rounded-full px-3"
      >
        Validar
      </ActionButton>
      <ActionButton
        type="submit"
        disabled={!canRegister}
        data-tour="new-credit-submit"
        isLoading={isSubmitting}
        aria-label="Registrar crédito"
        title={canRegister ? 'Crea el crédito real con la regla validada.' : 'Primero valida el crédito y corrige cualquier campo pendiente.'}
        icon={isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        variant="primary"
        fullWidth
        className="h-10 min-w-0 rounded-full px-3"
      >
        <span className="hidden sm:inline">Registrar crédito</span>
        <span className="sm:hidden">Registrar</span>
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
          eyebrow="Originación"
          title={(
            <span className="flex min-w-0 items-center gap-3">
              <IconActionButton
                onClick={onBack}
                label="Volver a créditos"
                icon={<ArrowLeft size={20} />}
                className="shrink-0"
              />
              <span className="min-w-0 truncate">Nuevo crédito</span>
            </span>
          )}
          subtitle="Crea créditos con la tasa operativa vigente y una validación congelada antes del registro."
          actions={(
            <>
              <QuickGuideButton guideKey="new-credit" />
              <ActionButton onClick={onBack}>Cancelar</ActionButton>
            </>
          )}
        />

        <section
          className="space-y-3"
          data-tour="new-credit-customer"
        >
          <h3 className="sr-only">Preparación del crédito</h3>
          <InsightStrip
            items={insightItems}
            aria-label="Estado de preparación del crédito"
            data-tour="new-credit-policy-summary"
          />
          {routeState?.source === 'credit-calculator' && (
            <div className="mt-3">
              <StatusChip tone="success" size="sm" icon={<CheckCircle2 size={13} />}>
                Escenario precargado
              </StatusChip>
            </div>
          )}
        </section>

        <div aria-label="Acciones flotantes del nuevo crédito">
          {actionDock}
        </div>

        <section className="grid gap-6 rounded-[1.6rem] bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.08),_transparent_34%),radial-gradient(circle_at_top_left,_rgba(16,185,129,0.05),_transparent_28%)] p-0" data-tour="new-credit-simulation">
          <div className="grid gap-8 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.45fr)]">
            <div className="min-w-0 space-y-5 rounded-[1.6rem] border border-border-subtle bg-bg-surface px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:px-6" data-tour="new-credit-borrower">
              <div className="pb-1">
                <h3 className="text-[1.05rem] font-bold text-text-primary">Datos del crédito</h3>
              </div>

              <FormField label="Cliente" error={borrowerErrors.customerId}>
                <SelectInput
                  id="customerId"
                  name="customerId"
                  aria-label="Cliente"
                  data-tour="new-credit-customer-select"
                  value={borrower.customerId}
                  onChange={handleBorrowerChange}
                  className={borrowerErrors.customerId ? 'border-red-400 focus:ring-red-500' : ''}
                  aria-invalid={!!borrowerErrors.customerId}
                >
                  <option value="">Seleccionar cliente…</option>
                  {customers.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {getDisplayName(customer)} · CUS-{String(customer.id).padStart(4, '0')}
                    </option>
                  ))}
                </SelectInput>
              </FormField>

              <FormField label="Monto del crédito">
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
                label="Tasa configurada"
                tooltip="La tasa no se escribe a mano: se toma de Configuración según el monto del crédito. Al registrar, queda guardada y no cambia si después editas las reglas."
                helper={visibleRatePolicyExplanation}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={hasAmbiguousRatePolicy ? 'danger' : isRatePolicyReady ? 'info' : 'warning'} size="sm">
                      {hasAmbiguousRatePolicy ? 'Conflicto de tasas' : isRatePolicyReady ? `Configuración: ${visibleRatePolicyLabel}` : 'Sin tasa configurada'}
                    </StatusChip>
                    {visibleRatePolicyRange && (
                      <StatusChip tone="neutral" size="sm">
                        Rango: {visibleRatePolicyRange}
                      </StatusChip>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      aria-label="Tasa configurada"
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
                label="Plazo en meses"
                tooltip="Cantidad de cuotas mensuales del crédito. Cambiarlo recalcula cuota, total a pagar e intereses antes de registrar."
              >
                <input
                  type="number"
                  min="1"
                  value={input.termMonths}
                  onChange={handleNumberFieldChange('termMonths')}
                  className="form-control"
                  placeholder="Ingrese el plazo en meses"
                />
              </FormField>

              <FormField
                label="Fecha del primer pago"
                tooltip="Primera fecha de vencimiento. Desde esa fecha se construye el calendario mensual del plan de pagos."
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
                label="Cálculo de mora"
                tooltip="La mora solo se cobra cuando una cuota queda vencida. Mora simple aplica tasa diaria sobre lo vencido; compuesta acumula recargo sobre recargo; sin recargo no cobra mora."
                helper={resolvedLateFeePolicy ? `Configuración: ${resolvedLateFeePolicy.label} · ${formatPolicyRate(resolvedLateFeePolicy.annualEffectiveRate)}. Se guarda al registrar, pero solo cobra si hay atraso.` : 'Puedes validar sin política de mora si el crédito no requiere recargo por atraso.'}
              >
                <SelectInput
                  data-tour="new-credit-late-fee-mode"
                  value={input.lateFeeMode || 'SIMPLE'}
                  onChange={handleLateFeeModeChange}
                >
                  <option value="NONE">Sin recargo</option>
                  <option value="SIMPLE">Mora simple</option>
                  <option value="COMPOUND">Mora compuesta</option>
                  <option value="FLAT">Cargo fijo por mora</option>
                  <option value="TIERED">Mora por tramos</option>
                </SelectInput>
              </FormField>

              <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone="warning" size="sm">{lateFeeModeLabel}</StatusChip>
                  <StatusChip tone="neutral" size="sm">{formatPolicyRate(annualLateFeeRate)}</StatusChip>
                </div>
                <p className="mt-2 font-semibold text-text-primary dark:text-amber-50">
                  La mora no se suma al desembolso ni a la cuota normal al crear el crédito.
                </p>
                <dl className="mt-3 grid gap-3">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">Cuándo se cobra</dt>
                    <dd className="mt-1 text-text-secondary dark:text-amber-100/85">{lateFeeModeDescription.trigger}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">Cómo se calcula</dt>
                    <dd className="mt-1 text-text-secondary dark:text-amber-100/85">{lateFeeModeDescription.formula}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">Qué queda guardado</dt>
                    <dd className="mt-1 text-text-secondary dark:text-amber-100/85">
                      {lateFeePolicyLabel}. {lateFeeModeDescription.effect}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="min-w-0 space-y-4 rounded-[1.6rem] border border-border-subtle bg-bg-surface px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:px-6">
              <div>
                <h3 className="text-[1.05rem] font-bold text-text-primary">Resumen financiero</h3>
                <p className="mt-1 text-sm text-text-secondary">Resultado consolidado de la fórmula.</p>
              </div>

              {calculationError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {calculationError}
                </div>
              )}

              {result && !isResultStale ? (
                <>
                  <div className="mt-1 grid gap-3 sm:grid-cols-3">
                    {summaryCards.map((card) => (
                      <MetricCard
                        key={card.label}
                        label={card.label}
                        value={card.value}
                        accent={card.accent}
                        className="!rounded-[1.15rem] !border-border-subtle/80"
                      />
                    ))}
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-text-secondary" />
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">Cronograma de amortización</h4>
                          <p className="mt-1 text-xs text-text-secondary">Desglose mensual de pago, interés, capital y saldo restante.</p>
                        </div>
                      </div>
                      <StatusChip tone="neutral" size="sm">{calculationRuleLabel}</StatusChip>
                    </div>
                    <DataTableSurface className="mt-4 overflow-x-auto">
                        <table className="min-w-[920px] w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-bg-base text-left text-[11px] uppercase tracking-[0.14em] text-text-secondary">
                            <tr>
                              <th className="w-16 px-4 py-3 text-center font-medium">Cuota</th>
                              <th className="px-4 py-3 font-medium">Vencimiento</th>
                              <th className="px-4 py-3 text-right font-medium">Pago</th>
                              <th className="px-4 py-3 text-right font-medium">Interés</th>
                              <th className="px-4 py-3 text-right font-medium">Capital</th>
                              <th className="px-4 py-3 text-right font-medium">Saldo</th>
                              <th className="w-32 px-4 py-3 text-center font-medium">Estado</th>
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
                                  Las cuotas calculadas aparecerán aquí después de validar.
                                </td>
                              </tr>
                            )}
                          </tbody>
                          {scheduleTotals && (
                            <tfoot>
                              <tr>
                                <td className="px-4 py-3 text-center font-semibold text-text-primary">{scheduleTotals.installmentCount}</td>
                                <td className="px-4 py-3 font-semibold text-text-primary">Totales</td>
                                <td className="px-4 py-3 text-right font-semibold text-text-primary">{formatMoney(scheduleTotals.totalScheduledPayment)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-text-primary">{formatMoney(scheduleTotals.totalInterest)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-text-primary">{formatMoney(scheduleTotals.totalPrincipal)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-text-primary">{formatMoney(scheduleTotals.finalBalance)}</td>
                                <td className="px-4 py-3 text-center font-semibold text-text-primary">{scheduleTotals.pendingCount} pendientes</td>
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
                      <h4 className="mt-5 text-[1.7rem] font-bold text-text-primary">Valida el crédito</h4>
                      <p className="mt-3 max-w-xl text-sm leading-7 text-text-secondary">
                        El resumen financiero y el cronograma aparecerán después de validar.
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 rounded-[1rem] border border-border-subtle bg-bg-surface px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-text-secondary" />
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">Cronograma de amortización</h4>
                          <p className="mt-1 text-xs text-text-secondary">Desglose mensual de pago, interés, capital y saldo restante.</p>
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
