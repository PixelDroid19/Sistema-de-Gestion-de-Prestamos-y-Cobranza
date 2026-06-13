import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreditsCalendarView from '../credits/CreditsCalendarView';
import type { CalendarOverviewResponse, InstallmentEvent } from '../credits/creditsHelpers';

const selectedEvent: InstallmentEvent = {
  id: '77-1',
  loanId: 77,
  title: 'Cliente Prueba',
  start: new Date('2026-04-24T00:00:00.000Z'),
  end: new Date('2026-04-24T00:00:00.000Z'),
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
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Detalle de cuota' });

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onSelectEvent).toHaveBeenCalledWith(null);
  });
});
