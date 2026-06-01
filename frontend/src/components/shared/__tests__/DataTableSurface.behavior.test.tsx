import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTableSurface } from '../Surfaces';
import { AppTable } from '../tables';

describe('DataTableSurface', () => {
  it('does not wrap AppTable in an extra overflow container', () => {
    const { container } = render(
      <DataTableSurface data-testid="surface">
        <AppTable variant="operational" shell="off" className="border-0 shadow-none bg-transparent rounded-none">
          <thead>
            <tr>
              <th>Col</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Valor</td>
            </tr>
          </tbody>
        </AppTable>
      </DataTableSurface>,
    );

    const surface = screen.getByTestId('surface');
    expect(surface).toHaveClass('data-table-surface');
    expect(surface.querySelector(':scope > .overflow-x-auto')).toBeNull();
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('allows flex layouts without an overflow wrapper', () => {
    const { container } = render(
      <DataTableSurface className="flex flex-col" data-testid="flex-surface">
        <div data-testid="row">Fila</div>
      </DataTableSurface>,
    );

    expect(screen.getByTestId('flex-surface').querySelector(':scope > .overflow-x-auto')).toBeNull();
    expect(screen.getByTestId('row')).toBeInTheDocument();
    expect(container.querySelector('table')).toBeNull();
  });
});
