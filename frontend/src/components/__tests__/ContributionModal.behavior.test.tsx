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
});
