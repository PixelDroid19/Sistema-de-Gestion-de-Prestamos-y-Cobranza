import React, { useId, useMemo } from 'react';
import {
  Calculator,
  Check,
  DollarSign,
  Loader2,
  Percent,
  Sparkles,
  Table2,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatCurrency as formatCurrencyValue, formatDate as formatLocaleDate } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { getCalculationValueLabel } from '../../lib/creditCalculationLabels';
import { formatScheduleStatusLabel } from '../../lib/scheduleStatusLabels';
import type { CreditCalculationInput, CreditCalculationResult } from '../../types/creditCalculation';
import { OperationalInput, OperationalSelect } from './FormControls';
import { ActionButton, FormField, InsightStrip } from './Surfaces';
import { AppTable } from './tables';

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
    displayValue?: number | undefined;
  };
  lateFeeControl?: {
    readOnly?: boolean;
    helper?: React.ReactNode;
    badge?: string;
  };
};

const lateFeeModeOptions: Array<NonNullable<CreditCalculationInput['lateFeeMode']>> = ['NONE', 'SIMPLE', 'COMPOUND'];

const lateFeeModeLabelKeys: Record<NonNullable<CreditCalculationInput['lateFeeMode']>, 'simulator.lateFee.mode.none' | 'simulator.lateFee.mode.simple' | 'simulator.lateFee.mode.compound' | 'simulator.lateFee.mode.flat' | 'simulator.lateFee.mode.tiered'> = {
  NONE: 'simulator.lateFee.mode.none',
  SIMPLE: 'simulator.lateFee.mode.simple',
  COMPOUND: 'simulator.lateFee.mode.compound',
  FLAT: 'simulator.lateFee.mode.flat',
  TIERED: 'simulator.lateFee.mode.tiered',
};

const lateFeeModeDescriptionKeys: Record<NonNullable<CreditCalculationInput['lateFeeMode']>, 'simulator.lateFee.description.none' | 'simulator.lateFee.description.simple' | 'simulator.lateFee.description.compound' | 'simulator.lateFee.description.flat' | 'simulator.lateFee.description.tiered'> = {
  NONE: 'simulator.lateFee.description.none',
  SIMPLE: 'simulator.lateFee.description.simple',
  COMPOUND: 'simulator.lateFee.description.compound',
  FLAT: 'simulator.lateFee.description.flat',
  TIERED: 'simulator.lateFee.description.tiered',
};

const formatLateFeeModeLabel = (value?: CreditCalculationInput['lateFeeMode']) => {
  const normalizedValue = value || 'SIMPLE';
  return tTerm(lateFeeModeLabelKeys[normalizedValue]);
};

const formatCurrency = (value: number) => formatCurrencyValue(value);

const formatDate = (value: string) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return formatLocaleDate(parsed, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }) || '-';
};

