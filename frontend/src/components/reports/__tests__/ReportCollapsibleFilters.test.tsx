import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportCollapsibleFilters } from '../ReportCollapsibleFilters';
import { FormField, TextInput } from '../../shared/Surfaces';

describe('ReportCollapsibleFilters', () => {
  it('toggles advanced filters and exposes aria-expanded', () => {
    render(
      <ReportCollapsibleFilters>
        <FormField label="Cliente">
          <TextInput aria-label="Cliente" />
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
          <TextInput aria-label="Crédito" />
        </FormField>
      </ReportCollapsibleFilters>,
    );

    expect(screen.getByRole('button', { name: 'Ocultar filtros' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Crédito')).toBeInTheDocument();
  });
});
