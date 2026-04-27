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
  usePaginationStore: () => ({ page: 1, pageSize: 20, setPage: vi.fn(), setPageSize: vi.fn() }),
}));

vi.mock('../../services/configService', () => ({
  useConfig: () => ({
    paymentMethods: [
      { key: 'transfer', type: 'transfer', label: 'Transferencia', name: 'Transferencia', isActive: true },
      { key: 'cash', type: 'cash', label: 'Efectivo', name: 'Efectivo', isActive: true },
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

  it('blocks regular payout registration for non-customer users', async () => {
    renderPayouts();

    const button = screen.getByRole('button', { name: 'Registrar pago' });
    expect(button).toBeDisabled();

    await waitFor(() => {
      expect(mockCreatePayment).not.toHaveBeenCalled();
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
