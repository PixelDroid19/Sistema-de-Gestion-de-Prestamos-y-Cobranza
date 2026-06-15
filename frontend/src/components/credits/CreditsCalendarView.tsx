import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatCurrency as formatCurrencyValue, formatDate as formatLocaleDate } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { getChipClassName } from '../../constants/uiChips';
import { getInstallmentStatusTone } from '../../lib/statusTones';
import { resolveOperationalGuard } from '../../services/operationalGuards';
import {
  ActionButton,
  MetricCard,
  ModalShell,
  SectionSurface,
} from '../shared/Surfaces';
import { AppInput, OperationalSelect } from '../shared/Surfaces';
import AppCalendar, { toCalendarDayKey, type CalendarEvent } from '../shared/AppCalendar';
import {
  type CalendarOverviewAgendaItem,
  type CalendarOverviewResponse,
  type InstallmentEvent,
  getCalendarStatusLabel,
  parseDueDate,
} from './creditsHelpers';

type CalendarFilters = {
  search: string;
  status: string;
  startDate: string;
  endDate: string;
};

type CreditsCalendarViewProps = {
  calendarEvents: InstallmentEvent[];
  calendarOverview: CalendarOverviewResponse;
  isCalendarLoading: boolean;
  selectedEvent: InstallmentEvent | null;
  filters: CalendarFilters;
  onFiltersChange: React.Dispatch<React.SetStateAction<CalendarFilters>>;
  onClearFilters: () => void;
  onSelectEvent: (event: InstallmentEvent | null) => void;
  onViewCredit: (loanId: number) => void;
  user: { role?: string; permissions?: string[] } | null;
};

