import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, CheckCircle2, Loader2, Save, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLoans } from '../services/loanService';
import { useCustomers } from '../services/customerService';
import { useAssociates } from '../services/associateService';
import { toast } from '../lib/toast';
import { extractValidationErrors } from '../services/apiErrors';
import { useConfig } from '../services/configService';
import CreditSimulationWorkspace from './shared/CreditSimulationWorkspace';
import {
  DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
  useActiveCreditSimulation,
} from './hooks/useActiveCreditSimulation';
import type { CreditCalculationInput } from '../types/creditCalculation';
import { HelpTooltip, QuickGuideButton } from './shared/HelpSupport';

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

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
  const { createLoan } = useLoans();
  const { data: customersData } = useCustomers({ pageSize: 100 });
  const { data: associatesData } = useAssociates({ pageSize: 100 });
  const { ratePolicies, lateFeePolicies } = useConfig();

  const customers = Array.isArray(customersData?.data?.customers)
    ? customersData.data.customers
    : Array.isArray(customersData?.data)
      ? customersData.data
      : [];
  const associates = Array.isArray(associatesData?.data?.associates)
    ? associatesData.data.associates
    : Array.isArray(associatesData?.data)
      ? associatesData.data
      : [];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [borrowerErrors, setBorrowerErrors] = useState<Record<string, string>>({});
  const [borrower, setBorrower] = useState({
    customerId: '',
    associateId: '',
  });
  const [rateWasEdited, setRateWasEdited] = useState(Boolean(routeState?.calculationInput?.interestRate));
  const [lateFeeWasEdited, setLateFeeWasEdited] = useState(Boolean(routeState?.calculationInput?.lateFeeMode));
  const initialCalculationInput = useMemo<CreditCalculationInput>(() => ({
    ...DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
    ...routeState?.calculationInput,
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

  const resolvedRatePolicy = useMemo<any>(() => {
    const amount = Number(input.amount || 0);
    return ratePolicies
      .filter((policy: any) => policy.isActive)
      .filter((policy: any) => {
        if (!amount) return true;
        if (policy.minAmount != null && amount < Number(policy.minAmount)) return false;
        if (policy.maxAmount != null && amount > Number(policy.maxAmount)) return false;
        return true;
      })
      .sort((left: any, right: any) => Number(left.priority || 100) - Number(right.priority || 100))[0] || null;
  }, [input.amount, ratePolicies]);

  const resolvedLateFeePolicy = useMemo<any>(() => (
    lateFeePolicies
      .filter((policy: any) => policy.isActive)
      .sort((left: any, right: any) => Number(left.priority || 100) - Number(right.priority || 100))[0] || null
  ), [lateFeePolicies]);

  useEffect(() => {
    const nextInput: Partial<CreditCalculationInput> = {};

    if (!rateWasEdited && resolvedRatePolicy?.annualEffectiveRate != null) {
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
  }, [lateFeeWasEdited, rateWasEdited, resolvedLateFeePolicy, resolvedRatePolicy, setInput]);

  const resolvedRateSource = rateWasEdited || !resolvedRatePolicy ? 'manual' : 'policy';
  const resolvedLateFeeSource = lateFeeWasEdited || !resolvedLateFeePolicy ? 'manual' : 'policy';
  const annualLateFeeRate = Number(
    input.annualLateFeeRate
    ?? resolvedLateFeePolicy?.annualEffectiveRate
    ?? 0,
  );
  const hasValidatedResult = Boolean(result) && !isResultStale;
  const canRegister = Boolean(borrower.customerId) && hasValidatedResult && !isSubmitting && !isSimulating;
  const isBorrowerReady = Boolean(borrower.customerId);
  const isRegistrationReady = isBorrowerReady && hasValidatedResult;
  const calculationRuleLabel = result?.calculationProfileVersionId != null
    ? `Regla v${result.calculationProfileVersionId}`
    : 'Regla activa';
  const nextActionMessage = !isBorrowerReady
    ? 'Selecciona el cliente que recibirá el crédito.'
    : !result
      ? 'Valida el cálculo antes de registrar.'
      : isResultStale
        ? 'Hay cambios sin validar. Ejecuta la validación otra vez.'
        : 'Listo para registrar el crédito real.';
  const readinessSummary = [
    {
      label: 'Cliente',
      status: isBorrowerReady ? 'Listo' : 'Pendiente',
      icon: User,
      toneClassName: isBorrowerReady
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200'
        : 'border-border-subtle bg-bg-surface text-text-secondary',
    },
    {
      label: 'Validación',
      status: hasValidatedResult ? 'Vigente' : result && isResultStale ? 'Revalidar' : 'Pendiente',
      icon: Calculator,
      toneClassName: hasValidatedResult
        ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200'
        : result && isResultStale
          ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200'
          : 'border-border-subtle bg-bg-surface text-text-secondary',
    },
    {
      label: 'Registro',
      status: isRegistrationReady ? 'Disponible' : 'Bloqueado',
      icon: Save,
      toneClassName: isRegistrationReady
        ? 'border-slate-300 bg-slate-900 text-white dark:border-slate-600 dark:bg-slate-100 dark:text-slate-900'
        : 'border-border-subtle bg-bg-surface text-text-secondary',
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
      setRateWasEdited(true);
      partialInput.rateSource = 'manual';
    }
    if (Object.prototype.hasOwnProperty.call(partialInput, 'lateFeeMode')) {
      setLateFeeWasEdited(true);
      partialInput.lateFeeSource = 'manual';
    }
    setInput(partialInput);
  };

  const resetCalculation = () => {
    setRateWasEdited(false);
    setLateFeeWasEdited(false);
    setInput({
      ...DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
      startDate: nextMonthAsIsoDate(),
    });
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

    setIsSubmitting(true);
    try {
      const response = await createLoan.mutateAsync({
        customerId: Number(borrower.customerId),
        associateId: borrower.associateId ? Number(borrower.associateId) : undefined,
        amount: Number(input.amount),
        interestRate: Number(input.interestRate),
        termMonths: Number(input.termMonths),
        startDate: input.startDate,
        lateFeeMode: input.lateFeeMode || 'SIMPLE',
        annualLateFeeRate,
        rateSource: resolvedRateSource,
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
      className="sticky top-4 z-30 w-full rounded-2xl border border-border-subtle bg-bg-surface/95 p-2 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)] backdrop-blur supports-[backdrop-filter]:bg-bg-surface/88"
      data-tour="new-credit-action-dock"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 px-2 py-1">
          <p className="text-sm font-semibold text-text-primary">Siguiente acción</p>
          <p className={`mt-0.5 text-xs font-medium ${isRegistrationReady ? 'text-emerald-700 dark:text-emerald-300' : 'text-text-secondary'}`}>
            {nextActionMessage}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[520px]">
          <button
            type="button"
            onClick={resetCalculation}
            disabled={isSimulating}
            aria-label="Restablecer parámetros"
            title="Limpia los parametros editados y vuelve a los valores base de la simulacion."
            className="inline-flex items-center justify-center rounded-xl border border-border-subtle bg-bg-surface px-3 py-2.5 text-sm font-semibold text-text-primary shadow-sm transition hover:border-slate-300 hover:bg-hover-bg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:border-slate-600"
          >
            Restablecer
          </button>
          <button
            type="button"
            data-tour="new-credit-validate"
            onClick={simulate}
            disabled={isSimulating}
            aria-label="Validar crédito"
            title="Calcula la cuota, intereses y cronograma antes de crear el credito real."
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
          >
            {isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
            <span>Validar crédito</span>
          </button>
          <button
            type="submit"
            disabled={!canRegister}
            data-tour="new-credit-submit"
            aria-label="Registrar crédito"
            title={canRegister ? 'Crea el crédito real con la regla validada.' : 'Primero valida el crédito y corrige cualquier campo pendiente.'}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:hover:bg-slate-300 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>Registrar crédito</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 pb-28"
      data-tour="new-credit-page"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-bg-surface text-text-secondary transition hover:bg-hover-bg hover:text-text-primary"
            aria-label="Volver a créditos"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0" data-tour="new-credit-header">
            <h2 className="text-3xl font-bold tracking-tight text-text-primary">Nuevo crédito</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
              Selecciona el titular, valida las condiciones y registra el crédito.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <QuickGuideButton guideKey="new-credit" />
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-xl border border-border-subtle bg-bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-hover-bg active:scale-[0.98]"
          >
            Cancelar
          </button>
        </div>
      </div>

      <section
        className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]"
        data-tour="new-credit-customer"
      >
        <div className="flex flex-col gap-4 border-b border-border-subtle px-5 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-text-primary">
              <User size={18} className="text-brand-primary" />
              Preparación del crédito
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
              El socio es opcional; no modifica tasa, mora ni cronograma.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Estado de preparación del crédito">
            {readinessSummary.map((item) => {
              const StatusIcon = item.icon;

              return (
                <span
                  key={item.label}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${item.toneClassName}`}
                >
                  <StatusIcon size={14} />
                  <span className="opacity-70">{item.label}</span>
                  <span>{item.status}</span>
                </span>
              );
            })}
          </div>
        </div>

        <div
          className="grid gap-4 px-5 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,0.62fr)] xl:items-start"
          data-tour="new-credit-associate"
        >
          <div>
            <label htmlFor="customerId" className="block text-sm font-medium text-text-primary">
              Cliente
            </label>
            <select
              id="customerId"
              name="customerId"
              data-tour="new-credit-customer-select"
              value={borrower.customerId}
              onChange={handleBorrowerChange}
              className={`mt-2 w-full rounded-xl border bg-bg-base px-4 py-2.5 text-sm text-text-primary shadow-sm outline-none transition focus:ring-2 ${borrowerErrors.customerId ? 'border-red-400 focus:ring-red-500' : 'border-border-subtle focus:ring-brand-primary'}`}
              aria-invalid={!!borrowerErrors.customerId}
            >
              <option value="">Seleccionar cliente...</option>
              {customers.map((customer: any) => (
                <option key={customer.id} value={customer.id}>
                  {getDisplayName(customer)} · CUS-{String(customer.id).padStart(4, '0')}
                </option>
              ))}
            </select>
            {borrowerErrors.customerId && (
              <p className="mt-1.5 text-xs text-red-600" role="alert">{borrowerErrors.customerId}</p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="associateId" className="block text-sm font-medium text-text-primary">
                Socio asignado
              </label>
              <HelpTooltip
                align="right"
                text="Es opcional. Úsalo para dejar trazabilidad del socio o inversionista relacionado. No cambia la tasa, la mora ni la cuota."
              />
            </div>
            <select
              id="associateId"
              name="associateId"
              value={borrower.associateId}
              onChange={handleBorrowerChange}
              aria-describedby="associate-help"
              className="mt-2 w-full rounded-xl border border-border-subtle bg-bg-base px-4 py-2.5 text-sm text-text-primary shadow-sm outline-none transition focus:ring-2 focus:ring-brand-primary"
            >
              <option value="">Sin socio asignado</option>
              {associates.map((associate: any) => (
                <option key={associate.id} value={associate.id}>
                  {getDisplayName(associate)}
                </option>
              ))}
            </select>
            <p id="associate-help" className="mt-1.5 text-xs leading-5 text-text-secondary">
              Solo si el crédito debe quedar asociado a un socio.
            </p>
          </div>

          <aside
            className="min-w-0 rounded-xl border border-border-subtle bg-bg-base/60 px-4 py-3"
            data-tour="new-credit-policy-summary"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text-primary">Resumen</h3>
              {routeState?.source === 'credit-calculator' && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                  <CheckCircle2 size={13} />
                  Precargado
                </span>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-[0.55fr_1.2fr_1fr] gap-3 text-sm">
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Tasa</dt>
                <dd className="mt-0.5 truncate font-semibold text-text-primary">
                  {resolvedRatePolicy ? `${resolvedRatePolicy.annualEffectiveRate}%` : `${input.interestRate}%`}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Mora</dt>
                <dd className="mt-0.5 truncate font-semibold text-text-primary">
                  {resolvedLateFeePolicy ? resolvedLateFeePolicy.label : 'Sin política'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Cálculo</dt>
                <dd className="mt-0.5 truncate font-semibold text-text-primary">
                  {hasValidatedResult ? calculationRuleLabel : 'Pendiente'}
                </dd>
              </div>
            </dl>
            {routeState?.source === 'credit-calculator' && (
              <p className="sr-only">Escenario precargado</p>
            )}
          </aside>
        </div>
      </section>

      {actionDock}

      <section data-tour="new-credit-simulation">
        <CreditSimulationWorkspace
          title="Condiciones y cronograma"
          description="Ajusta los datos financieros y revisa el resultado antes de registrar."
          modeLabel="Creación real"
          actionLabel="Validar crédito"
          input={input}
          result={result}
          isSimulating={isSimulating}
          error={calculationError}
          fieldErrors={calculationFieldErrors}
          isResultStale={isResultStale}
          onSimulate={simulate}
          onInputChange={handleCalculationInputChange}
          onReset={resetCalculation}
          showScenarioTools={false}
          hideHeaderActions
          compactChrome
          helperText="La validación no crea el crédito. Revisa la cuota, el total a pagar y el cronograma antes de registrar."
          resultBadge={result?.calculationProfileVersionId != null ? `Regla v${result.calculationProfileVersionId}` : null}
          validationStatus={result ? {
            valid: !isResultStale,
            message: isResultStale
              ? 'Cambiaste parámetros después de validar. Ejecuta la validación otra vez antes de registrar.'
              : 'Listo para registrar: el crédito conservará esta regla de cálculo.',
          } : null}
          emptyTitle="Valida antes de registrar"
          emptyDescription="Completa los datos del crédito y ejecuta la validación para revisar cuota, intereses y cronograma."
          emptyScheduleDescription="Las cuotas calculadas aparecerán aquí después de validar."
        />
      </section>

    </form>
  );
}
