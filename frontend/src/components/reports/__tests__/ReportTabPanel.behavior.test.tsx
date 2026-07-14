import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReportTabPanel } from '../ReportTabPanel';

describe('ReportTabPanel', () => {
  it('keeps optional filters out of the initial report surface', () => {
    render(
      <ReportTabPanel
        title="Cierre contable"
        subtitle="Caja del período"
        filters={<label htmlFor="report-year">Año<input id="report-year" /></label>}
      >
        <p>Datos del cierre</p>
      </ReportTabPanel>,
    );

    expect(screen.getByRole('heading', { name: 'Cierre contable' })).toBeInTheDocument();
    expect(screen.getByText('Datos del cierre')).toBeVisible();
    expect(screen.queryByLabelText('Año')).not.toBeInTheDocument();

    const filtersButton = screen.getByRole('button', { name: 'Filtros' });
    expect(filtersButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(filtersButton);

    expect(filtersButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Año')).toBeVisible();
  });

  it('opens active filters and includes their count in the accessible name', () => {
    render(
      <ReportTabPanel
        title="Pago de cuotas"
        filters={<label htmlFor="payment-state">Estado<input id="payment-state" /></label>}
        activeFilterCount={2}
      />,
    );

    expect(screen.getByRole('button', { name: 'Filtros (2)' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Estado')).toBeVisible();
  });
});
