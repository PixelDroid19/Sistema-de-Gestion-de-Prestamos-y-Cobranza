import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssociateTracking from '../AssociateTracking';
import { exportAssociatesExcel } from '../../services/associateService';

const useAssociateTrackingSpy = vi.fn();
const useAssociateDetailsSpy = vi.fn();

vi.mock('../../services/associateService', () => ({
  exportAssociatesExcel: vi.fn(),
  useAssociateDetails: (associateId: number) => useAssociateDetailsSpy(associateId),
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
  recentActivity,
}: {
  summary?: Record<string, unknown>;
  associates?: any[];
  obligations?: any[];
  recentPayments?: any[];
  recentContributions?: any[];
  recentCapitalReturns?: any[];
  recentActivity?: any[];
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
        ...(recentActivity !== undefined ? { recentActivity } : {}),
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
    status: 'active',
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

const selectTrackingView = (view: 'obligations' | 'activity') => {
  const label = view === 'obligations' ? /Obligaciones/ : /Actividad/;
  fireEvent.click(screen.getAllByRole('tab', { name: label })[0]);
};

describe('AssociateTracking behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAssociateDetailsSpy.mockReturnValue({
      payInstallment: {
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: false,
      },
    });
  });

  it('renders the financial summary and exposes tracking sections through one query selector', async () => {
    const user = userEvent.setup();
    const setCurrentView = vi.fn();
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

    render(<AssociateTracking setCurrentView={setCurrentView} />);

    expect(screen.getByText('Capital vigente')).toBeInTheDocument();
    expect(screen.getByText('COP 5.500.000')).toBeInTheDocument();
    expect(screen.getByText('Próximo vencimiento')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pagos e intereses' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Obligaciones 1' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^Socios \d/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Obligaciones con socios' })).toBeInTheDocument();
    expect(screen.getAllByText('Socio Integral').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Socios' }));
    expect(setCurrentView).toHaveBeenCalledWith('associates');

    selectTrackingView('activity');
    expect(screen.getByRole('heading', { name: 'Actividad reciente' })).toBeInTheDocument();
    expect(screen.getByText('Pago de interés')).toBeInTheDocument();
    expect(screen.getByText('Devolución de capital')).toBeInTheDocument();
    expect(screen.getByText('Aporte de capital')).toBeInTheDocument();
  });

  it('accepts tracking payloads returned directly under data for resilient rendering', () => {
    useAssociateTrackingSpy.mockReturnValue({
      data: {
        data: {
          summary: {
            totalCapital: 5500000,
            pendingInterest: 110000,
            paidInterest: 10000,
            activeAssociates: 1,
            totalAssociates: 1,
          },
          associates: [buildAssociateTrackingRow(1)],
          obligations: [buildAssociateObligationRow(1)],
          recentPayments: [],
          recentContributions: [],
          recentCapitalReturns: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    expect(screen.getByText('Capital vigente')).toBeInTheDocument();
    expect(screen.getByText('COP 5.500.000')).toBeInTheDocument();
    expect(screen.getByText('Pendiente por pagar')).toBeInTheDocument();
    expect(screen.getByText('COP 130.000')).toBeInTheDocument();
    expect(screen.getAllByText('COP 10.000').length).toBeGreaterThan(0);
    expect(screen.getByText('Socio Obligacion 1')).toBeInTheDocument();
  });

  it('renders recent activity when the API already returns a consolidated activity list', async () => {
    const user = userEvent.setup();
    useAssociateTrackingSpy.mockReturnValue(buildTrackingResponse({
      associates: [buildAssociateTrackingRow(1)],
      obligations: [buildAssociateObligationRow(1)],
      recentActivity: [
        {
          id: 'activity-1',
          type: 'payment',
          label: 'Pago de interés',
          detail: 'Pago registrado',
          associateId: 1,
          associateName: 'Socio Paginado 1',
          date: '2026-06-12',
          amount: 10000,
          responsible: 'QA Admin',
        },
      ],
    }));

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    selectTrackingView('activity');
    expect(screen.getByRole('heading', { name: 'Actividad reciente' })).toBeInTheDocument();
    expect(screen.getByText('Pago de interés')).toBeInTheDocument();
    expect(screen.getByText('Pago registrado')).toBeInTheDocument();
    expect(screen.getByText('QA Admin')).toBeInTheDocument();
  });

  it('renders flat associate rows and applies their rate to obligations', async () => {
    const user = userEvent.setup();
    useAssociateTrackingSpy.mockReturnValue({
      data: {
        data: {
          summary: {
            totalCapital: 100000000,
            pendingInterest: 2000000,
            paidInterest: 1000000,
          },
          associates: [{
            id: 1,
            name: 'Socio Capital Norte',
            email: 'capital.norte@test.local',
            currentCapital: 100000000,
            totalContributed: 100000000,
            pendingInterest: 2000000,
            paidInterest: 1000000,
            interestRate: 2,
            interestType: 'monthly',
            nextPaymentDate: '2026-07-01',
          }],
          obligations: [{
            id: 11,
            associateId: 1,
            associateName: 'Socio Capital Norte',
            installmentNumber: 1,
            dueDate: '2026-07-01',
            amount: 2000000,
            status: 'pending',
          }],
          recentPayments: [],
          recentContributions: [],
          recentCapitalReturns: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    expect(screen.getByText('2% mensual')).toBeInTheDocument();
    expect(screen.getAllByText('Socio Capital Norte').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1/07/2026').length).toBeGreaterThan(0);
  });


  it('exports associate tracking with the visible search and status filters', async () => {
    const user = userEvent.setup();
    useAssociateTrackingSpy.mockReturnValue(buildTrackingResponse({
      associates: [buildAssociateTrackingRow(1)],
    }));

    render(<AssociateTracking setCurrentView={vi.fn()} />);

    await user.clear(screen.getByLabelText('Buscar socio'));
    await user.type(screen.getByLabelText('Buscar socio'), 'socio paginado');
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'inactive' } });
    await user.click(screen.getByRole('button', { name: 'Exportar socios' }));

    await waitFor(() => {
      expect(exportAssociatesExcel).toHaveBeenCalledWith({
        search: 'socio paginado',
        status: 'inactive',
      });
    });
  });



  it('shows explicit empty states for each tracking query when filters leave no records', async () => {
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

    selectTrackingView('activity');
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

    selectTrackingView('activity');
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

    selectTrackingView('activity');
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

  it('registers an associate interest payment directly from the obligation row', async () => {
    const user = userEvent.setup();
    const payInstallment = vi.fn().mockResolvedValue({});
    useAssociateDetailsSpy.mockReturnValue({
      payInstallment: {
        mutateAsync: payInstallment,
        isPending: false,
      },
    });
    useAssociateTrackingSpy.mockReturnValue(buildTrackingResponse({
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

    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(screen.getByRole('dialog', { name: 'Registrar pago de interés' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Fecha real de pago'), { target: { value: '2026-06-15' } });
    fireEvent.change(screen.getByLabelText('Método de pago'), { target: { value: 'transferencia' } });
    await user.click(screen.getByRole('button', { name: 'Confirmar pago' }));

    await waitFor(() => {
      expect(useAssociateDetailsSpy).toHaveBeenCalledWith(1);
      expect(payInstallment).toHaveBeenCalledWith({
        installmentNumber: 1,
        paymentDate: '2026-06-15',
        paymentMethod: 'transferencia',
      });
    });
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

    expect(screen.getByText((content) => (
      content.includes('Vencidas')
      && content.includes('Por vencer')
      && content.includes('Pagos de intereses pendientes o vencidos por socio.')
    ))).toBeInTheDocument();
  });
});
