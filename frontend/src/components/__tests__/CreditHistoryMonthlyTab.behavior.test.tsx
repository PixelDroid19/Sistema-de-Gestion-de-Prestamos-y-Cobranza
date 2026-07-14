import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreditHistoryMonthlyTab from '../reports/CreditHistoryMonthlyTab';

vi.mock('../../services/customerService', () => ({
  useCustomers: () => ({
    data: {
      data: {
        customers: [{
          id: 7,
          name: 'Cliente Historial',
          documentNumber: 'CC-7',
          status: 'active',
        }],
      },
    },
    isLoading: false,
    isError: false,
  }),
}));

const emptyFilters = { startDate: '', endDate: '', status: '', customerId: '' };

describe('CreditHistoryMonthlyTab behavior', () => {
  it('uses a searchable customer filter instead of asking for internal ids', () => {
    render(
      <CreditHistoryMonthlyTab
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        data={{ summary: {}, months: [] }}
      />,
    );

    expect(screen.queryByPlaceholderText('ID cliente')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Número de cliente')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    expect(screen.getByRole('combobox', { name: 'Clientes para filtrar' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Créditos para filtrar' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tipo de crédito')).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole('combobox', { name: 'Clientes para filtrar' }));
    expect(screen.getByRole('option', { name: /Cliente Historial · CC-7/i })).toBeInTheDocument();
  });

  it('describes an active customer filter without exposing its internal id', () => {
    render(
      <CreditHistoryMonthlyTab
        filters={{ ...emptyFilters, customerId: '7' }}
        onFiltersChange={vi.fn()}
        data={{ summary: {}, months: [] }}
      />,
    );

    expect(screen.getByText('Cliente: Seleccionado')).toBeVisible();
    expect(screen.queryByText('Cliente: #7')).not.toBeInTheDocument();
  });

  it('shows a simple loan list without collection metrics or summary cards', () => {
    render(
      <CreditHistoryMonthlyTab
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        data={{
          summary: { creditsCreated: 1, totalPrincipalCreated: 1800000 },
          months: [],
          credits: [
            {
              creditId: 15,
              customerName: 'Cliente Historial',
              status: 'Activo',
              creditDate: '2026-04-01',
              amount: 1800000,
              principalOutstanding: 1200000,
              totalPaid: 700000,
              interestPaid: 90000,
              penaltyPaid: 0,
            },
          ],
          payments: [],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Detalle de créditos' })).toBeInTheDocument();
    expect(screen.getAllByText('Cliente Historial').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Crédito #15').length).toBeGreaterThan(0);
    expect(screen.getByText('Mostrando 1 a 1 de 1 créditos')).toBeInTheDocument();
    expect(screen.getByText('COP 1.800.000')).toBeInTheDocument();
    expect(screen.queryByText(/Interés cobrado/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Capital vivo/)).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Total pagado' })).not.toBeInTheDocument();
    expect(screen.queryByText('Créditos creados')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Historial de recaudo' })).not.toBeInTheDocument();
  });

  it('normalizes alternative backend field names without rendering zeros or N/A', () => {
    render(
      <CreditHistoryMonthlyTab
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        data={{
          summary: {},
          months: [],
          credits: [
            {
              loanId: 104,
              customerName: 'Carlos Ruiz',
              status: 'active',
              createdAt: '2026-04-22',
              amount: 15000000,
              outstandingPrincipal: 9800000,
              totalPaid: 7200000,
            },
          ],
          payments: [],
        }}
      />,
    );

    expect(screen.getByText('22/04/2026')).toBeInTheDocument();
    expect(screen.getAllByText('Crédito #104').length).toBeGreaterThan(0);
    expect(screen.getByText('COP 15.000.000')).toBeInTheDocument();
    expect(screen.getAllByText('Activo').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('N/A').length).toBe(0);
  });
});
