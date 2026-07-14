import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReportTabPanel } from '../ReportTabPanel';

describe('ReportTabPanel', () => {
  it('keeps report filters visible without requiring another click', () => {
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
    expect(screen.getByLabelText('Año')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Filtros' })).not.toBeInTheDocument();
  });

  it('does not add a redundant filter toggle when filters are active', () => {
    render(
      <ReportTabPanel
        title="Pago de cuotas"
        filters={<label htmlFor="payment-state">Estado<input id="payment-state" /></label>}
        activeFilterCount={2}
      />,
    );

    expect(screen.getByLabelText('Estado')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Filtros (2)' })).not.toBeInTheDocument();
  });
});
