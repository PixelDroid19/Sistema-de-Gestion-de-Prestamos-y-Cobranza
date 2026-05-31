import { AlertCircle, Bell, CheckCircle } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { ActionButton } from '../shared/Surfaces';
import { TabEmptyState } from './CreditDetailsTabs';
import { stableCreditKey, type AlertPresentation } from './creditDetailsHelpers';

type AlertsTabProps = {
  alertEntries: any[];
  getAlertPresentation: (alert: any) => AlertPresentation;
  formatDate: (value: unknown, withTime?: boolean) => string;
  isUpdating: boolean;
  onUpdateAlertStatus: (alert: any, status: 'active' | 'resolved') => void;
};

export function AlertsTab({
  alertEntries,
  getAlertPresentation,
  formatDate,
  isUpdating,
  onUpdateAlertStatus,
}: AlertsTabProps) {
  if (alertEntries.length === 0) {
    return (
      <TabEmptyState
        icon={CheckCircle}
        title={tTerm('creditDetails.alerts.empty.title')}
        description={tTerm('creditDetails.alerts.empty.description')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {alertEntries.map((alert: any) => {
        const presentation = getAlertPresentation(alert);
        return (
          <div key={stableCreditKey('alert', alert.id, alert.type, alert.installmentNumber, alert.dueDate, alert.createdAt)} className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex gap-4">
                <span className={`mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full ${presentation.iconClassName}`}>
                  <AlertCircle size={20} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-text-primary">{presentation.typeLabel}</p>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${presentation.statusClassName}`}>
                      {presentation.statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">{presentation.summary}</p>
                  <dl className="mt-3 grid gap-3 text-xs text-text-secondary sm:grid-cols-3">
                    <div>
                      <dt className="font-semibold uppercase tracking-[0.12em]">{tTerm('creditDetails.alerts.label.installment')}</dt>
                      <dd className="mt-1 text-text-primary">{presentation.installmentLabel}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-[0.12em]">{tTerm('creditDetails.alerts.label.balance')}</dt>
                      <dd className="mt-1 text-text-primary">{presentation.balanceLabel}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-[0.12em]">{tTerm('creditDetails.alerts.label.dueDate')}</dt>
                      <dd className="mt-1 text-text-primary">{formatDate(alert.dueDate)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                    <span>{tTerm('creditDetails.alerts.createdAt', { date: formatDate(alert.createdAt, true) })}</span>
                    {alert.resolvedAt && (
                      <span>{tTerm('creditDetails.alerts.resolvedAt', { date: formatDate(alert.resolvedAt, true) })}</span>
                    )}
                  </div>
                  {presentation.notes && (
                    <p className="mt-3 rounded-lg bg-bg-base p-3 text-sm leading-6 text-text-secondary whitespace-pre-wrap">{presentation.notes}</p>
                  )}
                </div>
              </div>
              <ActionButton
                type="button"
                onClick={() => onUpdateAlertStatus(alert, alert.status === 'resolved' ? 'active' : 'resolved')}
                disabled={isUpdating}
                icon={alert.status === 'resolved' ? <Bell size={16} /> : <CheckCircle size={16} />}
              >
                {alert.status === 'resolved'
                  ? tTerm('creditDetails.confirm.alert.reactivate.confirm')
                  : tTerm('creditDetails.confirm.alert.resolve.confirm')}
              </ActionButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}
