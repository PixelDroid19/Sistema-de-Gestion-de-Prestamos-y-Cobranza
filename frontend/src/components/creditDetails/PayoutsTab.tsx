import { DollarSign, Edit2, FileText } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { getPaymentTypeLabel } from '../../constants/paymentTypes';
import { resolveOperationalGuard } from '../../services/operationalGuards';
import { ActionButton, DataTableSurface } from '../shared/Surfaces';
import { TabEmptyState } from './CreditDetailsTabs';
import { formatOperationalStatus, stableCreditKey } from './creditDetailsHelpers';

type PayoutsTabProps = {
  paymentHistoryEntries: any[];
  formatCurrency: (value: unknown) => string;
  formatDate: (value: unknown, withTime?: boolean) => string;
  formatPaymentMethod: (value: unknown) => string;
  isBackofficeUser: boolean;
  loanStatus?: string;
  userRole?: string;
  userPermissions?: unknown;
  onDownloadVoucher: (paymentId: number) => void;
  onOpenEditPaymentMethod: (entry: any) => void;
};

const paymentTypeBadgeClass = (entry: any) => {
  if (entry.type === 'payoff') {
    return 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300';
  }
  if (entry.paymentType === 'capital') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300';
  }
  if (entry.paymentType === 'partial') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
  }
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
};

const paymentStatusBadgeClass = (entry: any) => {
  if (entry.status === 'completed' || entry.paymentStatus === 'completed') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
  }
  if (entry.status === 'failed' || entry.paymentStatus === 'failed') {
    return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
  }
  return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
};

function PaymentTypeBadge({ entry }: { entry: any }) {
  const label = entry.type === 'payoff'
    ? tTerm('creditDetails.payouts.type.payoff')
    : getPaymentTypeLabel(entry.paymentType);

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${paymentTypeBadgeClass(entry)}`}>
      {label}
    </span>
  );
}

function PaymentStatusBadge({ entry }: { entry: any }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStatusBadgeClass(entry)}`}>
      {formatOperationalStatus(entry.status || entry.paymentStatus || 'pending')}
    </span>
  );
}

function VoucherAction({
  hasVoucher,
  paymentId,
  onDownloadVoucher,
  layout = 'table',
}: {
  hasVoucher: boolean;
  paymentId: number;
  onDownloadVoucher: (paymentId: number) => void;
  layout?: 'table' | 'card';
}) {
  const downloadLabel = tTerm('payouts.action.downloadVoucher');
  const shortLabel = tTerm('creditDetails.payouts.action.voucher');
  const unavailableReason = tTerm('creditDetails.payouts.voucherUnavailable');

  if (!hasVoucher) {
    return (
      <span
        className="inline-flex items-center text-xs font-medium text-text-secondary"
        title={unavailableReason}
      >
        {tTerm('creditDetails.payouts.voucherUnavailableShort')}
      </span>
    );
  }

  return (
    <ActionButton
      type="button"
      variant={layout === 'card' ? 'secondary' : 'ghost'}
      onClick={() => onDownloadVoucher(paymentId)}
      icon={<FileText size={layout === 'card' ? 16 : 14} />}
      className={layout === 'card'
        ? 'w-full sm:w-auto'
        : '!min-h-8 !px-2.5 !py-1 text-xs whitespace-nowrap'}
      title={downloadLabel}
    >
      {layout === 'card' ? downloadLabel : shortLabel}
    </ActionButton>
  );
}

