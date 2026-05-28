import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Payouts from '../Payouts';

const mockCreatePayment = vi.fn().mockResolvedValue(undefined);
const mockCreatePartialPayment = vi.fn().mockResolvedValue(undefined);
const mockCreateCapitalPayment = vi.fn().mockResolvedValue(undefined);
const mockUpdatePaymentMetadata = vi.fn().mockResolvedValue(undefined);
const mockConfirmDanger = vi.fn().mockResolvedValue(true);

let currentUser = {
  id: 1,
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin' as 'admin' | 'employee' | 'socio' | 'customer',
  permissions: ['*'],
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({ user: currentUser }),
}));

vi.mock('../../store/paginationStore', () => ({
  usePaginationStore: () => ({ page: 1, pageSize: 20, setPage: vi.fn(), setPageSize: vi.fn() }),
}));

vi.mock('../../services/configService', () => ({
  useConfig: () => ({
    paymentMethods: [
      { key: 'transfer', type: 'transfer', label: 'Transferencia', name: 'Transferencia', isActive: true },
      { key: 'cash', type: 'cash', label: 'Efectivo', name: 'Efectivo', isActive: true },
      { key: 'wallet_mobile', type: 'other', label: 'Billetera móvil', name: 'Billetera móvil', isActive: true },
    ],
  }),
}));

vi.mock('../../services/paymentService', () => ({
  usePayments: () => ({
    data: {
      data: {
        payments: [
          {
            id: 55,
            loanId: 999,
            amount: 150000,
            paymentDate: '2026-03-01T00:00:00.000Z',
            paymentMethod: 'transfer',
            status: 'completed',
            reconciled: false,
            paymentMetadata: {
              reference: 'REF-OLD',
            },
          },
        ],
        pagination: { totalItems: 1, totalPages: 1 },
      },
    },
    isLoading: false,
    isError: false,
    createPayment: { mutateAsync: mockCreatePayment },
    createPartialPayment: { mutateAsync: mockCreatePartialPayment },
    createCapitalPayment: { mutateAsync: mockCreateCapitalPayment },
    updatePaymentMetadata: { mutateAsync: mockUpdatePaymentMetadata },
  }),
  downloadVoucher: vi.fn(),
}));

const mockToastError = vi.fn();

vi.mock('../../lib/toast', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  },
}));

vi.mock('../../lib/confirmModal', () => ({
  confirmDanger: (...args: unknown[]) => mockConfirmDanger(...args),
}));

const renderPayouts = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Payouts />
    </QueryClientProvider>,
  );
};

