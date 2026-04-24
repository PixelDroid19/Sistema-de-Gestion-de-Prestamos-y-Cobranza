import React, { useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calculator,
  Check,
  Clock3,
  DollarSign,
  GitCompareArrows,
  Loader2,
  Percent,
  Save,
  Sparkles,
  Table2,
  Trash2,
} from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import type { SimulationInput, SimulationResult } from '../../types/dag';

type SavedScenario = {
  id: string;
  name: string;
  input: SimulationInput;
  result: SimulationResult;
  createdAt: Date;
};

type CreditSimulationWorkspaceProps = {
  title: string;
  description: string;
  modeLabel: string;
  input: SimulationInput;
  result: SimulationResult | null;
  isSimulating: boolean;
  error: string | null;
  fieldErrors?: Record<string, string>;
  isResultStale?: boolean;
  onInputChange: (input: Partial<SimulationInput>) => void;
  onSimulate: () => void;
  onReset?: () => void;
  disabled?: boolean;
  showScenarioTools?: boolean;
  helperText?: string;
  resultBadge?: string | null;
  validationStatus?: {
    valid: boolean;
    message: string;
  } | null;
  actionLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

const lateFeeModeOptions: Array<{ value: NonNullable<SimulationInput['lateFeeMode']>; label: string }> = [
  { value: 'NONE', label: 'Sin mora' },
  { value: 'SIMPLE', label: 'Interés simple' },
  { value: 'COMPOUND', label: 'Interés compuesto' },
  { value: 'FLAT', label: 'Cargo fijo' },
  { value: 'TIERED', label: 'Escalonado' },
];

const formatLateFeeModeLabel = (value?: SimulationInput['lateFeeMode']) => {
  const selectedOption = lateFeeModeOptions.find((option) => option.value === (value || 'SIMPLE'));
  return selectedOption?.label || 'Interés simple';
};

const formatCurrency = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(value);

const formatDate = (value: string) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
};

const formatScheduleStatus = (status?: string) => {
  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus === 'pending') return 'Pendiente';
  if (normalizedStatus === 'paid' || normalizedStatus === 'settled') return 'Pagada';
  if (normalizedStatus === 'overdue' || normalizedStatus === 'defaulted') return 'En mora';
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'annulled') return 'Anulada';
  return status || '-';
};

const getDefaultScenarioName = (savedScenariosCount: number) => `Escenario ${savedScenariosCount + 1}`;

