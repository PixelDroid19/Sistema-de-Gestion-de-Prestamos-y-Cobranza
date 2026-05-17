import React, { useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
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
  InsightStrip,
  ModalShell,
  SectionSurface,
} from '../shared/Surfaces';
import {
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

// ─── Props ────────────────────────────────────────────────────────────────────

type CreditsCalendarViewProps = {
  calendarEvents: InstallmentEvent[];
  calendarOverview: CalendarOverviewResponse;
  isCalendarLoading: boolean;
  selectedEvent: InstallmentEvent | null;
  onSelectEvent: (event: InstallmentEvent | null) => void;
  onViewCredit: (loanId: number) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreditsCalendarView({
  calendarEvents,
  calendarOverview,
  isCalendarLoading,
  selectedEvent,
  onSelectEvent,
  onViewCredit,
}: CreditsCalendarViewProps) {
  const { locale } = useTranslation();
  const formatCurrency = (value: number) => formatCurrencyValue(value);

  const initialCalendarView = useMemo(() => (
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'agenda' : 'month'
  ), []);

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

  const calendarSummaryItems = useMemo(() => [
    {
      id: 'actionable',
      label: tTerm('credits.stats.calendar.actionable.label'),
      value: String(calendarOverview.summary.actionableCount),
      helper: calendarOverview.summary.actionableCount === 1
        ? tTerm('credits.stats.calendar.actionable.helper.one')
        : tTerm('credits.stats.calendar.actionable.helper.other', { count: calendarOverview.summary.actionableCount }),
      accent: 'blue' as const,
      icon: <DollarSign aria-hidden="true" />,
    },
    {
      id: 'overdue',
      label: tTerm('credits.stats.calendar.overdue.label'),
      value: String(calendarOverview.summary.overdueCount),
      helper: calendarOverview.summary.overdueCount === 1
        ? tTerm('credits.stats.calendar.overdue.helper.one')
        : tTerm('credits.stats.calendar.overdue.helper.other', { count: calendarOverview.summary.overdueCount }),
      accent: 'rose' as const,
      icon: <AlertTriangle aria-hidden="true" />,
    },
    {
      id: 'due-today',
      label: tTerm('credits.stats.calendar.dueToday.label'),
      value: String(calendarOverview.summary.dueTodayCount),
      helper: calendarOverview.summary.dueTodayCount === 1
        ? tTerm('credits.stats.calendar.dueToday.helper.one')
        : tTerm('credits.stats.calendar.dueToday.helper.other', { count: calendarOverview.summary.dueTodayCount }),
      accent: 'teal' as const,
      icon: <CalendarIcon aria-hidden="true" />,
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
  ], [
    calendarOverview.summary.actionableCount,
    calendarOverview.summary.dueTodayCount,
    calendarOverview.summary.overdueCount,
    calendarOverview.summary.totalLateFeeAmount,
    calendarOverview.summary.totalPayableAmount,
    locale,
  ]);

  return (
    <div className="relative flex flex-1 flex-col gap-4 min-w-0">
      <SectionSurface
        className="min-h-[660px]"
        title={tTerm('credits.calendar.title')}
        subtitle={tTerm('credits.calendar.subtitle')}
        actions={(
          <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-slate-400 dark:bg-slate-500" />
              {tTerm('credits.calendar.legend.paid')}
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-blue-500" />
              {tTerm('credits.calendar.legend.pending')}
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-red-500" />
              {tTerm('credits.calendar.legend.overdue')}
            </div>
          </div>
        )}
      >
        {isCalendarLoading ? (
          <div className="flex h-full min-h-[560px] items-center justify-center text-text-secondary">
            {tTerm('credits.calendar.loading')}
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            defaultView={initialCalendarView}
            style={{ height: 620 }}
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

        {!isCalendarLoading && calendarEvents.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-border-subtle bg-bg-base p-4 text-sm text-text-secondary">
            {tTerm('credits.calendar.empty')}
          </div>
        )}
      </SectionSurface>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SectionSurface>
          <div>
            <h4 className="text-base font-semibold text-text-primary">{tTerm('credits.agenda.title')}</h4>
            <p className="mt-1 text-sm text-text-secondary">
              {tTerm('credits.agenda.subtitle')}
            </p>
          </div>
          <InsightStrip items={calendarSummaryItems} className="calendar-summary-strip mt-4" />
        </SectionSurface>

        <SectionSurface as="section">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold text-text-primary">{tTerm('credits.agenda.nextAction')}</h4>
              <p className="mt-1 text-sm text-text-secondary">
                {tTerm('credits.agenda.subtitle')}
              </p>
            </div>
            <span className="rounded-full bg-bg-base px-3 py-1 text-xs font-semibold text-text-secondary">
              {tTerm('credits.agenda.count', { count: calendarOverview.agenda.length })}
            </span>
          </div>

          {calendarOverview.nextAction && (
            <div className="mt-4 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4">
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
                {formatLocaleDate(parseDueDate(calendarOverview.nextAction.dueDate) || new Date(), { day: 'numeric', month: 'short', timeZone: 'UTC' })}
              </p>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {calendarOverview.agenda.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-base p-4 text-sm text-text-secondary">
                {tTerm('credits.agenda.empty')}
              </div>
            )}

            {calendarOverview.agenda.map((item) => (
              <div key={`${item.loanId}-${item.installmentNumber}`} className="rounded-2xl border border-border-subtle bg-bg-base p-4">
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

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{tTerm('credits.agenda.dueDate')}</div>
                    <div className="mt-1 text-sm font-medium text-text-primary">
                      {formatLocaleDate(parseDueDate(item.dueDate) || new Date(), { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                    </div>
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
                  <ActionButton
                    type="button"
                    onClick={() => onViewCredit(item.loanId)}
                  >
                    {tTerm('credits.action.viewLoan')}
                  </ActionButton>
                  {item.canPay && (
                    <ActionButton
                      type="button"
                      onClick={() => onViewCredit(item.loanId)}
                      variant="primary"
                    >
                      {tTerm('creditDetails.cta.recordPayment')}
                    </ActionButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionSurface>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <ModalShell
          title={tTerm('credits.modal.title')}
          subtitle={selectedEvent.clientName}
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
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-3 rounded-full ${
                selectedEvent.type === 'paid' ? 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300' :
                selectedEvent.type === 'overdue' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
                'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
              }`}>
                {selectedEvent.type === 'paid' ? <CheckCircle2 size={24} /> :
                 selectedEvent.type === 'overdue' ? <AlertCircle size={24} /> :
                 <Clock size={24} />}
              </div>
              <div>
                <div className="text-sm text-text-secondary">{tTerm('credits.modal.status')}</div>
                <div className="font-semibold text-lg">
                  {selectedEvent.type === 'paid' ? tTerm('credits.modal.status.paid') :
                   selectedEvent.type === 'overdue' ? tTerm('credits.modal.status.overdue') : tTerm('credits.modal.status.pending')}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-base p-3 rounded-xl border border-border-subtle">
                  <div className="text-xs text-text-secondary mb-1">{tTerm('credits.modal.installmentNumber')}</div>
                  <div className="font-semibold">{tTerm('credits.modal.installmentOf', { number: selectedEvent.installmentNumber, total: selectedEvent.totalInstallments })}</div>
                </div>
                <div className="bg-bg-base p-3 rounded-xl border border-border-subtle">
                  <div className="text-xs text-text-secondary mb-1">{tTerm('credits.modal.dueDate')}</div>
                  <div className="font-semibold">{formatLocaleDate(selectedEvent.start, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</div>
                </div>
              </div>

              <div className="bg-bg-base rounded-xl border border-border-subtle overflow-hidden">
                <div className="p-3 border-b border-border-subtle flex justify-between items-center bg-hover-bg/50">
                  <span className="text-sm font-medium">{tTerm('credits.modal.suggestedCollection')}</span>
                  <span className="font-bold text-lg">{formatCurrency(selectedEvent.payableAmount || selectedEvent.amountToPay)}</span>
                </div>
                <div className="p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{tTerm('credits.modal.interest')}</span>
                    <span>{formatCurrency(selectedEvent.interest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{tTerm('credits.modal.amortizedPrincipal')}</span>
                    <span>{formatCurrency(selectedEvent.amortizedCapital)}</span>
                  </div>
                  {selectedEvent.arrears > 0 && (
                    <div className="flex justify-between text-red-600 dark:text-red-400 font-medium pt-2 border-t border-border-subtle mt-2">
                      <span>{tTerm('credits.modal.accumulatedLateFee')}</span>
                      <span>{formatCurrency(selectedEvent.arrears)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-bg-base p-3 rounded-xl border border-border-subtle flex justify-between items-center">
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
