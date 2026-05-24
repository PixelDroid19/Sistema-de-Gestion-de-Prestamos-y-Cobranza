import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewAssociate from '../NewAssociate';
import { toast } from '../../lib/toast';

const createAssociateMock = { mutateAsync: vi.fn() };
const updateAssociateMock = { mutateAsync: vi.fn() };
const runSubmitMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({}),
}));

vi.mock('../../services/associateService', () => ({
  useAssociates: () => ({
    createAssociate: createAssociateMock,
    updateAssociate: updateAssociateMock,
  }),
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

  it('rejects malformed initial capital before submitting the associate', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fillRequiredFields(container);
    fireEvent.change(container.querySelector('#new-associate-initial-capital') as HTMLInputElement, {
      target: { value: '100e2' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(runSubmitMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith({ title: 'El capital inicial debe ser un monto positivo con máximo dos decimales.' });
  });

  it('rejects malformed participation percentages before submitting the associate', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fillRequiredFields(container);
    fireEvent.change(container.querySelector('#new-associate-participation') as HTMLInputElement, {
      target: { value: '1e2' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(runSubmitMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith({ title: 'La participación debe estar entre 0% y 100%, con máximo 4 decimales.' });
  });

  it('rejects exponent-like interest rates before submitting the associate', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fillRequiredFields(container);
    fireEvent.change(container.querySelector('#new-associate-interest-rate') as HTMLInputElement, {
      target: { value: '1e2' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(runSubmitMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith({ title: 'La tasa del socio debe estar entre 0% y 100%.' });
  });

  it('rejects exponent-like interest payment days before submitting the associate', () => {
    const { container } = render(<NewAssociate onBack={vi.fn()} />);

    fillRequiredFields(container);
    fireEvent.change(container.querySelector('#new-associate-interest-rate') as HTMLInputElement, {
      target: { value: '2.5' },
    });
    fireEvent.change(container.querySelector('#new-associate-interest-day') as HTMLInputElement, {
      target: { value: '1e1' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(runSubmitMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith({ title: 'El día de pago debe estar entre 1 y 28.' });
  });
});