const getEventDateLabel = (value: unknown) => (
  formatLocaleDate(parseDueDate(value) || new Date(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
);

const buildDefaultCalendarDate = ({
  nextAction,
  events,
}: {
  nextAction: CalendarOverviewAgendaItem | null;
  events: InstallmentEvent[];
}) => {
  const nextActionDate = parseDueDate(nextAction?.dueDate);
  if (nextActionDate) return nextActionDate;
  return events[0]?.start || new Date();
};

export default function CreditsCalendarView({
  calendarEvents,
  calendarOverview,
  isCalendarLoading,
  selectedEvent,
  filters,
  onFiltersChange,
  onClearFilters,
  onSelectEvent,
  onViewCredit,
  user,
}: CreditsCalendarViewProps) {
  const { locale } = useTranslation();
  const formatCurrency = (value: number) => formatCurrencyValue(value);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const defaultCalendarDate = useMemo(() => buildDefaultCalendarDate({
    nextAction: calendarOverview.nextAction,
    events: calendarEvents,
  }), [calendarEvents, calendarOverview.nextAction]);

  const appCalendarEvents = useMemo<CalendarEvent[]>(() => calendarEvents.map((event) => ({
    id: event.id,
    date: event.start,
    title: event.title,
    meta: formatCurrency(event.payableAmount || event.amountToPay),
    tone: event.type === 'paid' ? 'success' : event.type === 'overdue' ? 'danger' : 'info',
  })), [calendarEvents, locale]);

  const selectedDayEvents = useMemo(() => (
    selectedDayKey
      ? calendarEvents.filter((event) => toCalendarDayKey(event.start) === selectedDayKey)
      : []
  ), [calendarEvents, selectedDayKey]);

  const visibleAgenda = calendarOverview.actionableEntries ?? calendarOverview.agenda;
  const hasFilters = Boolean(filters.search || filters.status || filters.startDate || filters.endDate);

  const canShowPayAction = (loanStatus: string) => resolveOperationalGuard('installment.pay', {
    role: user?.role,
    permissions: user?.permissions,
    loanStatus,
  });

  const summaryItems = useMemo(() => [
    {
      id: 'actionable',
      label: tTerm('credits.stats.calendar.actionable.label'),
      value: String(calendarOverview.summary.actionableCount),
      helper: tTerm('credits.stats.calendar.actionable.short'),
      accent: 'blue' as const,
      icon: <DollarSign aria-hidden="true" />,
    },
    {
      id: 'overdue',
      label: tTerm('credits.stats.calendar.overdue.label'),
      value: String(calendarOverview.summary.overdueCount),
      helper: tTerm('credits.stats.calendar.overdue.short'),
      accent: 'rose' as const,
      icon: <AlertTriangle aria-hidden="true" />,
    },
    {
      id: 'paid',
      label: tTerm('credits.stats.calendar.paid.label'),
      value: String(calendarOverview.summary.paidCount),
      helper: tTerm('credits.stats.calendar.paid.short'),
      accent: 'emerald' as const,
      icon: <CheckCircle2 aria-hidden="true" />,
    },
    {
      id: 'amount',
      label: tTerm('credits.stats.calendar.amount.label'),
      value: formatCurrency(calendarOverview.summary.totalPayableAmount),
      helper: calendarOverview.summary.totalLateFeeAmount > 0
        ? tTerm('credits.stats.calendar.amount.helper.withLateFee', { amount: formatCurrency(calendarOverview.summary.totalLateFeeAmount) })
        : tTerm('credits.stats.calendar.amount.helper.withoutLateFee'),
      accent: 'amber' as const,
      icon: <TrendingUp aria-hidden="true" />,
    },
  ], [calendarOverview.summary, locale]);

  const renderAgendaCard = (item: CalendarOverviewAgendaItem) => {
    const payGuard = canShowPayAction(String(item.loanStatus || 'active'));
    return (
    <article key={`${item.loanId}-${item.installmentNumber}`} className="rounded-2xl border border-border-subtle bg-bg-base p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-text-primary">{item.customerName}</div>
          <div className="mt-1 text-sm text-text-secondary">
            {item.totalInstallments > 0
              ? tTerm('credits.agenda.loanInstallmentOf', {
                loanId: item.loanId,
                number: item.installmentNumber,
                total: item.totalInstallments,
              })
              : tTerm('credits.agenda.loanInstallment', { loanId: item.loanId, number: item.installmentNumber })}
          </div>
        </div>
        <span className={getChipClassName(getInstallmentStatusTone(item.status))}>
          {getCalendarStatusLabel(item.status)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{tTerm('credits.agenda.dueDate')}</div>
          <div className="mt-1 text-sm font-medium text-text-primary">{getEventDateLabel(item.dueDate)}</div>
          {item.daysOverdue > 0 && (
            <div className="mt-1 text-sm font-medium text-rose-600">{tTerm('credits.agenda.daysOverdue', { count: item.daysOverdue })}</div>
          )}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{tTerm('credits.agenda.suggestedCollection')}</div>
          <div className="mt-1 text-sm font-semibold text-text-primary">{formatCurrency(item.payableAmount)}</div>
          {item.lateFeeDue > 0 && (
            <div className="mt-1 text-sm text-amber-700">{tTerm('credits.agenda.includesLateFee', { amount: formatCurrency(item.lateFeeDue) })}</div>
          )}
        </div>
      </div>

      {item.disabledReason && !item.canPay && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {item.disabledReason}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton type="button" onClick={() => onViewCredit(item.loanId)}>
          {tTerm('credits.action.viewLoan')}
        </ActionButton>
        {item.canPay && payGuard.visible && (
          <ActionButton
            type="button"
            onClick={() => onViewCredit(item.loanId)}
            variant="primary"
            disabled={!payGuard.executable}
            title={payGuard.executable ? undefined : (payGuard.reason || tTerm('credits.action.unavailable'))}
          >
            {tTerm('creditDetails.cta.recordPayment')}
          </ActionButton>
        )}
      </div>
    </article>
    );
  };

  return (
    <div className="relative flex flex-1 flex-col gap-4 min-w-0">
      <SectionSurface
        title={tTerm('credits.calendar.title')}
        subtitle={tTerm('credits.calendar.subtitle')}
        actions={(
          <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
            <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-emerald-500" />{tTerm('credits.calendar.legend.paid')}</div>
            <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-blue-500" />{tTerm('credits.calendar.legend.pending')}</div>
            <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-red-500" />{tTerm('credits.calendar.legend.overdue')}</div>
          </div>
        )}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(130px,0.7fr)_minmax(130px,0.7fr)_auto]">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-text-secondary">{tTerm('credits.calendar.filter.search')}</span>
            <AppInput
              value={filters.search}
              onValueChange={(value) => onFiltersChange((current) => ({ ...current, search: String(value) }))}
              icon={<Search size={16} />}
              placeholder={tTerm('credits.calendar.filter.searchPlaceholder')}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-text-secondary">{tTerm('credits.calendar.filter.status')}</span>
            <OperationalSelect
              value={filters.status}
              onChange={(event) => onFiltersChange((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">{tTerm('credits.calendar.filter.allStatuses')}</option>
              <option value="pending">{tTerm('credits.modal.status.pending')}</option>
              <option value="paid">{tTerm('credits.modal.status.paid')}</option>
              <option value="overdue">{tTerm('credits.modal.status.overdue')}</option>
              <option value="partial">{tTerm('credits.calendar.status.partial')}</option>
            </OperationalSelect>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-text-secondary">{tTerm('credits.calendar.filter.from')}</span>
            <AppInput
              value={filters.startDate}
              variant="date"
              onValueChange={(value) => onFiltersChange((current) => ({ ...current, startDate: String(value) }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-text-secondary">{tTerm('credits.calendar.filter.to')}</span>
            <AppInput
              value={filters.endDate}
              variant="date"
              onValueChange={(value) => onFiltersChange((current) => ({ ...current, endDate: String(value) }))}
            />
          </label>
          <div className="flex items-end">
            <ActionButton type="button" onClick={onClearFilters} icon={<X size={16} />} disabled={!hasFilters}>
              {tTerm('credits.filter.clear')}
            </ActionButton>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {summaryItems.map((item) => (
            <MetricCard
              key={item.id}
              label={item.label}
              value={item.value}
              helper={item.helper}
              icon={item.icon}
              accent={item.accent}
            />
          ))}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
          <div className="min-h-[560px] rounded-2xl border border-border-subtle bg-bg-base p-3">
            {isCalendarLoading ? (
              <div className="flex h-full min-h-[520px] items-center justify-center text-text-secondary">
                {tTerm('credits.calendar.loading')}
              </div>
            ) : (
              <>
                <AppCalendar
                  key={defaultCalendarDate.toISOString()}
                  events={appCalendarEvents}
                  initialDate={defaultCalendarDate}
                  selectedDate={selectedDayKey}
                  onSelectDate={(dayKey) => setSelectedDayKey((current) => (current === dayKey ? null : dayKey))}
                  onSelectEvent={(eventId) => {
                    const event = calendarEvents.find((candidate) => candidate.id === eventId);
                    if (event) onSelectEvent(event);
                  }}
                  className="min-h-[520px]"
                />
                {selectedDayKey && selectedDayEvents.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-2xl border border-border-subtle bg-surface p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      {getEventDateLabel(selectedDayEvents[0].start)}
                    </div>
                    {selectedDayEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-subtle bg-bg-base px-3 py-2 text-left transition hover:border-brand-primary/40"
                        onClick={() => onSelectEvent(event)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-text-primary">{event.title}</span>
                          <span className="block truncate text-xs text-text-secondary">
                            {tTerm('credits.modal.installmentOf', { number: event.installmentNumber, total: event.totalInstallments })}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end">
                          <span className="text-sm font-semibold text-text-primary">{formatCurrency(event.payableAmount || event.amountToPay)}</span>
                          <span className={getChipClassName(getInstallmentStatusTone(event.status))}>
                            {getCalendarStatusLabel(event.status)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="rounded-2xl border border-border-subtle bg-bg-base p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-text-primary">{tTerm('credits.agenda.title')}</h4>
                <p className="mt-1 text-sm text-text-secondary">{tTerm('credits.agenda.subtitle')}</p>
              </div>
              <span className="rounded-full bg-hover-bg px-3 py-1 text-xs font-semibold text-text-secondary">
                {tTerm('credits.agenda.count', { count: visibleAgenda.length })}
              </span>
            </div>

            {calendarOverview.nextAction && (
              <button
                type="button"
                className="mt-4 w-full rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4 text-left transition hover:border-brand-primary/40"
                onClick={() => onViewCredit(calendarOverview.nextAction!.loanId)}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">{tTerm('credits.agenda.nextAction')}</div>
                <div className="mt-2 text-base font-semibold text-text-primary">{calendarOverview.nextAction.customerName}</div>
                <p className="mt-1 text-sm text-text-secondary">
                  {calendarOverview.nextAction.totalInstallments > 0
                    ? tTerm('credits.agenda.installmentOf', {
                      number: calendarOverview.nextAction.installmentNumber,
                      total: calendarOverview.nextAction.totalInstallments,
                    })
                    : tTerm('credits.agenda.installment', { number: calendarOverview.nextAction.installmentNumber })}
                  {' · '}
                  {getEventDateLabel(calendarOverview.nextAction.dueDate)}
                </p>
              </button>
            )}

            <div className="mt-4 max-h-[470px] space-y-3 overflow-y-auto pr-1">
              {!isCalendarLoading && visibleAgenda.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border-subtle bg-surface p-4 text-sm text-text-secondary">
                  {calendarEvents.length === 0 ? tTerm('credits.calendar.empty') : tTerm('credits.agenda.empty')}
                </div>
              )}
              {visibleAgenda.map(renderAgendaCard)}
            </div>
          </aside>
        </div>
      </SectionSurface>

      {selectedEvent && (
        <ModalShell
          title={tTerm('credits.modal.title')}
          subtitle={selectedEvent.clientName}
          onClose={() => onSelectEvent(null)}
          footer={(
            <>
              <ActionButton onClick={() => onSelectEvent(null)} fullWidth>
                {tTerm('credits.modal.close')}
              </ActionButton>
              {selectedEvent.type !== 'paid' && selectedEvent.canPay && (() => {
                const payGuard = canShowPayAction(selectedEvent.loanStatus);
                if (!payGuard.visible) return null;
                return (
                <ActionButton
                  onClick={() => {
                    onSelectEvent(null);
                    onViewCredit(selectedEvent.loanId);
                  }}
                  variant="primary"
                  fullWidth
                  disabled={!payGuard.executable}
                  title={payGuard.executable ? undefined : (payGuard.reason || tTerm('credits.action.unavailable'))}
                >
                  {tTerm('creditDetails.cta.recordPayment')}
                </ActionButton>
                );
              })()}
            </>
          )}
        >
          <div>
            <div className="mb-6 flex items-center gap-3">
              <div className={`rounded-full p-3 ${
                selectedEvent.type === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : selectedEvent.type === 'overdue' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
              }`}>
                {selectedEvent.type === 'paid' ? <CheckCircle2 size={24} />
                  : selectedEvent.type === 'overdue' ? <AlertCircle size={24} />
                    : <Clock size={24} />}
              </div>
              <div>
                <div className="text-sm text-text-secondary">{tTerm('credits.modal.status')}</div>
                <div className="text-lg font-semibold">
                  {selectedEvent.type === 'paid' ? tTerm('credits.modal.status.paid')
                    : selectedEvent.type === 'overdue' ? tTerm('credits.modal.status.overdue')
                      : tTerm('credits.modal.status.pending')}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border-subtle bg-bg-base p-3">
                  <div className="mb-1 text-xs text-text-secondary">{tTerm('credits.modal.installmentNumber')}</div>
                  <div className="font-semibold">{tTerm('credits.modal.installmentOf', { number: selectedEvent.installmentNumber, total: selectedEvent.totalInstallments })}</div>
                </div>
                <div className="rounded-xl border border-border-subtle bg-bg-base p-3">
                  <div className="mb-1 text-xs text-text-secondary">{tTerm('credits.modal.dueDate')}</div>
                  <div className="font-semibold">{getEventDateLabel(selectedEvent.start)}</div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-base">
                <div className="flex items-center justify-between border-b border-border-subtle bg-hover-bg/50 p-3">
                  <span className="text-sm font-medium">{tTerm('credits.modal.suggestedCollection')}</span>
                  <span className="text-lg font-bold">{formatCurrency(selectedEvent.payableAmount || selectedEvent.amountToPay)}</span>
                </div>
                <div className="space-y-2 p-3 text-sm">
                  <div className="flex justify-between"><span className="text-text-secondary">{tTerm('credits.modal.interest')}</span><span>{formatCurrency(selectedEvent.interest)}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">{tTerm('credits.modal.amortizedPrincipal')}</span><span>{formatCurrency(selectedEvent.amortizedCapital)}</span></div>
                  {selectedEvent.arrears > 0 && (
                    <div className="mt-2 flex justify-between border-t border-border-subtle pt-2 font-medium text-red-600 dark:text-red-400">
                      <span>{tTerm('credits.modal.accumulatedLateFee')}</span>
                      <span>{formatCurrency(selectedEvent.arrears)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-base p-3">
                <span className="text-sm font-medium text-text-secondary">{tTerm('credits.modal.remainingPrincipal')}</span>
                <span className="font-semibold">{formatCurrency(selectedEvent.remainingCapital)}</span>
              </div>

              {selectedEvent.disabledReason && !selectedEvent.canPay && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {selectedEvent.disabledReason}
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
