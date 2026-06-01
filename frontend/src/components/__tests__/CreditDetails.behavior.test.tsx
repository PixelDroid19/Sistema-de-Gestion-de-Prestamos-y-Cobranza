import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreditDetails from '../CreditDetails';
import { downloadVoucher } from '../../services/paymentService';
import { exportCreditExcel } from '../../services/reportService';

const mockNavigate = vi.fn();
const mockRecordPayment = vi.fn();
const mockCreatePromise = vi.fn();
const mockCreateFollowUp = vi.fn();
const mockAnnulInstallment = vi.fn();
const mockExecutePayoff = vi.fn();
const mockRecordCapitalPayment = vi.fn();
const mockUpdateLateFeeRate = vi.fn();
const mockUpdateLoanStatus = vi.fn();
const mockUpdatePaymentMethod = vi.fn().mockResolvedValue(undefined);
const mockUpdateAlertStatus = vi.fn().mockResolvedValue(undefined);
const mockUpdatePromiseStatus = vi.fn().mockResolvedValue(undefined);
const mockDownloadPromiseDocument = vi.fn().mockResolvedValue(undefined);
const mockConfirmDanger = vi.fn().mockResolvedValue(true);
const defaultCreditDetailPaymentMethods = [
  { key: 'transfer', type: 'transfer', label: 'Transferencia', name: 'Transferencia', isActive: true },
  { key: 'cash', type: 'cash', label: 'Efectivo', name: 'Efectivo', isActive: true },
];
const defaultHistoryPayments = [
  {
    id: 9001,
    amount: 250000,
    paymentDate: '2026-03-10T00:00:00.000Z',
    paymentType: 'installment',
    paymentMethod: 'transfer',
    status: 'completed',
    reconciled: false,
    createdBy: { id: 72, name: 'Operadora Caja', email: 'caja@test.local', role: 'employee' },
  },
];
let routeLoanId = '101';
let creditDetailPaymentMethods: any[] = [...defaultCreditDetailPaymentMethods];
let historyPayments = [...defaultHistoryPayments];
let mockCalendarEntries: Array<{
  installmentNumber: number | string;
  scheduledPayment: number;
  remainingInterest: number;
  status: string;
  dueDate?: string;
  outstandingAmount?: number;
}> = [
  { installmentNumber: 1, scheduledPayment: 250000, remainingInterest: 50000, status: 'pending', dueDate: '2026-03-25', outstandingAmount: 250000 },
];
let mockAlerts: any[] = [];
let mockPromises: any[] = [];
let mockPayoffQuote: any = null;
const buildMockLoan = () => ({
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
      outstandingBalance: 850000,
    },
	    payoffEligibility: {
	      allowed: true,
	      denialReasons: [] as Array<string | { code?: string; message?: string }>,
	    },
      capitalEligibility: {
        allowed: true,
        denialReasons: [] as Array<string | { code?: string; message?: string }>,
      },
	  },
  Customer: { name: 'Cliente Demo' },
});
let mockLoan = buildMockLoan();
const mockUseSessionStore = vi.fn(() => ({
  user: { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: routeLoanId }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../services/paymentService', () => ({
  downloadVoucher: vi.fn(),
}));

vi.mock('../../services/reportService', () => ({
  exportCreditExcel: vi.fn(),
  useCreditReports: () => ({
    history: {
      data: {
        history: {
          payments: [
            ...historyPayments,
          ],
          payoffHistory: [],
        },
      },
    },
    isLoading: false,
  }),
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
  useSessionStore: () => mockUseSessionStore(),
}));

vi.mock('../../services/configService', () => ({
  useConfig: () => ({
    paymentMethods: creditDetailPaymentMethods,
  }),
}));

