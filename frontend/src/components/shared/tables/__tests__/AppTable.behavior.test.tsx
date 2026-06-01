import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppTable } from '../AppTable';
import { resolveUseTableShell } from '../tableTypes'; // internal helper — not re-exported from tables/index

describe('resolveUseTableShell', () => {
  it('returns false when shell is off', () => {
    expect(resolveUseTableShell({ shell: 'off', pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, onPrev: () => {}, onNext: () => {} } })).toBe(false);
  });

  it('returns true when pagination is provided in auto mode', () => {
    expect(resolveUseTableShell({
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, onPrev: () => {}, onNext: () => {} },
    })).toBe(true);
  });
});

describe('AppTable', () => {
  it('renders financial variant with dense schedule class', () => {
    render(
      <AppTable variant="financial" visibleFrom="always">
        <thead>
          <tr>
            <th>Cuota</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
          </tr>
        </tbody>
      </AppTable>,
    );

    const table = screen.getByRole('table');
    expect(table).toHaveClass('financial-schedule-table');
  });

  it('renders operational variant without pagination when omitted', () => {
    render(
      <AppTable variant="operational" shell="off" aria-label="Listado estático">
        <thead>
          <tr>
            <th>Cliente</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Acme</td>
          </tr>
        </tbody>
      </AppTable>,
    );

    expect(screen.getByRole('table', { name: 'Listado estático' })).toBeInTheDocument();
    expect(screen.queryByText(/Anterior/i)).not.toBeInTheDocument();
  });

  it('renders operational pagination through TableShell', () => {
    render(
      <AppTable
        variant="operational"
        aria-label="Listado paginado"
        recordsLabel="registros"
        pagination={{
          page: 2,
          pageSize: 10,
          totalItems: 25,
          totalPages: 3,
          onPrev: () => {},
          onNext: () => {},
        }}
      >
        <thead>
          <tr>
            <th>Cliente</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Acme</td>
          </tr>
        </tbody>
      </AppTable>,
    );

    expect(screen.getByRole('table', { name: 'Listado paginado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Anterior/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Siguiente/i })).toBeInTheDocument();
  });

  it('renders footer outside the table element', () => {
    const { container } = render(
      <AppTable variant="operational" shell="off" footer={<div data-testid="table-footer">Pie</div>}>
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
      </AppTable>,
    );

    const table = container.querySelector('table');
    const footer = screen.getByTestId('table-footer');
    expect(table?.contains(footer)).toBe(false);
    expect(footer).toBeInTheDocument();
  });
});
