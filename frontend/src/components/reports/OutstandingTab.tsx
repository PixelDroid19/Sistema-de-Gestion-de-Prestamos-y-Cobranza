import type { ReactNode } from 'react';
import { formatCurrency as formatCurrencyValue, formatNumber as formatNumberValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { ReportDataTableSection } from './ReportDataTableSection';

const formatMoney = (value: unknown) => formatCurrencyValue(value);
const formatNumber = (value: unknown) => formatNumberValue(value, { maximumFractionDigits: 0 });
const buildCompactSummary = (items: Array<{ label: string; value: string }>) => (
  items.map((item) => `${item.label}: ${item.value}`).join(' · ')
);

const toAmountNumber = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const getOutstandingCustomerLabel = (item: Record<string, unknown>) => {
  if (typeof item.customerName === 'string' && item.customerName.trim()) {
    return item.customerName.trim();
  }

  const customerId = Number(item.customerId);
  if (Number.isFinite(customerId) && customerId > 0) {
    return tTerm('reports.outstanding.customerFallback', { id: String(customerId) });
  }

  const loanId = Number(item.loanId);
  if (Number.isFinite(loanId) && loanId > 0) {
    return tTerm('reports.outstanding.loanFallback', { id: String(loanId) });
  }

  return tTerm('common.notAvailable');
};

type OutstandingTabProps = {
  overdueLoans: Array<Record<string, unknown>>;
  isLoading: boolean;
  isError: boolean;
  exportActions?: ReactNode;
};

export default function OutstandingTab({
  overdueLoans,
  isLoading,
  isError,
  exportActions,
}: OutstandingTabProps) {
  const summary = overdueLoans.reduce<{
    totalCount: number;
    overdueCount: number;
    totalOverdueAmount: number;
    totalRemainingCapital: number;
    maxDaysOverdue: number;
  }>((acc, item) => {
    const daysOverdue = toAmountNumber(item.daysOverdue);
    acc.totalCount += 1;
    if (daysOverdue > 0) {
      acc.overdueCount += 1;
    }
    acc.totalOverdueAmount += toAmountNumber(item.overdueAmount);
    acc.totalRemainingCapital += toAmountNumber(item.remainingCapital);
    acc.maxDaysOverdue = Math.max(acc.maxDaysOverdue, daysOverdue);
    return acc;
  }, {
    totalCount: 0,
    overdueCount: 0,
    totalOverdueAmount: 0,
    totalRemainingCapital: 0,
    maxDaysOverdue: 0,
  });

  const hasActualOverdue = summary.overdueCount > 0 || summary.maxDaysOverdue > 0;
  const countLabel = hasActualOverdue
    ? tTerm('reports.outstanding.summary.count.label')
    : tTerm('reports.outstanding.summary.count.currentLabel');
  const countHelper = hasActualOverdue
    ? tTerm('reports.outstanding.summary.count.helper')
    : tTerm('reports.outstanding.summary.count.currentHelper');
  const amountLabel = hasActualOverdue
    ? tTerm('reports.outstanding.summary.amount.label')
    : tTerm('reports.outstanding.summary.amount.currentLabel');
  const amountHelper = hasActualOverdue
    ? tTerm('reports.outstanding.summary.amount.helper')
    : tTerm('reports.outstanding.summary.amount.currentHelper');
  const maxDaysHelper = hasActualOverdue
    ? tTerm('reports.outstanding.summary.maxDays.helper')
    : tTerm('reports.outstanding.summary.maxDays.currentHelper');
  const subtitle = hasActualOverdue
    ? tTerm('reports.outstanding.subtitle')
    : tTerm('reports.outstanding.subtitleCurrent');
  const compactSummary = !isLoading && !isError && overdueLoans.length > 0
    ? buildCompactSummary([
      {
        label: countLabel,
        value: formatNumber(hasActualOverdue ? summary.overdueCount : summary.totalCount),
      },
      {
        label: tTerm('reports.outstanding.summary.maxDays.label'),
        value: formatNumber(summary.maxDaysOverdue),
      },
      {
        label: amountLabel,
        value: formatMoney(summary.totalOverdueAmount),
      },
      {
        label: tTerm('reports.outstanding.summary.remainingCapital.label'),
        value: formatMoney(summary.totalRemainingCapital),
      },
    ])
    : '';
  const daysColumnLabel = hasActualOverdue
    ? tTerm('reports.outstanding.daysOverdue')
    : tTerm('reports.outstanding.daysStatus');
  const amountColumnLabel = hasActualOverdue
    ? tTerm('reports.outstanding.amount')
    : tTerm('reports.outstanding.balance');

  return (
    <div className="report-tab-layout">
      <ReportDataTableSection
        title={tTerm('reports.outstanding.title')}
        subtitle={compactSummary ? `${subtitle} · ${compactSummary}` : subtitle}
        aside={exportActions}
        isLoading={isLoading}
        isError={isError}
        hasData={overdueLoans.length > 0}
        loadingContent={<div className="table-empty-state">{tTerm('reports.state.loading')}</div>}
        errorContent={<div className="table-empty-state">{tTerm('reports.state.partialError')}</div>}
        emptyContent={<div className="table-empty-state">{tTerm('reports.outstanding.empty')}</div>}
        recordsLabel={tTerm('reports.outstanding.recordsLabel')}
        minWidthClassName="min-w-[760px]"
      >
        <thead>
          <tr>
            <th>{tTerm('reports.outstanding.customer')}</th>
            <th>{daysColumnLabel}</th>
            <th>{amountColumnLabel}</th>
            <th>{tTerm('reports.outstanding.remainingCapital')}</th>
          </tr>
        </thead>
        <tbody>
          {overdueLoans.map((item: any, index: number) => {
            const isOverdue = toAmountNumber(item.daysOverdue) > 0;

            return (
              <tr key={`outstanding-${item.loanId ?? item.customerId ?? 'row'}-${index}`}>
              <td>
                <div className="report-record-stack">
                  <p className="report-record-stack__title">
                    {getOutstandingCustomerLabel(item)}
                  </p>
                  {item.loanId ? (
                    <p className="report-record-stack__meta">
                      {tTerm('reports.payouts.table.loanReference', { id: String(item.loanId) })}
                    </p>
                  ) : null}
                </div>
              </td>
              <td className={`font-medium ${isOverdue ? 'text-amber-600' : 'text-emerald-700'}`}>
                {isOverdue
                  ? tTerm('credits.agenda.daysOverdue', { count: item.daysOverdue })
                  : tTerm('reports.outstanding.daysCurrent')}
              </td>
              <td className={`font-bold ${isOverdue ? 'text-amber-600' : 'text-text-primary'}`}>
                {formatMoney(item.overdueAmount)}
              </td>
              <td>{formatMoney(item.remainingCapital)}</td>
              </tr>
            );
          })}
        </tbody>
      </ReportDataTableSection>
    </div>
  );
}
