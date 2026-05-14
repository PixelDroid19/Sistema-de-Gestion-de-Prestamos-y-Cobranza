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
import { getCalculationValueLabel } from '../../lib/creditCalculationLabels';
import type { CreditCalculationInput, CreditCalculationResult } from '../../types/creditCalculation';
import { HelpTooltip } from './HelpSupport';
import { ActionButton, DataTableSurface, SectionSurface } from './Surfaces';

type SavedScenario = {
  id: string;
  name: string;
  input: CreditCalculationInput;
  result: CreditCalculationResult;
  createdAt: Date;
};

type CreditSimulationWorkspaceProps = {
  title: string;
  description: string;
  modeLabel: string;
  input: CreditCalculationInput;
  result: CreditCalculationResult | null;
  isSimulating: boolean;
  error: string | null;
  fieldErrors?: Record<string, string>;
  isResultStale?: boolean;
  onInputChange: (input: Partial<CreditCalculationInput>) => void;
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
  simulateButtonDataTour?: string;
  hideHeaderActions?: boolean;
  compactChrome?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyScheduleDescription?: string;
  rateControl?: {
    readOnly?: boolean;
    helper?: string;
    badge?: string;
  };
};

const lateFeeModeOptions: Array<{ value: NonNullable<CreditCalculationInput['lateFeeMode']>; label: string; helper: string }> = [
  { value: 'NONE', label: 'Sin recargo', helper: 'No aplica mora.' },
  { value: 'SIMPLE', label: 'Mora simple', helper: 'Recargo claro sobre cuota vencida.' },
  { value: 'COMPOUND', label: 'Mora compuesta', helper: 'Capitaliza recargos.' },
  { value: 'FLAT', label: 'Cargo fijo por mora', helper: 'Valor fijo por atraso.' },
  { value: 'TIERED', label: 'Mora por tramos', helper: 'Tramos por días vencidos.' },
];

const formatLateFeeModeLabel = (value?: CreditCalculationInput['lateFeeMode']) => {
  const selectedOption = lateFeeModeOptions.find((option) => option.value === (value || 'SIMPLE'));
  return selectedOption?.label || 'Mora simple';
};

const lateFeeModeDescriptions: Record<NonNullable<CreditCalculationInput['lateFeeMode']>, string> = {
  NONE: 'No cobra recargo por atraso.',
  SIMPLE: 'Cobra sobre la cuota vencida, sin cobrar mora sobre mora.',
  COMPOUND: 'Capitaliza recargos vencidos; úsalo solo con política aprobada.',
  FLAT: 'Aplica un valor fijo por atraso.',
  TIERED: 'Usa tramos por días vencidos o severidad.',
};

const formatCurrency = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(value);

const formatAmountInputDisplay = (value: number) =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

const parseDigitsToAmount = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
};

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
    timeZone: 'UTC',
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

const formatCalculationMethod = (value?: CreditCalculationResult['method']) => (
  getCalculationValueLabel(value || 'FRENCH', 'method')
);

const getDefaultScenarioName = (savedScenariosCount: number) => `Escenario ${savedScenariosCount + 1}`;

const fieldHelp = {
  amount: 'Capital a desembolsar antes de intereses y recargos.',
  rate: 'Porcentaje anual usado para construir la cuota mensual equivalente.',
  term: 'Número total de cuotas mensuales del cronograma.',
  startDate: 'Fecha exacta de vencimiento de la primera cuota. Las siguientes cuotas se calculan mes a mes desde esta fecha.',
  lateFee: 'Define el método matemático de la mora. La política activa de Configuración aporta la tasa y el valor queda guardado con el crédito.',
  scenarios: 'Guarda resultados para comparar cuota e interés sin registrar un crédito.',
};

