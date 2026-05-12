import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssociateDetails from '../AssociateDetails';

const mockNavigate = vi.fn();
const mockUseSessionStore = vi.fn();
const useAssociateDetailsSpy = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => mockUseSessionStore(),
}));

vi.mock('../../services/associateService', () => ({
  useAssociateDetails: (associateId: number) => useAssociateDetailsSpy(associateId),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    apiErrorSafe: vi.fn(),
  },
}));

vi.mock('../ContributionModal', () => ({
  default: () => null,
}));

vi.mock('../InstallmentsModal', () => ({
  default: () => null,
}));

const buildDetailsResponse = () => ({
  portal: {
    associate: {
      id: 1,
      name: 'Socio Uno',
      status: 'active',
      participationPercentage: '25.0000',
      interestType: 'monthly',
      interestRate: '2.5000',
    },
    summary: {
      totalContributed: 2500000,
      totalDistributed: 150000,
      totalInterestPaid: 125000,
      interestDebt: 62500,
      nextInterestPaymentDate: '2026-06-15T00:00:00.000Z',
      debtStatus: 'pending',
      activeLoanCount: 2,
    },
    loans: [],
    contributions: [],
    distributions: [],
    paymentHistory: [
      {
        id: 50,
        installmentNumber: 1,
        amount: 125000,
        dueDate: '2026-05-15T00:00:00.000Z',
        paidAt: '2026-05-16T00:00:00.000Z',
        paymentMethod: 'transfer',
      },
    ],
  },
  installments: {
    installments: [
      {
        id: 11,
        installmentNumber: 1,
        amount: 350000,
        dueDate: '2026-05-10T00:00:00.000Z',
        status: 'pending',
      },
    ],
    totals: {
      totalPending: 350000,
      totalPaid: 0,
      totalOverdue: 0,
    },
  },
  contributions: [],
  calendar: {
    events: [],
    summary: {
      contributionCount: 0,
      distributionCount: 0,
      installmentCount: 1,
      pendingInstallments: 1,
    },
  },
  isLoading: false,
  createContribution: { mutateAsync: vi.fn() },
  createDistribution: { mutateAsync: vi.fn() },
  createReinvestment: { mutateAsync: vi.fn() },
  payInstallment: { mutateAsync: vi.fn() },
});

describe('AssociateDetails behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAssociateDetailsSpy.mockReturnValue(buildDetailsResponse());
  });

  it('shows admin controls only to admin users', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    expect(screen.getByRole('button', { name: 'Volver a socios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar aporte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar retiro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar reinversión' })).toBeInTheDocument();
  });

  it('keeps the socio portal read-only for operational actions', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 7, role: 'socio', name: 'Socio', email: 'socio@test.com', permissions: [], associateId: 1 },
    });

    render(<AssociateDetails />);

    expect(screen.queryByRole('button', { name: 'Registrar aporte' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar retiro' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar reinversión' })).not.toBeInTheDocument();
    expect(screen.getByText(/los movimientos financieros se registran desde la mesa operativa/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cuotas' }));

    expect(screen.queryByRole('button', { name: /Marcar como pagado/i })).not.toBeInTheDocument();
  });

  it('translates associated loan statuses into operator-friendly labels', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 7, role: 'socio', name: 'Socio', email: 'socio@test.com', permissions: [], associateId: 1 },
    });

    useAssociateDetailsSpy.mockReturnValue({
      ...buildDetailsResponse(),
      portal: {
        ...buildDetailsResponse().portal,
        loans: [
          { id: 4, amount: 360000, totalInterest: 0, status: 'active' },
          { id: 3, amount: 350000, totalInterest: 0, status: 'pending' },
        ],
      },
    });

    render(<AssociateDetails />);

    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.queryByText(/^active$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^pending$/i)).not.toBeInTheDocument();
  });

  it('shows associate interest debt and payment history trace', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    expect(screen.getByText(/Con intereses pendientes/i)).toBeInTheDocument();
    expect(screen.getByText('Interés pagado')).toBeInTheDocument();
    expect(screen.getByText('Deuda con socio')).toBeInTheDocument();
    expect(screen.getByText('Interés pactado')).toBeInTheDocument();
    expect(screen.getByText('Historial de intereses pagados')).toBeInTheDocument();
    expect(screen.getAllByText(/\$125[,.]000/).length).toBeGreaterThan(0);
    expect(screen.getByText('transfer')).toBeInTheDocument();
  });
});
