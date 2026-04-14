import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Credits from '../Credits';

const mockDeleteLoan = vi.fn().mockResolvedValue(undefined);
const mockInvalidateAfterDelete = vi.fn().mockResolvedValue(undefined);
const mockSetCurrentView = vi.fn();
const mockToastError = vi.fn();
const mockConfirmDanger = vi.fn().mockResolvedValue(true);

type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'socio' | 'customer';
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

vi.mock('../DAGWorkbench', () => ({
  default: () => null,
}));

vi.mock('../../api/client', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({
      data: {
        data: {
          simulation: {
            summary: {
              installmentAmount: 100000,
              totalInterest: 50000,
              totalPayable: 1050000,
            },
            schedule: [],
          },
        },
      },
    }),
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
  useLoanStatistics: () => ({
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
  }),
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
  });

  it('executes view details action and navigates to credit detail', async () => {
    renderCredits();

    expect(screen.getByRole('heading', { name: 'Operación de créditos' })).toBeInTheDocument();
    expect(screen.queryByText('Gestión de Créditos')).not.toBeInTheDocument();

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

    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(mockSetCurrentView).toHaveBeenCalledWith('credits/77');
    });
  });
});
