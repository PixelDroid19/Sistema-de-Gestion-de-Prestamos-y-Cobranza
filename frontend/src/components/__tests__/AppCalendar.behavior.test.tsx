import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppCalendar, { toCalendarDayKey, type CalendarEvent } from '../shared/AppCalendar';

vi.mock('../../i18n', () => ({
  useTranslation: () => ({ locale: 'es-CO' }),
}));

vi.mock('../../i18n/terminology', () => ({
  tTerm: (key: string) => {
    const labels: Record<string, string> = {
      'credits.calendar.nav.previous': 'Anterior',
      'credits.calendar.nav.today': 'Hoy',
      'credits.calendar.nav.next': 'Siguiente',
    };
    return labels[key] || key;
  },
}));

const buildEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: '1-1',
  date: new Date('2026-06-15T00:00:00.000Z'),
  title: 'Cuota 1/12 - Cliente Prueba',
  meta: 'COP 100.000',
  tooltip: 'Cuota 1/12 - Cliente Prueba · COP 100.000',
  tone: 'info',
  ...overrides,
});

describe('AppCalendar behavior', () => {
  it('renders the month title without capitalizing every word', () => {
    render(
      <AppCalendar
        events={[]}
        initialDate={new Date('2026-07-01T00:00:00.000Z')}
      />,
    );

    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Julio de 2026');
  });

  it('exposes the rich tooltip on event chips', () => {
    render(
      <AppCalendar
        events={[buildEvent()]}
        initialDate={new Date('2026-06-01T00:00:00.000Z')}
      />,
    );

    expect(screen.getByRole('button', { name: /Cuota 1\/12 - Cliente Prueba/i })).toHaveAttribute(
      'title',
      'Cuota 1/12 - Cliente Prueba · COP 100.000',
    );
  });

  it('applies the highlight class to the highlighted day', () => {
    const dayKey = toCalendarDayKey(new Date('2026-06-15T00:00:00.000Z'));

    render(
      <AppCalendar
        events={[buildEvent()]}
        initialDate={new Date('2026-06-01T00:00:00.000Z')}
        highlightDate={dayKey}
      />,
    );

    const highlightedCell = screen.getByRole('gridcell', { name: /15/ });
    expect(highlightedCell.className).toContain('app-calendar__day--highlight');
  });

  it('notifies the parent when a day is selected', () => {
    const onSelectDate = vi.fn();
    const dayKey = toCalendarDayKey(new Date('2026-06-15T00:00:00.000Z'));

    render(
      <AppCalendar
        events={[buildEvent()]}
        initialDate={new Date('2026-06-01T00:00:00.000Z')}
        onSelectDate={onSelectDate}
      />,
    );

    fireEvent.click(screen.getByRole('gridcell', { name: /15/ }));

    expect(onSelectDate).toHaveBeenCalledWith(dayKey, expect.any(Array));
  });
});
