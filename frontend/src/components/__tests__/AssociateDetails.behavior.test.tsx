import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssociateDetails from '../AssociateDetails';
import { toast } from '../../lib/toast';

const mockNavigate = vi.fn();
const mockUseSessionStore = vi.fn();
const useAssociateDetailsSpy = vi.fn();
const exportAssociateFinancialSummarySpy = vi.fn();

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
  exportAssociateFinancialSummary: (associateId: number) => exportAssociateFinancialSummarySpy(associateId),
  useAssociateDetails: (associateId: number, calendarFilters?: { startDate?: string; endDate?: string }) => useAssociateDetailsSpy(associateId, calendarFilters),
}));

vi.mock('../../services/configService', () => ({
  useActivePaymentMethods: () => ({
    paymentMethods: [
      { key: 'transfer', label: 'Transferencia', isActive: true },
      { key: 'cash', label: 'Efectivo', isActive: true },
    ],
  }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    apiErrorSafe: vi.fn(),
  },
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
      interestType: 'monthly',
      interestRate: '2.5000',
    },
    summary: {
      totalContributed: 2500000,
      currentCapital: 2350000,
      totalCapitalReturned: 150000,
      totalInterestPaid: 275000,
      interestDebt: 62500,
      nextInterestPaymentDate: '2026-06-15T00:00:00.000Z',
      debtStatus: 'pending',
    },
    contributions: [],
    distributions: [],
    paymentHistory: [
      {
        id: 50,
        displayType: 'Pago programado #1',
        paymentType: 'scheduled',
        installmentNumber: 1,
        amount: 125000,
        dueDate: '2026-05-15T00:00:00.000Z',
        paidAt: '2026-05-16T00:00:00.000Z',
        paymentMethod: 'transfer',
        paidByUser: { id: 1, name: 'Admin QA' },
      },
      {
        id: 51,
        displayType: 'Pago manual de rentabilidad',
        paymentType: 'manual',
        installmentNumber: null,
        amount: 150000,
        dueDate: null,
        paidAt: '2026-05-20T00:00:00.000Z',
        paymentMethod: null,
        paidByUser: { id: 7, name: 'Operador Socios' },
      },
      {
        id: 52,
        displayType: 'Devolución de capital',
        paymentType: 'capital_return',
        installmentNumber: null,
        amount: 500000,
        dueDate: null,
        paidAt: '2026-05-22T00:00:00.000Z',
        paymentMethod: null,
        paidByUser: { id: 9, name: 'Tesorería' },
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
  createCapitalReturn: { mutateAsync: vi.fn() },
  createReinvestment: { mutateAsync: vi.fn() },
  payInstallment: { mutateAsync: vi.fn() },
});

const openAssociateMoreMovementsMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Más movimientos' }));
};

const hasTextContent = (expected: string) => (_content: string, node: Element | null) => (
  node?.textContent?.includes(expected) ?? false
);

const getTableRowFromCellText = (text: string) => {
  const row = screen.getByText(text).closest('tr');
  if (!row) {
    throw new Error(`No table row found for cell text: ${text}`);
  }

  return row;
};

const selectAssociateDetailView = (view: 'overview' | 'installments' | 'calendar') => {
  fireEvent.change(screen.getByLabelText('Ver'), { target: { value: view } });
};

describe('AssociateDetails behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportAssociateFinancialSummarySpy.mockResolvedValue(undefined);
    useAssociateDetailsSpy.mockReturnValue(buildDetailsResponse());
  });

  it('keeps associate detail inside the same associates module navigation', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    expect(screen.getByRole('tab', { name: 'Socios' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: 'Pagos e intereses' }));

    expect(mockNavigate).toHaveBeenCalledWith('/associates/tracking');
  });

  it('shows admin controls only to admin users', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    expect(screen.getByRole('button', { name: 'Volver a socios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar aporte de capital' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver pagos de intereses' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Más movimientos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guía rápida' })).not.toBeInTheDocument();

    openAssociateMoreMovementsMenu();

    expect(screen.getByRole('menuitem', { name: 'Registrar devolución de capital' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Registrar pago manual de rentabilidad' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Reinvertir intereses' })).toBeInTheDocument();
  });

  it('presents associate records as administrative details, not a portal', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    expect(screen.getByText('Detalle del socio')).toBeInTheDocument();
    expect(screen.queryByText(/portal del socio/i)).not.toBeInTheDocument();
  });

  it('does not invent an interest rate label when the associate record lacks the rate configuration', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    const response = buildDetailsResponse();
    useAssociateDetailsSpy.mockReturnValue({
      ...response,
      details: {
        ...response.details,
        associate: {
          ...response.details.associate,
          interestRate: undefined,
          interestType: undefined,
        },
      },
    });

    render(<AssociateDetails />);

    expect(screen.queryByText('0% mensual')).not.toBeInTheDocument();
    expect(screen.getByText(/Rentabilidad No especificado/i)).toBeInTheDocument();
  });

  it('keeps non-admin associate access read-only for operational actions', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 7, role: 'employee', name: 'Empleado', email: 'employee@test.com', permissions: ['SOCIOS_VIEW_ALL'] },
    });

    render(<AssociateDetails />);

    expect(screen.queryByRole('button', { name: 'Registrar aporte de capital' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver pagos de intereses' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Más movimientos' })).not.toBeInTheDocument();
    expect(screen.getByText(/los movimientos financieros se registran desde la mesa operativa/i)).toBeInTheDocument();

    selectAssociateDetailView('installments');

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
    expect(screen.getByText('Capital vigente')).toBeInTheDocument();
    expect(screen.getByText('Aportes')).toBeInTheDocument();
    expect(screen.getByText('Intereses pagados')).toBeInTheDocument();
    expect(screen.getAllByText('Intereses pendientes').length).toBeGreaterThan(0);
    expect(screen.getByText('Capital devuelto')).toBeInTheDocument();
    expect(screen.getByText('Próximo pago')).toBeInTheDocument();
    expect(screen.getAllByText(/COP\s*2\.350\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/COP\s*62\.500/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Historial de pagos al socio')).not.toBeInTheDocument();

    selectAssociateDetailView('installments');
    expect(screen.getByText('Historial de pagos al socio')).toBeInTheDocument();
    expect(screen.getByText('Pago manual de rentabilidad')).toBeInTheDocument();
    expect(screen.getByText('Cuota #1')).toBeInTheDocument();
    expect(screen.getByText('Devolución de capital')).toBeInTheDocument();
    expect(getTableRowFromCellText('Pago manual de rentabilidad')).toHaveTextContent('Operador Socios');
    expect(getTableRowFromCellText('Devolución de capital')).toHaveTextContent('Tesorería');
    expect(screen.getAllByText(/COP\s*125[,.]000/).length).toBeGreaterThan(0);
    expect(getTableRowFromCellText('Cuota #1')).toHaveTextContent('Transferencia');
    expect(screen.queryByText('transfer')).not.toBeInTheDocument();
  });

  it('renders the canonical financial summary contract', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });
    useAssociateDetailsSpy.mockReturnValue(buildDetailsResponse());

    render(<AssociateDetails />);

    expect(screen.getAllByText('Intereses pendientes').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/COP\s*62\.500/).length).toBeGreaterThan(0);
    expect(screen.getByText('Próximo pago')).toBeInTheDocument();
    expect(screen.getByText('15/06/2026')).toBeInTheDocument();
    selectAssociateDetailView('installments');
    expect(screen.getByText('Cuota #1')).toBeInTheDocument();
    expect(getTableRowFromCellText('Cuota #1')).toHaveTextContent('Admin QA');
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  });

  it('renders canonical payment rows and explicit alerts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T00:00:00.000Z'));

    try {
      mockUseSessionStore.mockReturnValue({
        user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
      });

      const detailsResponse = buildDetailsResponse();
      useAssociateDetailsSpy.mockReturnValue({
        ...detailsResponse,
        details: {
          ...detailsResponse.details,
          summary: {
            totalContributed: 2500000,
            currentCapital: 2350000,
            interestDebt: 65000,
            totalInterestPaid: 300000,
            nextInterestPaymentDate: '2026-05-14T00:00:00.000Z',
          },
          paymentHistory: [
            {
              id: 81,
              paymentType: 'manual',
              amount: 150000,
              paidAt: '2026-05-20T00:00:00.000Z',
              paidByUser: { name: 'Tesorería QA' },
            },
          ],
        },
        installments: {
          installments: [
            {
              id: 21,
              installmentNumber: 3,
              amount: 175000,
              dueDate: '2026-05-10T00:00:00.000Z',
              status: 'overdue',
            },
            {
              id: 22,
              installmentNumber: 4,
              amount: 180000,
              dueDate: '2026-05-14T00:00:00.000Z',
              status: 'pending',
            },
          ],
          totals: {
            totalPending: 180000,
            totalPaid: 0,
            totalOverdue: 175000,
          },
          alerts: [
            { type: 'overdue', installmentNumber: 3, amount: 175000, dueDate: '2026-05-10T00:00:00.000Z', daysOverdue: 2 },
            { type: 'upcoming', installmentNumber: 4, amount: 180000, dueDate: '2026-05-14T00:00:00.000Z', daysUntilDue: 2 },
          ],
        },
      });

      render(<AssociateDetails />);

      expect(screen.getByText('Capital vigente')).toBeInTheDocument();
      expect(screen.getAllByText(/COP\s*2\.350\.000/).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Intereses pendientes').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/COP\s*65\.000/).length).toBeGreaterThan(0);
      expect(screen.getByText('Pago #3 vencido hace 2 días')).toBeInTheDocument();
      expect(screen.getByText('Pago #4 vence en 2 días')).toBeInTheDocument();
      expect(screen.queryByText('Pago #N/A vencido hace 0 días')).not.toBeInTheDocument();
      expect(screen.queryByText('COP 0 programado para -')).not.toBeInTheDocument();
      selectAssociateDetailView('installments');
      expect(getTableRowFromCellText('Pago manual de rentabilidad')).toHaveTextContent('Tesorería QA');
      expect(within(getTableRowFromCellText('Pago manual de rentabilidad')).getByText('20/05/2026')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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

  it('uses only alerts returned by the installment contract', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T00:00:00.000Z'));

    try {
      mockUseSessionStore.mockReturnValue({
        user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
      });

      const detailsResponse = buildDetailsResponse();
      useAssociateDetailsSpy.mockReturnValue({
        ...detailsResponse,
        installments: {
          installments: [
            {
              id: 31,
              installmentNumber: 7,
              amount: 150000,
              dueDate: '2026-05-10T00:00:00.000Z',
              status: 'paid',
              paidAt: '2026-05-10T00:00:00.000Z',
            },
            {
              id: 32,
              installmentNumber: 8,
              amount: 175000,
              dueDate: '2026-05-15T00:00:00.000Z',
              status: 'pending',
            },
          ],
          totals: {
            totalPending: 175000,
            totalPaid: 150000,
            totalOverdue: 0,
          },
          alerts: [
            { type: 'upcoming', installmentNumber: 8, amount: 175000, dueDate: '2026-05-15T00:00:00.000Z', daysUntilDue: 3 },
          ],
        },
      });

      render(<AssociateDetails />);

      expect(screen.queryByText('Pago #7 vencido hace 2 días')).not.toBeInTheDocument();
      expect(screen.getByText('Pago #8 vence en 3 días')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps associate calendar date filters within a valid range', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    selectAssociateDetailView('calendar');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-06-30' } });

    expect(screen.getByLabelText('Desde')).toHaveValue('2026-07-01');
    expect(screen.getByLabelText('Hasta')).toHaveValue('');
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

    selectAssociateDetailView('installments');

    expect(screen.getAllByText('Vencido').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
  });

  it('opens the interest installments tab from the detail action toolbar', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver pagos de intereses' }));

    expect(screen.getByLabelText('Ver')).toHaveValue('installments');
    expect(screen.queryByRole('tab', { name: 'Pagos de intereses' })).not.toBeInTheDocument();
    expect(screen.getByText('Pagos de intereses programados')).toBeInTheDocument();
  });

  it('exports the associate financial summary from the detail action toolbar', async () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    fireEvent.click(screen.getByRole('button', { name: 'Exportar resumen' }));

    await waitFor(() => {
      expect(exportAssociateFinancialSummarySpy).toHaveBeenCalledWith(1);
    });
    expect(toast.success).toHaveBeenCalledWith({
      title: 'Resumen financiero del socio exportado correctamente',
    });
  });

  it('renders canonical installment and calendar payloads', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });
    const detailsResponse = buildDetailsResponse();
    useAssociateDetailsSpy.mockReturnValue({
      ...detailsResponse,
      details: {
        ...detailsResponse.details,
        paymentHistory: [
          {
            id: 70,
            paymentType: 'manual',
            amount: 200000,
            paidAt: '2026-06-05T00:00:00.000Z',
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
        totals: { totalPending: 350000, totalPaid: 0, totalOverdue: 0 },
        alerts: [],
      },
      calendar: {
        events: [
        {
          id: 'contribution-1',
          type: 'contribution',
          amount: 2500000,
          date: '2026-05-01T00:00:00.000Z',
          status: 'completed',
          },
        {
          id: 'interest-1',
          type: 'installment',
          amount: 350000,
          date: '2026-05-10T00:00:00.000Z',
          status: 'pending',
          },
        ],
        summary: { contributionCount: 1, distributionCount: 0, installmentCount: 1, pendingInstallments: 1 },
      },
    });

    render(<AssociateDetails />);

    selectAssociateDetailView('installments');
    expect(screen.getByText('Pago manual de rentabilidad')).toBeInTheDocument();
    expect(screen.getAllByText(/COP\s*350[,.]000/).length).toBeGreaterThan(0);
    selectAssociateDetailView('calendar');
    expect(screen.getByTestId('associate-detail-calendar')).toBeInTheDocument();
    expect(screen.getAllByText('Aporte').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pago de interés').length).toBeGreaterThan(0);
    expect(screen.queryByText('No disponible')).not.toBeInTheDocument();
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

    selectAssociateDetailView('installments');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));

    expect(screen.getByRole('heading', { name: 'Registrar pago de interés' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Notas')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Método de pago').tagName).toBe('SELECT');
    fireEvent.change(screen.getByLabelText('Fecha real de pago'), { target: { value: '2026-05-16' } });
    fireEvent.change(screen.getByLabelText('Método de pago'), { target: { value: 'transfer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pago' }));

    await waitFor(() => {
      expect(detailsResponse.payInstallment.mutateAsync).toHaveBeenCalledWith({
        installmentNumber: 1,
        paymentDate: '2026-05-16',
        paymentMethod: 'transfer',
      });
    });
  });

  it('shows the recorded associate interest payment method in history even when it is not a catalog value', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });
    const detailsResponse = buildDetailsResponse();
    detailsResponse.details.paymentHistory = [
      {
        id: 53,
        displayType: 'Pago programado #1',
        paymentType: 'scheduled',
        installmentNumber: 1,
        amount: 125000,
        dueDate: '2026-05-15T00:00:00.000Z',
        paidAt: '2026-05-16T00:00:00.000Z',
        paymentMethod: 'transferencia QA',
        paidByUser: { id: 1, name: 'Admin QA' },
      },
    ];
    useAssociateDetailsSpy.mockReturnValue(detailsResponse);

    render(<AssociateDetails />);

    selectAssociateDetailView('installments');
    expect(screen.getByText(/transferencia QA · Admin QA/i)).toBeInTheDocument();
    expect(screen.queryByText('Método no clasificado')).not.toBeInTheDocument();
  });

  it('rejects malformed reinvestment amounts instead of truncating them', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });
    const detailsResponse = buildDetailsResponse();
    useAssociateDetailsSpy.mockReturnValue(detailsResponse);

    render(<AssociateDetails />);

    openAssociateMoreMovementsMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reinvertir intereses' }));
    fireEvent.change(screen.getByLabelText('Monto', { selector: '#associate-action-reinvestment-amount' }), { target: { value: '100e2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(detailsResponse.createReinvestment.mutateAsync).not.toHaveBeenCalled();
  });

  it('opens the capital contribution modal in create mode from the associate toolbar', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar aporte de capital' }));

    expect(screen.getByRole('dialog', { name: 'Registrar aporte de capital' })).toBeInTheDocument();
  });

  it('closes associate money action modals with Escape', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });

    render(<AssociateDetails />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar aporte de capital' }));
    const dialog = screen.getByRole('dialog', { name: 'Registrar aporte de capital' });

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Registrar aporte de capital' })).not.toBeInTheDocument();
  });

  it('shows a Spanish inline validation error when the interest payment date is empty', async () => {
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

    selectAssociateDetailView('installments');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    fireEvent.change(screen.getByLabelText('Fecha real de pago'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pago' }));

    expect(await screen.findByText('La fecha real de pago es obligatoria.')).toBeInTheDocument();
    expect(detailsResponse.payInstallment.mutateAsync).not.toHaveBeenCalled();
  });

  it('closes associate installment payment modal with Escape', () => {
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

    selectAssociateDetailView('installments');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    const dialog = screen.getByRole('dialog', { name: 'Registrar pago de interés' });

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Registrar pago de interés' })).not.toBeInTheDocument();
  });

  it('keeps separate normalized amounts for each associate money action', () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });
    const detailsResponse = buildDetailsResponse();
    useAssociateDetailsSpy.mockReturnValue(detailsResponse);

    const { container } = render(<AssociateDetails />);

    openAssociateMoreMovementsMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Registrar pago manual de rentabilidad' }));
    fireEvent.change(container.querySelector('#associate-action-distribution-amount') as HTMLInputElement, {
      target: { value: '1200000' },
    });

    expect(container.querySelector('#associate-action-distribution-amount')).toHaveValue('1.200.000');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    openAssociateMoreMovementsMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reinvertir intereses' }));

    expect(container.querySelector('#associate-action-reinvestment-amount')).toHaveValue('');
  });

  it('records capital returns through a dedicated associate action', async () => {
    mockUseSessionStore.mockReturnValue({
      user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', permissions: ['*'] },
    });
    const detailsResponse = buildDetailsResponse();
    detailsResponse.createCapitalReturn.mutateAsync = vi.fn().mockResolvedValue({});
    useAssociateDetailsSpy.mockReturnValue(detailsResponse);

    const { container } = render(<AssociateDetails />);

    openAssociateMoreMovementsMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Registrar devolución de capital' }));
    fireEvent.change(container.querySelector('#associate-action-capitalReturn-amount') as HTMLInputElement, {
      target: { value: '500000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
        expect(detailsResponse.createCapitalReturn.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 500000, capitalReturnDate: expect.any(String), notes: undefined }),
      );
    });
  });
});
