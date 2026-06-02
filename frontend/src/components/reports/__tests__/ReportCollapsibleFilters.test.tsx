import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportCollapsibleFilters } from '../ReportCollapsibleFilters';
import { AppInput, FormField } from '../../shared/Surfaces';

describe('ReportCollapsibleFilters', () => {
  it('toggles advanced filters and exposes aria-expanded', () => {
    render(
      <ReportCollapsibleFilters>
        <FormField label="Cliente">
          <AppInput aria-label="Cliente" value="" onValueChange={() => {}} />
        </FormField>
      </ReportCollapsibleFilters>,
    );

    const toggle = screen.getByRole('button', { name: 'Más filtros' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Cliente')).toBeInTheDocument();
  });

  it('opens automatically when activeCount is greater than zero', () => {
    render(
      <ReportCollapsibleFilters activeCount={2}>
        <FormField label="Crédito">
          <AppInput aria-label="Crédito" value="" onValueChange={() => {}} />
        </FormField>
      </ReportCollapsibleFilters>,
    );

    expect(screen.getByRole('button', { name: 'Ocultar filtros' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Crédito')).toBeInTheDocument();
  });
});
