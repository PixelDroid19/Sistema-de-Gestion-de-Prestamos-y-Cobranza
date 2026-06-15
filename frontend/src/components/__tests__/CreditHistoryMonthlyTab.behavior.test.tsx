import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreditHistoryMonthlyTab from '../reports/CreditHistoryMonthlyTab';

vi.mock('../../services/loanService', () => ({
  useLoans: () => ({
    data: {
      data: {
        loans: [{
          id: 15,
          customerName: 'Cliente Historial',
          amount: 1800000,
          status: 'active',
        }],
      },
    },
    isLoading: false,
    isError: false,
  }),
}));

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

describe('CreditHistoryMonthlyTab behavior', () => {
  it('uses searchable customer and credit options instead of asking for internal ids', () => {
    render(
      <CreditHistoryMonthlyTab
        filters={{ startDate: '', endDate: '', status: '', customerId: '', loanId: '', financialProductId: '' }}
        onFiltersChange={vi.fn()}
        data={{ summary: {}, months: [] }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Más filtros' }));

    expect(screen.queryByPlaceholderText('ID cliente')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('ID crédito')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Número de cliente')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Número de crédito')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Clientes para filtrar' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Créditos para filtrar' })).toBeInTheDocument();
    fireEvent.focus(screen.getByRole('combobox', { name: 'Clientes para filtrar' }));
    expect(screen.getByRole('option', { name: /Cliente Historial · CC-7/i })).toBeInTheDocument();
    fireEvent.focus(screen.getByRole('combobox', { name: 'Créditos para filtrar' }));
    expect(screen.getByRole('option', { name: /Cliente Historial · Crédito/i })).toBeInTheDocument();
  });

  it('shows detailed loan and collection tables from the canonical monthly history response', () => {
    render(
      <CreditHistoryMonthlyTab
        filters={{ startDate: '', endDate: '', status: '', customerId: '', loanId: '', financialProductId: '' }}
        onFiltersChange={vi.fn()}
        data={{
          summary: {},
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
          payments: [
            {
              paymentId: 31,
              creditId: 15,
              customerName: 'Cliente Historial',
              paymentDate: '2026-04-10',
              paymentType: 'Cuota',
              status: 'Aplicado',
              amount: 120000,
              principalApplied: 90000,
              interestApplied: 30000,
              penaltyApplied: 0,
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Detalle de créditos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Historial de recaudo' })).toBeInTheDocument();
    expect(screen.getAllByText('Cliente Historial').length).toBeGreaterThan(1);
    expect(screen.getByText('Crédito #15')).toBeInTheDocument();
    expect(screen.getByText('Aplicado')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 a 1 de 1 créditos')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 a 1 de 1 pagos')).toBeInTheDocument();
  });
});