describe('Payouts behavioral parity scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirmDanger.mockResolvedValue(true);
    currentUser = {
      id: 1,
      name: 'Admin',
      email: 'admin@test.com',
      role: 'admin',
      permissions: ['*'],
    };
  });

  it('opens admin payout registration on an executable payment type', async () => {
    renderPayouts();

    const button = screen.getByRole('button', { name: 'Registrar pago' });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    expect(screen.queryByRole('option', { name: 'Pago regular (cuota)' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pago parcial' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ej: 1'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '250000' } });
    fireEvent.change(screen.getByLabelText('Método de pago'), { target: { value: 'wallet_mobile' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Pago' }));

    await waitFor(() => {
      expect(mockCreatePartialPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          loanId: 100,
          amount: 250000,
          paymentMethod: 'wallet_mobile',
          paymentDate: expect.any(String),
        }),
      );
    });
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });

  it('keeps payout registration unavailable for customer records', () => {
    currentUser = {
      id: 2,
      name: 'Customer',
      email: 'customer@test.com',
      role: 'customer',
      permissions: ['*'],
    };

    renderPayouts();

    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled();
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(mockCreatePartialPayment).not.toHaveBeenCalled();
    expect(mockCreateCapitalPayment).not.toHaveBeenCalled();
  });

  it('allows permissioned employees to register backoffice partial payments', async () => {
    currentUser = {
      id: 4,
      name: 'Employee',
      email: 'employee@test.com',
      role: 'employee',
      permissions: ['PAYMENTS_CREATE'],
    };

    renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(screen.queryByRole('option', { name: 'Pago regular (cuota)' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pago parcial' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ej: 1'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Pago' }));

    await waitFor(() => {
      expect(mockCreatePartialPayment).toHaveBeenCalledWith(expect.objectContaining({
        loanId: 100,
        amount: 250000,
      }));
    });
  });

  it('sends the selected term when a capital payment reduces the installment amount', async () => {
    const { container } = renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    fireEvent.change(container.querySelector('#payout-type') as HTMLSelectElement, { target: { value: 'capital' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: 1'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '300000' } });
    fireEvent.change(container.querySelector('#payout-capital-strategy') as HTMLSelectElement, { target: { value: 'reduce_payment' } });
    fireEvent.change(container.querySelector('#payout-capital-new-term') as HTMLInputElement, { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Pago' }));

    await waitFor(() => {
      expect(mockCreateCapitalPayment).toHaveBeenCalledWith(expect.objectContaining({
        loanId: 100,
        amount: 300000,
        strategy: 'reduce_payment',
        newTermMonths: 10,
      }));
    });
  });

  it('rejects exponent-like new term values for capital payment reductions', () => {
    const { container } = renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    fireEvent.change(container.querySelector('#payout-type') as HTMLSelectElement, { target: { value: 'capital' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: 1'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '300000' } });
    fireEvent.change(container.querySelector('#payout-capital-strategy') as HTMLSelectElement, { target: { value: 'reduce_payment' } });
    fireEvent.change(container.querySelector('#payout-capital-new-term') as HTMLInputElement, { target: { value: '1e2' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Pago' }));

    expect(mockCreateCapitalPayment).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith({ title: 'Indica cuántas cuotas tendrá el saldo restante.' });
  });

  it('keeps the current loan id when the operator types exponent-like text', () => {
    renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    const loanIdInput = screen.getByPlaceholderText('Ej: 1') as HTMLInputElement;
    fireEvent.change(loanIdInput, { target: { value: '100' } });
    expect(loanIdInput.value).toBe('100');

    fireEvent.change(loanIdInput, { target: { value: '1e2' } });
    expect(loanIdInput.value).toBe('100');
  });

  it('keeps the current payout amount when the operator types exponent-like text', () => {
    renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    const amountInput = screen.getByPlaceholderText('0.00') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '250000' } });
    expect(amountInput.value).toBe('250000');

    fireEvent.change(amountInput, { target: { value: '2e5' } });
    expect(amountInput.value).toBe('250000');
  });

  it('shows the specific capital-payment backend denial when a payout capital payment is rejected', async () => {
    mockCreateCapitalPayment.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          error: {
            statusCode: 400,
            message: 'El abono a capital no puede exceder el capital vivo del crédito',
          },
        },
      },
    });

    const { container } = renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    fireEvent.change(container.querySelector('#payout-type') as HTMLSelectElement, { target: { value: 'capital' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: 1'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '900000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Pago' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith({
        title: 'No se pudo registrar el abono a capital',
        description: 'El abono a capital no puede exceder el capital vivo del crédito',
      });
    });
  });

  it('keeps exponent-like credit identifiers out of the payout form before submit', () => {
    renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    const loanIdInput = screen.getByPlaceholderText('Ej: 1') as HTMLInputElement;
    fireEvent.change(loanIdInput, { target: { value: '1e2' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '250000' } });

    expect(loanIdInput.value).toBe('');
    expect(mockCreatePartialPayment).not.toHaveBeenCalled();
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(mockCreateCapitalPayment).not.toHaveBeenCalled();
  });

  it('keeps payout registration unavailable for socios', () => {
    currentUser = {
      id: 3,
      name: 'Socio',
      email: 'socio@test.com',
      role: 'socio',
      permissions: ['*'],
    };

    renderPayouts();

    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled();
  });

  it('keeps out-of-scope payout deletion explicitly blocked without regression', async () => {
    renderPayouts();

    const deleteButton = screen.getByTitle('La eliminación directa de pagos no está disponible. Use anulación de cuota desde el detalle del crédito.');

    expect(deleteButton).toBeDisabled();
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(mockCreatePartialPayment).not.toHaveBeenCalled();
    expect(mockCreateCapitalPayment).not.toHaveBeenCalled();
  });

  it('edits payment method with confirmation modal flow', async () => {
    renderPayouts();

    fireEvent.click(screen.getByTitle('Editar método de pago real'));
    fireEvent.change(screen.getByPlaceholderText('Ej: REF-123'), { target: { value: 'REF-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mockUpdatePaymentMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 55,
          payload: expect.objectContaining({
            paymentMethod: 'transfer',
            paymentMetadata: expect.objectContaining({
              reference: 'REF-123',
            }),
          }),
        }),
      );
    });
  });

  it('allows multi-selection visibility for payout rows', async () => {
    renderPayouts();

    fireEvent.click(screen.getByLabelText('Seleccionar pago 55'));

    expect(screen.getByText('1 pago(s) seleccionado(s)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar comprobantes' })).toBeInTheDocument();
  });
});
