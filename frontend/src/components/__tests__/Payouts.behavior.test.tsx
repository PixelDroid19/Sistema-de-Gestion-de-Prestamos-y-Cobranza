import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Payouts from '../Payouts';

const mockCreatePayment = vi.fn().mockResolvedValue(undefined);
const mockCreatePartialPayment = vi.fn().mockResolvedValue(undefined);
const mockCreateCapitalPayment = vi.fn().mockResolvedValue(undefined);
const mockUpdatePaymentMetadata = vi.fn().mockResolvedValue(undefined);
const mockConfirmDanger = vi.fn().mockResolvedValue(true);
const mockNavigate = vi.fn();
const defaultPaymentMethodsFixture = [
  { key: 'transfer', type: 'transfer', label: 'Transferencia', name: 'Transferencia', isActive: true },
  { key: 'cash', type: 'cash', label: 'Efectivo', name: 'Efectivo', isActive: true },
  { key: 'wallet_mobile', type: 'other', label: 'Billetera móvil', name: 'Billetera móvil', isActive: true },
];
const defaultPaymentsFixture = [
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
];
const defaultLoansFixture = [
  {
    id: 100,
    amount: 2000000,
    status: 'active',
    principalOutstanding: 1800000,
    interestOutstanding: 50000,
    Customer: { name: 'Cliente Pago Uno', email: 'cliente-pago@test.local' },
  },
  {
    id: 200,
    amount: 3500000,
    status: 'approved',
    principalOutstanding: 3500000,
    interestOutstanding: 0,
    Customer: { name: 'Cliente Pago Dos', email: 'cliente-dos@test.local' },
  },
];
let paymentMethodsFixture: any[] = [...defaultPaymentMethodsFixture];
let paymentsFixture = [...defaultPaymentsFixture];
let loansFixture = [...defaultLoansFixture];

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
    useNavigate: () => mockNavigate,
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
    paymentMethods: paymentMethodsFixture,
  }),
}));

vi.mock('../../services/paymentService', () => ({
  usePayments: () => ({
    data: {
      data: {
        payments: paymentsFixture,
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

vi.mock('../../services/loanService', async () => {
  const actual = await vi.importActual<typeof import('../../services/loanService')>('../../services/loanService');
  return {
    ...actual,
    useLoans: vi.fn(() => ({
      data: {
        data: {
          loans: loansFixture,
          pagination: { totalItems: loansFixture.length, totalPages: 1 },
        },
      },
      isLoading: false,
      isError: false,
    })),
  };
});

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

const selectFirstLoanOption = () => {
  fireEvent.change(screen.getByRole('combobox', { name: 'Créditos disponibles' }), {
    target: { value: '100' },
  });
};

describe('Payouts behavioral parity scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirmDanger.mockResolvedValue(true);
    paymentMethodsFixture = [...defaultPaymentMethodsFixture];
    paymentsFixture = [...defaultPaymentsFixture];
    loansFixture = [...defaultLoansFixture];
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

    selectFirstLoanOption();
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '250000' } });
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

  it('closes the payout registration modal with Escape', () => {
    renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    const dialog = screen.getByRole('dialog', { name: 'Registrar pago' });

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Registrar pago' })).not.toBeInTheDocument();
  });

  it('uses generic labels when configured payment methods lack display names', () => {
    paymentMethodsFixture = [
      { key: 'internal_gateway', type: 'other', isActive: true },
    ];
    paymentsFixture = [
      {
        ...defaultPaymentsFixture[0],
        paymentMethod: 'internal_gateway',
      },
    ];

    renderPayouts();

    expect(screen.getByText('Método sin nombre')).toBeInTheDocument();
    expect(screen.queryByText(/internal_gateway/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(screen.getByRole('option', { name: 'Método sin nombre' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /internal_gateway/i })).not.toBeInTheDocument();
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

    selectFirstLoanOption();
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '250000' } });
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
    selectFirstLoanOption();
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '300000' } });
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
    selectFirstLoanOption();
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '300000' } });
    fireEvent.change(container.querySelector('#payout-capital-strategy') as HTMLSelectElement, { target: { value: 'reduce_payment' } });
    fireEvent.change(container.querySelector('#payout-capital-new-term') as HTMLInputElement, { target: { value: '1e2' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Pago' }));

    expect(mockCreateCapitalPayment).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith({ title: 'Indica cuántas cuotas tendrá el saldo restante.' });
  });

  it('requires selecting an existing credit instead of typing a raw credit number', () => {
    renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(screen.queryByPlaceholderText('Ej: 1')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Créditos disponibles' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Cliente Pago Uno/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Pago' }));

    expect(mockCreatePartialPayment).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith({ title: 'Ingrese un crédito válido.' });
  });

  it('keeps the current payout amount when the operator types exponent-like text', () => {
    renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    const amountInput = screen.getByPlaceholderText('0,00') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '250000' } });
    expect(amountInput.value).toBe('250.000');

    fireEvent.change(amountInput, { target: { value: '2e5' } });
    expect(amountInput.value).toBe('250.000');
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
    selectFirstLoanOption();
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '900000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Pago' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith({
        title: 'No se pudo registrar el abono a capital',
        description: 'El abono a capital no puede exceder el capital vivo del crédito',
      });
    });
  });

  it('clears the selected credit when the operator clears the selector', () => {
    renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    selectFirstLoanOption();
    fireEvent.change(screen.getByRole('combobox', { name: 'Créditos disponibles' }), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Pago' }));

    expect(mockCreatePartialPayment).not.toHaveBeenCalled();
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(mockCreateCapitalPayment).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith({ title: 'Ingrese un crédito válido.' });
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

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
    const deleteButton = screen.getByRole('menuitem', {
      name: 'La eliminación directa de pagos no está disponible. Use anulación de cuota desde el detalle del crédito.',
    });

    expect(deleteButton).toBeDisabled();
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(mockCreatePartialPayment).not.toHaveBeenCalled();
    expect(mockCreateCapitalPayment).not.toHaveBeenCalled();
  });

  it('edits payment method with confirmation modal flow', async () => {
    renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar método de pago real' }));
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

  it('closes the payment method edit modal with Escape', () => {
    renderPayouts();

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar método de pago real' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar método de pago' });

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Editar método de pago' })).not.toBeInTheDocument();
  });

  it('allows multi-selection visibility for payout rows', async () => {
    renderPayouts();

    fireEvent.click(screen.getByLabelText('Seleccionar pago registrado'));

    expect(screen.getByText('1 pago(s) seleccionado(s)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar comprobantes' })).toBeInTheDocument();
  });

  it('navigates to the credit details without exposing the raw loan id as row text', async () => {
    renderPayouts();

    expect(screen.queryByRole('columnheader', { name: /recibo id/i })).not.toBeInTheDocument();
    expect(screen.queryByText('55')).not.toBeInTheDocument();
    expect(screen.queryByText('999')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Crédito vinculado' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/credits/999');
    });
  });
});
