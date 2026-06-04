import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { formatCurrency as formatCurrencyValue, formatDate as formatLocaleDate } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { formatScheduleStatusLabel } from '../../lib/scheduleStatusLabels';
import type { AmortizationRow } from '../../types/creditCalculation';
import { AppTable, TABLE_EMBEDDED_SHELL_CLASS } from './tables';

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

const buildScheduleTotals = (schedule: AmortizationRow[]) => {
  if (!schedule.length) {
    return null;
  }

  return schedule.reduce((totals, row, index, rows) => ({
    scheduledPayment: totals.scheduledPayment + Number(row.scheduledPayment || 0),
    interestComponent: totals.interestComponent + Number(row.interestComponent || 0),
    principalComponent: totals.principalComponent + Number(row.principalComponent || 0),
    closingBalance: index === rows.length - 1
      ? Number(row.remainingBalance || 0)
      : totals.closingBalance,
  }), {
    scheduledPayment: 0,
    interestComponent: 0,
    principalComponent: 0,
    closingBalance: 0,
  });
};

export type CreditSimulationScheduleTableProps = {
  schedule: AmortizationRow[];
  startDate?: string;
  amount?: number;
  isSimulating?: boolean;
  emptyDescription?: string;
  showStartRow?: boolean;
  showStatusColumn?: boolean;
  showTotalsFooter?: boolean;
  embeddedInSurface?: boolean;
  minWidthClassName?: string;
  className?: string;
  surfaceClassName?: string;
};

export function CreditSimulationScheduleTable({
  schedule,
  startDate = '',
  amount = 0,
  isSimulating = false,
  emptyDescription,
  showStartRow = true,
  showStatusColumn = true,
  showTotalsFooter = false,
  embeddedInSurface = false,
  minWidthClassName = 'min-w-[880px]',
  className = '',
  surfaceClassName = '',
}: CreditSimulationScheduleTableProps) {
  const resolvedEmptyDescription = emptyDescription ?? tTerm('simulator.empty.pendingScheduleDescription');
  const embeddedShellClass = embeddedInSurface ? TABLE_EMBEDDED_SHELL_CLASS : '';
  const columnCount = showStatusColumn ? 7 : 6;
  const scheduleTotals = useMemo(
    () => (showTotalsFooter ? buildScheduleTotals(schedule) : null),
    [schedule, showTotalsFooter],
  );

  return (
    <AppTable
      variant="financial"
      visibleFrom="always"
      horizontalScroll
      embeddedInSurface={embeddedInSurface}
      minWidthClassName={minWidthClassName}
      className={[embeddedShellClass, className].filter(Boolean).join(' ')}
      surfaceClassName={[embeddedShellClass, surfaceClassName].filter(Boolean).join(' ')}
    >
      <colgroup>
        {showStatusColumn ? (
          <>
            <col style={{ width: '6%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '22%' }} />
          </>
        ) : (
          <>
            <col style={{ width: '7%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '17%' }} />
          </>
        )}
      </colgroup>
      <thead>
        <tr>
          <th className="text-center">{tTerm('simulator.schedule.header.number')}</th>
          <th>{tTerm('schedule.table.header.dueDate')}</th>
          <th className="text-right">{tTerm('simulator.schedule.header.payment')}</th>
          <th className="text-right">{tTerm('simulator.schedule.header.interest')}</th>
          <th className="text-right">{tTerm('simulator.schedule.header.principal')}</th>
          <th className="text-right">{tTerm('simulator.schedule.header.balance')}</th>
          {showStatusColumn ? (
            <th className="text-center">{tTerm('schedule.table.header.status')}</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {showStartRow ? (
          <tr className="bg-hover-bg/40">
            <td className="text-center font-medium text-text-secondary">0</td>
            <td className="text-text-secondary">{formatDate(startDate)}</td>
            <td className="text-right text-text-secondary">-</td>
            <td className="text-right text-text-secondary">-</td>
            <td className="text-right text-text-secondary">-</td>
            <td className="text-right font-semibold text-text-primary">{formatCurrency(amount)}</td>
            {showStatusColumn ? (
              <td className="text-center text-text-secondary">{tTerm('simulator.schedule.row.start')}</td>
            ) : null}
          </tr>
        ) : null}

        {isSimulating ? (
          <tr>
            <td colSpan={columnCount} className="table-empty-state">
              <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-4 py-2 text-sm text-text-secondary">
                <Loader2 size={16} className="animate-spin" />
                {tTerm('simulator.schedule.loading')}
              </div>
            </td>
          </tr>
        ) : schedule.length > 0 ? (
          schedule.map((row) => (
            <tr key={row.installmentNumber} className="hover:bg-hover-bg/60">
              <td className="text-center font-medium text-text-secondary">{row.installmentNumber}</td>
              <td className="text-text-secondary">{formatDate(row.dueDate)}</td>
              <td className="text-right font-medium text-blue-900 dark:text-blue-200">{formatCurrency(row.scheduledPayment)}</td>
              <td className="text-right text-amber-900 dark:text-amber-200">{formatCurrency(row.interestComponent)}</td>
              <td className="text-right text-emerald-900 dark:text-emerald-200">{formatCurrency(row.principalComponent)}</td>
              <td className="text-right font-medium text-text-primary">{formatCurrency(row.remainingBalance)}</td>
              {showStatusColumn ? (
                <td className="text-center">
                  <span className="rounded-full border border-border-subtle bg-bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                    {formatScheduleStatusLabel(row.status)}
                  </span>
                </td>
              ) : null}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columnCount} className="table-empty-state">
              {resolvedEmptyDescription}
            </td>
          </tr>
        )}
      </tbody>
      {scheduleTotals ? (
        <tfoot>
          <tr className="border-t border-border-subtle bg-bg-base/70 dark:bg-bg-surface/70">
            <td className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              {tTerm('newCredit.schedule.totals')}
            </td>
            <td />
            <td className="text-right font-bold text-text-primary">
              {formatCurrency(scheduleTotals.scheduledPayment)}
            </td>
            <td className="text-right font-bold text-text-secondary">
              {formatCurrency(scheduleTotals.interestComponent)}
            </td>
            <td className="text-right font-bold text-text-primary">
              {formatCurrency(scheduleTotals.principalComponent)}
            </td>
            <td className="text-right font-bold text-brand-primary text-base">
              {formatCurrency(scheduleTotals.closingBalance)}
            </td>
            {showStatusColumn ? <td /> : null}
          </tr>
        </tfoot>
      ) : null}
    </AppTable>
  );
}
