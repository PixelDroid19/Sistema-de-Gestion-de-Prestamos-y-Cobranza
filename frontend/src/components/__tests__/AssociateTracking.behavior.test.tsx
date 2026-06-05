import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssociateTracking from '../AssociateTracking';

const useAssociateTrackingSpy = vi.fn();

vi.mock('../../services/associateService', () => ({
  exportAssociatesExcel: vi.fn(),
  useAssociateTracking: (filters: unknown) => useAssociateTrackingSpy(filters),
}));

vi.mock('../../services/permissionsService', () => ({
  useResolvedPermissionNames: () => ['*'],
}));

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({
    user: { role: 'admin', permissions: ['*'] },
  }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../lib/clientDiagnostics', () => ({
  reportClientError: vi.fn(),
}));

const buildTrackingResponse = ({
  summary = {},
  associates = [],
  obligations = [],
  recentPayments = [],
  recentContributions = [],
  recentCapitalReturns = [],
}: {
  summary?: Record<string, unknown>;
  associates?: any[];
  obligations?: any[];
  recentPayments?: any[];
  recentContributions?: any[];
  recentCapitalReturns?: any[];
} = {}) => ({
  data: {
    data: {
      tracking: {
        summary: {
          totalCapital: 5500000,
          totalCapitalReturned: 0,
          totalPayable: 110000,
          interestPaid: 10000,
          activeAssociates: 2,
          totalAssociates: 2,
          ...summary,
        },
        associates,
        obligations,
        recentPayments,
        recentContributions,
        recentCapitalReturns,
      },
    },
  },
  isLoading: false,
  isError: false,
});

describe('AssociateTracking behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the financial summary and key tracking tables with active data', () => {
    useAssociateTrackingSpy.mockReturnValue(buildTrackingResponse({
      associates: [
        {
          associate: { id: 1, firstName: 'Socio', lastName: 'Integral', email: 'socio.integral@test.local' },
          currentCapital: 5000000,
          totalContributed: 5000000,
          totalCapitalReturned: 0,
          interestPending: 100000,
          interestOverdue: 0,
          interestPaid: 10000,
          nextPaymentDate: '2026-06-14',
          debtStatus: 'pending',
        },
      ],
      obligations: [
        {
          id: 11,
          associateId: 1,
          associateName: 'Socio Integral',
          installmentNumber: 1,
          dueDate: '2026-06-14',
          amount: 100000,
          interestRate: 2,
          interestType: 'monthly',
          status: 'pending',
        },
      ],
      recentPayments: [
        {
          id: 21,
          associateId: 1,
          associateName: 'Socio Integral',
          displayType: 'Pago programado #1',
          paidAt: '2026-06-01',
          amount: 10000,
          paidByUser: { name: 'QA Admin' },
        },
      ],
      recentContributions: [
        {
          id: 31,
          associateId: 1,
          associateName: 'Socio Integral',
          contributionDate: '2026-06-02',
          amount: 500000,
          status: 'completed',
          createdBy: { name: 'QA Admin' },
        },
      ],
      recentCapitalReturns: [
        {
          id: 41,
          associateId: 1,
          associateName: 'Socio Integral',
          distributionDate: '2026-06-03',
          amount: 150000,
          createdBy: { name: 'Tesorería' },
        },
      ],
    }));

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    expect(screen.getAllByText('Capital vigente').length).toBeGreaterThan(0);
    expect(screen.getByText('$ 5.500.000')).toBeInTheDocument();
    expect(screen.getByText('Próximo vencimiento')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Obligaciones con socios' })).toBeInTheDocument();
    expect(screen.getAllByText('Socio Integral').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Actividad reciente' })).toBeInTheDocument();
    expect(screen.getByText('Pago de interés')).toBeInTheDocument();
    expect(screen.getByText('Devolución de capital')).toBeInTheDocument();
    expect(screen.getByText('Aporte de capital')).toBeInTheDocument();
  });

  it('shows explicit empty states for the tracking sections when filters leave no records', () => {
    useAssociateTrackingSpy.mockReturnValue(buildTrackingResponse({
      summary: {
        totalCapital: 0,
        totalPayable: 0,
        interestPaid: 0,
        activeAssociates: 0,
        totalAssociates: 0,
      },
      associates: [],
      obligations: [],
      recentPayments: [],
      recentContributions: [],
    }));

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    expect(screen.getByText('Sin obligaciones pendientes')).toBeInTheDocument();
    expect(screen.getByText('Sin socios para seguimiento')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Actividad reciente' })).toBeInTheDocument();
    expect(screen.getByText('Sin movimientos recientes')).toBeInTheDocument();
  });

  it('ignores malformed tracking rows instead of rendering broken table entries', () => {
    useAssociateTrackingSpy.mockReturnValue(buildTrackingResponse({
      obligations: [
        {
          id: 99,
          associateId: 2,
          associateName: '',
          installmentNumber: null,
          dueDate: null,
          amount: 0,
          interestRate: 0,
          interestType: 'monthly',
          status: 'overdue',
        },
      ],
      recentPayments: [
        {
          id: 199,
          associateId: 2,
          associateName: '',
          paidAt: null,
          amount: 0,
        },
      ],
    }));

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    expect(screen.queryByText('Socio sin nombre')).not.toBeInTheDocument();
    expect(screen.getByText('Sin obligaciones pendientes')).toBeInTheDocument();
    expect(screen.getByText('Sin movimientos recientes')).toBeInTheDocument();
  });

  it('consolidates recent movements into a single activity table ordered from newest to oldest', () => {
    useAssociateTrackingSpy.mockReturnValue(buildTrackingResponse({
      recentPayments: [
        {
          id: 21,
          associateId: 1,
          associateName: 'Socio Pago',
          displayType: 'Pago programado #1',
          paidAt: '2026-06-01',
          amount: 10000,
          paidByUser: { name: 'QA Admin' },
        },
      ],
      recentContributions: [
        {
          id: 31,
          associateId: 2,
          associateName: 'Socio Aporte',
          contributionDate: '2026-06-03',
          amount: 500000,
          status: 'completed',
          createdBy: { name: 'Tesorería' },
        },
      ],
      recentCapitalReturns: [
        {
          id: 41,
          associateId: 3,
          associateName: 'Socio Capital',
          distributionDate: '2026-06-02',
          amount: 150000,
          createdBy: { name: 'Tesorería' },
        },
      ],
    }));

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    const movementLabels = screen.getAllByText(/Pago de interés|Devolución de capital|Aporte de capital/);
    expect(movementLabels.map((item) => item.textContent)).toEqual([
      'Aporte de capital',
      'Devolución de capital',
      'Pago de interés',
    ]);
  });

  it('surfaces overdue and upcoming obligation counters in the obligations header', () => {
    useAssociateTrackingSpy.mockReturnValue(buildTrackingResponse({
      obligations: [
        {
          id: 11,
          associateId: 1,
          associateName: 'Socio Mora',
          installmentNumber: 1,
          dueDate: '2026-05-14',
          amount: 100000,
          interestRate: 2,
          interestType: 'monthly',
          status: 'overdue',
        },
        {
          id: 12,
          associateId: 1,
          associateName: 'Socio Mora',
          installmentNumber: 2,
          dueDate: '2026-06-14',
          amount: 100000,
          interestRate: 2,
          interestType: 'monthly',
          status: 'pending',
        },
      ],
    }));

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    expect(screen.getByText('Vencidas 1')).toBeInTheDocument();
    expect(screen.getByText('Por vencer 1')).toBeInTheDocument();
  });
});
