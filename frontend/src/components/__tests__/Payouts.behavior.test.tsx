import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Payouts from '../Payouts';

const mockCreatePayment = vi.fn().mockResolvedValue(undefined);
const mockCreatePartialPayment = vi.fn().mockResolvedValue(undefined);
const mockCreateCapitalPayment = vi.fn().mockResolvedValue(undefined);
const mockUpdatePaymentMetadata = vi.fn().mockResolvedValue(undefined);
const mockRequestInput = vi.fn().mockResolvedValue('REF-123');

let currentUser = {
  id: 1,
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin' as 'admin' | 'socio' | 'customer',
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
  usePaginationStore: () => ({ page: 1, pageSize: 20, setPage: vi.fn() }),
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

vi.mock('../../lib/confirmModal', () => ({
  requestInput: (...args: unknown[]) => mockRequestInput(...args),
}));

const mockToastError = vi.fn();

vi.mock('../../lib/toast', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  },
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
    mockRequestInput.mockResolvedValue('REF-123');
    currentUser = {
      id: 1,
      name: 'Admin',
      email: 'admin@test.com',
      role: 'admin',
      permissions: ['*'],
    };
  });

  it('blocks regular payout registration for non-customer users', async () => {
    renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    fireEvent.change(screen.getByPlaceholderText('Ej: 1'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '250000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Pago' }));

    await waitFor(() => {
      expect(mockCreatePayment).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Acción no disponible',
        }),
      );
    });
  });

  it('allows regular payout registration for customer users', async () => {
    currentUser = {
      id: 2,
      name: 'Customer',
      email: 'customer@test.com',
      role: 'customer',
      permissions: ['*'],
    };

    renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    fireEvent.change(screen.getByPlaceholderText('Ej: 1'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '250000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Pago' }));

    await waitFor(() => {
      expect(mockCreatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          loanId: 100,
          paymentAmount: 250000,
        }),
      );
    });
  });

  it('keeps out-of-scope payout deletion explicitly blocked without regression', async () => {
    renderPayouts();

    const deleteButton = screen.getByTitle('La eliminación directa de pagos no está disponible. Use anulación de cuota desde el detalle del crédito.');

    expect(deleteButton).toBeDisabled();
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(mockCreatePartialPayment).not.toHaveBeenCalled();
    expect(mockCreateCapitalPayment).not.toHaveBeenCalled();
  });

  it('uses reusable prompt flow to edit payment metadata', async () => {
    renderPayouts();

    fireEvent.click(screen.getByTitle('Editar metadata del pago'));

    await waitFor(() => {
      expect(mockRequestInput).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Referencia de conciliación',
          message: 'Actualice la referencia para el pago seleccionado.',
          label: 'Referencia de conciliación (opcional)',
        }),
      );
    });

    await waitFor(() => {
      expect(mockUpdatePaymentMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 55,
          payload: expect.objectContaining({
            paymentMetadata: expect.objectContaining({
              reference: 'REF-123',
            }),
          }),
        }),
      );
    });
  });
});
