import { Activity, Bell, Clock, CreditCard } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { TableSectionIntro } from '../shared/tables';
import { TabEmptyState } from './CreditDetailsTabs';
import { formatOperationalStatus, stableCreditKey } from './creditDetailsHelpers';

type HistoryTabProps = {
  operationalHistoryEntries: any[];
  isLoadingHistory: boolean;
  formatDate: (value: unknown, withTime?: boolean) => string;
};

export function HistoryTab({
  operationalHistoryEntries,
  isLoadingHistory,
  formatDate,
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
    <div className="space-y-4 max-w-5xl">
      <TableSectionIntro
        title={tTerm('creditDetails.history.title')}
        description={tTerm('creditDetails.history.description')}
      />

      <div className="space-y-3">
        {operationalHistoryEntries.map((event: any) => {
          const isAlert = event.type === 'alert';
          const isPromise = event.type === 'promise';

          return (
            <div key={stableCreditKey('history', event.id, event.type, event.date, event.createdAt, event.action)} className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
              <div className="flex gap-4">
                <span className={`mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full ${
                  isAlert ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' :
                  isPromise ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300'
                }`}>
                  {isAlert ? <Bell size={16} /> : isPromise ? <Clock size={16} /> : <CreditCard size={16} />}
                </span>
                <div className="min-w-0 flex-1">
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
