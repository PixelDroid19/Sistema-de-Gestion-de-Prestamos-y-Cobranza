import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewAssociate from '../NewAssociate';
import { toast } from '../../lib/toast';

const createAssociateMock = { mutateAsync: vi.fn() };
const updateAssociateMock = { mutateAsync: vi.fn() };
const runSubmitMock = vi.fn();
const useAssociatesMock = vi.fn((_params?: unknown, _options?: unknown) => ({
  createAssociate: createAssociateMock,
  updateAssociate: updateAssociateMock,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({}),
}));

vi.mock('../../services/associateService', () => ({
  useAssociates: (params?: unknown, options?: unknown) => useAssociatesMock(params, options),
  useAssociateById: () => ({
    data: null,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../hooks/useCreateEntitySubmit', () => ({
  useCreateEntitySubmit: () => ({
    isSubmitting: false,
    run: runSubmitMock,
  }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('NewAssociate behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fillRequiredFields = (container: HTMLElement) => {
    fireEvent.change(container.querySelector('#new-associate-name') as HTMLInputElement, {
      target: { value: 'Socio Operativo' },
    });
    fireEvent.change(container.querySelector('#new-associate-email') as HTMLInputElement, {
      target: { value: 'socio@test.local' },
    });
    fireEvent.change(container.querySelector('#new-associate-phone') as HTMLInputElement, {
      target: { value: '3001234567' },
    });
  };

  it('does not prefetch the associates list on the new associate form', () => {
    render(<NewAssociate onBack={vi.fn()} />);

    expect(useAssociatesMock).toHaveBeenCalledWith(undefined, { enabled: false });
  });

  it('normalizes initial capital before submitting the associate', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fillRequiredFields(container);
    fireEvent.change(container.querySelector('#new-associate-initial-capital') as HTMLInputElement, {
      target: { value: '2000000' },
    });

    expect(container.querySelector('#new-associate-initial-capital')).toHaveValue('2.000.000');

    fireEvent.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(runSubmitMock).toHaveBeenCalledWith(expect.objectContaining({ initialCapital: '2000000' }));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does not share invalid money text with associate form state', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fillRequiredFields(container);
    fireEvent.change(container.querySelector('#new-associate-initial-capital') as HTMLInputElement, {
      target: { value: '100e2' },
    });

    expect(container.querySelector('#new-associate-initial-capital')).toHaveValue('');
  });

  it('no longer asks for a profit participation percentage', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    expect(container.querySelector('#new-associate-participation')).toBeNull();
  });

  it('submits only the associate creation fields supported by the current contract', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fillRequiredFields(container);
    fireEvent.change(container.querySelector('#new-associate-initial-capital') as HTMLInputElement, {
      target: { value: '2000000' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear socio' }));

    const submittedPayload = runSubmitMock.mock.calls.at(-1)?.[0];
    expect(Object.keys(submittedPayload).sort()).toEqual([
      'email',
      'initialCapital',
      'interestPaymentDay',
      'interestPaymentMonth',
      'interestRate',
      'interestType',
      'name',
      'phone',
      'status',
    ]);
  });

  it('normalizes decimal interest rates and rejects exponent-like values', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fillRequiredFields(container);
    fireEvent.change(container.querySelector('#new-associate-interest-rate') as HTMLInputElement, {
      target: { value: '2,5' },
    });
    expect(container.querySelector('#new-associate-interest-rate')).toHaveValue('2.5');

    fireEvent.change(container.querySelector('#new-associate-interest-rate') as HTMLInputElement, {
      target: { value: '1e2' },
    });

    expect(container.querySelector('#new-associate-interest-rate')).toHaveValue('2.5');
  });

  it('normalizes bounded interest payment days and rejects exponent-like values', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fillRequiredFields(container);
    fireEvent.change(container.querySelector('#new-associate-interest-day') as HTMLInputElement, {
      target: { value: '08' },
    });
    expect(container.querySelector('#new-associate-interest-day')).toHaveValue('8');

    fireEvent.change(container.querySelector('#new-associate-interest-day') as HTMLInputElement, {
      target: { value: '1e1' },
    });

    expect(container.querySelector('#new-associate-interest-day')).toHaveValue('8');
  });

  it('shows annual payment month only when annual interest is selected', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    expect(container.querySelector('#new-associate-interest-month')).not.toBeInTheDocument();

    fireEvent.change(container.querySelector('#new-associate-interest-type') as HTMLSelectElement, {
      target: { value: 'annual' },
    });

    expect(container.querySelector('#new-associate-interest-month')).toBeInTheDocument();

    fireEvent.change(container.querySelector('#new-associate-interest-type') as HTMLSelectElement, {
      target: { value: 'monthly' },
    });

    expect(container.querySelector('#new-associate-interest-month')).not.toBeInTheDocument();
  });
});
