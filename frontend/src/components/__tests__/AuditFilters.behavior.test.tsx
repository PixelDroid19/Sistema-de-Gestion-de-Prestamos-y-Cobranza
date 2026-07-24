import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuditFilters from '../AuditFilters';

describe('AuditFilters behavior', () => {
  it('uses operator-facing labels while preserving audit filter values', () => {
    const onFilter = vi.fn();

    render(<AuditFilters onFilter={onFilter} onReset={vi.fn()} />);

    expect(screen.queryByText('ID usuario')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ID de entidad/i)).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Finanzas' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar evento'), { target: { value: '23' } });
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    expect(onFilter).toHaveBeenCalledWith(expect.objectContaining({
      entityId: '23',
      userId: '7',
    }));
  });
});
