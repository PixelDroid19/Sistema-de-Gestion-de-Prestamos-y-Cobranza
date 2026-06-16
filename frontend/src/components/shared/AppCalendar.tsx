import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { tTerm } from '../../i18n/terminology';
import './AppCalendar.css';

export type CalendarEventTone = 'success' | 'info' | 'danger' | 'warning' | 'neutral';

export interface CalendarEvent {
  id: string;
  /** Event date. Interpreted with UTC date-only semantics to avoid TZ drift. */
  date: Date;
  title: string;
  /** Optional secondary line (e.g. an amount). */
  meta?: string;
  /** Rich hover label (e.g. client + installment + amount). */
  tooltip?: string;
  tone?: CalendarEventTone;
}

export interface AppCalendarProps {
  events: CalendarEvent[];
  /** Month to show first. Defaults to today. */
  initialDate?: Date;
  /** Currently highlighted day key ('YYYY-MM-DD'), controlled by the parent. */
  selectedDate?: string | null;
  /** Soft highlight for an operational day (e.g. next actionable due date) without selecting it. */
  highlightDate?: string | null;
  onSelectDate?: (dayKey: string, dayEvents: CalendarEvent[]) => void;
  onSelectEvent?: (eventId: string) => void;
  /** 0 = Sunday, 1 = Monday (default). */
  weekStartsOn?: 0 | 1;
  /** Max event chips per day before collapsing into "+N". */
  maxVisiblePerDay?: number;
  /** Optional legend / footer rendered under the grid. */
  footer?: ReactNode;
  className?: string;
}

/** Build a stable 'YYYY-MM-DD' key from a date using its UTC parts. */
export const toCalendarDayKey = (date: Date): string => [
  date.getUTCFullYear(),
  String(date.getUTCMonth() + 1).padStart(2, '0'),
  String(date.getUTCDate()).padStart(2, '0'),
].join('-');

const utcTodayKey = (): string => toCalendarDayKey(new Date());

type GridDay = {
  key: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
};

const buildMonthGrid = (year: number, month: number, weekStartsOn: 0 | 1): GridDay[] => {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const leadingDays = (firstOfMonth.getUTCDay() - weekStartsOn + 7) % 7;
  const gridStart = new Date(Date.UTC(year, month, 1 - leadingDays));

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(Date.UTC(
      gridStart.getUTCFullYear(),
      gridStart.getUTCMonth(),
      gridStart.getUTCDate() + index,
    ));
    return {
      key: toCalendarDayKey(day),
      dayOfMonth: day.getUTCDate(),
      inCurrentMonth: day.getUTCMonth() === month,
    };
  });
};

export default function AppCalendar({
  events,
  initialDate,
  selectedDate = null,
  highlightDate = null,
  onSelectDate,
  onSelectEvent,
  weekStartsOn = 1,
  maxVisiblePerDay = 3,
  footer,
  className = '',
}: AppCalendarProps) {
  const { locale } = useTranslation();
  const baseDate = initialDate && !Number.isNaN(initialDate.getTime()) ? initialDate : new Date();
  const [view, setView] = useState({ year: baseDate.getUTCFullYear(), month: baseDate.getUTCMonth() });

  const todayKey = utcTodayKey();

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      if (Number.isNaN(event.date.getTime())) return;
      const key = toCalendarDayKey(event.date);
      const bucket = map.get(key);
      if (bucket) bucket.push(event);
      else map.set(key, [event]);
    });
    return map;
  }, [events]);

  const grid = useMemo(
    () => buildMonthGrid(view.year, view.month, weekStartsOn),
    [view.year, view.month, weekStartsOn],
  );

  const monthLabel = useMemo(() => {
    const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(view.year, view.month, 1)));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [locale, view.year, view.month]);

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    // 2024-01-01 is a Monday; offset by weekStartsOn.
    return Array.from({ length: 7 }, (_, index) => {
      const label = formatter.format(new Date(Date.UTC(2024, 0, 1 + ((index + weekStartsOn - 1 + 7) % 7))));
      return label.charAt(0).toUpperCase() + label.slice(1).replace(/\.$/, '');
    });
  }, [locale, weekStartsOn]);

  const moveMonth = (delta: number) => {
    const next = new Date(Date.UTC(view.year, view.month + delta, 1));
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  };

  const goToToday = () => {
    const now = new Date();
    setView({ year: now.getUTCFullYear(), month: now.getUTCMonth() });
    onSelectDate?.(todayKey, eventsByDay.get(todayKey) || []);
  };

  const selectDay = (key: string) => onSelectDate?.(key, eventsByDay.get(key) || []);

  return (
    <div className={`app-calendar ${className}`.trim()} data-testid="app-calendar">
      <div className="app-calendar__header">
        <h4 className="app-calendar__title" aria-live="polite">{monthLabel}</h4>
        <div className="app-calendar__nav">
          <button
            type="button"
            className="app-calendar__nav-btn app-calendar__nav-btn--icon"
            aria-label={tTerm('credits.calendar.nav.previous')}
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button type="button" className="app-calendar__nav-btn" onClick={goToToday}>
            {tTerm('credits.calendar.nav.today')}
          </button>
          <button
            type="button"
            className="app-calendar__nav-btn app-calendar__nav-btn--icon"
            aria-label={tTerm('credits.calendar.nav.next')}
            onClick={() => moveMonth(1)}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="app-calendar__weekdays" aria-hidden="true">
        {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
      </div>

      <div className="app-calendar__grid" role="grid">
        {grid.map((day) => {
          const dayEvents = eventsByDay.get(day.key) || [];
          const isToday = day.key === todayKey;
          const isSelected = day.key === selectedDate;
          const isHighlighted = day.key === highlightDate;
          const visible = dayEvents.slice(0, maxVisiblePerDay);
          const hidden = dayEvents.length - visible.length;
          const dayClasses = [
            'app-calendar__day',
            day.inCurrentMonth ? '' : 'app-calendar__day--outside',
            isToday ? 'app-calendar__day--today' : '',
            isHighlighted ? 'app-calendar__day--highlight' : '',
            isSelected ? 'app-calendar__day--selected' : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={day.key}
              role="gridcell"
              tabIndex={0}
              aria-selected={isSelected}
              className={dayClasses}
              onClick={() => selectDay(day.key)}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                  keyEvent.preventDefault();
                  selectDay(day.key);
                }
              }}
            >
              <div className="app-calendar__day-head">
                <span className={`app-calendar__daynum ${isToday ? 'app-calendar__daynum--today' : ''}`.trim()}>
                  {day.dayOfMonth}
                </span>
                {dayEvents.length > 0 && (
                  <span className="app-calendar__dots" aria-hidden="true">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span key={event.id} className={`app-calendar__dot app-calendar__dot--${event.tone || 'info'}`} />
                    ))}
                  </span>
                )}
              </div>

              {dayEvents.length > 0 && (
                <div className="app-calendar__events">
                  {visible.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`app-calendar__event app-calendar__event--${event.tone || 'info'}`}
                      title={event.tooltip || (event.meta ? `${event.title} · ${event.meta}` : event.title)}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onSelectEvent?.(event.id);
                      }}
                    >
                      <span className="app-calendar__event-title">{event.title}</span>
                      {event.meta && <span className="app-calendar__event-meta">{event.meta}</span>}
                    </button>
                  ))}
                  {hidden > 0 && (
                    <button
                      type="button"
                      className="app-calendar__more"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        selectDay(day.key);
                      }}
                    >
                      +{hidden}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {footer && <div className="app-calendar__legend">{footer}</div>}
    </div>
  );
}
