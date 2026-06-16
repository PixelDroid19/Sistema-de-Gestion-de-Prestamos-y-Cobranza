import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  Search,
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
  ModalShell,
  SectionSurface,
} from '../shared/Surfaces';
import { AppInput, OperationalSelect } from '../shared/Surfaces';
import AppCalendar, { toCalendarDayKey, type CalendarEvent, type CalendarEventTone } from '../shared/AppCalendar';
import {
  AppTable,
  RowActionsWithOverflow,
  TableActionsCell,
  TableActionsHeader,
  type RowActionOverflowItem,
} from '../shared/tables';
import {
  type InstallmentEvent,
  type CalendarOverviewResponse,
  getCalendarStatusLabel,
  parseDueDate,
} from './creditsHelpers';
import './CreditsCalendarView.css';

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

// Worst-status wins when collapsing a day's installments into a single cell.
const TONE_PRIORITY: Record<CalendarEventTone, number> = {
  danger: 4,
  warning: 3,
  info: 2,
  success: 1,
  neutral: 0,
};

const getCalendarEventTone = (event: InstallmentEvent): CalendarEventTone => {
  const status = String(event.status || event.type || '').toLowerCase();
  if (status === 'paid' || event.type === 'paid') return 'success';
  if (status === 'overdue' || event.type === 'overdue') return 'danger';
  if (status === 'partial') return 'warning';
  return 'info';
};

