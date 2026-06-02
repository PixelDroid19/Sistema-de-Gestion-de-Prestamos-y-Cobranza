import { useMemo } from 'react';
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
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { useTranslation } from '../../i18n';
import { formatCurrency as formatCurrencyValue, formatDate as formatLocaleDate } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { getChipClassName } from '../../constants/uiChips';
import { getInstallmentStatusTone } from '../../lib/statusTones';
import {
  ActionButton,
  MetricCard,
  ModalShell,
  SectionSurface,
} from '../shared/Surfaces';
import { AppInput, OperationalSelect } from '../shared/Surfaces';
import {
  type CalendarOverviewAgendaItem,
  type CalendarOverviewResponse,
  type InstallmentEvent,
  eventStyleGetter,
  getCalendarStatusLabel,
  parseDueDate,
} from './creditsHelpers';

const locales = { es, en: enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

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
}: CreditsCalendarViewProps) {
  const { locale } = useTranslation();
  const formatCurrency = (value: number) => formatCurrencyValue(value);

  const initialCalendarView = useMemo(() => (
    typeof window !== 'undefined' && window.innerWidth < 760 ? 'agenda' : 'month'
  ), []);

  const defaultCalendarDate = useMemo(() => buildDefaultCalendarDate({
    nextAction: calendarOverview.nextAction,
    events: calendarEvents,
  }), [calendarEvents, calendarOverview.nextAction]);

  const calendarMessages = useMemo(() => ({
    next: tTerm('credits.calendar.nav.next'),
    previous: tTerm('credits.calendar.nav.previous'),
    today: tTerm('credits.calendar.nav.today'),
    month: tTerm('credits.calendar.nav.month'),
    week: tTerm('credits.calendar.nav.week'),
    day: tTerm('credits.calendar.nav.day'),
    agenda: tTerm('credits.calendar.nav.agenda'),
    date: tTerm('credits.calendar.nav.date'),
    time: tTerm('credits.calendar.nav.time'),
    event: tTerm('credits.calendar.nav.event'),
  }), [locale]);

  const visibleAgenda = calendarOverview.agenda;
  const hasFilters = Boolean(filters.search || filters.status || filters.startDate || filters.endDate);

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

  const renderAgendaCard = (item: CalendarOverviewAgendaItem) => (
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
        {item.canPay && (
          <ActionButton type="button" onClick={() => onViewCredit(item.loanId)} variant="primary">
            {tTerm('creditDetails.cta.recordPayment')}
          </ActionButton>
        )}
      </div>
    </article>
  );

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
              <Calendar
                key={`${defaultCalendarDate.toISOString()}-${filters.search}-${filters.status}-${filters.startDate}-${filters.endDate}`}
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                defaultDate={defaultCalendarDate}
                defaultView={initialCalendarView}
                style={{ height: 540 }}
                messages={calendarMessages}
                culture={locale}
                eventPropGetter={eventStyleGetter}
                components={{
                  event: ({ event }: { event: InstallmentEvent }) => (
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 text-left focus:outline-none focus:ring-2 focus:ring-white/80"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onSelectEvent(event);
                      }}
                    >
                      <span className="truncate font-semibold">{event.title}</span>
                      <span className="truncate opacity-90">{formatCurrency(event.amountToPay)}</span>
                      {event.arrears > 0 && (
                        <span className="truncate font-bold text-red-100">
                          {tTerm('credits.calendar.event.lateFee', { amount: formatCurrency(event.arrears) })}
                        </span>
                      )}
                    </button>
                  ),
                }}
                onSelectEvent={(event) => onSelectEvent(event as InstallmentEvent)}
                className="dark:text-text-primary"
              />
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
              {selectedEvent.type !== 'paid' && selectedEvent.canPay && (
                <ActionButton
                  onClick={() => {
                    onSelectEvent(null);
                    onViewCredit(selectedEvent.loanId);
                  }}
                  variant="primary"
                  fullWidth
                >
                  {tTerm('creditDetails.cta.recordPayment')}
                </ActionButton>
              )}
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