function FieldHint({ id, text }: { id: string; text: string }) {
  return (
    <span id={id}>
      <HelpTooltip text={text} />
    </span>
  );
}

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
  actionLabel = tTerm('simulator.form.simulate'),
  simulateButtonDataTour,
  hideHeaderActions = false,
  compactChrome = false,
  emptyTitle = 'Sin resultados todavía',
  emptyDescription = 'Ajusta los parámetros y ejecuta el cálculo para revisar la cuota, el costo financiero y el cronograma.',
  emptyScheduleDescription = 'Tras calcular, aquí verás cada cuota con vencimiento, pago e intereses.',
  rateControl,
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
  const startDateHelpId = useId();
  const lateFeeHelpId = useId();
  const scenariosHelpId = useId();
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [scenarioName, setScenarioName] = useState('');
  const [isComparisonVisible, setIsComparisonVisible] = useState(false);
  const freshResult = isResultStale ? null : result;

  const summaryCards = useMemo(() => {
    if (!freshResult) {
      return [];
    }

    const totalInstallments = Math.max(freshResult.schedule.length, input.termMonths || 0, 1);
    const averageInterestPerInstallment = freshResult.summary.totalInterest / totalInstallments;

    return [
      {
        id: 'installment',
        label: 'Cuota estimada',
        compactLabel: 'Cuota',
        value: formatCurrency(freshResult.summary.installmentAmount),
        tone: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300',
      },
      {
        id: 'payable',
        label: 'Total a pagar',
        compactLabel: 'Total',
        value: formatCurrency(freshResult.summary.totalPayable),
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
      },
      {
        id: 'interest',
        label: 'Interés total',
        compactLabel: 'Interés',
        value: formatCurrency(freshResult.summary.totalInterest),
        tone: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
      },
      {
        id: 'averageInterest',
        label: 'Interés promedio por cuota',
        compactLabel: 'Promedio/cuota',
        value: formatCurrency(averageInterestPerInstallment),
        tone: 'border-border-subtle bg-bg-base text-text-primary',
      },
    ];
  }, [freshResult, input.termMonths]);

  const handleSaveScenario = () => {
    if (!showScenarioTools || !freshResult) {
      return;
    }

    const nextScenario: SavedScenario = {
      id: `${Date.now()}`,
      name: scenarioName.trim() || getDefaultScenarioName(savedScenarios.length),
      input: { ...input },
      result: freshResult,
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

  const handleFieldChange = (field: keyof CreditCalculationInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const nextValue = event.target.value;

    if (field === 'lateFeeMode' || field === 'startDate') {
      onInputChange({ [field]: nextValue || undefined });
      return;
    }

    if (field === 'amount') {
      onInputChange({ amount: parseDigitsToAmount(nextValue) });
      return;
    }

    onInputChange({ [field]: Number(nextValue) || 0 });
  };

  return (
    <section className={`flex flex-col ${compactChrome ? 'gap-4' : 'gap-6'}`} aria-labelledby={titleId}>
      <div className={compactChrome ? 'border-t border-border-subtle pt-5' : 'overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]'}>
        <div className={`${compactChrome ? 'pb-4' : 'border-b border-border-subtle px-6 py-6 sm:px-8'}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className={`max-w-3xl ${compactChrome ? 'space-y-1' : 'space-y-3'}`}>
              {!compactChrome && (
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
              )}
              <div>
                <h3 id={titleId} className={`${compactChrome ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'} font-semibold text-text-primary`}>
                  {title}
                </h3>
                <p className={`max-w-2xl text-sm leading-6 text-text-secondary ${compactChrome ? 'mt-1' : 'mt-2 sm:text-base'}`}>
                  {description}
                </p>
                {compactChrome && (
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    {modeLabel}
                  </p>
                )}
              </div>
            </div>

            {!hideHeaderActions && (
              <div className="flex flex-col items-stretch gap-3 lg:min-w-[260px]">
                <ActionButton
                  data-tour={simulateButtonDataTour}
                  onClick={onSimulate}
                  disabled={disabled || isSimulating}
                  isLoading={isSimulating}
                  icon={isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                  variant="primary"
                  className="py-3"
                >
                  {actionLabel}
                </ActionButton>
                {onReset && (
                  <ActionButton
                    onClick={onReset}
                    disabled={disabled || isSimulating}
                    className="py-3"
                  >
                    Restablecer parámetros
                  </ActionButton>
                )}
              </div>
            )}
          </div>

          {!compactChrome && (
            <dl className="mt-6 grid gap-x-8 gap-y-4 border-t border-border-subtle pt-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-primary/55 dark:text-text-secondary">
                  <DollarSign size={14} />
                  Monto base
                </dt>
                <dd className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-text-primary">{formatCurrency(input.amount)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-primary/55 dark:text-text-secondary">
                  <Percent size={14} />
                  Tasa anual
                </dt>
                <dd className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-text-primary">{input.interestRate}%</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-primary/55 dark:text-text-secondary">
                  <Clock3 size={14} />
                  Plazo
                </dt>
                <dd className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-text-primary">{input.termMonths} meses</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-primary/55 dark:text-text-secondary">
                  <AlertCircle size={14} />
                  Mora
                </dt>
                <dd className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-text-primary">{formatLateFeeModeLabel(input.lateFeeMode)}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className={`grid ${compactChrome ? 'gap-4 xl:grid-cols-[minmax(300px,0.52fr)_minmax(0,1.48fr)] 2xl:grid-cols-[minmax(320px,0.56fr)_minmax(0,1.44fr)]' : 'gap-6 p-6 sm:p-8 lg:gap-7 xl:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.6fr)] 2xl:grid-cols-[minmax(500px,0.95fr)_minmax(0,1.65fr)]'}`}>
          <div className={`${compactChrome ? 'space-y-4 xl:sticky xl:top-4 xl:self-start' : 'space-y-5'}`}>
            <section className={`${compactChrome ? 'space-y-4 border-b border-border-subtle pb-5' : 'space-y-5'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Calculator size={16} />
                Parámetros
              </div>
              <p className={`${compactChrome ? 'text-xs' : 'text-sm'} text-text-secondary`}>
                Ajusta datos y ejecuta el cálculo.
              </p>

              <div className={`grid ${compactChrome ? 'gap-3' : 'gap-4'}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <label htmlFor={amountInputId} className="text-sm font-medium text-text-primary">
                      Monto del crédito
                    </label>
                    <FieldHint id={amountHelpId} text={fieldHelp.amount} />
                  </div>
                  <div className="relative mt-2">
                    <DollarSign size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <input
                      id={amountInputId}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={formatAmountInputDisplay(input.amount)}
                      onChange={handleFieldChange('amount')}
                      aria-describedby={fieldErrors.amount ? `${amountInputId}-error` : undefined}
                      aria-invalid={!!fieldErrors.amount}
                      disabled={disabled}
                      className={`w-full rounded-xl border bg-bg-base px-10 py-2.5 text-sm tabular-nums text-text-primary shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${fieldErrors.amount ? 'border-red-400 focus:ring-red-500' : 'border-border-subtle focus:ring-blue-500'}`}
                    />
                  </div>
                  {fieldErrors.amount && (
                    <p id={`${amountInputId}-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
                      {fieldErrors.amount}
                    </p>
                  )}
                </div>

                <div className={`grid ${compactChrome ? 'gap-3' : 'gap-4 sm:grid-cols-2'}`}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor={rateInputId} className="text-sm font-medium text-text-primary">
                        {rateControl?.readOnly ? 'Tasa configurada' : 'Tasa nominal anual'}
                      </label>
                      <FieldHint id={rateHelpId} text={rateControl?.helper || fieldHelp.rate} />
                      {rateControl?.badge && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200">
                          {rateControl.badge}
                        </span>
                      )}
                    </div>
                    <div className="relative mt-2">
                      <input
                        id={rateInputId}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={input.interestRate}
                        onChange={handleFieldChange('interestRate')}
                        aria-describedby={fieldErrors.interestRate ? `${rateInputId}-error` : undefined}
                        aria-invalid={!!fieldErrors.interestRate}
                        disabled={disabled || rateControl?.readOnly}
                        className={`w-full rounded-xl border bg-bg-base px-4 py-2.5 pr-10 text-sm text-text-primary shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${fieldErrors.interestRate ? 'border-red-400 focus:ring-red-500' : 'border-border-subtle focus:ring-blue-500'}`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary">%</span>
                    </div>
                    {rateControl?.helper && (
                      <p className="mt-1.5 text-xs text-text-secondary">{rateControl.helper}</p>
                    )}
                    {fieldErrors.interestRate && (
                      <p id={`${rateInputId}-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
                        {fieldErrors.interestRate}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <label htmlFor={termInputId} className="text-sm font-medium text-text-primary">
                        Plazo en meses
                      </label>
                      <FieldHint id={termHelpId} text={fieldHelp.term} />
                    </div>
                    <input
                      id={termInputId}
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={input.termMonths}
                      onChange={handleFieldChange('termMonths')}
                      aria-describedby={fieldErrors.termMonths ? `${termInputId}-error` : undefined}
                      aria-invalid={!!fieldErrors.termMonths}
                      disabled={disabled}
                       className={`mt-2 w-full rounded-xl border bg-bg-base px-4 py-2.5 text-sm text-text-primary shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${fieldErrors.termMonths ? 'border-red-400 focus:ring-red-500' : 'border-border-subtle focus:ring-blue-500'}`}
                    />
                    {fieldErrors.termMonths && (
                      <p id={`${termInputId}-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
                        {fieldErrors.termMonths}
                      </p>
                    )}
                  </div>
                </div>

                <div className={`grid ${compactChrome ? 'gap-3' : 'gap-4 sm:grid-cols-2'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <label htmlFor={startDateInputId} className="text-sm font-medium text-text-primary">
                        Fecha del primer pago
                      </label>
                      <FieldHint id={startDateHelpId} text={fieldHelp.startDate} />
                    </div>
                    <input
                      id={startDateInputId}
                      type="date"
                      value={input.startDate || ''}
                      onChange={handleFieldChange('startDate')}
                      disabled={disabled}
                       className="mt-2 w-full rounded-xl border border-border-subtle bg-bg-base px-4 py-2.5 text-sm text-text-primary shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <label htmlFor={lateFeeInputId} className="text-sm font-medium text-text-primary">
                        Cálculo de mora
                      </label>
                      <FieldHint id={lateFeeHelpId} text={fieldHelp.lateFee} />
                    </div>
                    <div className="mt-2" data-tour="new-credit-late-fee-mode">
                      <select
                        id={lateFeeInputId}
                        value={input.lateFeeMode || 'SIMPLE'}
                        onChange={(event) => onInputChange({ lateFeeMode: event.target.value as NonNullable<CreditCalculationInput['lateFeeMode']> })}
                        disabled={disabled}
                        className="w-full rounded-xl border border-border-subtle bg-bg-base px-4 py-2.5 text-sm font-semibold text-text-primary shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {lateFeeModeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-xs leading-5 text-text-secondary">
                        <span className="font-semibold text-text-primary">
                          {formatLateFeeModeLabel(input.lateFeeMode)}:
                        </span>{' '}
                        {lateFeeModeDescriptions[input.lateFeeMode || 'SIMPLE']}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {helperText && !validationStatus?.valid && (
                <div className="border-l-4 border-blue-300 bg-blue-50 px-4 py-2.5 text-sm leading-6 text-blue-900 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-200">
                  {helperText}
                </div>
              )}

              {validationStatus && (
                <div
                  className={`border-l-4 px-4 py-2.5 text-sm leading-6 ${validationStatus.valid
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
                    <FieldHint id={scenariosHelpId} text={fieldHelp.scenarios} />
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    Compara hasta 3 resultados.
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
                    <ActionButton
                      onClick={handleSaveScenario}
                      disabled={disabled || !freshResult}
                      icon={<Save size={16} />}
                      className="py-3"
                    >
                      Guardar escenario
                    </ActionButton>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-text-secondary">
                      {savedScenarios.length} escenario{savedScenarios.length === 1 ? '' : 's'} guardado{savedScenarios.length === 1 ? '' : 's'}.
                    </p>
                    {savedScenarios.length > 0 && (
                      <ActionButton
                        onClick={() => setIsComparisonVisible((currentValue) => !currentValue)}
                        icon={<GitCompareArrows size={14} />}
                        variant="ghost"
                        className="min-h-8 px-3 py-1.5 text-xs"
                        aria-expanded={isComparisonVisible}
                      >
                        {isComparisonVisible ? 'Ocultar comparación' : 'Comparar escenarios'}
                      </ActionButton>
                    )}
                  </div>
                </div>
              )}
            </section>

            {showScenarioTools && isComparisonVisible && savedScenarios.length > 0 && (
              <SectionSurface
                aria-label="Comparación de escenarios guardados"
                title={(
                  <span className="flex items-center gap-2">
                    <GitCompareArrows size={16} />
                    Comparación de escenarios
                  </span>
                )}
                bodyClassName="space-y-3"
              >
                  {freshResult && (
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
                          <dd className="font-semibold text-blue-900 dark:text-blue-200">{formatCurrency(freshResult.summary.installmentAmount)}</dd>
                        </div>
                        <div>
                          <dt className="text-text-secondary">Interés total</dt>
                          <dd className="font-semibold text-text-primary">{formatCurrency(freshResult.summary.totalInterest)}</dd>
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
              </SectionSurface>
            )}
          </div>

          <div className={`${compactChrome ? 'space-y-4' : 'space-y-5'} min-w-0`}>
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

            <section className={`${compactChrome ? 'space-y-3' : 'space-y-5'}`} aria-label="Resumen del cálculo">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Resumen financiero</h4>
                  <p className={`${compactChrome ? 'mt-0.5 text-xs' : 'mt-1 text-sm'} leading-6 text-text-secondary`}>
                    Resultado consolidado de la fórmula.
                  </p>
                </div>
                {freshResult && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-border-subtle bg-bg-base px-3 py-1 text-xs font-medium text-text-secondary">
                      Método: {formatCalculationMethod(freshResult.method)}
                    </div>
                    <div className="rounded-full border border-border-subtle bg-bg-base px-3 py-1 text-xs font-medium text-text-secondary">
                      Próximo vencimiento: {formatDate(freshResult.summary.nextInstallment?.dueDate || '')}
                    </div>
                  </div>
                )}
              </div>

              {isSimulating ? (
                <div className={`${compactChrome ? 'mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4' : 'mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4'}`} aria-live="polite">
                  {[1, 2, 3, 4].map((item) => (
                     <div key={item} className="rounded-xl border border-border-subtle bg-bg-base p-4">
                      <div className="h-3 w-24 animate-pulse rounded bg-border-subtle" />
                      <div className="mt-3 h-7 w-32 animate-pulse rounded bg-border-subtle" />
                    </div>
                  ))}
                </div>
              ) : freshResult ? (
                <div className={`${compactChrome ? 'mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4' : 'mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4'}`}>
                  {summaryCards.map((card) => (
                     <article key={card.id} className={`rounded-xl border ${compactChrome ? 'px-3 py-2.5' : 'p-4'} ${card.tone}`}>
                      <p className={`${compactChrome ? 'text-[9px] tracking-[0.1em]' : 'text-[10px] tracking-[0.12em]'} font-semibold uppercase opacity-90`}>
                        {compactChrome ? card.compactLabel : card.label}
                      </p>
                      <p className={`${compactChrome ? 'mt-0.5 text-base' : 'mt-2 text-xl'} font-bold tabular-nums tracking-tight`}>{card.value}</p>
                    </article>
                  ))}
                </div>
              ) : (
                 <div className={`mt-5 text-center ${compactChrome ? 'border-y border-border-subtle px-4 py-10' : 'rounded-2xl border border-dashed border-border-subtle bg-bg-base px-6 py-10'}`}>
                  <Calculator size={40} className="mx-auto text-text-secondary" strokeWidth={1.5} />
                  <h5 className="mt-4 text-lg font-semibold text-text-primary">{emptyTitle}</h5>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
                    {emptyDescription}
                  </p>
                </div>
              )}
            </section>

            <section className={`${compactChrome ? 'space-y-3' : 'space-y-5'}`} aria-label="Tabla de amortización">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <Table2 size={16} />
                    Cronograma de amortización
                  </div>
                  <p className={`${compactChrome ? 'mt-0.5 text-xs' : 'mt-1 text-sm'} leading-6 text-text-secondary`}>
                    Desglose mensual de pago, interés, capital y saldo restante.
                  </p>
                </div>
                {freshResult && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-border-subtle bg-bg-base px-3 py-1 text-xs font-medium text-text-secondary">
                      Regla: {freshResult.calculationProfileVersionId != null ? `v${freshResult.calculationProfileVersionId}` : 'Activa sin versión visible'}
                    </div>
                    {!compactChrome && (
                      <div className="rounded-full border border-border-subtle bg-bg-base px-3 py-1.5 text-xs font-medium text-text-secondary">
                        Método: {formatCalculationMethod(freshResult.method)}
                      </div>
                    )}
                  </div>
                )}
              </div>

               <DataTableSurface>
                <div className={`${compactChrome ? 'max-h-[460px]' : 'max-h-[540px]'} overflow-auto`}>
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
                              Calculando cronograma…
                            </div>
                          </td>
                        </tr>
                      ) : freshResult && freshResult.schedule.length > 0 ? (
                        freshResult.schedule.map((row) => (
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
                            {emptyScheduleDescription}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </DataTableSurface>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
