import { useMemo, useState } from 'react';
import { tTerm } from '../../i18n/terminology';
import { AppInput, FormField } from '../shared/Surfaces';

export type ReportDateRange = {
  fromDate: string;
  toDate: string;
};

type ReportPeriodMode = 'day' | 'month' | 'range';

type ReportPeriodSelectorProps = {
  value: ReportDateRange;
  onChange: (range: ReportDateRange) => void;
};

const monthPattern = /^(\d{4})-(\d{2})$/;

export const getMonthDateRange = (monthValue: string): ReportDateRange => {
  const match = monthPattern.exec(monthValue);
  if (!match) return { fromDate: '', toDate: '' };

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return { fromDate: '', toDate: '' };

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    fromDate: `${monthValue}-01`,
    toDate: `${monthValue}-${String(lastDay).padStart(2, '0')}`,
  };
};

const inferPeriodMode = (value: ReportDateRange): ReportPeriodMode => {
  if (!value.fromDate && !value.toDate) return 'month';
  if (value.fromDate && value.fromDate === value.toDate) return 'day';
  if (value.fromDate && value.toDate) {
    const candidate = value.fromDate.slice(0, 7);
    const monthRange = getMonthDateRange(candidate);
    if (monthRange.fromDate === value.fromDate && monthRange.toDate === value.toDate) return 'month';
  }
  return 'range';
};

export default function ReportPeriodSelector({ value, onChange }: ReportPeriodSelectorProps) {
  const [mode, setMode] = useState<ReportPeriodMode>(() => inferPeriodMode(value));
  const monthValue = useMemo(() => {
    if (!value.fromDate || !value.toDate) return '';
    const candidate = value.fromDate.slice(0, 7);
    const monthRange = getMonthDateRange(candidate);
    return monthRange.fromDate === value.fromDate && monthRange.toDate === value.toDate ? candidate : '';
  }, [value.fromDate, value.toDate]);
  const dayValue = value.fromDate === value.toDate ? value.fromDate : '';

  const selectMode = (nextMode: ReportPeriodMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    onChange({ fromDate: '', toDate: '' });
  };

  return (
    <fieldset className="report-period-selector">
      <legend className="report-period-selector__legend">{tTerm('reports.period.label')}</legend>
      <div className="report-period-selector__modes" aria-label={tTerm('reports.period.mode')}>
        {(['day', 'month', 'range'] as const).map((periodMode) => (
          <button
            key={periodMode}
            type="button"
            className="report-period-selector__mode"
            aria-pressed={mode === periodMode}
            onClick={() => selectMode(periodMode)}
          >
            {tTerm(`reports.period.${periodMode}`)}
          </button>
        ))}
      </div>

      <div className={`report-period-selector__fields report-period-selector__fields--${mode}`}>
        {mode === 'day' ? (
          <FormField label={tTerm('reports.period.dayField')}>
            <AppInput
              variant="date"
              value={dayValue}
              onValueChange={(date) => onChange({ fromDate: date, toDate: date })}
            />
          </FormField>
        ) : null}
        {mode === 'month' ? (
          <FormField label={tTerm('reports.period.monthField')}>
            <div className="operational-control">
              <input
                type="month"
                className="operational-control-input"
                value={monthValue}
                onChange={(event) => onChange(getMonthDateRange(event.target.value))}
              />
            </div>
          </FormField>
        ) : null}
        {mode === 'range' ? (
          <>
            <FormField label={tTerm('reports.period.from')}>
              <AppInput
                variant="date"
                value={value.fromDate}
                max={value.toDate || undefined}
                onValueChange={(fromDate) => {
                  if (!fromDate || !value.toDate || fromDate <= value.toDate) {
                    onChange({ ...value, fromDate });
                  }
                }}
              />
            </FormField>
            <FormField label={tTerm('reports.period.to')}>
              <AppInput
                variant="date"
                value={value.toDate}
                min={value.fromDate || undefined}
                onValueChange={(toDate) => {
                  if (!toDate || !value.fromDate || toDate >= value.fromDate) {
                    onChange({ ...value, toDate });
                  }
                }}
              />
            </FormField>
          </>
        ) : null}
      </div>
    </fieldset>
  );
}
