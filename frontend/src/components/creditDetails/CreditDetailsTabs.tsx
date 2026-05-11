import type React from 'react';
import { Activity, Bell, Calendar, Clock, CreditCard, DollarSign } from 'lucide-react';

export type CreditDetailsTab = 'calendar' | 'alerts' | 'promises' | 'payouts' | 'payoff' | 'history';

type CreditDetailsTabsProps = {
  activeTab: CreditDetailsTab;
  isAdmin: boolean;
  canViewPayoff: boolean;
  alertCount: number;
  pendingPromiseCount: number;
  paymentHistoryCount: number;
  labels: {
    calendar: string;
    alerts: string;
    promises: string;
    payoff: string;
    history: string;
  };
  onSelect: (tab: CreditDetailsTab) => void;
};

function TabButton({
  id,
  icon: Icon,
  label,
  badge,
  activeTab,
  onSelect,
}: {
  id: CreditDetailsTab;
  icon: React.ElementType;
  label: string;
  badge?: number;
  activeTab: CreditDetailsTab;
  onSelect: (tab: CreditDetailsTab) => void;
}) {
  const isActive = activeTab === id;

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`relative flex items-center gap-2 rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-200 whitespace-nowrap outline-none ${
        isActive
          ? 'bg-brand-primary/8 text-brand-primary'
          : 'text-text-secondary hover:bg-hover-bg hover:text-text-primary'
      }`}
    >
      <Icon size={18} className={isActive ? 'text-brand-primary' : 'text-text-secondary opacity-70'} />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`ml-1.5 py-0.5 px-2 rounded-full text-[10px] font-bold ${
          isActive ? 'bg-brand-primary text-white' : 'bg-border-subtle text-text-secondary'
        }`}>
          {badge}
        </span>
      )}
      {isActive && (
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-primary rounded-t-full shadow-[0_-2px_10px_rgba(var(--color-brand-primary),0.5)]" />
      )}
    </button>
  );
}

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
  canViewPayoff,
  alertCount,
  pendingPromiseCount,
  paymentHistoryCount,
  labels,
  onSelect,
}: CreditDetailsTabsProps) {
  return (
    <div className="overflow-x-auto border-b border-border-subtle py-2 hide-scrollbar" data-tour="credit-detail-tabs">
      <div className="flex min-w-max items-center gap-2">
        <TabButton id="calendar" icon={Calendar} label={labels.calendar} activeTab={activeTab} onSelect={onSelect} />
        {isAdmin && <TabButton id="alerts" icon={Bell} label={labels.alerts} badge={alertCount} activeTab={activeTab} onSelect={onSelect} />}
        {isAdmin && <TabButton id="promises" icon={Clock} label={labels.promises} badge={pendingPromiseCount} activeTab={activeTab} onSelect={onSelect} />}
        <TabButton id="payouts" icon={DollarSign} label="Historial de pagos" badge={paymentHistoryCount} activeTab={activeTab} onSelect={onSelect} />
        {canViewPayoff && <TabButton id="payoff" icon={CreditCard} label={labels.payoff} activeTab={activeTab} onSelect={onSelect} />}
        <TabButton id="history" icon={Activity} label={labels.history} activeTab={activeTab} onSelect={onSelect} />
      </div>
    </div>
  );
}
