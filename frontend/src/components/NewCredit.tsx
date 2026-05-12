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
import { QuickGuideButton } from './shared/HelpSupport';
import { getCalculationValueLabel } from '../lib/creditCalculationLabels';
import { ActionButton, FormField, IconActionButton, SectionSurface, SelectInput, StatusChip } from './shared/Surfaces';

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
  const rateSourceLabel = resolvedRateSource === 'policy' ? 'Configuración' : 'Manual';
  const lateFeeSourceLabel = resolvedLateFeeSource === 'policy' ? 'Configuración' : 'Manual';
  const rateSummaryValue = `${Number(input.interestRate ?? resolvedRatePolicy?.annualEffectiveRate ?? 0)}% EA`;
  const rateSummaryDetail = resolvedRateSource === 'policy' && resolvedRatePolicy
    ? resolvedRatePolicy.label
    : 'Editada en este crédito';
  const lateFeeModeLabel = getCalculationValueLabel(
    input.lateFeeMode || resolvedLateFeePolicy?.lateFeeMode || 'SIMPLE',
    'lateFeeMode',
  );
  const lateFeeSummaryDetail = resolvedLateFeeSource === 'policy' && resolvedLateFeePolicy
    ? resolvedLateFeePolicy.label
    : 'Editada en este crédito';
  const lateFeeSummaryValue = `${lateFeeModeLabel} · ${annualLateFeeRate}% EA`;
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
    <SectionSurface
      className="sticky top-4 z-30 w-full p-2 backdrop-blur supports-[backdrop-filter]:bg-bg-surface/88"
      bodyClassName="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"
      data-tour="new-credit-action-dock"
    >
        <div className="min-w-0 px-2 py-1">
          <p className="text-sm font-semibold text-text-primary">Siguiente acción</p>
          <p className={`mt-0.5 text-xs font-medium ${isRegistrationReady ? 'text-emerald-700 dark:text-emerald-300' : 'text-text-secondary'}`}>
            {nextActionMessage}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[520px]">
          <ActionButton
            onClick={resetCalculation}
            disabled={isSimulating}
            aria-label="Restablecer parámetros"
            title="Limpia los parametros editados y vuelve a los valores base de la simulacion."
            fullWidth
          >
            Restablecer
          </ActionButton>
          <ActionButton
            data-tour="new-credit-validate"
            onClick={simulate}
            disabled={isSimulating}
            isLoading={isSimulating}
            aria-label="Validar crédito"
            title="Calcula la cuota, intereses y cronograma antes de crear el credito real."
            icon={isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
            fullWidth
          >
            Validar crédito
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
          >
            Registrar crédito
          </ActionButton>
        </div>
    </SectionSurface>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 pb-28"
      data-tour="new-credit-page"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <IconActionButton
            onClick={onBack}
            className="mt-1"
            label="Volver a créditos"
            icon={<ArrowLeft size={20} />}
          />
          <div className="min-w-0" data-tour="new-credit-header">
            <h2 className="text-3xl font-bold tracking-tight text-text-primary">Nuevo crédito</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
              Selecciona el titular, valida las condiciones y registra el crédito.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <QuickGuideButton guideKey="new-credit" />
          <ActionButton onClick={onBack}>
            Cancelar
          </ActionButton>
        </div>
      </div>

      <SectionSurface
        data-tour="new-credit-customer"
        title={(
          <span className="inline-flex items-center gap-2">
            <User size={18} className="text-brand-primary" />
            Preparación del crédito
          </span>
        )}
        subtitle="Selecciona el titular y revisa las reglas que se usarán al registrar. El socio es opcional y solo agrega trazabilidad."
        actions={(
          <div className="flex flex-wrap gap-2" aria-label="Estado de preparación del crédito">
            {readinessSummary.map((item) => {
              const StatusIcon = item.icon;

              return (
                <StatusChip
                  key={item.label}
                  tone={item.tone as 'neutral' | 'success' | 'info' | 'warning' | 'dark'}
                >
                  <StatusIcon size={14} aria-hidden="true" />
                  <span className="opacity-70">{item.label}</span>
                  <span>{item.status}</span>
                </StatusChip>
              );
            })}
          </div>
        )}
      >

        <div
          className="grid gap-4 xl:grid-cols-2"
          data-tour="new-credit-associate"
        >
          <FormField label="Cliente" error={borrowerErrors.customerId}>
            <SelectInput
              id="customerId"
              name="customerId"
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

          <FormField
            label="Socio asignado"
            tooltip="Es opcional. Úsalo para dejar trazabilidad del socio o inversionista relacionado. No cambia la tasa, la mora ni la cuota."
            helper="Solo si el crédito debe quedar asociado a un socio."
          >
            <SelectInput
              id="associateId"
              name="associateId"
              aria-label="Socio asignado"
              value={borrower.associateId}
              onChange={handleBorrowerChange}
              aria-describedby="associate-help"
            >
              <option value="">Sin socio asignado</option>
              {associates.map((associate: any) => (
                <option key={associate.id} value={associate.id}>
                  {getDisplayName(associate)}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </div>

        <div
          className="mt-4 rounded-xl border border-border-subtle bg-bg-base/60 p-3"
          data-tour="new-credit-policy-summary"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">Reglas que se aplicarán</h3>
            {routeState?.source === 'credit-calculator' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200">
                <CheckCircle2 size={13} />
                Precargado desde calculadora
              </span>
            )}
          </div>
          <dl className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="min-w-0 rounded-lg bg-bg-surface px-3 py-2 ring-1 ring-border-subtle">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Tasa</dt>
              <dd className="mt-1 text-sm font-semibold text-text-primary">{rateSummaryValue}</dd>
              <p className="mt-0.5 truncate text-xs text-text-secondary" title={`${rateSourceLabel}: ${rateSummaryDetail}`}>
                {rateSourceLabel}: {rateSummaryDetail}
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-bg-surface px-3 py-2 ring-1 ring-border-subtle">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Mora</dt>
              <dd className="mt-1 text-sm font-semibold text-text-primary">{lateFeeSummaryValue}</dd>
              <p className="mt-0.5 truncate text-xs text-text-secondary" title={`${lateFeeSourceLabel}: ${lateFeeSummaryDetail}`}>
                {lateFeeSourceLabel}: {lateFeeSummaryDetail}
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-bg-surface px-3 py-2 ring-1 ring-border-subtle">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Validación</dt>
              <dd className="mt-1 text-sm font-semibold text-text-primary">
                {hasValidatedResult ? calculationRuleLabel : 'Pendiente'}
              </dd>
              <p className="mt-0.5 truncate text-xs text-text-secondary" title="La validación congela la regla usada al registrar.">
                Congela la regla usada al registrar.
              </p>
            </div>
          </dl>
          {routeState?.source === 'credit-calculator' && (
            <p className="sr-only">Escenario precargado</p>
          )}
        </div>
      </SectionSurface>

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
