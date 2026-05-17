import type { ReactNode } from 'react';
import { Calendar } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
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
  renderInstallmentActions: (row: any, options?: { alignClassName?: string; titlePrefix?: string }) => ReactNode;
};

export function CalendarTab({
  installmentRows,
  installmentColumnTotals,
  loanAmount,
  showInstallmentActionColumn,
  nextPayableInstallmentNumber,
  calendarSnapshot,
  formatCurrency,
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

  return (
    <div className="space-y-4">
      <div className="border-b border-border-subtle pb-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-base font-semibold text-text-primary">{tTerm('creditDetails.calendar.title')}</p>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Opera primero la próxima cuota pendiente. El sistema bloquea pagos y anulaciones fuera de secuencia para no romper la cartera.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="inline-flex items-center gap-2 rounded-full bg-hover-bg px-3 py-2 text-text-secondary">
              Próxima cuota operable: {nextPayableInstallmentNumber ?? 'Sin pendientes'}
            </span>
            {calendarSnapshot && (
              <span className="inline-flex items-center gap-2 rounded-full bg-hover-bg px-3 py-2 text-text-secondary">
                Balance pendiente: {formatCurrency(calendarSnapshot.outstandingBalance)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-4 lg:hidden">
        {installmentRows.map((row: any) => {
          const statusInfo = getInstallmentStatusInfo(row.status);
          return (
            <div key={getInstallmentRowKey(row)} className="rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">{tTerm('creditDetails.calendar.installment', { number: row.installmentNumber })}</p>
                  <p className="mt-2 text-xl font-bold text-text-primary">{formatCurrency(row.scheduledPayment)}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('creditDetails.label.interest')}</dt>
                  <dd className="mt-1 text-sm font-medium text-text-primary">{formatCurrency(row.interestComponent)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('creditDetails.label.lateFee')}</dt>
                  <dd className="mt-1 text-sm font-medium text-rose-600 dark:text-rose-300">{row.lateFeeDue ? formatCurrency(row.lateFeeDue) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Amortización</dt>
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

      {/* Desktop table */}
      <div className="data-table-surface hidden overflow-x-auto lg:block">
        <table className="credit-installment-calendar-table min-w-0 w-full table-fixed text-sm text-left whitespace-nowrap">
          <colgroup>
            {showInstallmentActionColumn ? (
              <>
                <col style={{ width: '5%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '21%' }} />
              </>
            ) : (
              <>
                <col style={{ width: '6%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
              </>
            )}
          </colgroup>
          <thead>
            <tr>
              <th className="text-center">N°</th>
              <th className="text-right">{tTerm('creditDetails.label.installment')}</th>
              <th className="text-right">{tTerm('creditDetails.label.interest')}</th>
              <th className="text-right">{tTerm('creditDetails.label.lateFee')}</th>
              <th className="text-right">Amortización</th>
              <th className="text-right">{tTerm('creditDetails.label.remainingPrincipal')}</th>
              <th className="text-center">Estado</th>
              {showInstallmentActionColumn && <th className="text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-center text-text-secondary font-medium">0</td>
              <td className="text-right text-text-secondary">—</td>
              <td className="text-right text-text-secondary">—</td>
              <td className="text-right text-text-secondary">—</td>
              <td className="text-right text-text-secondary">—</td>
              <td className="text-right font-bold text-text-primary">{formatCurrency(loanAmount)}</td>
              <td></td>
              {showInstallmentActionColumn && <td></td>}
            </tr>
            {installmentRows.map((row: any, idx: number) => {
              const statusInfo = getInstallmentStatusInfo(row.status);
              return (
                <tr key={getInstallmentRowKey(row)} data-tour={idx === 0 ? 'credit-detail-installment-row' : undefined} className="group">
                  <td className="text-center font-medium text-text-secondary">{row.installmentNumber}</td>
                  <td className="text-right font-medium text-text-primary">{formatCurrency(row.scheduledPayment)}</td>
                  <td className="text-right text-text-secondary">{formatCurrency(row.interestComponent)}</td>
                  <td className="text-right text-red-600 dark:text-red-400">{row.lateFeeDue ? formatCurrency(row.lateFeeDue) : '—'}</td>
                  <td className="text-right text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(row.principalComponent)}</td>
                  <td className="text-right font-medium text-text-primary">{formatCurrency(row.closingBalance)}</td>
                  <td className="text-center">
                    <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  </td>
                  {showInstallmentActionColumn && (
                    <td className="text-right">{renderInstallmentActions(row)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-subtle bg-bg-base/70 dark:bg-bg-surface/70">
              <td className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Total</td>
              <td className="text-right font-bold text-text-primary">{formatCurrency(installmentColumnTotals.scheduledPayment)}</td>
              <td className="text-right font-bold text-text-secondary">{formatCurrency(installmentColumnTotals.interestComponent)}</td>
              <td className="text-right font-bold text-red-600 dark:text-red-400">{installmentColumnTotals.lateFeeDue > 0 ? formatCurrency(installmentColumnTotals.lateFeeDue) : '—'}</td>
              <td className="text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(installmentColumnTotals.principalComponent)}</td>
              <td className="text-right font-bold text-brand-primary text-base">{formatCurrency(installmentColumnTotals.outstandingBalance)}</td>
              <td className="text-center text-xs text-text-secondary">—</td>
              {showInstallmentActionColumn && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
