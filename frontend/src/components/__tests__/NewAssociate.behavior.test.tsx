import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NewAssociate from '../NewAssociate';
import { toast } from '../../lib/toast';

const createAssociateMock = { mutateAsync: vi.fn() };
const updateAssociateMock = { mutateAsync: vi.fn() };
const runSubmitMock = vi.fn();
const useAssociatesMock = vi.fn((_params?: unknown, _options?: unknown) => ({
  createAssociate: createAssociateMock,
  updateAssociate: updateAssociateMock,
}));
let associateQueryState: any;

vi.mock('react-router-dom', () => ({
  useParams: () => ({}),
}));

vi.mock('../../services/associateService', () => ({
  useAssociates: (params?: unknown, options?: unknown) => useAssociatesMock(params, options),
  useAssociateById: () => associateQueryState,
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T17:00:00.000Z'));
    associateQueryState = {
      data: null,
      isLoading: false,
      isError: false,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fillContactFields = (container: HTMLElement) => {
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

  const fillCreationTerms = (container: HTMLElement, capital = '2000000', rate = '12') => {
    fireEvent.change(container.querySelector('#new-associate-initial-capital') as HTMLInputElement, {
      target: { value: capital },
    });
    fireEvent.change(container.querySelector('#new-associate-interest-rate') as HTMLInputElement, {
      target: { value: rate },
    });
  };

  it('does not prefetch the associates list on the new associate form', () => {
    render(<NewAssociate onBack={vi.fn()} />);

    expect(useAssociatesMock).toHaveBeenCalledWith(undefined, { enabled: false });
  });

  it('starts annual and active without exposing configuration that is not a creation decision', () => {
    render(<NewAssociate onBack={vi.fn()} />);

    const frequency = screen.getByRole('group', { name: 'Frecuencia de pago' });
    expect(within(frequency).getByRole('radio', { name: 'Anual' })).toBeChecked();
    expect(within(frequency).getByRole('radio', { name: 'Mensual' })).not.toBeChecked();
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Primer pago')).toHaveValue('2027-07-13');
  });

  it('normalizes capital and shows the agreed annual return before submission', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fillContactFields(container);
    fillCreationTerms(container);

    expect(container.querySelector('#new-associate-initial-capital')).toHaveValue('2.000.000');
    expect(screen.getByText('Recibirá COP 240.000 cada año')).toBeInTheDocument();
    expect(screen.getByText('Primer pago: 13 de julio de 2027')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(runSubmitMock).toHaveBeenCalledWith(expect.objectContaining({
      initialCapital: '2000000',
      interestType: 'annual',
      interestRate: '12',
      interestPaymentDay: '13',
      interestPaymentMonth: '7',
      status: 'active',
    }));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('switches to monthly in one action and updates the date, rate label, and preview', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);
    fillContactFields(container);
    fillCreationTerms(container, '2000000', '2,5');

    fireEvent.click(screen.getByRole('radio', { name: 'Mensual' }));

    expect(screen.getByRole('textbox', { name: 'Tasa pactada mensual' })).toBeInTheDocument();
    expect(screen.getByLabelText('Primer pago')).toHaveValue('2026-08-13');
    expect(screen.getByText('Recibirá COP 50.000 cada mes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Crear socio' }));
    expect(runSubmitMock).toHaveBeenCalledWith(expect.objectContaining({
      interestType: 'monthly',
      interestRate: '2.5',
      interestPaymentDay: '13',
      interestPaymentMonth: '1',
    }));
  });

  it('rejects unsupported money text without sharing it with form state', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fireEvent.change(container.querySelector('#new-associate-initial-capital') as HTMLInputElement, {
      target: { value: '100e2' },
    });

    expect(container.querySelector('#new-associate-initial-capital')).toHaveValue('');
  });

  it('requires capital, positive rate, and a valid first payment date', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);
    fillContactFields(container);

    fireEvent.click(screen.getByRole('button', { name: 'Crear socio' }));
    expect(screen.getByText('Ingresa el capital inicial aportado.')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();

    fillCreationTerms(container, '2000000', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Crear socio' }));
    expect(screen.getByText('La tasa pactada debe ser mayor que 0% y no superar 100%.')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();

    fireEvent.change(container.querySelector('#new-associate-interest-rate') as HTMLInputElement, {
      target: { value: '12' },
    });
    expect(container.querySelector('#new-associate-interest-rate')).toHaveValue('12');
    fireEvent.change(screen.getByLabelText('Primer pago'), { target: { value: '2027-07-29' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    expect(screen.getByText('Selecciona una fecha válida para el primer pago.')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(runSubmitMock).not.toHaveBeenCalled();
  });

  it('submits only the fields supported by the current associate contract', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fillContactFields(container);
    fillCreationTerms(container);
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

  it('keeps decimal rate normalization and blocks exponent-like input', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    const rateInput = container.querySelector('#new-associate-interest-rate') as HTMLInputElement;
    expect(rateInput).toHaveAttribute('inputmode', 'decimal');
    expect(rateInput.closest('.operational-control')?.textContent).toContain('%');

    fireEvent.change(rateInput, { target: { value: '2,5' } });
    expect(rateInput).toHaveValue('2.5');

    fireEvent.change(rateInput, { target: { value: '1e2' } });
    expect(rateInput).toHaveValue('2.5');
  });

  it('keeps status available while editing and derives the next annual payment date', () => {
    associateQueryState = {
      data: {
        data: {
          associate: {
            id: 7,
            name: 'Socio Existente',
            email: 'existente@test.local',
            phone: '3000000000',
            status: 'inactive',
            interestType: 'annual',
            interestRate: '10',
            interestPaymentDay: 15,
            interestPaymentMonth: 12,
          },
        },
      },
      isLoading: false,
      isError: false,
    };

    render(<NewAssociate associateIdOverride={7} embedded onBack={vi.fn()} />);

    expect(screen.getByLabelText('Estado')).toHaveValue('inactive');
    expect(screen.getByLabelText('Primer pago')).toHaveValue('2026-12-15');
    expect(screen.queryByLabelText('Capital inicial aportado')).not.toBeInTheDocument();
  });
});
