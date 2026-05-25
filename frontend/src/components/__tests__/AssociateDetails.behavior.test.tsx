import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  useAssociateDetails: (associateId: number, calendarFilters?: { startDate?: string; endDate?: string }) => useAssociateDetailsSpy(associateId, calendarFilters),
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
  details: {
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
    },
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
    alerts: [
      {
        type: 'overdue',
        severity: 'high',
        installmentNumber: 1,
        amount: 350000,
        dueDate: '2026-05-10T00:00:00.000Z',
        daysOverdue: 2,
        daysUntilDue: null,
      },
      {
        type: 'upcoming',
        severity: 'medium',
        installmentNumber: 2,
        amount: 125000,
        dueDate: '2026-05-15T00:00:00.000Z',
        daysOverdue: null,
        daysUntilDue: 5,
      },
    ],
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
    expect(screen.getByRole('button', { name: 'Registrar aporte de capital' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar pago de interés' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar retiro de intereses' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reinvertir intereses' })).toBeInTheDocument();
  });

  it('presents associate records as administrative details, not a portal', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    expect(screen.getByText('Detalle del socio')).toBeInTheDocument();
    expect(screen.queryByText(/portal del socio/i)).not.toBeInTheDocument();
  });

  it('keeps non-admin associate access read-only for operational actions', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 7, role: 'employee', name: 'Empleado', email: 'employee@test.com', permissions: ['SOCIOS_VIEW_ALL'] },
    });

    render(<AssociateDetails />);

    expect(screen.queryByRole('button', { name: 'Registrar aporte de capital' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar pago de interés' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar retiro de intereses' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reinvertir intereses' })).not.toBeInTheDocument();
    expect(screen.getByText(/los movimientos financieros se registran desde la mesa operativa/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pagos de intereses' }));

    expect(screen.queryByRole('button', { name: /Registrar pago/i })).not.toBeInTheDocument();
  });

  it('does not present associates as linked to credit participation', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 7, role: 'employee', name: 'Empleado', email: 'employee@test.com', permissions: ['SOCIOS_VIEW_ALL'] },
    });

    useAssociateDetailsSpy.mockReturnValue({
      ...buildDetailsResponse(),
      details: {
        ...buildDetailsResponse().details,
        loans: [
          { id: 4, amount: 360000, totalInterest: 0, status: 'active' },
          { id: 3, amount: 350000, totalInterest: 0, status: 'pending' },
        ],
      },
    });

    render(<AssociateDetails />);

    expect(screen.queryByText(/Créditos participados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ID crédito/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^active$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^pending$/i)).not.toBeInTheDocument();
  });

  it('shows associate interest debt and payment history trace', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    expect(screen.getByText(/Con intereses pendientes/i)).toBeInTheDocument();
    expect(screen.getByText('Capital aportado')).toBeInTheDocument();
    expect(screen.getByText('Interés pagado')).toBeInTheDocument();
    expect(screen.getByText('Interés por pagar')).toBeInTheDocument();
    expect(screen.getByText('Próximo pago')).toBeInTheDocument();
    expect(screen.getByText('Historial de intereses pagados')).toBeInTheDocument();
    expect(screen.getAllByText(/\$\s*125[,.]000/).length).toBeGreaterThan(0);
    expect(screen.getByText('transfer')).toBeInTheDocument();
  });

  it('shows upcoming and overdue associate payment alerts', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    expect(screen.getByText('Alertas de pagos a socio')).toBeInTheDocument();
    expect(screen.getByText('Pago #1 vencido hace 2 días')).toBeInTheDocument();
    expect(screen.getByText('Pago #2 vence en 5 días')).toBeInTheDocument();
  });

  it('keeps associate calendar date filters within a valid range', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    fireEvent.click(screen.getByRole('button', { name: 'Calendario' }));
    fireEvent.change(screen.getByLabelText('Desde calendario'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('Hasta calendario'), { target: { value: '2026-06-30' } });

    expect(screen.getByLabelText('Desde calendario')).toHaveValue('2026-07-01');
    expect(screen.getByLabelText('Hasta calendario')).toHaveValue('');
    expect(useAssociateDetailsSpy).toHaveBeenLastCalledWith(1, {
      startDate: '2026-07-01',
      endDate: '',
    });
  });

  it('allows admins to pay overdue associate interest installments', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });
    useAssociateDetailsSpy.mockReturnValue({
      ...buildDetailsResponse(),
      installments: {
        installments: [
          {
            id: 11,
            installmentNumber: 1,
            amount: 350000,
            dueDate: '2000-05-10T00:00:00.000Z',
            status: 'overdue',
          },
        ],
        totals: {
          totalPending: 0,
          totalPaid: 0,
          totalOverdue: 350000,
        },
      },
    });

    render(<AssociateDetails />);

    fireEvent.click(screen.getByRole('button', { name: 'Pagos de intereses' }));

    expect(screen.getAllByText('Vencido').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
  });

  it('requires the actual associate interest payment details before marking an installment as paid', async () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });
    const detailsResponse = buildDetailsResponse();
    detailsResponse.payInstallment.mutateAsync = vi.fn().mockResolvedValue({});
    useAssociateDetailsSpy.mockReturnValue({
      ...detailsResponse,
      installments: {
        installments: [
          {
            id: 11,
            installmentNumber: 1,
            amount: 350000,
            dueDate: '2000-05-10T00:00:00.000Z',
            status: 'overdue',
          },
        ],
        totals: {
          totalPending: 0,
          totalPaid: 0,
          totalOverdue: 350000,
        },
      },
    });

    render(<AssociateDetails />);

    fireEvent.click(screen.getByRole('button', { name: 'Pagos de intereses' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(screen.getByRole('heading', { name: 'Registrar pago de interés' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Fecha real de pago'), { target: { value: '2026-05-16' } });
    fireEvent.change(screen.getByLabelText('Método de pago'), { target: { value: 'transferencia' } });
    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Pago confirmado por banco' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pago' }));

    await waitFor(() => {
      expect(detailsResponse.payInstallment.mutateAsync).toHaveBeenCalledWith({
        installmentNumber: 1,
        paymentDate: '2026-05-16',
        paymentMethod: 'transferencia',
        notes: 'Pago confirmado por banco',
      });
    });
  });

  it('rejects malformed reinvestment amounts instead of truncating them', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });
    const detailsResponse = buildDetailsResponse();
    useAssociateDetailsSpy.mockReturnValue(detailsResponse);

    render(<AssociateDetails />);

    fireEvent.click(screen.getByRole('button', { name: 'Reinvertir intereses' }));
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '100e2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(detailsResponse.createReinvestment.mutateAsync).not.toHaveBeenCalled();
  });
});