const formatCalculationMethod = (value?: CreditCalculationResult['method']) => (
  getCalculationValueLabel(value || 'FRENCH', 'method')
);

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
  helperText,
  resultBadge,
  validationStatus,
  actionLabel,
  simulateButtonDataTour,
  hideHeaderActions = false,
  compactChrome = false,
  emptyTitle,
  emptyDescription,
  emptyScheduleDescription,
  rateControl,
  lateFeeControl,
}: CreditSimulationWorkspaceProps) {
  const { locale } = useTranslation();
  const instanceId = useId();
  const titleId = `${instanceId}-credit-simulation-title`;
  const freshResult = isResultStale ? null : result;
  const resolvedActionLabel = actionLabel || tTerm('simulator.form.simulate');
  const resolvedEmptyTitle = emptyTitle || tTerm('simulator.empty.pendingTitle');
  const resolvedEmptyDescription = emptyDescription || tTerm('simulator.empty.pendingDescription');
  const resolvedEmptyScheduleDescription = emptyScheduleDescription || tTerm('simulator.empty.pendingScheduleDescription');
  const fieldHelp = {
    amount: tTerm('simulator.help.amount'),
    rate: tTerm('simulator.help.rate'),
    term: tTerm('simulator.help.term'),
    startDate: tTerm('simulator.help.startDate'),
    lateFee: tTerm('simulator.help.lateFee'),
  };
  const displayInterestRate = rateControl?.readOnly && Object.prototype.hasOwnProperty.call(rateControl, 'displayValue')
    ? rateControl.displayValue
    : input.interestRate;

  const summaryCards = useMemo(() => {
    if (!freshResult) {
      return [];
    }

    return [
      {
        id: 'installment',
        label: tTerm('simulator.summary.card.installmentEstimated'),
        compactLabel: tTerm('simulator.schedule.header.payment'),
        value: formatCurrency(freshResult.summary.installmentAmount),
        helper: tTerm('simulator.summary.card.helper.monthlyEstimated'),
        icon: <DollarSign size={18} />,
        accent: 'blue' as const,
      },
      {
        id: 'payable',
        label: tTerm('simulator.summary.totalPayment'),
        compactLabel: tTerm('simulator.summary.totalPayment.short'),
        value: formatCurrency(freshResult.summary.totalPayable),
        helper: tTerm('simulator.summary.card.helper.capitalInterest'),
        icon: <Check size={18} />,
        accent: 'emerald' as const,
      },
      {
        id: 'interest',
        label: tTerm('simulator.summary.card.totalInterestLabel'),
        compactLabel: tTerm('simulator.summary.totalInterest.short'),
        value: formatCurrency(freshResult.summary.totalInterest),
        helper: tTerm('simulator.summary.card.helper.financialCost'),
        icon: <Percent size={18} />,
        accent: 'amber' as const,
      },
    ];
  }, [freshResult, locale]);

  return (
    <section className={`flex flex-col ${compactChrome ? 'gap-4' : 'gap-6'}`} aria-labelledby={titleId}>
      <div className={compactChrome ? 'overflow-visible rounded-[1.35rem] border border-border-subtle bg-bg-surface shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]' : 'overflow-visible rounded-2xl border border-border-subtle bg-bg-surface shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]'}>
        <div className={`${compactChrome ? 'border-b border-border-subtle px-6 py-6 sm:px-8' : 'border-b border-border-subtle px-6 py-6 sm:px-8'}`}>
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
                  {resolvedActionLabel}
                </ActionButton>
                {onReset && (
                  <ActionButton
                    onClick={onReset}
                    disabled={disabled || isSimulating}
                    className="py-3"
                  >
                    {tTerm('simulator.action.resetParameters')}
                  </ActionButton>
                )}
              </div>
            )}
          </div>

        </div>

        <div className={`grid ${compactChrome ? 'gap-0 xl:grid-cols-[minmax(300px,0.52fr)_minmax(0,1.48fr)] 2xl:grid-cols-[minmax(320px,0.56fr)_minmax(0,1.44fr)]' : 'gap-6 p-6 sm:p-8 lg:gap-7 xl:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.6fr)] 2xl:grid-cols-[minmax(500px,0.95fr)_minmax(0,1.65fr)]'}`}>
          <div className={`${compactChrome ? 'space-y-4 p-6 sm:p-8 xl:sticky xl:top-4 xl:self-start xl:border-r xl:border-border-subtle' : 'space-y-5'}`}>
            <section className={`${compactChrome ? 'space-y-4' : 'space-y-5'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Calculator size={16} />
                {tTerm('simulator.section.parameters')}
              </div>

              <div className={`grid ${compactChrome ? 'gap-3' : 'gap-4'}`}>
                <FormField label={tTerm('simulator.form.amount')} tooltip={fieldHelp.amount} error={fieldErrors.amount}>
                  <OperationalInput
                    variant="money"
                    value={input.amount}
                    onValueChange={(value) => onInputChange({ amount: Number(value) || 0 })}
                    disabled={disabled}
                    invalid={!!fieldErrors.amount}
                    autoComplete="off"
                    icon={<DollarSign size={16} />}
                  />
                </FormField>

                <div className={`grid ${compactChrome ? 'gap-3' : 'gap-4 sm:grid-cols-2'}`}>
                  <FormField
                    label={rateControl?.readOnly ? tTerm('simulator.field.rate.configured') : tTerm('simulator.field.rate.nominal')}
                    tooltip={rateControl?.helper || fieldHelp.rate}
                    helper={rateControl?.badge || rateControl?.helper}
                    error={fieldErrors.interestRate}
                  >
                    <OperationalInput
                      variant="percent"
                      min="0"
                      step="0.01"
                      value={displayInterestRate}
                      onValueChange={(value) => onInputChange({ interestRate: Number(value) || 0 })}
                      disabled={disabled || rateControl?.readOnly}
                      invalid={!!fieldErrors.interestRate}
                      suffix="%"
                    />
                  </FormField>

                  <FormField label={tTerm('simulator.field.termMonths')} tooltip={fieldHelp.term} error={fieldErrors.termMonths}>
                    <OperationalInput
                      variant="number"
                      min="1"
                      value={input.termMonths}
                      onValueChange={(value) => onInputChange({ termMonths: Number(value) || 0 })}
                      disabled={disabled}
                      invalid={!!fieldErrors.termMonths}
                    />
                  </FormField>
                </div>

                <div className={`grid ${compactChrome ? 'gap-3' : 'gap-4 sm:grid-cols-2'}`}>
                  <FormField label={tTerm('simulator.form.firstPaymentDate')} tooltip={fieldHelp.startDate}>
                    <OperationalInput
                      variant="date"
                      value={input.startDate || ''}
                      onValueChange={(value) => onInputChange({ startDate: String(value || '') || undefined })}
                      disabled={disabled}
                    />
                  </FormField>

                  <FormField
                    label={tTerm('simulator.form.lateFeeCalculation')}
                    tooltip={fieldHelp.lateFee}
                    helper={lateFeeControl?.badge || lateFeeControl?.helper || (
                      <>
                        <span className="font-semibold text-text-primary">
                          {formatLateFeeModeLabel(input.lateFeeMode)}:
                        </span>{' '}
                        {tTerm(lateFeeModeDescriptionKeys[input.lateFeeMode || 'SIMPLE'])}
                      </>
                    )}
                  >
                    <OperationalSelect
                      aria-label={tTerm('simulator.form.lateFeeCalculation')}
                      value={input.lateFeeMode || 'SIMPLE'}
                      onChange={(event) => onInputChange({ lateFeeMode: event.target.value as NonNullable<CreditCalculationInput['lateFeeMode']> })}
                      disabled={disabled || lateFeeControl?.readOnly}
                      data-tour="new-credit-late-fee-mode"
                    >
                      {lateFeeModeOptions.map((option) => (
                        <option key={option} value={option}>
                          {tTerm(lateFeeModeLabelKeys[option])}
                        </option>
                      ))}
                    </OperationalSelect>
                  </FormField>
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
            </section>
          </div>

          <div className={`${compactChrome ? 'space-y-4 p-6 sm:p-8' : 'space-y-5'} min-w-0`}>
            {error && (
               <div className="rounded-xl border border-red-200 bg-red-100 px-4 py-3 text-sm leading-6 text-red-900 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-200" role="alert">
                 {error}
               </div>
             )}

             {isResultStale && !isSimulating && result && (
               <div className="rounded-xl border border-amber-200 bg-amber-100 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200" role="status">
                 {tTerm('simulator.warning.stale')}
               </div>
             )}

            <section className={`${compactChrome ? 'space-y-3' : 'space-y-5'}`} aria-label={tTerm('simulator.summary.aria')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">{tTerm('simulator.section.summary.title')}</h4>
                </div>
                {freshResult && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-border-subtle bg-bg-base px-3 py-1 text-xs font-medium text-text-secondary">
                      {tTerm('simulator.summary.methodLabel', { method: formatCalculationMethod(freshResult.method) })}
                    </div>
                    <div className="rounded-full border border-border-subtle bg-bg-base px-3 py-1 text-xs font-medium text-text-secondary">
                      {tTerm('simulator.summary.nextDue', { date: formatDate(freshResult.summary.nextInstallment?.dueDate || '') })}
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
                <InsightStrip
                  className={compactChrome ? 'credit-simulation-summary-strip credit-simulation-summary-strip--compact' : 'credit-simulation-summary-strip'}
                  aria-label={tTerm('simulator.summary.aria')}
                  items={summaryCards.map((card) => ({
                    id: card.id,
                    label: compactChrome ? card.compactLabel : card.label,
                    value: card.value,
                    helper: card.helper,
                    icon: card.icon,
                    accent: card.accent,
                  }))}
                />
              ) : (
                 <div className={`mt-5 text-center ${compactChrome ? 'border-y border-border-subtle px-4 py-10' : 'rounded-2xl border border-dashed border-border-subtle bg-bg-base px-6 py-10'}`}>
                  <Calculator size={40} className="mx-auto text-text-secondary" strokeWidth={1.5} />
                  <h5 className="mt-4 text-lg font-semibold text-text-primary">{resolvedEmptyTitle}</h5>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
                    {resolvedEmptyDescription}
                  </p>
                </div>
              )}
            </section>

            <section className={`${compactChrome ? 'space-y-3 pb-4' : 'space-y-5 pb-6'}`} aria-label={tTerm('simulator.schedule.title')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <Table2 size={16} />
                    {tTerm('simulator.schedule.title')}
                  </div>
                </div>
                {freshResult && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-border-subtle bg-bg-base px-3 py-1 text-xs font-medium text-text-secondary">
                      {tTerm('simulator.schedule.activeRule')}
                    </div>
                    {!compactChrome && (
                      <div className="rounded-full border border-border-subtle bg-bg-base px-3 py-1.5 text-xs font-medium text-text-secondary">
                        {tTerm('simulator.summary.methodLabel', { method: formatCalculationMethod(freshResult.method) })}
                      </div>
                    )}
                  </div>
                )}
              </div>

               <AppTable variant="financial" visibleFrom="always" horizontalScroll minWidthClassName="min-w-[880px]">
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
                      <tr className="bg-hover-bg/40">
                        <td className="text-center font-medium text-text-secondary">0</td>
                        <td className="text-text-secondary">{formatDate(input.startDate || '')}</td>
                        <td className="text-right text-text-secondary">-</td>
                        <td className="text-right text-text-secondary">-</td>
                        <td className="text-right text-text-secondary">-</td>
                        <td className="text-right font-semibold text-text-primary">{formatCurrency(input.amount)}</td>
                        <td className="text-center text-text-secondary">{tTerm('simulator.schedule.row.start')}</td>
                      </tr>

                      {isSimulating ? (
                        <tr>
                          <td colSpan={7} className="table-empty-state">
                            <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-4 py-2 text-sm text-text-secondary">
                              <Loader2 size={16} className="animate-spin" />
                              {tTerm('simulator.schedule.loading')}
                            </div>
                          </td>
                        </tr>
                      ) : freshResult && freshResult.schedule.length > 0 ? (
                        freshResult.schedule.map((row) => (
                          <tr key={row.installmentNumber} className="hover:bg-hover-bg/60">
                            <td className="text-center font-medium text-text-secondary">{row.installmentNumber}</td>
                            <td className="text-text-secondary">{formatDate(row.dueDate)}</td>
                             <td className="text-right font-medium text-blue-900 dark:text-blue-200">{formatCurrency(row.scheduledPayment)}</td>
                             <td className="text-right text-amber-900 dark:text-amber-200">{formatCurrency(row.interestComponent)}</td>
                             <td className="text-right text-emerald-900 dark:text-emerald-200">{formatCurrency(row.principalComponent)}</td>
                             <td className="text-right font-medium text-text-primary">{formatCurrency(row.remainingBalance)}</td>
                             <td className="text-center">
                               <span className="rounded-full border border-border-subtle bg-bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                                 {formatScheduleStatusLabel(row.status)}
                               </span>
                             </td>
                           </tr>
                         ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="table-empty-state">
                            {resolvedEmptyScheduleDescription}
                          </td>
                        </tr>
                      )}
                    </tbody>
              </AppTable>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
