import { DollarSign, Edit2, FileText } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { getPaymentTypeLabel } from '../../constants/paymentTypes';
import { resolveOperationalGuard } from '../../services/operationalGuards';
import { TabEmptyState } from './CreditDetailsTabs';
import { InstallmentActionButton } from './InstallmentActionButton';
import { formatOperationalStatus, stableCreditKey } from './creditDetailsHelpers';

const paymentActionButtonBase = 'inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-text-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent';

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
    <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${paymentTypeBadgeClass(entry)}`}>
      {label}
    </span>
  );
}

function PaymentStatusBadge({ entry }: { entry: any }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusBadgeClass(entry)}`}>
      {formatOperationalStatus(entry.status || entry.paymentStatus || 'pending')}
    </span>
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
}) {
  const isPayoff = entry.type === 'payoff';
  const downloadLabel = tTerm('payouts.action.downloadVoucher');
  const voucherUnavailable = tTerm('creditDetails.payouts.voucherUnavailable');
  const editGuard = !isPayoff
    ? resolveOperationalGuard('installment.editPaymentMethod', {
      role: userRole,
      permissions: userPermissions,
      loanStatus,
      paymentStatus: entry.paymentStatus,
      paymentReconciled: Boolean(entry.paymentReconciled),
    })
    : null;
  const showVoucher = !isPayoff;
  const showEdit = isBackofficeUser && Boolean(editGuard?.visible);

  if (!showVoucher && !showEdit) {
    return null;
  }

  const editLabel = editGuard?.executable
    ? tTerm('payouts.action.editPaymentMethodTitle')
    : (editGuard?.reason || tTerm('credits.action.unavailable'));

  return (
    <div
      className="credit-installment-actions inline-flex flex-nowrap items-center justify-end gap-1.5"
      role="toolbar"
      aria-label={tTerm('creditDetails.payouts.actions.aria')}
    >
      {showVoucher && (
        <InstallmentActionButton
          label={hasVoucher ? downloadLabel : voucherUnavailable}
          onClick={() => onDownloadVoucher(paymentId)}
          disabled={!hasVoucher}
          className={`${paymentActionButtonBase} hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200`}
        >
          <FileText size={16} />
        </InstallmentActionButton>
      )}
      {showEdit && editGuard && (
        <InstallmentActionButton
          label={editLabel}
          onClick={() => onOpenEditPaymentMethod(entry)}
          disabled={!editGuard.executable}
          className={`${paymentActionButtonBase} hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700 dark:hover:border-slate-500/30 dark:hover:bg-slate-500/10 dark:hover:text-slate-200`}
        >
          <Edit2 size={16} />
        </InstallmentActionButton>
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
                />
              </div>
            </article>
          );
        })}
      </div>

      <div className="data-table-surface hidden overflow-x-auto lg:block">
        <table className="credit-installment-calendar-table min-w-0 w-full table-fixed text-sm text-left whitespace-nowrap">
          <colgroup>
            <col style={{ width: '8%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '17%' }} />
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
              <th className="text-right">{tTerm('creditDetails.payouts.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {paymentHistoryEntries.map((entry: any) => {
              const paymentId = Number(entry.paymentId ?? entry.id);
              const hasVoucher = Number.isFinite(paymentId) && paymentId > 0;

              return (
                <tr key={stableCreditKey('payment-row', entry.id, entry.date, entry.amount, entry.installmentNumber)} className="group">
                  <td>
                    <PaymentTypeBadge entry={entry} />
                  </td>
                  <td className="text-center font-medium text-text-secondary">{entry.installmentNumber || '—'}</td>
                  <td className="text-right font-medium text-text-primary">{formatCurrency(entry.amount)}</td>
                  <td className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                    {entry.principalApplied ? formatCurrency(entry.principalApplied) : '—'}
                  </td>
                  <td className="text-right text-text-secondary">
                    {entry.interestApplied ? formatCurrency(entry.interestApplied) : '—'}
                  </td>
                  <td className="text-right text-red-600 dark:text-red-400">
                    {entry.penaltyApplied ? formatCurrency(entry.penaltyApplied) : '—'}
                  </td>
                  <td className="text-text-secondary">{formatPaymentMethod(entry.paymentMethod)}</td>
                  <td className="text-text-secondary">{entry.createdBy?.name || tTerm('common.notAvailable')}</td>
                  <td className="text-text-secondary">{formatDate(entry.date || entry.paymentDate)}</td>
                  <td className="text-center">
                    <PaymentStatusBadge entry={entry} />
                  </td>
                  <td className="text-right">
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
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
