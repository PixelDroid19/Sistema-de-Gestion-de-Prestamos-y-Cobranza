import { DollarSign, FileText } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { getPaymentTypeLabel } from '../../constants/paymentTypes';
import { ActionButton } from '../shared/Surfaces';
import { TabEmptyState } from './CreditDetailsTabs';
import { formatOperationalStatus, stableCreditKey } from './creditDetailsHelpers';

type PayoutsTabProps = {
  paymentHistoryEntries: any[];
  formatCurrency: (value: unknown) => string;
  formatDate: (value: unknown, withTime?: boolean) => string;
  formatPaymentMethod: (value: unknown) => string;
  onDownloadVoucher: (paymentId: number) => void;
};

export function PayoutsTab({
  paymentHistoryEntries,
  formatCurrency,
  formatDate,
  formatPaymentMethod,
  onDownloadVoucher,
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-base border-b border-border-subtle">
          <tr>
            <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">{tTerm('creditDetails.payouts.table.type')}</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">{tTerm('creditDetails.payouts.table.installment')}</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">{tTerm('creditDetails.payouts.table.amount')}</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">{tTerm('creditDetails.payouts.table.capital')}</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">{tTerm('creditDetails.label.interest')}</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">{tTerm('creditDetails.label.lateFee')}</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">{tTerm('creditDetails.payouts.table.method')}</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">{tTerm('creditDetails.payouts.table.createdBy')}</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">{tTerm('creditDetails.payouts.table.paymentDate')}</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">{tTerm('creditDetails.payouts.table.status')}</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">{tTerm('creditDetails.payouts.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {paymentHistoryEntries.map((entry: any) => {
            const paymentId = Number(entry.paymentId ?? entry.id);
            const hasVoucher = Number.isFinite(paymentId) && paymentId > 0;

            return (
              <tr key={stableCreditKey('payment-row', entry.id, entry.date, entry.amount, entry.installmentNumber)} className="border-b border-border-subtle hover:bg-hover-bg">
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    entry.type === 'payoff' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' :
                    entry.paymentType === 'capital' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' :
                    entry.paymentType === 'partial' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                    'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {entry.type === 'payoff' ? tTerm('creditDetails.payouts.type.payoff') : getPaymentTypeLabel(entry.paymentType)}
                  </span>
                </td>
                <td className="py-3 px-4 text-text-secondary">{entry.installmentNumber || '—'}</td>
                <td className="py-3 px-4 text-right font-medium text-text-primary">{formatCurrency(entry.amount)}</td>
                <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">{entry.principalApplied ? formatCurrency(entry.principalApplied) : '—'}</td>
                <td className="py-3 px-4 text-right text-amber-600 dark:text-amber-400">{entry.interestApplied ? formatCurrency(entry.interestApplied) : '—'}</td>
                <td className="py-3 px-4 text-right text-red-600 dark:text-red-400">{entry.penaltyApplied ? formatCurrency(entry.penaltyApplied) : '—'}</td>
                <td className="py-3 px-4 text-text-secondary">{formatPaymentMethod(entry.paymentMethod)}</td>
                <td className="py-3 px-4 text-text-secondary">{entry.createdBy?.name || tTerm('common.notAvailable')}</td>
                <td className="py-3 px-4 text-text-secondary">{formatDate(entry.date || entry.paymentDate)}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    entry.status === 'completed' || entry.paymentStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    entry.status === 'failed' || entry.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {formatOperationalStatus(entry.status || entry.paymentStatus || 'pending')}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <ActionButton
                    onClick={() => onDownloadVoucher(paymentId)}
                    disabled={!hasVoucher}
                    disabledReason={hasVoucher ? undefined : tTerm('creditDetails.payouts.voucherUnavailable')}
                    className="!min-h-0 !px-3 !py-1.5"
                    icon={<FileText size={16} />}
                  >
                    {tTerm('payouts.action.downloadVoucher')}
                  </ActionButton>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
