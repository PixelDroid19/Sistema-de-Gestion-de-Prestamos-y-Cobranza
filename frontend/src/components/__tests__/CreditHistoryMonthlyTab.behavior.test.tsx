import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreditHistoryMonthlyTab from '../reports/CreditHistoryMonthlyTab';

describe('CreditHistoryMonthlyTab behavior', () => {
  it('uses operational placeholders instead of ID terminology for numeric filters', () => {
    render(
      <CreditHistoryMonthlyTab
        filters={{ startDate: '', endDate: '', status: '', customerId: '', loanId: '' }}
        onFiltersChange={vi.fn()}
        data={{ summary: {}, months: [] }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Más filtros' }));

    expect(screen.queryByPlaceholderText('ID cliente')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('ID crédito')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Número de cliente')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Número de crédito')).toBeInTheDocument();
  });
});
