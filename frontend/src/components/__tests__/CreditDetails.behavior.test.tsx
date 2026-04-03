import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreditDetails from '../CreditDetails';

const mockNavigate = vi.fn();
const mockRecordPayment = vi.fn();
const mockCreatePromise = vi.fn();
const mockCreateFollowUp = vi.fn();
const mockAnnulInstallment = vi.fn();
const mockConfirmDanger = vi.fn().mockResolvedValue(true);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '101' }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../services/paymentService', () => ({
  downloadVoucher: vi.fn(),
}));

vi.mock('../../services/userService', () => ({
  useUsers: () => ({ data: { data: { users: [] } } }),
}));

vi.mock('../../services/reportService', () => ({
  useCreditReports: () => ({ history: { data: { history: { payments: [], payoffHistory: [] } } }, isLoading: false }),
}));

const mockInvalidateAfterPayment = vi.fn().mockResolvedValue(undefined);
const mockInvalidateAfterPromiseOrFollowUp = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/operationalInvalidation', () => ({
  invalidateAfterPayment: (...args: unknown[]) => mockInvalidateAfterPayment(...args),
  invalidateAfterPromiseOrFollowUp: (...args: unknown[]) => mockInvalidateAfterPromiseOrFollowUp(...args),
}));

vi.mock('../../lib/confirmModal', () => ({
  confirmDanger: (...args: unknown[]) => mockConfirmDanger(...args),
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('../../lib/toast', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({
    user: { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] },
  }),
}));

vi.mock('../../services/loanService', () => {
  const loan = {
    id: 101,
    status: 'active',
    amount: 1000000,
    termMonths: 12,
    annualLateFeeRate: 20,
    paymentContext: {
      snapshot: {
        outstandingInstallments: 3,
        totalInterest: 200000,
        totalPaidPrincipal: 150000,
        outstandingPrincipal: 850000,
      },
    },
    Customer: { name: 'Cliente Demo' },
  };

  return {
    PAYMENT_METHODS: [
      { value: 'transfer', label: 'Transferencia' },
      { value: 'cash', label: 'Efectivo' },
    ],
    CAPITAL_STRATEGIES: [{ value: 'reduce_term', label: 'Reducir plazo' }],
    useLoans: () => ({
      data: { data: { loans: [loan] } },
      isLoading: false,
      updateLoanStatus: { mutateAsync: vi.fn() },
    }),
    useLoanById: () => ({ data: { data: { loan } }, isLoading: false }),
    useLoanDetails: () => ({
      calendar: [
        { installmentNumber: 1, scheduledPayment: 250000, remainingInterest: 50000, status: 'pending' },
      ],
      calendarSnapshot: { outstandingBalance: 750000 },
      alerts: [],
      promises: [],
      payoffQuote: null,
      isLoading: false,
      createPromise: { mutateAsync: mockCreatePromise },
      createFollowUp: { mutateAsync: mockCreateFollowUp },
      executePayoff: { mutateAsync: vi.fn() },
      recordPayment: { mutateAsync: mockRecordPayment },
      annulInstallment: { mutateAsync: mockAnnulInstallment },
      updatePaymentMethod: { mutateAsync: vi.fn() },
      recordCapitalPayment: { mutateAsync: vi.fn() },
      updateLateFeeRate: { mutateAsync: vi.fn() },
    }),
  };
});

const renderCreditDetails = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CreditDetails />
    </QueryClientProvider>,
  );
};

describe('CreditDetails behavioral parity scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirmDanger.mockResolvedValue(true);
  });

  vi.mock('../../lib/confirmModal', () => ({
    confirmDanger: vi.fn(() => Promise.resolve(true)),
    confirm: vi.fn(() => Promise.resolve(true)),
    requestInput: vi.fn(() => Promise.resolve('test reference')),
  }));

  it('executes installment payment action with installment context', async () => {
    renderCreditDetails();

    expect(screen.getByRole('button', { name: 'Calendario' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cronograma' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Registrar pago de cuota'));
    expect(screen.getByText('Pago aplicado a cuota #1')).toBeInTheDocument();

    const submitButtons = screen.getAllByRole('button', { name: 'Registrar Pago' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(mockRecordPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          installmentNumber: 1,
          paymentAmount: 250000,
        }),
      );
    });


    await waitFor(() => {
      expect(mockInvalidateAfterPayment).toHaveBeenCalledWith(expect.anything(), { loanId: 101 });
    });
  });

  it('blocks payment execution when installment context is missing with recoverable feedback', async () => {
    renderCreditDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar Pago' }));
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100000' } });

    const submitButtons = screen.getAllByRole('button', { name: 'Registrar Pago' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(mockRecordPayment).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'No se pudo resolver la cuota seleccionada. Reintente desde la fila correspondiente.',
        }),
      );
    });
  });

  it('triggers promise and follow-up mutations from installment row actions', async () => {
    renderCreditDetails();

    fireEvent.click(screen.getByTitle('Crear compromiso de pago'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Promesa' }));

    await waitFor(() => {
      expect(mockCreatePromise).toHaveBeenCalledWith(
        expect.objectContaining({ installmentNumber: 1, amount: 250000 }),
      );
    });

    fireEvent.click(screen.getByTitle('Crear seguimiento'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Llamar y confirmar nuevo compromiso' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Seguimiento' }));

    await waitFor(() => {
      expect(mockCreateFollowUp).toHaveBeenCalledWith(
        expect.objectContaining({
          installmentNumber: 1,
          notes: 'Llamar y confirmar nuevo compromiso',
        }),
      );
      expect(mockInvalidateAfterPromiseOrFollowUp).toHaveBeenCalled();
    });
  });

  it('hides backend business-rule details when annulling installment fails', async () => {
    mockAnnulInstallment.mockRejectedValueOnce({
      message: 'nearest cancellable installment is #4 with status pending in payment_state_machine',
      statusCode: 409,
    });

    renderCreditDetails();

    fireEvent.click(screen.getByTitle('Anular cuota'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Anulación' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'No se pudo anular la cuota',
          description: 'Verifica el estado de la operación y vuelve a intentarlo.',
        }),
      );
    });

    expect(mockToastError).not.toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('nearest cancellable installment'),
      }),
    );
  });
});
