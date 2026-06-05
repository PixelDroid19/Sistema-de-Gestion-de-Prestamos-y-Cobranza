import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ContributionModal from '../ContributionModal';

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ContributionModal behavior', () => {
  it('shows the historical return terms stored with each contribution', () => {
    render(
      <ContributionModal
        contributions={[
          {
            id: 1,
            amount: 1200000,
            date: '2026-05-15T00:00:00.000Z',
            interestRateSnapshot: '2.5000',
            interestTypeSnapshot: 'monthly',
          },
        ]}
        isLoading={false}
        onAddContribution={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Rentabilidad pactada: 2,5% mensual')).toBeInTheDocument();
  });

  it('renders the real contribution status instead of a fixed completed badge', () => {
    render(
      <ContributionModal
        contributions={[
          {
            id: 7,
            amount: 900000,
            date: '2026-05-20T00:00:00.000Z',
            status: 'pending',
          },
        ]}
        isLoading={false}
        onAddContribution={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('closes with Escape through the shared modal shell', () => {
    const onClose = vi.fn();

    render(
      <ContributionModal
        contributions={[]}
        isLoading={false}
        onAddContribution={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Historial de aportes' }), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed contribution amounts instead of truncating them', () => {
    const onAddContribution = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <ContributionModal
        contributions={[]}
        isLoading={false}
        onAddContribution={onAddContribution}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo aporte' }));
    fireEvent.change(container.querySelector('#new-contribution-amount') as HTMLInputElement, { target: { value: '100e2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(onAddContribution).not.toHaveBeenCalled();
  });

  it('shows a Spanish inline validation error when the contribution amount is empty', async () => {
    const onAddContribution = vi.fn().mockResolvedValue(undefined);

    render(
      <ContributionModal
        contributions={[]}
        isLoading={false}
        onAddContribution={onAddContribution}
        onClose={vi.fn()}
        initialAddFormOpen
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('El monto es obligatorio.')).toBeInTheDocument();
    expect(onAddContribution).not.toHaveBeenCalled();
  });

  it('shows normalized contribution amounts while submitting canonical values', () => {
    const onAddContribution = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <ContributionModal
        contributions={[]}
        isLoading={false}
        onAddContribution={onAddContribution}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo aporte' }));
    fireEvent.change(container.querySelector('#new-contribution-amount') as HTMLInputElement, { target: { value: '1200000' } });

    expect(container.querySelector('#new-contribution-amount')).toHaveValue('1.200.000');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(onAddContribution).toHaveBeenCalledWith(expect.objectContaining({ amount: 1200000 }));
  });

  it('submits contribution date, status, and notes from the modal form', () => {
    const onAddContribution = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <ContributionModal
        contributions={[]}
        isLoading={false}
        onAddContribution={onAddContribution}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo aporte' }));
    fireEvent.change(container.querySelector('#new-contribution-amount') as HTMLInputElement, {
      target: { value: '3500000' },
    });
    fireEvent.change(screen.getByLabelText('Fecha del aporte'), { target: { value: '2026-06-04' } });
    fireEvent.change(screen.getByLabelText('Estado del aporte'), { target: { value: 'pending' } });
    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Aporte pendiente de conciliación' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(onAddContribution).toHaveBeenCalledWith({
      amount: 3500000,
      contributionDate: '2026-06-04',
      status: 'pending',
      notes: 'Aporte pendiente de conciliación',
    });
  });
});