vi.mock('../../services/loanService', () => {
  return {
    PAYMENT_METHODS: [
      { value: 'transfer', label: 'Transferencia' },
      { value: 'cash', label: 'Efectivo' },
    ],
    CAPITAL_STRATEGIES: [
      { value: 'reduce_term', label: 'Reducir plazo' },
      { value: 'reduce_payment', label: 'Reducir cuota' },
    ],
    useLoans: () => ({
      data: { data: { loans: [mockLoan] } },
      isLoading: false,
      updateLoanStatus: { mutateAsync: mockUpdateLoanStatus },
    }),
    useLoanById: () => ({ data: { data: { loan: mockLoan } }, isLoading: false }),
    useInstallmentQuote: () => ({
      data: {
        data: {
          quote: {
            installmentNumber: 1,
            canPay: true,
            baseAmount: 250000,
            lateFeeDue: 0,
            totalDue: 250000,
            daysOverdue: 0,
            disabledReason: null,
          },
        },
      },
      isFetching: false,
      isError: false,
    }),
    useLoanDetails: () => ({
      calendar: mockCalendarEntries,
      calendarSnapshot: { outstandingBalance: 750000 },
      alerts: mockAlerts,
      promises: mockPromises,
      payoffQuote: mockPayoffQuote,
      isLoading: false,
      createPromise: { mutateAsync: mockCreatePromise },
      createFollowUp: { mutateAsync: mockCreateFollowUp },
      executePayoff: { mutateAsync: mockExecutePayoff },
      recordPayment: { mutateAsync: mockRecordPayment },
      annulInstallment: { mutateAsync: mockAnnulInstallment },
      updatePaymentMethod: { mutateAsync: mockUpdatePaymentMethod },
      updateAlertStatus: { mutateAsync: mockUpdateAlertStatus, isPending: false },
      updatePromiseStatus: { mutateAsync: mockUpdatePromiseStatus, isPending: false },
      downloadPromiseDocument: { mutateAsync: mockDownloadPromiseDocument, isPending: false },
      recordCapitalPayment: { mutateAsync: mockRecordCapitalPayment },
      updateLateFeeRate: { mutateAsync: mockUpdateLateFeeRate },
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
    mockLoan = buildMockLoan();
    mockPayoffQuote = null;
    routeLoanId = '101';
    creditDetailPaymentMethods = [...defaultCreditDetailPaymentMethods];
    historyPayments = [...defaultHistoryPayments];
    mockCalendarEntries = [
      { installmentNumber: 1, scheduledPayment: 250000, remainingInterest: 50000, status: 'pending', dueDate: '2026-03-25', outstandingAmount: 250000 },
    ];
    mockAlerts = [];
    mockPromises = [];
  });

  const setSessionUser = (user: {
    id: number;
    name: string;
    email: string;
    role: string;
    permissions: string[];
    associateId?: number;
  }) => {
    mockUseSessionStore.mockReturnValue({ user });
  };

  it('uses operator-facing copy for invalid credit routes', () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    routeLoanId = 'abc';

    renderCreditDetails();

    expect(screen.getByText('Crédito inválido')).toBeInTheDocument();
    expect(screen.queryByText('ID de crédito inválido')).not.toBeInTheDocument();
  });

  it('executes installment payment action with installment context', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockRecordPayment.mockResolvedValueOnce({ data: { paymentId: 7001 } });
    renderCreditDetails();

    expect(screen.getByRole('tab', { name: 'Calendario' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Cronograma' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Registrar pago de cuota'));
    expect(screen.getByText('Cotización cuota #1')).toBeInTheDocument();

    const submitButtons = screen.getAllByRole('button', { name: 'Registrar pago' });
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
      expect(downloadVoucher).toHaveBeenCalledWith(7001);
    });


    await waitFor(() => {
      expect(mockInvalidateAfterPayment).toHaveBeenCalledWith(expect.anything(), { loanId: 101 });
    });

    await waitFor(() => {
      expect(screen.queryByText('Cotización cuota #1')).not.toBeInTheDocument();
    });
  });

  it('shows voucher download action inside payment history', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    renderCreditDetails();

    fireEvent.click(screen.getByRole('tab', { name: /Historial de pagos/ }));

    expect(screen.getByRole('cell', { name: 'Transferencia' })).toBeInTheDocument();
    const voucherButton = screen.getByRole('button', { name: 'Descargar comprobante' });
    fireEvent.click(voucherButton);

    await waitFor(() => {
      expect(downloadVoucher).toHaveBeenCalledWith(9001);
    });
  });

  it('keeps row installment actions working when the calendar installment number is serialized as text', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockCalendarEntries = [
      { installmentNumber: '1', scheduledPayment: 250000, remainingInterest: 50000, status: 'pending' },
    ];

    renderCreditDetails();

    fireEvent.click(screen.getByTitle('Registrar pago de cuota'));
    expect(screen.getByText('Cotización cuota #1')).toBeInTheDocument();
  });

  it('renders installment row actions as a compact horizontal toolbar', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    renderCreditDetails();

    const toolbar = screen
      .getAllByLabelText('Acciones de la cuota 1')
      .find((node) => node.classList.contains('justify-end'));

    expect(toolbar).toBeTruthy();

    expect(toolbar as HTMLElement).toHaveClass('credit-installment-actions');
    expect(toolbar as HTMLElement).toHaveClass('flex-nowrap');
    expect(toolbar as HTMLElement).toHaveClass('justify-end');
    expect((toolbar as HTMLElement).querySelectorAll('button')).toHaveLength(4);
  });

  it('renders monetary totals for the installment calendar columns', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockCalendarEntries = [
      { installmentNumber: 1, scheduledPayment: 250000, remainingInterest: 50000, status: 'pending' },
      { installmentNumber: 2, scheduledPayment: 300000, remainingInterest: 40000, status: 'pending' },
    ];

    const { container } = renderCreditDetails();
    const renderedText = container.textContent?.replace(/\s+/g, ' ') || '';
    const calendarTable = screen.getAllByRole('table')[0];
    const calendarTableText = calendarTable.textContent?.replace(/\s+/g, ' ') || '';

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(renderedText).toMatch(/\$\s*550\.000/);
    expect(renderedText).toMatch(/\$\s*90\.000/);
    expect(renderedText).toMatch(/\$\s*460\.000/);
    expect(calendarTableText).toMatch(/\$\s*390\.000/);
    expect(calendarTableText).not.toMatch(/\$\s*750\.000/);
  });

  it('routes top-level payment CTA to the next payable installment', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    renderCreditDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(screen.getByText('Cotización cuota #1')).toBeInTheDocument();

    const submitButtons = screen.getAllByRole('button', { name: 'Registrar pago' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(mockRecordPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          installmentNumber: 1,
          paymentAmount: 250000,
        }),
      );
    });
  });

  it('rejects exponent-like payment amounts at the field level and keeps the last valid amount', () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });

    const { container } = renderCreditDetails();

    fireEvent.click(screen.getByTitle('Registrar pago de cuota'));

    const paymentAmountInput = container.querySelector('#credit-payment-amount') as HTMLInputElement;
    expect(paymentAmountInput).toHaveValue('250000.00');

    fireEvent.change(paymentAmountInput, { target: { value: '1e2' } });

    expect(paymentAmountInput).toHaveValue('250000.00');
  });

  it('triggers promise and follow-up mutations from installment row actions', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    renderCreditDetails();

    fireEvent.click(screen.getByTitle('Crear compromiso de pago'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar compromiso' }));

    await waitFor(() => {
      expect(mockCreatePromise).toHaveBeenCalledWith(
        expect.objectContaining({ installmentNumber: 1, amount: 250000 }),
      );
    });

    fireEvent.click(screen.getByTitle('Crear seguimiento'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Llamar y confirmar nuevo compromiso' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar seguimiento' }));

    await waitFor(() => {
      expect(mockCreateFollowUp).toHaveBeenCalledWith(
        expect.objectContaining({
          installmentNumber: 1,
          notes: 'Llamar y confirmar nuevo compromiso',
          dueDate: '2026-03-25',
          scheduledAmount: 250000,
          outstandingAmount: 250000,
        }),
      );
      expect(mockInvalidateAfterPromiseOrFollowUp).toHaveBeenCalled();
    });
  });

  it('blocks malformed promise dates before creating the promise', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    renderCreditDetails();

    fireEvent.click(screen.getByTitle('Crear compromiso de pago'));
    fireEvent.change(screen.getByLabelText('Fecha comprometida'), { target: { value: '60620-02-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar compromiso' }));

    expect(mockCreatePromise).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ingrese una fecha comprometida válida.' }),
    );
  });

  it('hides backend business-rule details when annulling installment fails', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockAnnulInstallment.mockRejectedValueOnce({
      message: 'nearest cancellable installment is #4 with status pending in payment_state_machine',
      statusCode: 409,
    });

    renderCreditDetails();

    fireEvent.click(screen.getByTitle('Anular cuota'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));

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

  it('edits payment method from history with confirmation', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    renderCreditDetails();

    fireEvent.click(screen.getByRole('tab', { name: /Historial de pagos/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /Método/i })[0]);
    fireEvent.change(screen.getByLabelText('Nuevo método'), { target: { value: 'cash' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(mockUpdatePaymentMethod).toHaveBeenCalledWith({
        paymentId: 9001,
        paymentMethod: 'cash',
      });
    });
  });

  it('uses a generic payment method label when config lacks display names', () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    creditDetailPaymentMethods = [
      { key: 'internal_gateway', type: 'other', isActive: true },
    ];
    historyPayments = [
      {
        ...defaultHistoryPayments[0],
        paymentMethod: 'internal_gateway',
      },
    ];

    renderCreditDetails();

    fireEvent.click(screen.getByRole('tab', { name: /Historial de pagos/ }));

    expect(screen.getByText('Método sin nombre')).toBeInTheDocument();
    expect(screen.queryByText(/internal_gateway/i)).not.toBeInTheDocument();
  });

  it('resolves alerts and updates promise statuses from their detail tabs', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockAlerts = [{
      id: 44,
      alertType: 'payment_reminder',
      installmentNumber: 1,
      outstandingAmount: 250000,
      status: 'active',
      dueDate: '2026-03-15T00:00:00.000Z',
      createdAt: '2026-03-10T00:00:00.000Z',
    }];
    mockPromises = [{
      id: 77,
      amount: 250000,
      promisedDate: '2026-03-20T00:00:00.000Z',
      status: 'pending',
      createdAt: '2026-03-10T00:00:00.000Z',
      statusHistory: [{ status: 'pending', changedAt: '2026-03-10T00:00:00.000Z' }],
    }];

    renderCreditDetails();

    fireEvent.click(screen.getByRole('tab', { name: /Alertas/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Resolver' }));

    await waitFor(() => {
      expect(mockUpdateAlertStatus).toHaveBeenCalledWith(expect.objectContaining({
        alertId: 44,
        status: 'resolved',
      }));
    });

    fireEvent.click(screen.getByRole('tab', { name: /Compromisos de pago/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cumplida' }));

    await waitFor(() => {
      expect(mockUpdatePromiseStatus).toHaveBeenCalledWith(expect.objectContaining({
        promiseId: 77,
        status: 'kept',
      }));
    });
  });

  it('formats alert details without exposing technical audit tokens', () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockAlerts = [{
      id: 44,
      alertType: 'payment_reminder',
      installmentNumber: 1,
      outstandingAmount: 0,
      status: 'active',
      dueDate: '2026-05-10T00:00:00.000Z',
      createdAt: '2026-05-10T18:09:49.192Z',
      notes: '[2026-05-10T18:09:49.192Z] REMINDER actor:3 status:active prueba',
    }];

    renderCreditDetails();

    fireEvent.click(screen.getByRole('tab', { name: /Alertas/ }));

    expect(screen.getByText('Recordatorio de pago')).toBeInTheDocument();
    expect(screen.getByText('Cuota n.º 1')).toBeInTheDocument();
    expect(screen.getByText('Sin saldo pendiente')).toBeInTheDocument();
    expect(screen.getByText('prueba')).toBeInTheDocument();
    expect(screen.queryByText(/REMINDER|actor:3|status:active/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Seguimiento operativo/ }));

    expect(screen.getByText('Alerta activa')).toBeInTheDocument();
    expect(screen.getByText('Recordatorio de pago · Cuota n.º 1 · Sin saldo pendiente')).toBeInTheDocument();
    expect(screen.getByText('Seguimiento registrado')).toBeInTheDocument();
    expect(screen.getByText('prueba')).toBeInTheDocument();
    expect(screen.queryByText(/REMINDER|actor:3|status:active/)).not.toBeInTheDocument();
  });

  it('hides stale payoff data and disables financial actions once the credit is completed', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockLoan = {
      ...buildMockLoan(),
      status: 'closed',
      paymentContext: {
        snapshot: {
          outstandingInstallments: 0,
          totalInterest: 200000,
          totalPaidPrincipal: 1000000,
          outstandingPrincipal: 0,
          outstandingBalance: 0,
        },
        payoffEligibility: {
          allowed: false,
          denialReasons: [{ message: 'Este crédito ya no tiene saldo pendiente para liquidar.' }],
        },
        capitalEligibility: {
          allowed: false,
          denialReasons: [{ code: 'NO_OUTSTANDING_BALANCE', message: 'Loan has no outstanding balance for capital payment' }],
        },
      },
    };
    mockPayoffQuote = {
      asOfDate: '2026-03-10',
      outstandingPrincipal: 850000,
      total: 850000,
    };

    renderCreditDetails();

    fireEvent.focus(screen.getByLabelText(/Pago total no disponible/i));

    expect(await screen.findByText('Pago total no disponible. Este crédito ya no tiene saldo pendiente para liquidar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Abono a capital' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tasa de mora' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Estado' })).toBeDisabled();
  });

  it('disables capital payments until the first installment is paid', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockLoan = {
      ...buildMockLoan(),
      paymentContext: {
        ...buildMockLoan().paymentContext,
        capitalEligibility: {
          allowed: false,
          denialReasons: [{
            code: 'FIRST_INSTALLMENT_PAYMENT_REQUIRED',
            message: 'Debe existir al menos la primera cuota pagada antes de abonar a capital',
          }],
        },
      },
    };

    renderCreditDetails();

    const capitalButton = screen.getByRole('button', { name: 'Abono a capital' });
    expect(capitalButton).toBeDisabled();
    fireEvent.click(capitalButton);
    expect(mockRecordCapitalPayment).not.toHaveBeenCalled();
  });

  it('shows the first-installment requirement when capital payment is disabled', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockLoan = {
      ...buildMockLoan(),
      paymentContext: {
        ...buildMockLoan().paymentContext,
        capitalEligibility: {
          allowed: false,
          denialReasons: [{
            code: 'FIRST_INSTALLMENT_PAYMENT_REQUIRED',
            message: 'Debe existir al menos la primera cuota pagada antes de abonar a capital',
          }],
        },
      },
    };

    renderCreditDetails();

    fireEvent.focus(screen.getByLabelText(/Abono a capital no disponible/i));

    expect(await screen.findByText('Abono a capital no disponible. Primero registra el pago completo de la primera cuota. Después podrás abonar a capital.')).toBeInTheDocument();
  });

  it('sends selected installments when reducing the payment after a capital prepayment', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockRecordCapitalPayment.mockResolvedValueOnce({ data: { payment: { id: 991 } } });

    const { container } = renderCreditDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Abono a capital' }));
    fireEvent.change(container.querySelector('#credit-capital-amount') as HTMLInputElement, { target: { value: '300000' } });
    fireEvent.change(container.querySelector('#credit-capital-strategy') as HTMLSelectElement, { target: { value: 'reduce_payment' } });
    fireEvent.change(container.querySelector('#credit-capital-new-term') as HTMLInputElement, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar abono' }));

    await waitFor(() => {
      expect(mockRecordCapitalPayment).toHaveBeenCalledWith(expect.objectContaining({
        amount: 300000,
        strategy: 'reduce_payment',
        newTermMonths: 10,
      }));
    });
  });

  it('uses the remaining installments by default when switching a capital prepayment to reduce-payment', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockRecordCapitalPayment.mockResolvedValueOnce({ data: { payment: { id: 992 } } });

    const { container } = renderCreditDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Abono a capital' }));
    fireEvent.change(container.querySelector('#credit-capital-amount') as HTMLInputElement, { target: { value: '300000' } });
    fireEvent.change(container.querySelector('#credit-capital-strategy') as HTMLSelectElement, { target: { value: 'reduce_payment' } });

    const newTermInput = container.querySelector('#credit-capital-new-term') as HTMLInputElement;
    expect(newTermInput).toHaveValue('3');
    expect(screen.getByRole('button', { name: 'Registrar abono' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar abono' }));

    await waitFor(() => {
      expect(mockRecordCapitalPayment).toHaveBeenCalledWith(expect.objectContaining({
        amount: 300000,
        strategy: 'reduce_payment',
        newTermMonths: 3,
      }));
    });
  });

  it('normalizes capital new term input to plain integers in reduce-payment flow', () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });

    const { container } = renderCreditDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Abono a capital' }));
    fireEvent.change(container.querySelector('#credit-capital-amount') as HTMLInputElement, { target: { value: '300000' } });
    fireEvent.change(container.querySelector('#credit-capital-strategy') as HTMLSelectElement, { target: { value: 'reduce_payment' } });

    const newTermInput = container.querySelector('#credit-capital-new-term') as HTMLInputElement;
    fireEvent.change(newTermInput, { target: { value: '08' } });

    expect(newTermInput).toHaveValue('8');
  });

  it('keeps capital prepayment submission disabled when the amount exceeds live principal', () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });

    const { container } = renderCreditDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Abono a capital' }));
    fireEvent.change(container.querySelector('#credit-capital-amount') as HTMLInputElement, { target: { value: '900000' } });

    expect(screen.getByRole('button', { name: 'Registrar abono' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar abono' }));
    expect(mockRecordCapitalPayment).not.toHaveBeenCalled();
  });

  it('keeps the default remaining installments when exponent-like text is typed in reduce-payment mode', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockRecordCapitalPayment.mockResolvedValueOnce({ data: { payment: { id: 993 } } });

    const { container } = renderCreditDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Abono a capital' }));
    fireEvent.change(container.querySelector('#credit-capital-amount') as HTMLInputElement, { target: { value: '300000' } });
    fireEvent.change(container.querySelector('#credit-capital-strategy') as HTMLSelectElement, { target: { value: 'reduce_payment' } });
    const newTermInput = container.querySelector('#credit-capital-new-term') as HTMLInputElement;

    fireEvent.change(newTermInput, { target: { value: '1e2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar abono' }));

    expect(newTermInput).toHaveValue('3');
    expect(screen.getByRole('button', { name: 'Registrar abono' })).toBeEnabled();

    await waitFor(() => {
      expect(mockRecordCapitalPayment).toHaveBeenCalledWith(expect.objectContaining({
        amount: 300000,
        strategy: 'reduce_payment',
        newTermMonths: 3,
      }));
    });
  });

  it('keeps capital prepayment submission enabled when exponent-like text preserves the valid default term', () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });

    const { container } = renderCreditDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Abono a capital' }));
    fireEvent.change(container.querySelector('#credit-capital-amount') as HTMLInputElement, { target: { value: '300000' } });
    fireEvent.change(container.querySelector('#credit-capital-strategy') as HTMLSelectElement, { target: { value: 'reduce_payment' } });
    const newTermInput = container.querySelector('#credit-capital-new-term') as HTMLInputElement;

    fireEvent.change(newTermInput, { target: { value: '1e2' } });

    expect(newTermInput).toHaveValue('3');
    expect(screen.getByRole('button', { name: 'Registrar abono' })).toBeEnabled();
  });

  it('keeps the current late fee rate when the operator types exponent-like text', () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });

    const { container } = renderCreditDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Tasa de mora' }));

    const lateFeeInput = container.querySelector('#credit-late-fee-rate') as HTMLInputElement;
    expect(lateFeeInput).toHaveValue('20');

    fireEvent.change(lateFeeInput, { target: { value: '1e2' } });

    expect(lateFeeInput).toHaveValue('20');
    expect(mockUpdateLateFeeRate).not.toHaveBeenCalled();
  });

  it('rejects out-of-range late fee rate values at the field level', () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });

    const { container } = renderCreditDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Tasa de mora' }));

    const lateFeeInput = container.querySelector('#credit-late-fee-rate') as HTMLInputElement;
    expect(lateFeeInput).toHaveValue('20');

    fireEvent.change(lateFeeInput, { target: { value: '101' } });

    expect(lateFeeInput).toHaveValue('20');
  });

  it('shows a specific payoff denial reason when an active credit still has balance', async () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });
    mockLoan = {
      ...buildMockLoan(),
      status: 'active',
      paymentContext: {
        snapshot: {
          outstandingInstallments: 4,
          totalInterest: 28357.91,
          totalPaidPrincipal: 146296.58,
          outstandingPrincipal: 603703.42,
          outstandingBalance: 622686.33,
        },
        payoffEligibility: {
          allowed: false,
          denialReasons: [{
            code: 'PAYOFF_BEFORE_LOAN_START',
            message: 'Payoff effective date must be on or after the loan start date',
          }],
        },
        capitalEligibility: {
          allowed: true,
          denialReasons: [],
        },
      },
    };

    renderCreditDetails();

    fireEvent.focus(screen.getByLabelText(/Pago total no disponible/i));

    expect(await screen.findByText('Pago total no disponible. El pago total solo puede ejecutarse desde la fecha de inicio del crédito.')).toBeInTheDocument();
    expect(screen.queryByText('Este crédito ya no tiene saldo pendiente para liquidar.')).not.toBeInTheDocument();
  });

  it('does not expose payment actions to employees without payment permissions', () => {
    setSessionUser({ id: 10, name: 'Empleado consulta', email: 'readonly.employee@test.com', role: 'employee', permissions: ['CREDITS_VIEW_ALL'] });

    renderCreditDetails();

    expect(screen.queryByRole('tab', { name: 'Alertas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Compromisos de pago' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pago total' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Pagar cuota' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Estado' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Pagar cuota')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Crear compromiso de pago')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Crear seguimiento')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Anular cuota')).not.toBeInTheDocument();
  });

  it('allows permissioned employees to register payments and view internal collection tabs', () => {
    setSessionUser({
      id: 2,
      name: 'Employee',
      email: 'employee@test.com',
      role: 'employee',
      permissions: ['PAYMENTS_CREATE', 'CREDITS_VIEW_ALL'],
    });

    renderCreditDetails();

    expect(screen.getByRole('tab', { name: /Alertas/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Compromisos de pago/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeEnabled();
    expect(screen.getByTitle('Registrar pago de cuota')).toBeInTheDocument();
    expect(screen.queryByTitle('Crear compromiso de pago')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Crear seguimiento')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tasa de mora' })).not.toBeInTheDocument();
  });

  it('shows who registered each payment in the credit payment history', async () => {
    renderCreditDetails();

    fireEvent.click(screen.getByRole('tab', { name: /Historial de pagos/ }));

    expect(await screen.findByText('Operadora Caja')).toBeInTheDocument();
    expect(screen.getByText('Registrado por')).toBeInTheDocument();
  });

  it('renders an employee read-only detail view without admin-only tabs or payoff', () => {
    setSessionUser({ id: 3, name: 'Empleado lectura', email: 'employee.read@test.com', role: 'employee', permissions: ['CREDITS_VIEW_ALL'] });

    renderCreditDetails();

    expect(screen.queryByRole('tab', { name: 'Alertas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Compromisos de pago' })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Pago total' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Estado' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Registrar pago de cuota')).not.toBeInTheDocument();
  });

  it('keeps the credit Excel action visible for administrators', () => {
    setSessionUser({ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] });

    renderCreditDetails();

    expect(screen.getByRole('button', { name: 'Excel' })).toBeInTheDocument();
  });

  it('preserves valid customer names in the credit header without stripping fragments like dev', () => {
    mockLoan = {
      ...buildMockLoan(),
      Customer: { name: 'Devora Alvarez' },
    };

    renderCreditDetails();

    expect(screen.getByText('Devora Alvarez')).toBeInTheDocument();
    expect(screen.queryByText('ora Alvarez')).not.toBeInTheDocument();
  });

  it('allows employees with report permission to export the credit Excel', async () => {
    setSessionUser({
      id: 4,
      name: 'Empleado reportes',
      email: 'employee.reports@test.com',
      role: 'employee',
      permissions: ['CREDITS_VIEW_ALL', 'REPORTS_VIEW_ALL'],
    });

    renderCreditDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));

    await waitFor(() => {
      expect(exportCreditExcel).toHaveBeenCalledWith(101);
    });
  });
});