const getEventDateLabel = (value: unknown) => (
  formatLocaleDate(parseDueDate(value) || new Date(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
);

const getEventPayable = (event: InstallmentEvent) => event.payableAmount || event.amountToPay || 0;

const getClientInitials = (name: string) => {
  // Prefer alphabetic words so numeric account suffixes never become an initial.
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const alphaWords = words.filter((word) => /\p{L}/u.test(word));
  const source = alphaWords.length > 0 ? alphaWords : words;
  if (source.length === 0) return '—';
  if (source.length === 1) return source[0].slice(0, 2).toUpperCase();
  return (source[0][0] + source[1][0]).toUpperCase();
};

const DAY_TABLE_PAGE_SIZE_OPTIONS = [5, 10, 25];

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

  // The agenda always centres on a concrete day (today by default), mirroring an
  // operational worklist: "what do I collect on this date?".
  const todayKey = useMemo(() => toCalendarDayKey(new Date()), []);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(todayKey);
  // Once the operator picks a day we stop auto-centering, even on empty days.
  const [userPinnedDay, setUserPinnedDay] = useState(false);
  const [dayTablePage, setDayTablePage] = useState(1);
  const [dayTablePageSize, setDayTablePageSize] = useState(DAY_TABLE_PAGE_SIZE_OPTIONS[0]);

  const selectDay = (dayKey: string) => {
    setUserPinnedDay(true);
    setSelectedDayKey(dayKey);
  };

  const eventsByDay = useMemo(() => {
    const map = new Map<string, InstallmentEvent[]>();
    calendarEvents.forEach((event) => {
      const key = toCalendarDayKey(event.start);
      const bucket = map.get(key);
      if (bucket) bucket.push(event);
      else map.set(key, [event]);
    });
    return map;
  }, [calendarEvents]);

  // Best day to open on: today if it has work, else the backend's next action,
  // else the earliest scheduled day. Recomputed until the operator pins a day.
  const defaultDayKey = useMemo(() => {
    if (eventsByDay.has(todayKey)) return todayKey;
    const nextActionDate = parseDueDate(calendarOverview.nextAction?.dueDate);
    const nextActionKey = nextActionDate ? toCalendarDayKey(nextActionDate) : null;
    if (nextActionKey && eventsByDay.has(nextActionKey)) return nextActionKey;
    const orderedKeys = [...eventsByDay.keys()].sort();
    return orderedKeys[0] ?? todayKey;
  }, [eventsByDay, todayKey, calendarOverview.nextAction]);

  // One aggregated chip per day: count + total, coloured by the most urgent status.
  const appCalendarEvents = useMemo<CalendarEvent[]>(() => {
    const events: CalendarEvent[] = [];
    eventsByDay.forEach((dayEvents, dayKey) => {
      const total = dayEvents.reduce((sum, event) => sum + getEventPayable(event), 0);
      const tone = dayEvents.reduce<CalendarEventTone>((worst, event) => {
        const candidate = getCalendarEventTone(event);
        return TONE_PRIORITY[candidate] > TONE_PRIORITY[worst] ? candidate : worst;
      }, 'success');
      const countLabel = dayEvents.length === 1
        ? tTerm('credits.calendar.day.count.one')
        : tTerm('credits.calendar.day.count.other', { count: dayEvents.length });
      const amountLabel = formatCurrency(total);
      events.push({
        id: dayKey,
        date: dayEvents[0].start,
        title: countLabel,
        meta: amountLabel,
        tooltip: `${countLabel} · ${amountLabel}`,
        tone,
      });
    });
    return events;
  }, [eventsByDay, locale]);

  const selectedDayEvents = useMemo(() => {
    const dayEvents = eventsByDay.get(selectedDayKey) || [];
    return [...dayEvents].sort((left, right) => {
      // Overdue first, then by remaining urgency, keeps the worklist actionable.
      const toneDelta = TONE_PRIORITY[getCalendarEventTone(right)] - TONE_PRIORITY[getCalendarEventTone(left)];
      if (toneDelta !== 0) return toneDelta;
      return getEventPayable(right) - getEventPayable(left);
    });
  }, [eventsByDay, selectedDayKey]);

  const selectedDayLabel = useMemo(() => {
    const [year, month, day] = selectedDayKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const label = formatLocaleDate(date, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [selectedDayKey]);

  const dayStats = useMemo(() => {
    const accumulator = {
      pending: 0,
      paid: 0,
      overdue: 0,
      payable: 0,
    };
    selectedDayEvents.forEach((event) => {
      const status = String(event.status || event.type || '').toLowerCase();
      if (status === 'paid') {
        accumulator.paid += 1;
      } else if (status === 'overdue') {
        accumulator.overdue += 1;
        accumulator.payable += getEventPayable(event);
      } else {
        accumulator.pending += 1;
        accumulator.payable += getEventPayable(event);
      }
    });
    return accumulator;
  }, [selectedDayEvents]);

  const hasFilters = Boolean(filters.search || filters.status || filters.startDate || filters.endDate);

  const canShowPayAction = (loanStatus: string) => resolveOperationalGuard('installment.pay', {
    role: user?.role,
    permissions: user?.permissions,
    loanStatus,
  });

  const dayTiles = useMemo(() => [
    {
      id: 'pending',
      label: tTerm('credits.calendar.dayPanel.pending'),
      value: dayStats.pending,
      tone: 'pending' as const,
    },
    {
      id: 'paid',
      label: tTerm('credits.calendar.dayPanel.paid'),
      value: dayStats.paid,
      tone: 'paid' as const,
    },
    {
      id: 'overdue',
      label: tTerm('credits.calendar.dayPanel.overdue'),
      value: dayStats.overdue,
      tone: 'overdue' as const,
    },
    {
      id: 'total',
      label: tTerm('credits.calendar.dayPanel.total'),
      value: formatCurrency(dayStats.payable),
      tone: 'total' as const,
    },
  ], [dayStats, locale]);

  const dayTableTotalPages = Math.max(1, Math.ceil(selectedDayEvents.length / dayTablePageSize));
  const currentDayTablePage = Math.min(dayTablePage, dayTableTotalPages);
  const dayTableRows = useMemo(() => {
    const startIndex = (currentDayTablePage - 1) * dayTablePageSize;
    return selectedDayEvents.slice(startIndex, startIndex + dayTablePageSize);
  }, [selectedDayEvents, currentDayTablePage, dayTablePageSize]);
  const dayTablePagination = selectedDayEvents.length > dayTablePageSize
    ? {
      page: currentDayTablePage,
      pageSize: dayTablePageSize,
      totalItems: selectedDayEvents.length,
      totalPages: dayTableTotalPages,
      pageSizeOptions: DAY_TABLE_PAGE_SIZE_OPTIONS,
      onPrev: () => setDayTablePage((page) => Math.max(1, page - 1)),
      onNext: () => setDayTablePage((page) => Math.min(dayTableTotalPages, page + 1)),
      onPageSizeChange: (pageSize: number) => {
        setDayTablePageSize(pageSize);
        setDayTablePage(1);
      },
    }
    : undefined;

  const renderStatusChip = (status: string) => (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getChipClassName(getInstallmentStatusTone(status))}`}>
      {getCalendarStatusLabel(status)}
    </span>
  );

  const getRowActionItems = (event: InstallmentEvent): RowActionOverflowItem[] => {
    const payGuard = canShowPayAction(String(event.loanStatus || 'active'));
    const items: RowActionOverflowItem[] = [
      {
        id: 'view',
        label: tTerm('credits.action.viewLoan'),
        icon: <Eye size={16} />,
        onClick: () => onViewCredit(event.loanId),
      },
    ];

    if (event.canPay && payGuard.visible) {
      items.push({
        id: 'pay',
        label: payGuard.executable
          ? tTerm('creditDetails.cta.recordPayment')
          : (payGuard.reason || tTerm('credits.action.unavailable')),
        icon: <DollarSign size={16} />,
        onClick: () => onViewCredit(event.loanId),
        disabled: !payGuard.executable,
      });
    }

    return items;
  };

  const modalStatusTone = selectedEvent ? getInstallmentStatusTone(selectedEvent.status) : 'info';

  // Keep the selected day on the visible month so the calendar opens where the user is looking.
  const calendarInitialDate = useMemo(() => {
    const [year, month, day] = selectedDayKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }, [selectedDayKey]);

  useEffect(() => {
    // Until the operator pins a day, keep the panel on the most relevant date as
    // data loads or filters change, so it never strands on an empty default.
    if (!userPinnedDay && selectedDayKey !== defaultDayKey) {
      setSelectedDayKey(defaultDayKey);
    }
  }, [userPinnedDay, defaultDayKey, selectedDayKey]);

  useEffect(() => {
    setDayTablePage(1);
  }, [selectedDayKey, filters.search, filters.status, filters.startDate, filters.endDate]);

  useEffect(() => {
    if (dayTablePage > dayTableTotalPages) {
      setDayTablePage(dayTableTotalPages);
    }
  }, [dayTablePage, dayTableTotalPages]);

  return (
    <div className="relative flex flex-1 flex-col gap-4 min-w-0">
      <SectionSurface
        title={tTerm('credits.agenda.title')}
        subtitle={tTerm('credits.agenda.subtitle')}
        actions={(
          <div className="credits-calendar-legend" aria-label={tTerm('credits.calendar.legend.title')}>
            <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[var(--calendar-paid)]" />{tTerm('credits.calendar.legend.paid')}</div>
            <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[var(--calendar-pending)]" />{tTerm('credits.calendar.legend.pending')}</div>
            <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[var(--calendar-partial)]" />{tTerm('credits.calendar.legend.partial')}</div>
            <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[var(--calendar-overdue)]" />{tTerm('credits.calendar.legend.overdue')}</div>
          </div>
        )}
      >
        <div className="credits-calendar-filters">
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

        <div className="credits-calendar-workspace mt-4">
          <div className="credits-calendar-workspace__grid p-4 sm:p-5">
            {isCalendarLoading ? (
              <div className="credits-calendar-loading">
                {tTerm('credits.calendar.loading')}
              </div>
            ) : (
              <AppCalendar
                events={appCalendarEvents}
                initialDate={calendarInitialDate}
                selectedDate={selectedDayKey}
                onSelectDate={(dayKey) => selectDay(dayKey)}
                onSelectEvent={(dayKey) => selectDay(dayKey)}
                maxVisiblePerDay={1}
                className="credits-calendar-month"
              />
            )}
          </div>

          <aside className="credits-calendar-workspace__operation p-4 sm:p-5" aria-label={tTerm('credits.calendar.operation.dayTitle')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-primary/10 text-brand-primary">
                  <CalendarCheck size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h4 className="text-base font-semibold text-text-primary">
                    {tTerm('credits.calendar.operation.dayTitle')}
                  </h4>
                  <p className="mt-0.5 text-sm leading-5 text-text-secondary">{selectedDayLabel}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {userPinnedDay && selectedDayKey !== defaultDayKey && (
                  <ActionButton
                    type="button"
                    variant="ghost"
                    onClick={() => { setUserPinnedDay(false); setSelectedDayKey(defaultDayKey); }}
                  >
                    {tTerm('credits.calendar.operation.showAll')}
                  </ActionButton>
                )}
                <span className="rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-semibold text-text-secondary">
                  {tTerm('credits.agenda.count', { count: selectedDayEvents.length })}
                </span>
              </div>
            </div>

            <div className="credits-day-metrics mt-4" aria-label={tTerm('credits.calendar.operation.dayTitle')}>
              {dayTiles.map((tile) => (
                <div key={tile.id} className={`credits-day-tile credits-day-tile--${tile.tone}`}>
                  <div className="credits-day-tile__value">{tile.value}</div>
                  <div className="credits-day-tile__label">{tile.label}</div>
                </div>
              ))}
            </div>
            {!isCalendarLoading && selectedDayEvents.length === 0 && (
              <div className="credits-calendar-day-empty mt-4">
                {calendarEvents.length === 0
                  ? tTerm('credits.calendar.empty')
                  : tTerm('credits.calendar.dayPanel.empty')}
              </div>
            )}
          </aside>
        </div>

        <div className="credits-calendar-table mt-4">
          <div className="credits-calendar-table__header">
            <div>
              <h3 className="text-base font-semibold text-text-primary">{tTerm('credits.calendar.table.title')}</h3>
              <p className="mt-1 text-sm text-text-secondary">{selectedDayLabel}</p>
            </div>
            <span className="rounded-full border border-border-subtle bg-bg-base px-3 py-1 text-xs font-semibold text-text-secondary">
              {tTerm('credits.agenda.count', { count: selectedDayEvents.length })}
            </span>
          </div>

          <AppTable
            variant="operational"
            className="data-table-surface"
            minWidthClassName="min-w-[820px]"
            tableClassName="w-full text-left text-sm"
            statePresentation="shell"
            hasData={selectedDayEvents.length > 0}
            emptyContent={<div className="px-4 py-8 text-center text-text-secondary">{tTerm('credits.calendar.table.empty')}</div>}
            recordsLabel={tTerm('credits.agenda.count', { count: selectedDayEvents.length })}
            pagination={dayTablePagination}
          >
            <thead>
              <tr>
                <th className="min-w-[180px] px-3 py-3 font-semibold">{tTerm('credits.calendar.table.client')}</th>
                <th className="px-3 py-3 font-semibold">{tTerm('credits.calendar.table.credit')}</th>
                <th className="px-3 py-3 font-semibold">{tTerm('credits.calendar.table.installment')}</th>
                <th className="px-3 py-3 font-semibold">{tTerm('credits.calendar.table.dueDate')}</th>
                <th className="px-3 py-3 text-right font-semibold">{tTerm('credits.calendar.table.suggestedCollection')}</th>
                <th className="px-3 py-3 font-semibold">{tTerm('credits.calendar.table.status')}</th>
                <TableActionsHeader className="px-3 py-3 font-semibold">{tTerm('credits.calendar.table.actions')}</TableActionsHeader>
              </tr>
            </thead>
            <tbody>
              {dayTableRows.map((event) => (
                <tr key={event.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-hover-bg/60">
                  <td className="px-3 py-4">
                    <button
                      type="button"
                      role="button"
                      className="flex max-w-full items-center gap-2.5 rounded-lg text-left transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                      onClick={() => onSelectEvent(event)}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-primary/10 text-xs font-bold text-brand-primary">
                        {getClientInitials(event.clientName)}
                      </span>
                      <span className="truncate font-semibold text-text-primary">{event.clientName}</span>
                    </button>
                  </td>
                  <td className="px-3 py-4 text-text-secondary">{tTerm('credits.calendar.table.creditRef', { id: event.loanId })}</td>
                  <td className="px-3 py-4 text-text-secondary">
                    {event.totalInstallments > 0
                      ? tTerm('credits.agenda.installmentOf', { number: event.installmentNumber, total: event.totalInstallments })
                      : tTerm('credits.agenda.installment', { number: event.installmentNumber })}
                  </td>
                  <td className="px-3 py-4 text-text-secondary">{getEventDateLabel(event.start)}</td>
                  <td className="px-3 py-4 text-right font-semibold text-text-primary">{formatCurrency(getEventPayable(event))}</td>
                  <td className="px-3 py-4">
                    <div className="flex flex-col items-start gap-1.5">
                      {renderStatusChip(event.status)}
                      {event.daysOverdue > 0 && (
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                          {tTerm('credits.agenda.daysOverdue', { count: event.daysOverdue })}
                        </span>
                      )}
                    </div>
                  </td>
                  <TableActionsCell className="px-3 py-4">
                    <RowActionsWithOverflow
                      variant="icon"
                      align="center"
                      items={getRowActionItems(event)}
                      ariaLabel={tTerm('credits.calendar.table.actions')}
                    />
                  </TableActionsCell>
                </tr>
              ))}
            </tbody>
          </AppTable>
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
                modalStatusTone === 'success'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : modalStatusTone === 'danger'
                    ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                    : modalStatusTone === 'warning'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                      : 'bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20 dark:text-brand-primary'
              }`}>
                {modalStatusTone === 'success' ? <CheckCircle2 size={24} />
                  : modalStatusTone === 'danger' ? <AlertCircle size={24} />
                    : modalStatusTone === 'warning' ? <AlertTriangle size={24} />
                      : <Clock size={24} />}
              </div>
              <div>
                <div className="text-sm text-text-secondary">{tTerm('credits.modal.status')}</div>
                <div className="text-lg font-semibold">
                  {getCalendarStatusLabel(selectedEvent.status)}
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
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{selectedEvent.disabledReason}</span>
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
