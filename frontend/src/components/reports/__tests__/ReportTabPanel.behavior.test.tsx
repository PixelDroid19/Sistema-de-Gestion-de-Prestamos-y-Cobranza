import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReportTabPanel } from '../ReportTabPanel';

describe('ReportTabPanel', () => {
  it('keeps filters collapsed until the user asks for them', () => {
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

    const toggle = screen.getByRole('button', { name: 'Filtros' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByLabelText('Año')).toBeVisible();
  });

  it('shows active filters outside the collapsed panel and removes one at a time', () => {
    const onRemove = vi.fn();
    const onClearAllFilters = vi.fn();

    render(
      <ReportTabPanel
        title="Pago de cuotas"
        filters={<label htmlFor="payment-state">Estado<input id="payment-state" /></label>}
        activeFilterCount={1}
        activeFilters={[{
          id: 'status',
          label: 'Estado',
          value: 'Completado',
          onRemove,
        }]}
        onClearAllFilters={onClearAllFilters}
      />,
    );

    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros (1)' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Estado: Completado')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro Estado' }));
    expect(onRemove).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(onClearAllFilters).toHaveBeenCalledOnce();
  });
});
