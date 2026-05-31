import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Credits from '../Credits';

const mockDeleteLoan = vi.fn().mockResolvedValue(undefined);
const mockInvalidateAfterDelete = vi.fn().mockResolvedValue(undefined);
const mockSetCurrentView = vi.fn();
const mockToastError = vi.fn();
const mockConfirmDanger = vi.fn().mockResolvedValue(true);
const mockApiPost = vi.fn();
const mockApiGet = vi.fn();
const mockUseLoanStatistics = vi.fn((_options?: unknown) => ({
  data: {
    data: {
      statistics: {
        amounts: {
          totalLoanAmount: 1000000,
          totalCollected: 250000,
          totalOverdue: 10000,
        },
        counts: { activeCredits: 1, totalCredits: 1 },
      },
    },
  },
}));

type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'employee' | 'socio' | 'customer';
  permissions: string[];
};

let currentUser: SessionUser = {
  id: 1,
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
  permissions: ['*'],
};

vi.mock('react-big-calendar', () => ({
  Calendar: () => null,
  dateFnsLocalizer: () => ({}),
}));

vi.mock('../../api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

vi.mock('../../services/reportService', () => ({
  exportCreditsExcel: vi.fn(),
  downloadCreditReport: vi.fn(),
}));

vi.mock('../../services/operationalInvalidation', () => ({
  invalidateAfterDelete: (...args: unknown[]) => mockInvalidateAfterDelete(...args),
  invalidateAfterReport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/confirmModal', () => ({
  confirmDanger: (...args: unknown[]) => mockConfirmDanger(...args),
  confirm: vi.fn(() => Promise.resolve(true)),
  requestInput: vi.fn(() => Promise.resolve('test reference')),
}));

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({ user: currentUser }),
}));

