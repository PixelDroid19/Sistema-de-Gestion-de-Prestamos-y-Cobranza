import { useMemo } from 'react';
import { tTerm } from '../../i18n/terminology';
import { DataTableSurface } from '../shared/Surfaces';
import {
  AppTable,
  FINANCIAL_SCHEDULE_TABLE_CLASS,
  TableSectionIntro,
  TABLE_EMBEDDED_SHELL_CLASS,
} from '../shared/tables';

type InstallmentCompositionTableProps = {
  installmentRows: any[];
  formatCurrency: (value: unknown) => string;
  aside?: React.ReactNode;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const COLUMN_WIDTHS = ['6%', '17%', '17%', '17%', '28%', '15%'] as const;

/**
 * Composition table for the credit calendar: shows how each installment splits
 * between principal and interest, with an inline proportion bar and a totals
 * footer. Replaces the previous line/area chart with a scalable, readable table.
 */
export function InstallmentCompositionTable({
  installmentRows,
  formatCurrency,
  aside,
}: InstallmentCompositionTableProps) {
  const rows = useMemo(() => installmentRows.map((row: any) => {
    const capital = Math.max(0, toNumber(row.principalComponent));
    const interest = Math.max(0, toNumber(row.interestComponent));
    const total = capital + interest;
    const capitalShare = total > 0 ? (capital / total) * 100 : 0;
    return {
      key: row.installmentNumber ?? `${row.dueDate}`,
      installmentNumber: row.installmentNumber,
      scheduledPayment: toNumber(row.scheduledPayment) || total,
      capital,
      interest,
      capitalShare,
      interestShare: 100 - capitalShare,
      closingBalance: toNumber(row.closingBalance),
    };
  }), [installmentRows]);

  const totals = useMemo(() => {
    const acc = rows.reduce((sum, row) => {
      sum.scheduledPayment += row.scheduledPayment;
      sum.capital += row.capital;
      sum.interest += row.interest;
      return sum;
    }, { scheduledPayment: 0, capital: 0, interest: 0 });
    const totalSplit = acc.capital + acc.interest;
    return {
      ...acc,
      capitalShare: totalSplit > 0 ? (acc.capital / totalSplit) * 100 : 0,
    };
  }, [rows]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <DataTableSurface className="hidden md:block">
      <TableSectionIntro
        embedded
        compact
        title={tTerm('creditDetails.calendar.chart.title')}
        description={tTerm('creditDetails.calendar.chart.subtitle')}
        aside={aside}
      />
      <AppTable
        variant="financial"
        financialLayout="schedule"
        visibleFrom="always"
        embeddedInSurface
        className={TABLE_EMBEDDED_SHELL_CLASS}
        surfaceClassName={TABLE_EMBEDDED_SHELL_CLASS}
        tableClassName={FINANCIAL_SCHEDULE_TABLE_CLASS}
        horizontalScroll
        minWidthClassName="min-w-[680px]"
      >
        <colgroup>
          {COLUMN_WIDTHS.map((width, index) => (
            <col key={`${width}-${index}`} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="text-center">{tTerm('creditDetails.calendar.table.number')}</th>
            <th className="text-right">{tTerm('creditDetails.label.installment')}</th>
            <th className="text-right">{tTerm('creditDetails.calendar.chart.capital')}</th>
            <th className="text-right">{tTerm('creditDetails.calendar.chart.interest')}</th>
            <th>{tTerm('creditDetails.calendar.composition.share')}</th>
            <th className="text-right">{tTerm('creditDetails.calendar.chart.balance')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="group">
              <td className="text-center font-medium text-text-secondary">{row.installmentNumber}</td>
              <td className="text-right font-medium text-text-primary">{formatCurrency(row.scheduledPayment)}</td>
              <td className="text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(row.capital)}</td>
              <td className="text-right text-blue-600 dark:text-blue-400">{formatCurrency(row.interest)}</td>
              <td>
                <div
                  className="composition-bar"
                  role="img"
                  aria-label={tTerm('creditDetails.calendar.composition.aria')}
                >
                  <span
                    className="composition-bar__segment composition-bar__segment--capital"
                    style={{ width: `${row.capitalShare}%` }}
                  />
                  <span
                    className="composition-bar__segment composition-bar__segment--interest"
                    style={{ width: `${row.interestShare}%` }}
                  />
                </div>
              </td>
              <td className="text-right font-medium text-text-primary">{formatCurrency(row.closingBalance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
              {tTerm('creditDetails.calendar.total')}
            </td>
            <td className="text-right font-bold text-text-primary">{formatCurrency(totals.scheduledPayment)}</td>
            <td className="text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.capital)}</td>
            <td className="text-right font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totals.interest)}</td>
            <td>
              <div className="composition-bar composition-bar--legend" aria-hidden="true">
                <span className="composition-bar__chip composition-bar__chip--capital">
                  {tTerm('creditDetails.calendar.chart.capital')}
                </span>
                <span className="composition-bar__chip composition-bar__chip--interest">
                  {tTerm('creditDetails.calendar.chart.interest')}
                </span>
              </div>
            </td>
            <td className="text-right text-text-secondary">—</td>
          </tr>
        </tfoot>
      </AppTable>
    </DataTableSurface>
  );
}
