import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const buildAssociateTrackingRow = (index: number) => ({
  associate: {
    id: index,
    firstName: 'Socio',
    lastName: `Paginado ${index}`,
    email: `socio.paginado.${index}@test.local`,
    phone: `300000000${index}`,
    interestRate: 2,
    interestType: 'monthly',
  },
  currentCapital: 1000000 * index,
  totalContributed: 1000000 * index,
  totalCapitalReturned: 0,
  interestPending: 20000 * index,
  interestOverdue: index === 1 ? 20000 : 0,
  interestPaid: 10000 * index,
  nextPaymentDate: `2026-06-${String(index).padStart(2, '0')}`,
  debtStatus: index === 1 ? 'overdue' : 'pending',
  pendingInstallments: index,
  overdueInstallments: index === 1 ? 1 : 0,
});

const buildAssociateObligationRow = (index: number) => ({
  id: index,
  associateId: index,
  associateName: `Socio Obligacion ${index}`,
  installmentNumber: index,
  dueDate: `2026-06-${String(index).padStart(2, '0')}`,
  amount: 10000 * index,
  interestRate: 2,
  interestType: 'monthly',
  status: index === 1 ? 'overdue' : 'pending',
});

describe('AssociateTracking behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the financial summary and separates tracking sections with tabs', async () => {
    const user = userEvent.setup();
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
    expect(screen.getByRole('tab', { name: 'Obligaciones 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Obligaciones con socios' })).toBeInTheDocument();
    expect(screen.getAllByText('Socio Integral').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Actividad 3' }));
    expect(screen.getByRole('heading', { name: 'Actividad reciente' })).toBeInTheDocument();
    expect(screen.getByText('Pago de interés')).toBeInTheDocument();
    expect(screen.getByText('Devolución de capital')).toBeInTheDocument();
    expect(screen.getByText('Aporte de capital')).toBeInTheDocument();
  });

  it('shows explicit empty states for each tracking tab when filters leave no records', async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('tab', { name: 'Socios 0' }));
    expect(screen.getByText('Sin socios para seguimiento')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Actividad 0' }));
    expect(screen.getByRole('heading', { name: 'Actividad reciente' })).toBeInTheDocument();
    expect(screen.getByText('Sin movimientos recientes')).toBeInTheDocument();
  });

  it('ignores malformed tracking rows instead of rendering broken table entries', async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('tab', { name: 'Actividad 0' }));
    expect(screen.getByText('Sin movimientos recientes')).toBeInTheDocument();
  });

  it('consolidates recent movements into a single activity table ordered from newest to oldest', async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('tab', { name: 'Actividad 3' }));
    const movementLabels = screen.getAllByText(/Pago de interés|Devolución de capital|Aporte de capital/);
    expect(movementLabels.map((item) => item.textContent)).toEqual([
      'Aporte de capital',
      'Devolución de capital',
      'Pago de interés',
    ]);
  });

  it('opens a quick associate summary modal from a tracking row', async () => {
    const user = userEvent.setup();
    useAssociateTrackingSpy.mockReturnValue(buildTrackingResponse({
      associates: [
        {
          associate: { id: 1, firstName: 'Socio', lastName: 'Integral', email: 'socio.integral@test.local', interestRate: 2, interestType: 'monthly' },
          currentCapital: 5000000,
          totalContributed: 5000000,
          totalCapitalReturned: 0,
          interestPending: 100000,
          interestOverdue: 0,
          interestPaid: 10000,
          nextPaymentDate: '2026-06-14',
          debtStatus: 'pending',
          pendingInstallments: 1,
          overdueInstallments: 0,
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
    }));

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Ver resumen rápido' }));

    expect(screen.getByRole('dialog', { name: 'Resumen de Socio Integral' })).toBeInTheDocument();
    expect(screen.getByText('Condiciones pactadas')).toBeInTheDocument();
    expect(screen.getByText('Próximas obligaciones')).toBeInTheDocument();
  });

  it('paginates the associate control table without rendering every row at once', async () => {
    const user = userEvent.setup();
    useAssociateTrackingSpy.mockReturnValue(buildTrackingResponse({
      summary: {
        totalAssociates: 6,
        activeAssociates: 6,
      },
      associates: Array.from({ length: 6 }, (_, index) => buildAssociateTrackingRow(index + 1)),
    }));

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    await user.click(screen.getByRole('tab', { name: 'Socios 6' }));

    expect(screen.getByText('Socio Paginado 1')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Capital vigente' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Rentabilidad y saldo' })).toBeInTheDocument();
    expect(screen.queryByText('Socio Paginado 6')).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 a 5 de 6 socios')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('1 pendiente') && content.includes('1 vencida'))).toBeInTheDocument();
    expect(screen.getByText('2 pendientes')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByText('Socio Paginado 6')).toBeInTheDocument();
    expect(screen.queryByText('Socio Paginado 1')).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 6 a 6 de 6 socios')).toBeInTheDocument();
  });

  it('avoids repeating contributed capital in the row when the current capital already represents the full contribution', async () => {
    const user = userEvent.setup();
    useAssociateTrackingSpy.mockReturnValue(buildTrackingResponse({
      associates: [
        {
          associate: {
            id: 1,
            firstName: 'Socio',
            lastName: 'Sin Redundancia',
            email: 'socio.sin.red@test.local',
            interestRate: 2,
            interestType: 'monthly',
          },
          currentCapital: 1000000,
          totalContributed: 1000000,
          totalCapitalReturned: 0,
          interestPending: 20000,
          interestOverdue: 0,
          interestPaid: 0,
          nextPaymentDate: '2026-06-14',
          debtStatus: 'pending',
          pendingInstallments: 1,
          overdueInstallments: 0,
        },
      ],
    }));

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    await user.click(screen.getByRole('tab', { name: 'Socios 1' }));

    expect(screen.getByText('Socio Sin Redundancia')).toBeInTheDocument();
    expect(screen.queryByText('Aportado $ 1.000.000')).not.toBeInTheDocument();
    expect(screen.getByText(/Pendiente \$\s?20\.000/)).toBeInTheDocument();
    expect(screen.queryByText('Pagado $ 0')).not.toBeInTheDocument();
  });

  it('paginates open obligations instead of rendering the full obligation list', async () => {
    const user = userEvent.setup();
    useAssociateTrackingSpy.mockReturnValue(buildTrackingResponse({
      obligations: Array.from({ length: 6 }, (_, index) => buildAssociateObligationRow(index + 1)),
    }));

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    expect(screen.getByText('Socio Obligacion 1')).toBeInTheDocument();
    expect(screen.queryByText('Socio Obligacion 6')).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 a 5 de 6 obligaciones')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByText('Socio Obligacion 6')).toBeInTheDocument();
    expect(screen.queryByText('Socio Obligacion 1')).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 6 a 6 de 6 obligaciones')).toBeInTheDocument();
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