vi.mock('../../store/paginationStore', () => ({
  usePaginationStore: () => ({ page: 1, pageSize: 25, setPage: vi.fn(), setPageSize: vi.fn() }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('../../services/loanService', () => ({
  useLoanStatistics: (options: unknown) => mockUseLoanStatistics(options),
  useLoans: () => ({
    data: {
      data: {
        loans: [
          {
            id: 77,
            amount: 500000,
            interestRate: 12,
            installmentAmount: 55000,
            principalOutstanding: 300000,
            interestOutstanding: 40000,
            status: 'active',
            recoveryStatus: 'pending',
            createdAt: '2026-01-10T10:00:00.000Z',
            Customer: { name: 'Cliente Prueba' },
          },
        ],
        pagination: { totalItems: 1, totalPages: 1 },
      },
    },
    isLoading: false,
    isError: false,
    deleteLoan: { mutateAsync: mockDeleteLoan },
  }),
  useSearchLoans: () => ({
    data: {
      data: {
        loans: [],
        pagination: { totalItems: 0, totalPages: 1 },
      },
    },
    isLoading: false,
    isError: false,
  }),
}));

const renderCredits = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Credits setCurrentView={mockSetCurrentView} />
    </QueryClientProvider>,
  );
};

describe('Credits behavioral parity scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', permissions: ['*'] };
    vi.stubGlobal('confirm', vi.fn(() => true));
    mockConfirmDanger.mockResolvedValue(true);
    mockUseLoanStatistics.mockClear();
    mockUseLoanStatistics.mockImplementation(() => ({
      data: {
        data: {
          statistics: {
            amounts: {
              totalLoanAmount: 1000000,
              totalCollected: 250000,
              totalOverdue: 10000,
            },
            counts: { activeCredits: 1, totalCredits: 1 },
          },
        },
      },
    }));
    mockApiGet.mockResolvedValue({
      data: {
        data: {
          calendar: {
            summary: {
              totalLoans: 1,
              overdueCount: 1,
              pendingCount: 0,
              paidCount: 0,
              dueTodayCount: 0,
              actionableCount: 1,
              totalPayableAmount: 125000,
              totalLateFeeAmount: 5000,
            },
            agenda: [
              {
                loanId: 77,
                customerName: 'Cliente Prueba',
                installmentNumber: 1,
                totalInstallments: 12,
                dueDate: '2026-04-24T00:00:00.000Z',
                status: 'overdue',
                payableAmount: 125000,
                scheduledPayment: 120000,
                lateFeeDue: 5000,
                daysOverdue: 4,
                canPay: true,
                isNextPayable: true,
              },
            ],
            entries: [
              {
                loanId: 77,
                customerName: 'Cliente Prueba',
                totalInstallments: 12,
                loanStatus: 'active',
                installmentNumber: 1,
                dueDate: '2026-04-24T00:00:00.000Z',
                status: 'overdue',
                scheduledPayment: 120000,
                principalComponent: 80000,
                interestComponent: 40000,
                remainingBalance: 420000,
                outstandingAmount: 120000,
                payableAmount: 125000,
                lateFeeDue: 5000,
                daysOverdue: 4,
                canPay: true,
                isNextPayable: true,
                disabledReason: null,
              },
            ],
          },
        },
      },
    });
    mockApiPost.mockResolvedValue({
      data: {
        data: {
          calculation: {
            summary: {
              installmentAmount: 100000,
              totalInterest: 50000,
              totalPayable: 1050000,
              totalPrincipal: 1000000,
              outstandingBalance: 1050000,
              outstandingPrincipal: 1000000,
              outstandingInterest: 50000,
              outstandingInstallments: 12,
              nextInstallment: null,
            },
            calculationProfileVersionId: 7,
            lateFeeMode: 'SIMPLE',
            schedule: [
              {
                installmentNumber: 1,
                dueDate: '2026-06-01T00:00:00.000Z',
                openingBalance: 1000000,
                scheduledPayment: 100000,
                principalComponent: 60000,
                interestComponent: 40000,
                paidPrincipal: 0,
                paidInterest: 0,
                paidTotal: 0,
                remainingPrincipal: 940000,
                remainingInterest: 0,
                remainingBalance: 940000,
                status: 'pending',
              },
            ],
          },
        },
      },
    });
  });

  it('labels the credits tablist for assistive navigation', () => {
    renderCredits();

    expect(screen.getByRole('tablist', { name: 'Secciones de créditos' })).toBeInTheDocument();
  });

  it('executes view details action and navigates to credit detail', async () => {
    renderCredits();

    expect(screen.getByRole('heading', { name: 'Operación de créditos' })).toBeInTheDocument();
    expect(screen.queryByText('Gestión de Créditos')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/Estado: etapa administrativa del crédito/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Situación: lectura de cobranza/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Activo\. Activo: crédito vigente/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/En Curso\. En curso: crédito todavía tiene seguimiento/i).length).toBeGreaterThan(0);

    const viewButton = screen.getByTitle('Ver detalles del crédito');
    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('credits/77');
    });
  });

  it('allows all roles to view credit details', async () => {
    currentUser = { id: 2, name: 'Socio', email: 'socio@test.com', role: 'socio', permissions: ['*'] };
    renderCredits();

    const viewButton = screen.getByTitle('Ver detalles del crédito');
    expect(viewButton).toBeInTheDocument();
    expect(viewButton).not.toBeDisabled();
    expect(screen.queryByTitle('Registrar pago de cuota')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Crear compromiso de pago')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Crear seguimiento')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Anular cuota')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previsualizar crédito' })).not.toBeInTheDocument();

    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('credits/77');
    });
  });

  it('sends the operator to the dedicated preview route from credits', async () => {
    renderCredits();

    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar crédito' }));

    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('credit-calculator');
    });
  });

  it('hides the preview action for customer users', () => {
    currentUser = { id: 9, name: 'Cliente', email: 'customer@test.com', role: 'customer', permissions: ['*'] };
    renderCredits();

    expect(screen.queryByRole('button', { name: 'Previsualizar crédito' })).not.toBeInTheDocument();
  });

  it('does not request dashboard-only portfolio statistics for employees without dashboard permission', () => {
    currentUser = {
      id: 2,
      name: 'Empleado',
      email: 'employee@test.com',
      role: 'employee',
      permissions: ['CREDITS_VIEW_ALL'],
    };

    renderCredits();

    expect(mockUseLoanStatistics).toHaveBeenCalledWith({ enabled: false });
    expect(screen.getByLabelText('Resumen de los créditos visibles')).toBeInTheDocument();
    expect(screen.getAllByText((content) => content.includes('500.000')).length).toBeGreaterThan(0);
  });

  it('keeps internal credit identifiers out of the portfolio list', () => {
    renderCredits();

    expect(screen.queryByRole('columnheader', { name: /^ID$/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Crédito #77')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Seleccionar crédito 77')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Seleccionar crédito de Cliente Prueba')).toBeInTheDocument();
  });

  it('turns the calendar tab into an operational agenda with actions for the next payable installment', async () => {
    renderCredits();

    fireEvent.click(screen.getByRole('tab', { name: 'Calendario' }));



    expect(await screen.findByText('Agenda operativa')).toBeInTheDocument();
    expect(screen.getByText('Cobros accionables')).toBeInTheDocument();
    expect(await screen.findByText('Cliente Prueba')).toBeInTheDocument();
    expect(screen.getAllByText(/Cuota 1 de 12/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Crédito #77/i)).not.toBeInTheDocument();
    expect(screen.getByText('4 días de atraso')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar pago' })[0]);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/loans/calendar/overview', {
        params: {
          asOfDate: expect.any(String),
          search: undefined,
          status: undefined,
          startDate: undefined,
          endDate: undefined,
          limit: 150,
        },
      });
      expect(mockSetCurrentView).toHaveBeenCalledWith('credits/77');
    });
  });

  it('keeps credit calendar date filters within a valid range', async () => {
    renderCredits();

    fireEvent.click(screen.getByRole('tab', { name: 'Calendario' }));

    const fromInput = await screen.findByLabelText('Desde');
    const toInput = screen.getByLabelText('Hasta');

    fireEvent.change(fromInput, { target: { value: '2026-07-01' } });
    fireEvent.change(toInput, { target: { value: '2026-06-30' } });

    expect(fromInput).toHaveValue('2026-07-01');
    expect(toInput).toHaveValue('');
    expect(mockApiGet).not.toHaveBeenCalledWith('/loans/calendar/overview', {
      params: expect.objectContaining({
        startDate: '2026-07-01',
        endDate: '2026-06-30',
      }),
    });
  });
});
