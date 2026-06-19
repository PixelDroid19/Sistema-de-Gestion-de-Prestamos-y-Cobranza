import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentSchedule from '../PaymentSchedule';

const exportCreditExcel = vi.fn().mockResolvedValue(undefined);
const toastSuccess = vi.fn();
let scheduleFixture: any[] = [];
let summaryFixture: any = {};

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: '9' }),
}));

vi.mock('../../services/reportService', () => ({
  exportCreditExcel: (...args: unknown[]) => exportCreditExcel(...args),
  usePaymentSchedule: () => ({
    data: {},
    loan: {
      amount: 1000000,
      interestRate: 24,
      termMonths: 12,
      status: 'active',
      customerName: 'Cliente QA',
    },
    summary: {
      totalPrincipal: '1000000',
      totalInterest: '120000',
      totalPayment: '1120000',
      paidInstallments: 0,
      pendingInstallments: 12,
      ...summaryFixture,
    },
    schedule: scheduleFixture,
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: vi.fn(),
  },
}));

const sessionState = {
  user: { id: 1, role: 'admin' as 'admin' | 'employee', name: 'Admin', email: 'admin@test.com' },
};

const mockUseResolvedPermissionNames = vi.fn((_user?: unknown) => ['*']);

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => sessionState,
}));

vi.mock('../../services/permissionsService', () => ({
  useResolvedPermissionNames: (user?: unknown) => mockUseResolvedPermissionNames(user),
}));

describe('PaymentSchedule behavior', () => {
  beforeEach(() => {
    scheduleFixture = [];
    summaryFixture = {};
    vi.clearAllMocks();
    sessionState.user = { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com' };
    mockUseResolvedPermissionNames.mockReturnValue(['*']);
  });

  it('renders the loan summary status with an operator-facing label', () => {
    render(<PaymentSchedule />);

    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.queryByText(/^active$/i)).not.toBeInTheDocument();
  });

  it('renders schedule row statuses with operator-facing labels', () => {
    scheduleFixture = [{
      installmentNumber: 1,
      dueDate: '2026-06-15',
      openingBalance: 1000000,
      scheduledPayment: 100000,
      principalComponent: 80000,
      interestComponent: 20000,
      paidTotal: 0,
      remainingBalance: 920000,
      status: 'defaulted',
    }];

    render(<PaymentSchedule />);

    expect(screen.getByText('En mora')).toBeInTheDocument();
    expect(screen.queryByText(/^defaulted$/i)).not.toBeInTheDocument();
  });

  it('shows capital prepayments separately when the schedule summary includes them', () => {
    summaryFixture = {
      totalPrincipal: '1000000',
      totalInterest: '100000',
      totalPayment: '1100000',
      capitalPrepayments: '300000',
    };

    render(<PaymentSchedule />);

    expect(screen.getByText('Abonos a capital')).toBeInTheDocument();
    expect(screen.getByText('Capital pagado fuera de cuotas')).toBeInTheDocument();
    expect(screen.getByText(/COP 300.000/)).toBeInTheDocument();
    expect(screen.getByText('Cuotas del plan + abonos')).toBeInTheDocument();
  });

  it('hides export when the operator only has credit view permissions', () => {
    sessionState.user = { id: 2, role: 'employee', name: 'Operador', email: 'employee@test.com' };
    mockUseResolvedPermissionNames.mockReturnValue(['CREDITS_VIEW_ALL']);

    render(<PaymentSchedule />);

    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument();
  });

  it('confirms export without exposing the internal credit id in the toast', async () => {
    render(<PaymentSchedule />);

    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));

    await waitFor(() => {
      expect(exportCreditExcel).toHaveBeenCalledWith(9);
      expect(toastSuccess).toHaveBeenCalledWith({
        title: 'Exportación exitosa',
        description: 'Se exportó el Excel del crédito.',
      });
    });
  });
});
