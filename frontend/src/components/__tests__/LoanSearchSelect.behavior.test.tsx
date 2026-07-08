import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoanSearchSelect from '../shared/inputs/LoanSearchSelect';

const mockUseLoans = vi.fn();

vi.mock('../../services/loanService', () => ({
  useLoans: (...args: unknown[]) => mockUseLoans(...args),
}));

describe('LoanSearchSelect behavior', () => {
  beforeEach(() => {
    mockUseLoans.mockReset();
  });

  it('uses contextual fallback options when loan endpoints are unavailable', () => {
    mockUseLoans.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(
      <LoanSearchSelect
        id="loan-search-fallback"
        selectedLoanId=""
        searchValue="77"
        onSearchValueChange={vi.fn()}
        onSelectedLoanIdChange={vi.fn()}
        listboxLabel="Créditos para filtrar"
        fallbackOptions={[
          {
            value: '77',
            label: 'Andrés Ruiz · Crédito #77',
            meta: 'Cuota 6 · Vencido',
          },
        ]}
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Créditos para filtrar' });
    fireEvent.focus(input);

    expect(screen.queryByText('No se pudieron cargar los créditos.')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Andrés Ruiz/i })).toBeInTheDocument();
  });

  it('falls back to the base loan list when remote search fails', () => {
    mockUseLoans.mockImplementation((params?: { search?: string }) => {
      if (params?.search) {
        return {
          data: undefined,
          isLoading: false,
          isError: true,
        };
      }

      return {
        data: {
          data: {
            loans: [
              {
                id: 77,
                customerName: 'Andrés Ruiz',
                amount: 1850000,
                status: 'active',
              },
              {
                id: 95,
                customerName: 'Claudia Torres',
                amount: 1200000,
                status: 'overdue',
              },
            ],
          },
        },
        isLoading: false,
        isError: false,
      };
    });

    render(
      <LoanSearchSelect
        id="loan-search"
        selectedLoanId=""
        searchValue="77"
        onSearchValueChange={vi.fn()}
        onSelectedLoanIdChange={vi.fn()}
        listboxLabel="Créditos para filtrar"
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Créditos para filtrar' });
    fireEvent.focus(input);

    expect(screen.queryByText('No se pudieron cargar los créditos.')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Andrés Ruiz/i })).toBeInTheDocument();
  });
});
