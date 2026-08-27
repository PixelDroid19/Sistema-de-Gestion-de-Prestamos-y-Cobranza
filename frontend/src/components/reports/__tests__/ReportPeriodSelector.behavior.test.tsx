import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReportPeriodSelector, { getMonthDateRange } from '../ReportPeriodSelector';

describe('ReportPeriodSelector', () => {
  it('resolves complete calendar months, including leap years', () => {
    expect(getMonthDateRange('2028-02')).toEqual({
      fromDate: '2028-02-01',
      toDate: '2028-02-29',
    });
    expect(getMonthDateRange('2026-11')).toEqual({
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
    });
  });

  it('exposes explicit pressed states and clears hidden dates when changing mode', () => {
    const onChange = vi.fn();
    render(
      <ReportPeriodSelector
        value={{ fromDate: '2026-07-01', toDate: '2026-07-31' }}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Mes' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));

    expect(screen.getByRole('button', { name: 'Día' })).toHaveAttribute('aria-pressed', 'true');
    expect(onChange).toHaveBeenLastCalledWith({ fromDate: '', toDate: '' });
    expect(screen.getByLabelText('Día del reporte')).toBeVisible();
  });
});
