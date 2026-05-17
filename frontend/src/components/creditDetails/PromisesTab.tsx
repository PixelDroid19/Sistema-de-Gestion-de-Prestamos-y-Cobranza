import { AlertTriangle, Calendar, CheckCircle, ChevronRight, Clock, FileText } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { ActionButton } from '../shared/Surfaces';
import { TabEmptyState } from './CreditDetailsTabs';
import { formatOperationalStatus, stableCreditKey } from './creditDetailsHelpers';

type PromisesTabProps = {
  promiseEntries: any[];
  formatCurrency: (value: unknown) => string;
  formatDate: (value: unknown, withTime?: boolean) => string;
  promiseDate: (promise: any) => any;
  isUpdating: boolean;
  isDownloading: boolean;
  onUpdatePromiseStatus: (promise: any, status: 'pending' | 'kept' | 'broken' | 'cancelled') => void;
  onDownloadPromise: (promise: any) => void;
};

export function PromisesTab({
  promiseEntries,
  formatCurrency,
  formatDate,
  promiseDate,
  isUpdating,
  isDownloading,
  onUpdatePromiseStatus,
  onDownloadPromise,
}: PromisesTabProps) {
  if (promiseEntries.length === 0) {
    return (
      <TabEmptyState
        icon={Clock}
        title={tTerm('creditDetails.promises.empty.title')}
        description={tTerm('creditDetails.promises.empty.description')}
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {promiseEntries.map((promise: any) => {
        const isKept = promise.status === 'kept';
        const isBroken = promise.status === 'broken';
        const isPending = promise.status === 'pending';

        return (
          <div key={stableCreditKey('promise', promise.id, promiseDate(promise), promise.createdAt, promise.amount)} className="p-5 border border-border-subtle rounded-xl bg-bg-surface shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm text-text-secondary mb-1">{tTerm('creditDetails.promises.amountLabel')}</p>
                <p className="text-xl font-medium text-text-primary">{formatCurrency(promise.amount)}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                isKept ? 'bg-emerald-100 text-emerald-700' :
                isBroken ? 'bg-red-100 text-red-700' :
                isPending ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {formatOperationalStatus(promise.status)}
              </span>
            </div>

            <p className="text-sm text-text-secondary flex items-center gap-2 mb-4">
              <Calendar size={16} />
              <span>{tTerm('creditDetails.promises.forDate', { date: formatDate(promiseDate(promise)) })}</span>
            </p>

            {promise.notes && (
              <div className="text-sm text-text-secondary bg-bg-base p-3 rounded-lg mb-4">
                {promise.notes}
              </div>
            )}

            {promise.statusHistory && promise.statusHistory.length > 0 && (
              <details className="group">
                <summary className="text-sm text-brand-primary cursor-pointer hover:underline list-none flex items-center gap-1">
                  <ChevronRight size={14} className="group-open:rotate-90 transition-transform" /> {tTerm('creditDetails.tab.history')}
                </summary>
                <div className="mt-3 pl-4 border-l-2 border-border-subtle space-y-3">
                  {promise.statusHistory.slice().reverse().map((entry: any) => (
                    <div key={stableCreditKey('promise-history', promise.id, entry.id, entry.status, entry.changedAt)} className="text-sm">
                      <span className="text-text-primary">{formatOperationalStatus(entry.status)}</span>
                      <span className="text-text-secondary ml-2">{formatDate(entry.changedAt, true)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {isPending ? (
                <>
                  <ActionButton type="button" onClick={() => onUpdatePromiseStatus(promise, 'kept')} disabled={isUpdating} variant="primary" icon={<CheckCircle size={16} />}>
                    Cumplida
                  </ActionButton>
                  <ActionButton type="button" onClick={() => onUpdatePromiseStatus(promise, 'broken')} disabled={isUpdating} variant="danger" icon={<AlertTriangle size={16} />}>
                    Incumplida
                  </ActionButton>
                  <ActionButton type="button" onClick={() => onUpdatePromiseStatus(promise, 'cancelled')} disabled={isUpdating} variant="ghost">
                    Cancelar
                  </ActionButton>
                </>
              ) : (
                <ActionButton type="button" onClick={() => onUpdatePromiseStatus(promise, 'pending')} disabled={isUpdating} icon={<Clock size={16} />}>
                  Reabrir
                </ActionButton>
              )}
              <ActionButton type="button" onClick={() => onDownloadPromise(promise)} disabled={isDownloading} icon={<FileText size={16} />}>
                Descargar
              </ActionButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}