export default function CreditSimulationWorkspace({
  title,
  description,
  modeLabel,
  input,
  result,
  isSimulating,
  error,
  fieldErrors = {},
  isResultStale = false,
  onInputChange,
  onSimulate,
  onReset,
  disabled = false,
  showScenarioTools = false,
  helperText,
  resultBadge,
  validationStatus,
  actionLabel = tTerm('dag.actions.simulate'),
  emptyTitle = 'Sin resultados todavía',
  emptyDescription = 'Ajusta los parámetros y ejecuta el cálculo para revisar la cuota, el costo financiero y el cronograma.',
}: CreditSimulationWorkspaceProps) {
  const instanceId = useId();
  const titleId = `${instanceId}-credit-simulation-title`;
  const amountInputId = `${instanceId}-credit-simulation-amount`;
  const rateInputId = `${instanceId}-credit-simulation-rate`;
  const termInputId = `${instanceId}-credit-simulation-term`;
  const startDateInputId = `${instanceId}-credit-simulation-start-date`;
  const lateFeeInputId = `${instanceId}-credit-simulation-late-fee`;
  const amountHelpId = useId();
  const rateHelpId = useId();
  const termHelpId = useId();
  const lateFeeHelpId = useId();
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [scenarioName, setScenarioName] = useState('');
  const [isComparisonVisible, setIsComparisonVisible] = useState(false);

  const summaryCards = useMemo(() => {
    if (!result) {
      return [];
    }

    const totalInstallments = Math.max(result.schedule.length, input.termMonths || 0, 1);
    const averageInterestPerInstallment = result.summary.totalInterest / totalInstallments;

    return [
      {
        id: 'installment',
        label: 'Cuota estimada',
        value: formatCurrency(result.summary.installmentAmount),
        tone: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300',
      },
      {
        id: 'payable',
        label: 'Total a pagar',
        value: formatCurrency(result.summary.totalPayable),
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
      },
      {
        id: 'interest',
        label: 'Interés total',
        value: formatCurrency(result.summary.totalInterest),
        tone: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
      },
      {
        id: 'averageInterest',
        label: 'Interés promedio por cuota',
        value: formatCurrency(averageInterestPerInstallment),
        tone: 'border-border-subtle bg-bg-base text-text-primary',
      },
    ];
  }, [input.termMonths, result]);

  const handleSaveScenario = () => {
    if (!showScenarioTools || !result) {
      return;
    }

    const nextScenario: SavedScenario = {
      id: `${Date.now()}`,
      name: scenarioName.trim() || getDefaultScenarioName(savedScenarios.length),
      input: { ...input },
      result,
      createdAt: new Date(),
    };

    setSavedScenarios((currentScenarios) => [...currentScenarios.slice(-2), nextScenario]);
    setScenarioName('');
    setIsComparisonVisible(true);
  };

  const handleDeleteScenario = (scenarioId: string) => {
    setSavedScenarios((currentScenarios) => {
      const nextScenarios = currentScenarios.filter((scenario) => scenario.id !== scenarioId);
      if (nextScenarios.length === 0) {
        setIsComparisonVisible(false);
      }
      return nextScenarios;
    });
  };

  const handleFieldChange = (field: keyof SimulationInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const nextValue = event.target.value;

    if (field === 'lateFeeMode' || field === 'startDate') {
      onInputChange({ [field]: nextValue || undefined });
      return;
    }

    onInputChange({ [field]: Number(nextValue) || 0 });
  };

  return (
    <section className="flex flex-col gap-6" aria-labelledby={titleId}>
      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        <div className="border-b border-border-subtle px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-text-secondary">
                <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-bg-base px-3 py-1 text-[11px] tracking-[0.2em]">
                  <Sparkles size={12} />
                  {modeLabel}
                </span>
                {resultBadge && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-[11px] tracking-[0.12em] text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-200">
                    <Check size={12} />
                    {resultBadge}
                  </span>
                )}
              </div>
              <div>
                <h3 id={titleId} className="text-2xl font-semibold text-text-primary sm:text-3xl">
                  {title}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
                  {description}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 lg:min-w-[260px]">
              <button
                type="button"
                onClick={onSimulate}
                disabled={disabled || isSimulating}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-text-primary px-4 py-3 text-sm font-semibold text-bg-base shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                {actionLabel}
              </button>
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  disabled={disabled || isSimulating}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-base px-4 py-3 text-sm font-medium text-text-primary transition hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Restablecer parámetros
                </button>
              )}
            </div>
          </div>

          <dl className="mt-6 grid gap-x-8 gap-y-4 border-t border-border-subtle pt-5 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                <DollarSign size={14} />
                Monto base
              </dt>
              <dd className="mt-2 text-lg font-semibold text-text-primary">{formatCurrency(input.amount)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                <Percent size={14} />
                Tasa anual
              </dt>
              <dd className="mt-2 text-lg font-semibold text-text-primary">{input.interestRate}%</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                <Clock3 size={14} />
                Plazo
              </dt>
              <dd className="mt-2 text-lg font-semibold text-text-primary">{input.termMonths} meses</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                <AlertCircle size={14} />
                Mora
              </dt>
              <dd className="mt-2 text-lg font-semibold text-text-primary">{formatLateFeeModeLabel(input.lateFeeMode)}</dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
          <div className="space-y-5">
            <section className="space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Calculator size={16} />
                Parámetros
              </div>
              <p className="text-sm leading-6 text-text-secondary">
                Configura capital, tasa, plazo y política de mora. Los resultados solo se actualizan al ejecutar.
              </p>

              <div className="grid gap-4">
                <div>
                  <label htmlFor={amountInputId} className="block text-sm font-medium text-text-primary">
                    Monto del crédito
                  </label>
                  <p id={amountHelpId} className="mt-1 text-xs leading-5 text-text-secondary">
                    Capital a desembolsar antes de intereses y recargos.
                  </p>
                  <div className="relative mt-2">
                    <DollarSign size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <input
                      id={amountInputId}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={input.amount}
                      onChange={handleFieldChange('amount')}
                      aria-describedby={fieldErrors.amount ? `${amountHelpId} ${amountInputId}-error` : amountHelpId}
                      aria-invalid={!!fieldErrors.amount}
                      disabled={disabled}
                        className={`w-full rounded-xl border bg-bg-base px-10 py-3 text-sm text-text-primary shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${fieldErrors.amount ? 'border-red-400 focus:ring-red-500' : 'border-border-subtle focus:ring-blue-500'}`}
                    />
                  </div>
                  {fieldErrors.amount && (
                    <p id={`${amountInputId}-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
                      {fieldErrors.amount}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={rateInputId} className="block text-sm font-medium text-text-primary">
                      Tasa nominal anual
                    </label>
                    <p id={rateHelpId} className="mt-1 text-xs leading-5 text-text-secondary">
                      Porcentaje anual usado para construir la cuota mensual equivalente.
                    </p>
                    <div className="relative mt-2">
                      <input
                        id={rateInputId}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={input.interestRate}
                        onChange={handleFieldChange('interestRate')}
                        aria-describedby={fieldErrors.interestRate ? `${rateHelpId} ${rateInputId}-error` : rateHelpId}
                        aria-invalid={!!fieldErrors.interestRate}
                        disabled={disabled}
                        className={`w-full rounded-xl border bg-bg-base px-4 py-3 pr-10 text-sm text-text-primary shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${fieldErrors.interestRate ? 'border-red-400 focus:ring-red-500' : 'border-border-subtle focus:ring-blue-500'}`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary">%</span>
                    </div>
                    {fieldErrors.interestRate && (
                      <p id={`${rateInputId}-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
                        {fieldErrors.interestRate}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={termInputId} className="block text-sm font-medium text-text-primary">
                      Plazo en meses
                    </label>
                    <p id={termHelpId} className="mt-1 text-xs leading-5 text-text-secondary">
                      Número total de cuotas mensuales del cronograma.
                    </p>
                    <input
                      id={termInputId}
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={input.termMonths}
                      onChange={handleFieldChange('termMonths')}
                      aria-describedby={fieldErrors.termMonths ? `${termHelpId} ${termInputId}-error` : termHelpId}
                      aria-invalid={!!fieldErrors.termMonths}
                      disabled={disabled}
                       className={`mt-2 w-full rounded-xl border bg-bg-base px-4 py-3 text-sm text-text-primary shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${fieldErrors.termMonths ? 'border-red-400 focus:ring-red-500' : 'border-border-subtle focus:ring-blue-500'}`}
                    />
                    {fieldErrors.termMonths && (
                      <p id={`${termInputId}-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
                        {fieldErrors.termMonths}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={startDateInputId} className="block text-sm font-medium text-text-primary">
                      Fecha de inicio
                    </label>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">
                      Opcional. Si no se define, el backend usa la fecha actual del servidor.
                    </p>
                    <input
                      id={startDateInputId}
                      type="date"
                      value={input.startDate || ''}
                      onChange={handleFieldChange('startDate')}
                      disabled={disabled}
                       className="mt-2 w-full rounded-xl border border-border-subtle bg-bg-base px-4 py-3 text-sm text-text-primary shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label htmlFor={lateFeeInputId} className="block text-sm font-medium text-text-primary">
                      Modo de mora
                    </label>
                    <p id={lateFeeHelpId} className="mt-1 text-xs leading-5 text-text-secondary">
                      Política que se inyecta a la fórmula para estimar mora futura.
                    </p>
                    <select
                      id={lateFeeInputId}
                      value={input.lateFeeMode || 'SIMPLE'}
                      onChange={handleFieldChange('lateFeeMode')}
                      aria-describedby={lateFeeHelpId}
                      disabled={disabled}
                       className="mt-2 w-full rounded-xl border border-border-subtle bg-bg-base px-4 py-3 text-sm text-text-primary shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                       {lateFeeModeOptions.map((option) => (
                         <option key={option.value} value={option.value}>
                           {option.label}
                         </option>
                       ))}
                    </select>
                  </div>
                </div>
              </div>

              {helperText && !validationStatus?.valid && (
                <div className="border-l-4 border-blue-300 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-200">
                  {helperText}
                </div>
              )}

              {validationStatus && (
                <div
                  className={`border-l-4 px-4 py-3 text-sm leading-6 ${validationStatus.valid
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200'
                    : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200'
                  }`}
                  role="status"
                >
                  {validationStatus.message}
                </div>
              )}

              {showScenarioTools && (
                <div className="mt-5 border-t border-border-subtle pt-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <GitCompareArrows size={16} />
                    Escenarios guardados
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    Guarda hasta tres resultados para comparar cuotas, interés total y sensibilidad de la fórmula activa.
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={scenarioName}
                      onChange={(event) => setScenarioName(event.target.value)}
                      placeholder="Nombre del escenario"
                      disabled={disabled}
                       className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-bg-base px-4 py-3 text-sm text-text-primary shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={handleSaveScenario}
                      disabled={disabled || !result}
                       className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-base px-4 py-3 text-sm font-medium text-text-primary transition hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save size={16} />
                      Guardar escenario
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-text-secondary">
                      {savedScenarios.length} escenario{savedScenarios.length === 1 ? '' : 's'} guardado{savedScenarios.length === 1 ? '' : 's'}.
                    </p>
                    {savedScenarios.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsComparisonVisible((currentValue) => !currentValue)}
                        className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-base px-3 py-1.5 text-xs font-medium text-text-primary transition hover:bg-hover-bg"
                        aria-expanded={isComparisonVisible}
                      >
                        <GitCompareArrows size={14} />
                        {isComparisonVisible ? 'Ocultar comparación' : 'Comparar escenarios'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {showScenarioTools && isComparisonVisible && savedScenarios.length > 0 && (
              <section className="rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-sm" aria-label="Comparación de escenarios guardados">
                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <GitCompareArrows size={16} />
                  Comparación de escenarios
                </div>
                <div className="mt-4 space-y-3">
                  {result && (
                    <article className="rounded-xl border border-blue-200 bg-blue-100 p-4 dark:border-blue-500/30 dark:bg-blue-500/20">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-text-primary">Cálculo actual</h4>
                          <p className="mt-1 text-xs leading-5 text-text-secondary">
                            {formatCurrency(input.amount)} · {input.interestRate}% · {input.termMonths} meses
                          </p>
                        </div>
                        <span className="rounded-full border border-blue-200 bg-bg-surface px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-blue-900 dark:border-blue-500/30 dark:bg-bg-base dark:text-blue-200">
                          Activa
                        </span>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-text-secondary">Cuota</dt>
                          <dd className="font-semibold text-blue-900 dark:text-blue-200">{formatCurrency(result.summary.installmentAmount)}</dd>
                        </div>
                        <div>
                          <dt className="text-text-secondary">Interés total</dt>
                          <dd className="font-semibold text-text-primary">{formatCurrency(result.summary.totalInterest)}</dd>
                        </div>
                      </dl>
                    </article>
                  )}

                  {savedScenarios.map((scenario) => (
                    <article key={scenario.id} className="rounded-xl border border-border-subtle bg-bg-base p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-text-primary">{scenario.name}</h4>
                          <p className="mt-1 text-xs leading-5 text-text-secondary">
                            {formatCurrency(scenario.input.amount)} · {scenario.input.interestRate}% · {scenario.input.termMonths} meses
                          </p>
                          <p className="mt-1 text-xs text-text-secondary">
                            Guardado {scenario.createdAt.toLocaleString('es-CO')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteScenario(scenario.id)}
                          className="rounded-full p-2 text-text-secondary transition hover:bg-hover-bg hover:text-red-600"
                          aria-label={`Eliminar ${scenario.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-text-secondary">Cuota</dt>
                          <dd className="font-semibold text-blue-900 dark:text-blue-200">{formatCurrency(scenario.result.summary.installmentAmount)}</dd>
                        </div>
                        <div>
                          <dt className="text-text-secondary">Interés total</dt>
                          <dd className="font-semibold text-text-primary">{formatCurrency(scenario.result.summary.totalInterest)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-5 min-w-0">
            {error && (
               <div className="rounded-xl border border-red-200 bg-red-100 px-4 py-3 text-sm leading-6 text-red-900 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-200" role="alert">
                 {error}
               </div>
             )}

             {isResultStale && !isSimulating && result && (
               <div className="rounded-xl border border-amber-200 bg-amber-100 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200" role="status">
                 Cambiaste parámetros después del último cálculo. Ejecuta nuevamente para actualizar los resultados.
               </div>
             )}

            <section className="space-y-5" aria-label="Resumen del cálculo">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Resumen financiero</h4>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Resultado consolidado de la fórmula.
                  </p>
                </div>
                {result && (
                   <div className="rounded-full border border-border-subtle bg-bg-base px-3 py-1.5 text-xs font-medium text-text-secondary">
                     Próximo vencimiento: {formatDate(result.summary.nextInstallment?.dueDate || '')}
                   </div>
                 )}
              </div>

              {isSimulating ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
                  {[1, 2, 3, 4].map((item) => (
                     <div key={item} className="rounded-xl border border-border-subtle bg-bg-base p-4">
                      <div className="h-3 w-24 animate-pulse rounded bg-border-subtle" />
                      <div className="mt-3 h-7 w-32 animate-pulse rounded bg-border-subtle" />
                    </div>
                  ))}
                </div>
              ) : result ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {summaryCards.map((card) => (
                     <article key={card.id} className={`rounded-xl border p-4 ${card.tone}`}>
                      <p className="text-xs font-medium uppercase tracking-[0.14em]">{card.label}</p>
                      <p className="mt-2 text-lg font-semibold">{card.value}</p>
                    </article>
                  ))}
                </div>
              ) : (
                 <div className="mt-5 rounded-2xl border border-dashed border-border-subtle bg-bg-base px-6 py-10 text-center">
                  <Calculator size={40} className="mx-auto text-text-secondary" strokeWidth={1.5} />
                  <h5 className="mt-4 text-lg font-semibold text-text-primary">{emptyTitle}</h5>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
                    {emptyDescription}
                  </p>
                </div>
              )}
            </section>

            <section className="space-y-5" aria-label="Tabla de amortización">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <Table2 size={16} />
                    Cronograma de amortización
                  </div>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Desglose mensual de pago, interés, capital y saldo restante.
                  </p>
                </div>
                {result && (
                   <div className="rounded-full border border-border-subtle bg-bg-base px-3 py-1.5 text-xs font-medium text-text-secondary">
                     Fórmula: {result.graphVersionId != null ? `v${result.graphVersionId}` : 'Legado'}
                   </div>
                 )}
              </div>

               <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-base">
                <div className="max-h-[540px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-bg-surface text-left text-xs uppercase tracking-[0.14em] text-text-secondary shadow-sm">
                      <tr>
                        <th className="px-4 py-3 font-medium">Cuota</th>
                        <th className="px-4 py-3 font-medium">Vencimiento</th>
                        <th className="px-4 py-3 text-right font-medium">Pago</th>
                        <th className="px-4 py-3 text-right font-medium">Interés</th>
                        <th className="px-4 py-3 text-right font-medium">Capital</th>
                        <th className="px-4 py-3 text-right font-medium">Saldo</th>
                        <th className="px-4 py-3 text-right font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle bg-bg-base">
                      <tr className="bg-hover-bg/40">
                        <td className="px-4 py-3 font-medium text-text-primary">0</td>
                        <td className="px-4 py-3 text-text-secondary">{formatDate(input.startDate || '')}</td>
                        <td className="px-4 py-3 text-right text-text-secondary">-</td>
                        <td className="px-4 py-3 text-right text-text-secondary">-</td>
                        <td className="px-4 py-3 text-right text-text-secondary">-</td>
                        <td className="px-4 py-3 text-right font-semibold text-text-primary">{formatCurrency(input.amount)}</td>
                        <td className="px-4 py-3 text-right text-text-secondary">Inicio</td>
                      </tr>

                      {isSimulating ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center">
                            <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-4 py-2 text-sm text-text-secondary">
                              <Loader2 size={16} className="animate-spin" />
                              Calculando cronograma...
                            </div>
                          </td>
                        </tr>
                      ) : result && result.schedule.length > 0 ? (
                        result.schedule.map((row) => (
                          <tr key={row.installmentNumber} className="hover:bg-hover-bg/60">
                            <td className="px-4 py-3 font-medium text-text-primary">{row.installmentNumber}</td>
                            <td className="px-4 py-3 text-text-secondary">{formatDate(row.dueDate)}</td>
                             <td className="px-4 py-3 text-right font-medium text-blue-900 dark:text-blue-200">{formatCurrency(row.scheduledPayment)}</td>
                             <td className="px-4 py-3 text-right text-amber-900 dark:text-amber-200">{formatCurrency(row.interestComponent)}</td>
                             <td className="px-4 py-3 text-right text-emerald-900 dark:text-emerald-200">{formatCurrency(row.principalComponent)}</td>
                             <td className="px-4 py-3 text-right font-medium text-text-primary">{formatCurrency(row.remainingBalance)}</td>
                             <td className="px-4 py-3 text-right">
                               <span className="rounded-full border border-border-subtle bg-bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                                 {formatScheduleStatus(row.status)}
                               </span>
                             </td>
                           </tr>
                         ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-sm leading-6 text-text-secondary">
                            {emptyDescription}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
