import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreditsCalendarView from '../credits/CreditsCalendarView';
import type { CalendarOverviewResponse, InstallmentEvent } from '../credits/creditsHelpers';

// Pin the selected day to "today" so the agenda/table render deterministically:
// the view centres on the current date by default.
const todayUtc = new Date();
const dueDate = new Date(Date.UTC(
  todayUtc.getUTCFullYear(),
  todayUtc.getUTCMonth(),
  todayUtc.getUTCDate(),
));

const selectedEvent: InstallmentEvent = {
  id: '77-1',
  loanId: 77,
  title: 'Cuota 1/12 - Cliente Prueba',
  start: dueDate,
  end: dueDate,
  type: 'overdue',
  clientName: 'Cliente Prueba',
  installmentNumber: 1,
  totalInstallments: 12,
  amountToPay: 120000,
  interest: 40000,
  amortizedCapital: 80000,
  remainingCapital: 420000,
  arrears: 5000,
  payableAmount: 125000,
  daysOverdue: 4,
  canPay: true,
  disabledReason: null,
  isNextPayable: true,
  status: 'overdue',
  loanStatus: 'active',
};

const partialEvent: InstallmentEvent = {
  ...selectedEvent,
  id: '78-2',
  loanId: 78,
  type: 'pending',
  status: 'partial',
  clientName: 'Cliente Parcial',
  title: 'Cuota 2/12 - Cliente Parcial',
  installmentNumber: 2,
};

const calendarOverview: CalendarOverviewResponse = {
  asOfDate: '2026-05-31',
  summary: {
    totalLoans: 1,
    totalEntries: 1,
    paidCount: 0,
    pendingCount: 0,
    overdueCount: 1,
    dueTodayCount: 0,
    actionableCount: 1,
    totalPayableAmount: 125000,
    totalLateFeeAmount: 5000,
  },
  agenda: [],
  nextAction: null,
  entries: [],
};

const renderView = (overrides: Partial<Parameters<typeof CreditsCalendarView>[0]> = {}) => render(
  <CreditsCalendarView
    calendarEvents={[selectedEvent]}
    calendarOverview={calendarOverview}
    isCalendarLoading={false}
    selectedEvent={null}
    filters={{ search: '', status: '', startDate: '', endDate: '' }}
    onFiltersChange={vi.fn()}
    onClearFilters={vi.fn()}
    onSelectEvent={vi.fn()}
    onViewCredit={vi.fn()}
    user={{ role: 'admin' }}
    {...overrides}
  />,
);

describe('CreditsCalendarView behavior', () => {
  it('closes the selected event modal with Escape', () => {
    const onSelectEvent = vi.fn();

    render(
      <CreditsCalendarView
        calendarEvents={[selectedEvent]}
        calendarOverview={calendarOverview}
        isCalendarLoading={false}
        selectedEvent={selectedEvent}
        filters={{ search: '', status: '', startDate: '', endDate: '' }}
        onFiltersChange={vi.fn()}
        onClearFilters={vi.fn()}
        onSelectEvent={onSelectEvent}
        onViewCredit={vi.fn()}
        user={{ role: 'admin' }}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Detalle de cuota' });

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onSelectEvent).toHaveBeenCalledWith(null);
  });

  it('shows the partial legend and colours the aggregated day chip by worst status', () => {
    renderView({ calendarEvents: [partialEvent] });

    expect(screen.getByText('Parciales')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 crédito/i }).className).toContain('app-calendar__event--warning');
  });

  it('aggregates the day cell into a single count + amount chip', () => {
    renderView({ calendarEvents: [selectedEvent] });

    const chip = screen.getByRole('button', { name: /1 crédito/i });
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute('title', expect.stringContaining('1 crédito'));
  });

  it('renders the selected day worklist with the client and a schedule table', () => {
    renderView({ calendarEvents: [selectedEvent] });

    expect(screen.getByText('Cuotas del día')).toBeInTheDocument();
    // Client appears both in the agenda card and the day table.
    expect(screen.getAllByText('Cliente Prueba').length).toBeGreaterThan(0);

    const table = screen.getByRole('table');
    expect(within(table).getByText('Crédito 77')).toBeInTheDocument();
    expect(within(table).getAllByRole('button', { name: 'Ver crédito' }).length).toBeGreaterThan(0);
  });

  it('opens the installment detail modal when an agenda card is activated', () => {
    const onSelectEvent = vi.fn();
    renderView({ calendarEvents: [selectedEvent], onSelectEvent });

    const card = screen.getAllByText('Cliente Prueba')[0].closest('[role="button"]');
    expect(card).not.toBeNull();
    fireEvent.click(card!);

    expect(onSelectEvent).toHaveBeenCalledWith(selectedEvent);
  });

  it('keeps the payable amount in the compact day metrics instead of a repeated global strip', () => {
    renderView();

    expect(screen.getByText('Agenda operativa')).toBeInTheDocument();
    expect(screen.getByText('Cobro sugerido total')).toBeInTheDocument();
    expect(screen.getAllByText('COP 125.000').length).toBeGreaterThan(0);
  });
});
