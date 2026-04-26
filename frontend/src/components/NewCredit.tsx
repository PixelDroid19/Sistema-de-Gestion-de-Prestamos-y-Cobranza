import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Save, User } from 'lucide-react';
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
import type { SimulationInput } from '../types/dag';

const todayAsIsoDate = () => new Date().toISOString().slice(0, 10);

type NewCreditLocationState = {
  simulationInput?: Partial<SimulationInput>;
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
  const [rateWasEdited, setRateWasEdited] = useState(Boolean(routeState?.simulationInput?.interestRate));
  const [lateFeeWasEdited, setLateFeeWasEdited] = useState(Boolean(routeState?.simulationInput?.lateFeeMode));
  const initialSimulationInput = useMemo<SimulationInput>(() => ({
    ...DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
    ...routeState?.simulationInput,
    startDate: routeState?.simulationInput?.startDate || todayAsIsoDate(),
  }), [routeState?.simulationInput]);

  const {
    input,
    result,
    error: simulationError,
    fieldErrors: simulationFieldErrors,
    isSimulating,
    isResultStale,
    setInput,
    simulate,
  } = useActiveCreditSimulation({
    initialInput: initialSimulationInput,
    autoRun: Boolean(routeState?.simulationInput),
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
    const nextInput: Partial<SimulationInput> = {};

    if (!rateWasEdited && resolvedRatePolicy?.annualEffectiveRate != null) {
      nextInput.interestRate = Number(resolvedRatePolicy.annualEffectiveRate);
      nextInput.rateSource = 'policy';
    }

    if (!lateFeeWasEdited && resolvedLateFeePolicy?.lateFeeMode) {
      nextInput.lateFeeMode = String(resolvedLateFeePolicy.lateFeeMode) as SimulationInput['lateFeeMode'];
      nextInput.annualLateFeeRate = Number(resolvedLateFeePolicy.annualEffectiveRate || 0);
      nextInput.lateFeeSource = 'policy';
    }

    if (Object.keys(nextInput).length > 0) {
      setInput(nextInput);
    }
  }, [lateFeeWasEdited, rateWasEdited, resolvedLateFeePolicy, resolvedRatePolicy, setInput]);

  const selectedCustomer = customers.find((customer: any) => String(customer.id) === borrower.customerId);
  const selectedAssociate = associates.find((associate: any) => String(associate.id) === borrower.associateId);
  const annualLateFeeRate = Number(resolvedLateFeePolicy?.annualEffectiveRate || 0);
  const hasValidatedResult = Boolean(result) && !isResultStale;
  const canRegister = Boolean(borrower.customerId) && hasValidatedResult && !isSubmitting && !isSimulating;

  const handleBorrowerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = event.target;
    setBorrower((current) => ({ ...current, [name]: value }));
    setBorrowerErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleSimulationInputChange = (partialInput: Partial<SimulationInput>) => {
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

  const resetSimulation = () => {
    setRateWasEdited(false);
    setLateFeeWasEdited(false);
    setInput({
      ...DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
      startDate: todayAsIsoDate(),
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
        description: 'Ejecuta la validación con la fórmula activa antes de registrar el crédito real.',
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
        rateSource: rateWasEdited ? 'manual' : 'policy',
        lateFeeSource: lateFeeWasEdited ? 'manual' : 'policy',
      });
      const createdLoanId = Number(response?.data?.loan?.id);
      const versionLabel = result?.graphVersionId != null ? ` fórmula v${result.graphVersionId}` : ' fórmula activa';
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

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
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
          <div className="min-w-0">
            <h2 className="text-3xl font-bold tracking-tight text-text-primary">Nuevo crédito</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
              Selecciona el cliente, valida la fórmula activa y registra el crédito real con el mismo cálculo que se usará en producción.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-xl border border-border-strong bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary shadow-sm transition hover:bg-hover-bg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canRegister}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:hover:bg-slate-300"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Registrar crédito
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <User size={18} className="text-brand-primary" />
              Cliente y responsable
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
              Esta selección define a quién se le crea el crédito. La simulación no registra nada hasta usar “Registrar crédito”.
            </p>
            {routeState?.source === 'credit-calculator' && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
                <CheckCircle2 size={14} />
                Escenario precargado desde Previsualizar crédito
              </div>
            )}
          </div>

          <div className="grid flex-1 gap-4 md:grid-cols-2 xl:max-w-4xl">
            <div>
              <label htmlFor="customerId" className="block text-sm font-medium text-text-primary">
                Cliente
              </label>
              <select
                id="customerId"
                name="customerId"
                value={borrower.customerId}
                onChange={handleBorrowerChange}
                className={`mt-2 w-full rounded-xl border bg-bg-base px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:ring-2 ${borrowerErrors.customerId ? 'border-red-400 focus:ring-red-500' : 'border-border-subtle focus:ring-brand-primary'}`}
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
              <label htmlFor="associateId" className="block text-sm font-medium text-text-primary">
                Socio asignado
              </label>
              <select
                id="associateId"
                name="associateId"
                value={borrower.associateId}
                onChange={handleBorrowerChange}
                className="mt-2 w-full rounded-xl border border-border-subtle bg-bg-base px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:ring-2 focus:ring-brand-primary"
              >
                <option value="">Sin socio asignado</option>
                {associates.map((associate: any) => (
                  <option key={associate.id} value={associate.id}>
                    {getDisplayName(associate)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <dl className="mt-5 grid gap-x-8 gap-y-3 border-t border-border-subtle pt-4 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Cliente seleccionado</dt>
            <dd className="mt-1 truncate font-semibold text-text-primary">
              {selectedCustomer ? getDisplayName(selectedCustomer) : 'Pendiente'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Tasa sugerida</dt>
            <dd className="mt-1 truncate font-semibold text-text-primary">
              {resolvedRatePolicy ? `${resolvedRatePolicy.annualEffectiveRate}% · ${resolvedRatePolicy.label}` : `${input.interestRate}%`}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Mora sugerida</dt>
            <dd className="mt-1 truncate font-semibold text-text-primary">
              {resolvedLateFeePolicy ? `${resolvedLateFeePolicy.label}${annualLateFeeRate ? ` · ${annualLateFeeRate}% EA` : ''}` : 'Sin política activa'}
            </dd>
          </div>
        </dl>

        {selectedAssociate && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={14} />
            Socio asignado: {getDisplayName(selectedAssociate)}
          </div>
        )}
      </section>

      <CreditSimulationWorkspace
        title="Simulación y cronograma"
        description="Ajusta capital, tasa, plazo y fecha. La validación usa la fórmula activa; al registrar, el crédito queda guardado con esa versión exacta."
        modeLabel="Creación real"
        actionLabel="Validar crédito"
        input={input}
        result={result}
        isSimulating={isSimulating}
        error={simulationError}
        fieldErrors={simulationFieldErrors}
        isResultStale={isResultStale}
        onInputChange={handleSimulationInputChange}
        onSimulate={simulate}
        onReset={resetSimulation}
        showScenarioTools={false}
        helperText="La validación no crea el crédito. Revisa la cuota, el total a pagar y el cronograma antes de registrar."
        resultBadge={result?.graphVersionId != null ? `Fórmula v${result.graphVersionId}` : null}
        validationStatus={result ? {
          valid: !isResultStale,
          message: isResultStale
            ? 'Cambiaste parámetros después de validar. Ejecuta la validación otra vez antes de registrar.'
            : 'Listo para registrar: el crédito se creará con la fórmula activa y conservará esta versión.',
        } : null}
        emptyTitle="Valida antes de registrar"
        emptyDescription="Completa los datos del crédito y ejecuta la validación para revisar cuota, intereses y cronograma."
      />
    </form>
  );
}
