import { Activity, Bell, Clock, CreditCard, DollarSign, Edit2, FileText } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { resolveOperationalGuard } from '../../services/operationalGuards';
import { ActionButton } from '../shared/Surfaces';
import { TabEmptyState } from './CreditDetailsTabs';
import { extractPaymentId, formatOperationalStatus, stableCreditKey } from './creditDetailsHelpers';

type HistoryTabProps = {
  operationalHistoryEntries: any[];
  isLoadingHistory: boolean;
  isBackofficeUser: boolean;
  loanStatus: string;
  userRole: string | undefined;
  userPermissions: any;
  formatDate: (value: unknown, withTime?: boolean) => string;
  onDownloadVoucher: (paymentId: number) => void;
  onOpenEditPaymentMethod: (entry: any) => void;
};

export function HistoryTab({
  operationalHistoryEntries,
  isLoadingHistory,
  isBackofficeUser,
  loanStatus,
  userRole,
  userPermissions,
  formatDate,
  onDownloadVoucher,
  onOpenEditPaymentMethod,
}: HistoryTabProps) {
  if (isLoadingHistory) {
    return <p className="text-text-secondary">{tTerm('creditDetails.history.loading')}</p>;
  }

  if (operationalHistoryEntries.length === 0) {
    return (
      <TabEmptyState
        icon={Activity}
        title={tTerm('creditDetails.history.empty.title')}
        description={tTerm('creditDetails.history.empty.description')}
      />
    );
  }

  return (
    <div className="space-y-3">
      {operationalHistoryEntries.map((event: any) => {
        const paymentId = extractPaymentId(event.id);
        const isPayment = event.type === 'payment';
        const isAlert = event.type === 'alert';
        const isPromise = event.type === 'promise';

        return (
          <div key={stableCreditKey('history', event.id, event.type, event.date, event.createdAt, event.action)} className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
            <div className="flex gap-4">
              <span className={`mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full ${
                isPayment ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' :
                isAlert ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' :
                isPromise ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300' :
                'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300'
              }`}>
                {isPayment ? <DollarSign size={16} /> : isAlert ? <Bell size={16} /> : isPromise ? <Clock size={16} /> : <CreditCard size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-text-primary">{event.action}</p>
                      {event.status && (
                        <span className="inline-flex rounded-full bg-hover-bg px-2.5 py-1 text-xs font-semibold text-text-secondary">
                          {formatOperationalStatus(event.status)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-text-secondary whitespace-pre-wrap">{event.description}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-text-secondary">
                      <Clock size={12} /> {formatDate(event.date, true)}
                    </p>
                  </div>
                  {paymentId && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <ActionButton
                        onClick={() => onDownloadVoucher(paymentId)}
                        className="!min-h-0 !px-3 !py-1.5"
                        icon={<FileText size={16} />}
                      >
                        {tTerm('payouts.action.downloadVoucher')}
                      </ActionButton>
                      {(() => {
                        const editGuard = resolveOperationalGuard('installment.editPaymentMethod', {
                          role: userRole,
                          permissions: userPermissions,
                          loanStatus,
                          paymentStatus: event.paymentStatus,
                          paymentReconciled: Boolean(event.paymentReconciled),
                        });
                        if (!isBackofficeUser || !editGuard.visible) return null;
                        return (
                          <ActionButton
                            onClick={() => onOpenEditPaymentMethod(event)}
                            disabled={!editGuard.executable}
                            className="!min-h-0 !px-3 !py-1.5"
                            icon={<Edit2 size={16} />}
                            title={editGuard.executable ? tTerm('payouts.action.editPaymentMethod') : (editGuard.reason || tTerm('credits.action.unavailable'))}
                          >
                            Método
                          </ActionButton>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
