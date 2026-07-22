import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportCollapsibleFilters } from '../ReportCollapsibleFilters';
import { AppInput, FormField } from '../../shared/Surfaces';

describe('ReportCollapsibleFilters', () => {
  it('starts closed and reveals filters with an accessible toggle', () => {
    render(
      <ReportCollapsibleFilters>
        <FormField label="Cliente">
          <AppInput aria-label="Cliente" value="" onValueChange={() => {}} />
        </FormField>
      </ReportCollapsibleFilters>,
    );

    const toggle = screen.getByRole('button', { name: 'Filtros' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Cliente')).not.toBeVisible();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Cliente')).toBeInTheDocument();
  });

  it('keeps active filters collapsed and announces their count', () => {
    render(
      <ReportCollapsibleFilters activeCount={2}>
        <FormField label="Crédito">
          <AppInput aria-label="Crédito" value="" onValueChange={() => {}} />
        </FormField>
      </ReportCollapsibleFilters>,
    );

    expect(screen.getByRole('button', { name: 'Filtros (2)' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Crédito')).not.toBeVisible();
  });
});
