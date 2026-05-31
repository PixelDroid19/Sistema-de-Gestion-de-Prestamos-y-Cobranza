import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InstallmentsModal from '../InstallmentsModal';

describe('InstallmentsModal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses translated copy for loading and close states', () => {
    localStorage.setItem('app.locale', 'en');

    render(<InstallmentsModal installments={undefined} isLoading onClose={vi.fn()} />);

    expect(screen.getByText('Loading installments...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByText('Cargando cuotas...')).not.toBeInTheDocument();
  });

  it('closes with Escape through the shared modal shell', () => {
    const onClose = vi.fn();

    render(<InstallmentsModal installments={undefined} isLoading onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Pagos de intereses programados' }), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
