import type React from 'react';
import { Activity, Bell, Calendar, Clock, DollarSign } from 'lucide-react';
import { ViewTabs } from '../shared/Surfaces';

export type CreditDetailsTab = 'calendar' | 'alerts' | 'promises' | 'payouts' | 'history';

type CreditDetailsTabsProps = {
  activeTab: CreditDetailsTab;
  isAdmin: boolean;
  alertCount: number;
  pendingPromiseCount: number;
  paymentHistoryCount: number;
  labels: {
    calendar: string;
    alerts: string;
    promises: string;
    history: string;
  };
  onSelect: (tab: CreditDetailsTab) => void;
};

export function TabEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-bg-base/70 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-hover-bg text-text-secondary">
        <Icon size={24} />
      </div>
      <p className="mt-4 text-base font-semibold text-text-primary">{title}</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">{description}</p>
    </div>
  );
}

export function CreditDetailsTabs({
  activeTab,
  isAdmin,
  alertCount,
  pendingPromiseCount,
  paymentHistoryCount,
  labels,
  onSelect,
}: CreditDetailsTabsProps) {
  const tabs = [
    { id: 'calendar', icon: Calendar, label: labels.calendar },
    ...(isAdmin ? [{ id: 'alerts', icon: Bell, label: labels.alerts, count: alertCount }] : []),
    ...(isAdmin ? [{ id: 'promises', icon: Clock, label: labels.promises, count: pendingPromiseCount }] : []),
    { id: 'payouts', icon: DollarSign, label: 'Historial de pagos', count: paymentHistoryCount },
    { id: 'history', icon: Activity, label: labels.history },
  ];

  return (
    <ViewTabs
      tabs={tabs}
      activeTab={activeTab}
      onChange={(tabId) => onSelect(tabId as CreditDetailsTab)}
      ariaLabel="Secciones del detalle de crédito"
      data-tour="credit-detail-tabs"
    />
  );
}