function PaymentRowActions({
  entry,
  hasVoucher,
  paymentId,
  isBackofficeUser,
  loanStatus,
  userRole,
  userPermissions,
  onDownloadVoucher,
  onOpenEditPaymentMethod,
  layout,
}: {
  entry: any;
  hasVoucher: boolean;
  paymentId: number;
  isBackofficeUser: boolean;
  loanStatus?: string;
  userRole?: string;
  userPermissions?: unknown;
  onDownloadVoucher: (paymentId: number) => void;
  onOpenEditPaymentMethod: (entry: any) => void;
  layout: 'table' | 'card';
}) {
  const isPayoff = entry.type === 'payoff';
  const editGuard = !isPayoff
    ? resolveOperationalGuard('installment.editPaymentMethod', {
      role: userRole,
      permissions: userPermissions,
      loanStatus,
      paymentStatus: entry.paymentStatus,
      paymentReconciled: Boolean(entry.paymentReconciled),
    })
    : null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${layout === 'table' ? 'justify-center' : 'sm:justify-end'}`}>
      <VoucherAction
        hasVoucher={hasVoucher && !isPayoff}
        paymentId={paymentId}
        onDownloadVoucher={onDownloadVoucher}
        layout={layout}
      />
      {isBackofficeUser && editGuard?.visible && (
        <ActionButton
          type="button"
          variant={layout === 'card' ? 'ghost' : 'ghost'}
          onClick={() => onOpenEditPaymentMethod(entry)}
          disabled={!editGuard.executable}
          icon={<Edit2 size={layout === 'card' ? 16 : 14} />}
          className={layout === 'card'
            ? '!min-h-9 !px-3 !py-1.5'
            : '!min-h-8 !px-2.5 !py-1 text-xs whitespace-nowrap'}
          title={editGuard.executable
            ? tTerm('payouts.action.editPaymentMethod')
            : (editGuard.reason || tTerm('credits.action.unavailable'))}
        >
          {tTerm('creditDetails.history.editPaymentMethodShort')}
        </ActionButton>
      )}
    </div>
  );
}

export function PayoutsTab({
  paymentHistoryEntries,
  formatCurrency,
  formatDate,
  formatPaymentMethod,
  isBackofficeUser,
  loanStatus,
  userRole,
  userPermissions,
  onDownloadVoucher,
  onOpenEditPaymentMethod,
}: PayoutsTabProps) {
  if (paymentHistoryEntries.length === 0) {
    return (
      <TabEmptyState
        icon={DollarSign}
        title={tTerm('creditDetails.payouts.empty.title')}
        description={tTerm('creditDetails.payouts.empty.description')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-border-subtle pb-4">
        <p className="text-base font-semibold text-text-primary">{tTerm('creditDetails.payouts.title')}</p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
          {tTerm('creditDetails.payouts.description')}
        </p>
      </div>

      <div className="grid gap-4 lg:hidden">
        {paymentHistoryEntries.map((entry: any) => {
          const paymentId = Number(entry.paymentId ?? entry.id);
          const hasVoucher = Number.isFinite(paymentId) && paymentId > 0;

          return (
            <article
              key={stableCreditKey('payment-card', entry.id, entry.date, entry.amount, entry.installmentNumber)}
              className="rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <PaymentTypeBadge entry={entry} />
                    {entry.installmentNumber ? (
                      <span className="text-xs font-medium text-text-secondary">
                        {tTerm('creditDetails.payouts.table.installment')}: {entry.installmentNumber}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xl font-bold text-text-primary">{formatCurrency(entry.amount)}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {formatDate(entry.date || entry.paymentDate)}
                    {' · '}
                    {formatPaymentMethod(entry.paymentMethod)}
                  </p>
                </div>
                <PaymentStatusBadge entry={entry} />
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    {tTerm('creditDetails.payouts.table.capital')}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-300">
                    {entry.principalApplied ? formatCurrency(entry.principalApplied) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    {tTerm('creditDetails.label.interest')}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-300">
                    {entry.interestApplied ? formatCurrency(entry.interestApplied) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    {tTerm('creditDetails.label.lateFee')}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-rose-600 dark:text-rose-300">
                    {entry.penaltyApplied ? formatCurrency(entry.penaltyApplied) : '—'}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-text-secondary">
                  {tTerm('creditDetails.payouts.table.createdBy')}: {entry.createdBy?.name || tTerm('common.notAvailable')}
                </p>
                <PaymentRowActions
                  entry={entry}
                  hasVoucher={hasVoucher}
                  paymentId={paymentId}
                  isBackofficeUser={isBackofficeUser}
                  loanStatus={loanStatus}
                  userRole={userRole}
                  userPermissions={userPermissions}
                  onDownloadVoucher={onDownloadVoucher}
                  onOpenEditPaymentMethod={onOpenEditPaymentMethod}
                  layout="card"
                />
              </div>
            </article>
          );
        })}
      </div>

      <DataTableSurface className="hidden overflow-x-auto lg:block">
        <table className="credit-installment-calendar-table min-w-0 w-full table-fixed text-sm text-left">
          <colgroup>
            <col style={{ width: '9%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>{tTerm('creditDetails.payouts.table.type')}</th>
              <th className="text-center">{tTerm('creditDetails.payouts.table.installment')}</th>
              <th className="text-right">{tTerm('creditDetails.payouts.table.amount')}</th>
              <th className="text-right">{tTerm('creditDetails.payouts.table.capital')}</th>
              <th className="text-right">{tTerm('creditDetails.label.interest')}</th>
              <th className="text-right">{tTerm('creditDetails.label.lateFee')}</th>
              <th>{tTerm('creditDetails.payouts.table.method')}</th>
              <th>{tTerm('creditDetails.payouts.table.createdBy')}</th>
              <th>{tTerm('creditDetails.payouts.table.paymentDate')}</th>
              <th className="text-center">{tTerm('creditDetails.payouts.table.status')}</th>
              <th className="text-center">{tTerm('creditDetails.payouts.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {paymentHistoryEntries.map((entry: any) => {
              const paymentId = Number(entry.paymentId ?? entry.id);
              const hasVoucher = Number.isFinite(paymentId) && paymentId > 0;

              return (
                <tr key={stableCreditKey('payment-row', entry.id, entry.date, entry.amount, entry.installmentNumber)}>
                  <td>
                    <PaymentTypeBadge entry={entry} />
                  </td>
                  <td className="text-center text-text-secondary">{entry.installmentNumber || '—'}</td>
                  <td className="text-right font-semibold text-text-primary">{formatCurrency(entry.amount)}</td>
                  <td className="text-right text-emerald-600 dark:text-emerald-400">
                    {entry.principalApplied ? formatCurrency(entry.principalApplied) : '—'}
                  </td>
                  <td className="text-right text-amber-600 dark:text-amber-400">
                    {entry.interestApplied ? formatCurrency(entry.interestApplied) : '—'}
                  </td>
                  <td className="text-right text-rose-600 dark:text-rose-400">
                    {entry.penaltyApplied ? formatCurrency(entry.penaltyApplied) : '—'}
                  </td>
                  <td className="truncate text-text-secondary" title={formatPaymentMethod(entry.paymentMethod)}>
                    {formatPaymentMethod(entry.paymentMethod)}
                  </td>
                  <td className="truncate text-text-secondary" title={entry.createdBy?.name || tTerm('common.notAvailable')}>
                    {entry.createdBy?.name || tTerm('common.notAvailable')}
                  </td>
                  <td className="text-text-secondary">{formatDate(entry.date || entry.paymentDate)}</td>
                  <td className="text-center">
                    <PaymentStatusBadge entry={entry} />
                  </td>
                  <td className="text-center">
                    <PaymentRowActions
                      entry={entry}
                      hasVoucher={hasVoucher}
                      paymentId={paymentId}
                      isBackofficeUser={isBackofficeUser}
                      loanStatus={loanStatus}
                      userRole={userRole}
                      userPermissions={userPermissions}
                      onDownloadVoucher={onDownloadVoucher}
                      onOpenEditPaymentMethod={onOpenEditPaymentMethod}
                      layout="table"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableSurface>
    </div>
  );
}
