import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('keeps creation focused on data entry without an estimated-interest preview', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    expect(container.querySelector('[data-tour="new-associate-preview"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guía rápida' })).not.toBeInTheDocument();
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
    expect(submittedPayload).not.toHaveProperty('participationPercentage');
    expect(submittedPayload).not.toHaveProperty('interestStartDate');
    expect(submittedPayload).not.toHaveProperty('interestStartsAt');
  });

  it('omits empty initial capital from the create payload', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fillRequiredFields(container);
    fireEvent.click(screen.getByRole('button', { name: 'Crear socio' }));

    const submittedPayload = runSubmitMock.mock.calls.at(-1)?.[0];
    expect(submittedPayload).not.toHaveProperty('initialCapital');
    expect(Object.keys(submittedPayload).sort()).toEqual([
      'email',
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
    const rateInput = container.querySelector('#new-associate-interest-rate') as HTMLInputElement;
    expect(rateInput).toHaveAttribute('inputmode', 'decimal');
    expect(rateInput.closest('.operational-control')?.textContent).toContain('%');

    fireEvent.change(rateInput, {
      target: { value: '2,5' },
    });
    expect(rateInput).toHaveValue('2.5');

    fireEvent.change(rateInput, {
      target: { value: '1e2' },
    });

    expect(rateInput).toHaveValue('2.5');
  });

  it('starts with an empty rate field instead of a prefilled zero', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);
    expect(container.querySelector('#new-associate-interest-rate')).toHaveValue('');
  });

  it('uses a discrete day selector for interest payment day instead of free text', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    const daySelect = container.querySelector('#new-associate-interest-day') as HTMLSelectElement;
    expect(daySelect.tagName).toBe('SELECT');
    expect(within(daySelect).getAllByRole('option')).toHaveLength(28);

    fillRequiredFields(container);
    fireEvent.change(daySelect, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(runSubmitMock).toHaveBeenCalledWith(expect.objectContaining({
      interestPaymentDay: '15',
    }));
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
