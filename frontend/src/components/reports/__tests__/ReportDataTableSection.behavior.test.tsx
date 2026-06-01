import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportDataTableSection } from '../ReportDataTableSection';

describe('ReportDataTableSection', () => {
  it('uses operational AppTable by default', () => {
    const { container } = render(
      <ReportDataTableSection title="Resumen">
        <thead>
          <tr>
            <th>Mes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Enero</td>
          </tr>
        </tbody>
      </ReportDataTableSection>,
    );

    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
    expect(container.querySelector('.data-table-surface')).toBeInTheDocument();
    expect(container.querySelector('.data-table-surface > .overflow-x-auto > .overflow-x-auto')).toBeNull();
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
    expect(table).not.toHaveClass('financial-schedule-table');
  });

  it('supports financial variant when requested', () => {
    const { container } = render(
      <ReportDataTableSection tableVariant="financial">
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
      </ReportDataTableSection>,
    );

    expect(container.querySelector('table')).toHaveClass('financial-schedule-table');
  });

  it('renders operational pagination through TableShell', () => {
    render(
      <ReportDataTableSection
        recordsLabel="gastos"
        pagination={{
          page: 2,
          pageSize: 20,
          totalItems: 45,
          totalPages: 3,
          onPrev: () => {},
          onNext: () => {},
        }}
      >
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
      </ReportDataTableSection>,
    );

    expect(screen.getByRole('button', { name: /Anterior/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Siguiente/i })).toBeInTheDocument();
  });

  it('renders custom footer outside the table', () => {
    const { container } = render(
      <ReportDataTableSection
        shell="off"
        footer={<div data-testid="report-table-footer">Pie</div>}
      >
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
      </ReportDataTableSection>,
    );

    const table = container.querySelector('table');
    const footer = screen.getByTestId('report-table-footer');
    expect(table?.contains(footer)).toBe(false);
    expect(footer).toBeInTheDocument();
  });
});
