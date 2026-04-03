import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Credits from '../Credits';

const mockDeleteLoan = vi.fn().mockResolvedValue(undefined);
const mockInvalidateAfterDelete = vi.fn().mockResolvedValue(undefined);
const mockSetCurrentView = vi.fn();
const mockToastError = vi.fn();

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

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({ user: currentUser }),
}));

vi.mock('../../store/paginationStore', () => ({
  usePaginationStore: () => ({ page: 1, pageSize: 25, setPage: vi.fn() }),
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
  });

  vi.mock('../../lib/confirmModal', () => ({
    confirmDanger: vi.fn(() => Promise.resolve(true)),
    confirm: vi.fn(() => Promise.resolve(true)),
    requestInput: vi.fn(() => Promise.resolve('test reference')),
  }));

  it('executes delete action and invalidates list surface', async () => {
    renderCredits();

    expect(screen.getByRole('heading', { name: 'Operación de créditos' })).toBeInTheDocument();
    expect(screen.queryByText('Gestión de Créditos')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Eliminar'));

    await waitFor(() => {
      expect(mockDeleteLoan).toHaveBeenCalledWith(77);
      expect(mockInvalidateAfterDelete).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ loanId: 77, loansParams: { page: 1, pageSize: 25 } }),
      );
    });
  });

  it('blocks ineligible delete action with guard feedback', async () => {
    currentUser = { id: 2, name: 'Socio', email: 'socio@test.com', role: 'socio', permissions: ['*'] };
    renderCredits();

    fireEvent.click(screen.getByTitle('Eliminar'));

    expect(mockDeleteLoan).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Solo administradores pueden eliminar créditos.',
      }),
    );
  });
});
