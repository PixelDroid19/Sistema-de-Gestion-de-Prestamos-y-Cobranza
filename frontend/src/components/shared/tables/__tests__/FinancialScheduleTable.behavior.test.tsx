import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FinancialScheduleTable } from '../FinancialScheduleTable';
import { FINANCIAL_SCHEDULE_TABLE_CLASS } from '../tableActionStyles';

describe('FinancialScheduleTable', () => {
  it('renders the shared financial schedule table shell', () => {
    render(
      <FinancialScheduleTable data-testid="financial-table">
        <thead>
          <tr>
            <th>Col</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Val</td>
          </tr>
        </tbody>
      </FinancialScheduleTable>,
    );

    const table = screen.getByTestId('financial-table');
    expect(table).toHaveClass(FINANCIAL_SCHEDULE_TABLE_CLASS);
    expect(table).toHaveClass('w-full', 'text-sm', 'text-left');
    expect(table.closest('.data-table-surface')).toBeTruthy();
    expect(screen.getByText('Val')).toBeInTheDocument();
  });
});
