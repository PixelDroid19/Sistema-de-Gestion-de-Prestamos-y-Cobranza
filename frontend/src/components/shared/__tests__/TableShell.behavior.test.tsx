import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TableShell from '../TableShell';

describe('TableShell', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses translated pagination controls', () => {
    localStorage.setItem('app.locale', 'en');

    render(
      <TableShell
        isLoading={false}
        isError={false}
        hasData
        loadingContent={<span>Loading</span>}
        errorContent={<span>Error</span>}
        emptyContent={<span>Empty</span>}
        recordsLabel="payments"
        pagination={{
          page: 1,
          pageSize: 10,
          totalItems: 25,
          totalPages: 3,
          onPrev: vi.fn(),
          onNext: vi.fn(),
          onPageSizeChange: vi.fn(),
        }}
      >
        <table>
          <tbody>
            <tr>
              <td>Payment</td>
            </tr>
          </tbody>
        </table>
      </TableShell>,
    );

    expect(screen.getByText('Showing 1 to 10 of 25 payments')).toBeInTheDocument();
    expect(screen.getByText('Rows per page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });
});
