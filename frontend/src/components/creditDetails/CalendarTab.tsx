import type { ReactNode } from 'react';
import { Calendar } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import {
  AppTable,
  CREDIT_CALENDAR_COLUMN_WIDTHS,
  CREDIT_INSTALLMENT_CALENDAR_TABLE_CLASS,
  renderFinancialScheduleColgroup,
  TableActionsCell,
  TableActionsHeader,
  TableSectionIntro,
  TableStatusPill,
  TABLE_EMBEDDED_SHELL_CLASS,
} from '../shared/tables';
import { TabEmptyState } from './CreditDetailsTabs';
import { getInstallmentRowKey, getInstallmentStatusInfo } from './creditDetailsHelpers';

type CalendarTabProps = {
  installmentRows: any[];
  installmentColumnTotals: any;
  loanAmount: number;
  showInstallmentActionColumn: boolean;
  nextPayableInstallmentNumber: number | null;
  calendarSnapshot: any;
  formatCurrency: (value: unknown) => string;
  formatDate: (value: unknown, withTime?: boolean) => string;
  renderInstallmentActions: (row: any, options?: { alignClassName?: string; titlePrefix?: string; compact?: boolean }) => ReactNode;
};

export function CalendarTab({
  installmentRows,
  installmentColumnTotals,
  loanAmount,
  showInstallmentActionColumn,
  nextPayableInstallmentNumber,
  calendarSnapshot,
  formatCurrency,
  formatDate,
  renderInstallmentActions,
}: CalendarTabProps) {
  if (installmentRows.length === 0) {
    return (
      <TabEmptyState
        icon={Calendar}
        title={tTerm('creditDetails.calendar.empty.title')}
        description={tTerm('creditDetails.calendar.empty.description')}
      />
    );
  }

  const calendarAside = (
    <>
      <span className="credit-detail-chip">
        {tTerm('creditDetails.calendar.nextPayable', {
          number: nextPayableInstallmentNumber ?? tTerm('creditDetails.calendar.noPending'),
        })}
      </span>
      {calendarSnapshot ? (
        <span className="credit-detail-chip credit-detail-chip--emphasis">
          {tTerm('creditDetails.calendar.outstandingBalance', {
            amount: formatCurrency(calendarSnapshot.outstandingBalance),
          })}
        </span>
      ) : null}
    </>
  );

  return (
    <div className="credit-detail-tab-panel space-y-4">
      <div className="md:hidden">
        <TableSectionIntro
          compact
          title={tTerm('creditDetails.calendar.title')}
          description={tTerm('creditDetails.calendar.description')}
          aside={calendarAside}
        />
      </div>

      <div className="grid gap-4 md:hidden">
        {installmentRows.map((row: any) => {
          const statusInfo = getInstallmentStatusInfo(row.status);
          return (
            <div key={getInstallmentRowKey(row)} className="credit-detail-mobile-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">{tTerm('creditDetails.calendar.installment', { number: row.installmentNumber })}</p>
                  <p className="mt-2 text-xl font-bold text-text-primary">{formatCurrency(row.scheduledPayment)}</p>
                </div>
                <TableStatusPill className={statusInfo.className}>{statusInfo.label}</TableStatusPill>
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('schedule.table.header.dueDate')}</dt>
                  <dd className="mt-1 text-sm font-medium text-text-primary">{formatDate(row.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('creditDetails.label.interest')}</dt>
                  <dd className="mt-1 text-sm font-medium text-text-primary">{formatCurrency(row.interestComponent)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('creditDetails.label.lateFee')}</dt>
                  <dd className="mt-1 text-sm font-medium text-rose-600 dark:text-rose-300">{row.lateFeeDue ? formatCurrency(row.lateFeeDue) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('credits.modal.amortizedPrincipal')}</dt>
                  <dd className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-300">{formatCurrency(row.principalComponent)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('creditDetails.label.remainingPrincipal')}</dt>
                  <dd className="mt-1 text-sm font-medium text-text-primary">{formatCurrency(row.closingBalance)}</dd>
                </div>
              </dl>
              {showInstallmentActionColumn && (
                <div className="mt-4 border-t border-border-subtle pt-3">
                  {renderInstallmentActions(row, { alignClassName: 'justify-start', titlePrefix: 'Tarjeta · ' })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="data-table-surface hidden md:block scroll-mt-3">
        <TableSectionIntro
          embedded
          compact
          title={tTerm('creditDetails.calendar.title')}
          description={tTerm('creditDetails.calendar.description')}
          aside={calendarAside}
        />
        <AppTable
          variant="financial"
          financialLayout="credit-calendar"
          visibleFrom="always"
          embeddedInSurface
          className={TABLE_EMBEDDED_SHELL_CLASS}
          surfaceClassName={TABLE_EMBEDDED_SHELL_CLASS}
          horizontalScroll={showInstallmentActionColumn}
          minWidthClassName="min-w-[920px]"
          tableClassName={CREDIT_INSTALLMENT_CALENDAR_TABLE_CLASS}
          data-tour="credit-detail-calendar-table"
        >
        {renderFinancialScheduleColgroup(
          showInstallmentActionColumn
            ? CREDIT_CALENDAR_COLUMN_WIDTHS.withActions
            : CREDIT_CALENDAR_COLUMN_WIDTHS.withoutActions,
        )}
        <thead>
          <tr>
            <th className="text-center">{tTerm('creditDetails.calendar.table.number')}</th>
            <th>{tTerm('schedule.table.header.dueDate')}</th>
            <th className="text-right">{tTerm('creditDetails.label.installment')}</th>
            <th className="text-right">{tTerm('creditDetails.label.interest')}</th>
            <th className="text-right">{tTerm('creditDetails.label.lateFee')}</th>
            <th className="text-right">{tTerm('credits.modal.amortizedPrincipal')}</th>
            <th className="text-right">{tTerm('creditDetails.label.remainingPrincipal')}</th>
            <th className="text-center">{tTerm('credits.filter.status')}</th>
            {showInstallmentActionColumn && (
              <TableActionsHeader>{tTerm('credits.table.actions')}</TableActionsHeader>
            )}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="text-center text-text-secondary font-medium">0</td>
            <td className="text-text-secondary">{tTerm('simulator.schedule.row.start')}</td>
            <td className="text-right text-text-secondary">—</td>
            <td className="text-right text-text-secondary">—</td>
            <td className="text-right text-text-secondary">—</td>
            <td className="text-right text-text-secondary">—</td>
            <td className="text-right font-bold text-text-primary">{formatCurrency(loanAmount)}</td>
            <td></td>
            {showInstallmentActionColumn && <TableActionsCell>{null}</TableActionsCell>}
          </tr>
          {installmentRows.map((row: any, idx: number) => {
            const statusInfo = getInstallmentStatusInfo(row.status);
            return (
              <tr key={getInstallmentRowKey(row)} data-tour={idx === 0 ? 'credit-detail-installment-row' : undefined} className="group">
                <td className="text-center font-medium text-text-secondary">{row.installmentNumber}</td>
                <td className="text-text-secondary">{formatDate(row.dueDate)}</td>
                <td className="text-right font-medium text-text-primary">{formatCurrency(row.scheduledPayment)}</td>
                <td className="text-right text-text-secondary">{formatCurrency(row.interestComponent)}</td>
                <td className="text-right text-red-600 dark:text-red-400">{row.lateFeeDue ? formatCurrency(row.lateFeeDue) : '—'}</td>
                <td className="text-right text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(row.principalComponent)}</td>
                <td className="text-right font-medium text-text-primary">{formatCurrency(row.closingBalance)}</td>
                <td className="text-center">
                  <TableStatusPill className={statusInfo.className}>{statusInfo.label}</TableStatusPill>
                </td>
                {showInstallmentActionColumn && (
                  <TableActionsCell>{renderInstallmentActions(row)}</TableActionsCell>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border-subtle bg-bg-base/70 dark:bg-bg-surface/70">
            <td className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('creditDetails.calendar.total')}</td>
            <td></td>
            <td className="text-right font-bold text-text-primary">{formatCurrency(installmentColumnTotals.scheduledPayment)}</td>
            <td className="text-right font-bold text-text-secondary">{formatCurrency(installmentColumnTotals.interestComponent)}</td>
            <td className="text-right font-bold text-red-600 dark:text-red-400">{installmentColumnTotals.lateFeeDue > 0 ? formatCurrency(installmentColumnTotals.lateFeeDue) : '—'}</td>
            <td className="text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(installmentColumnTotals.principalComponent)}</td>
            <td className="text-right font-bold text-brand-primary text-base">{formatCurrency(installmentColumnTotals.closingBalance)}</td>
            <td className="text-center text-xs text-text-secondary">—</td>
            {showInstallmentActionColumn && <TableActionsCell>{null}</TableActionsCell>}
          </tr>
        </tfoot>
        </AppTable>
      </div>
    </div>
  );
}
