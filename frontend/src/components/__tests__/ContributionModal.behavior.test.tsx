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
});
