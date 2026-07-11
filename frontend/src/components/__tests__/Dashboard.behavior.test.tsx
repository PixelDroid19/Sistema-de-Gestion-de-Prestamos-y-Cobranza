import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard, { buildDashboardMonthlyChartData } from '../Dashboard';

let reportsState = {
  dashboardData: {
    position: { availableCash: 120000, receivables: 950000, capitalPlaced: 800000, associateCapital: 500000, associateLiabilities: 35000 },
    period: { collections: 240000, disbursements: 100000, operatingExpenses: 20000, associatePayments: 30000, netResult: 90000 },
    risk: { delinquentLoans: 1, capitalAtRisk: 180000, overdueAssociateObligations: 2, overdueAssociateAmount: 25000, arrearsRate: 33.33 },
    trend: [
      {
        month: '2026-05',
        disbursed: 100000,
        recovered: 45000,
      },
    ],
  },
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

vi.mock('../../services/reportService', () => ({
  useDashboardReport: () => reportsState,
}));

vi.mock('recharts', () => {
  const Mock = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    AreaChart: Mock,
    Area: ({ name, dataKey }: { name?: string; dataKey?: string }) => (
      <div data-testid="area-series">{`${name ?? ''}|${dataKey ?? ''}`}</div>
    ),
    XAxis: Mock,
    YAxis: Mock,
    CartesianGrid: Mock,
    Tooltip: Mock,
    ResponsiveContainer: Mock,
    BarChart: Mock,
    Bar: ({ name, dataKey }: { name?: string; dataKey?: string }) => (
      <div data-testid="bar-series">{`${name ?? ''}|${dataKey ?? ''}`}</div>
    ),
  };
});

vi.mock('react-grid-layout', () => {
  const Responsive = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Responsive,
    default: Responsive,
    verticalCompactor: {},
  };
});

const renderDashboard = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>,
  );
};

describe('Dashboard behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    reportsState = {
      dashboardData: {
        position: { availableCash: 120000, receivables: 950000, capitalPlaced: 800000, associateCapital: 500000, associateLiabilities: 35000 },
        period: { collections: 240000, disbursements: 100000, operatingExpenses: 20000, associatePayments: 30000, netResult: 90000 },
        risk: { delinquentLoans: 1, capitalAtRisk: 180000, overdueAssociateObligations: 2, overdueAssociateAmount: 25000, arrearsRate: 33.33 },
        trend: [
          {
            month: '2026-05',
            disbursed: 100000,
            recovered: 45000,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it('maps monthly disbursed and recovered keys for dashboard charts', () => {
    const rows = buildDashboardMonthlyChartData([
      { month: '2026-05', disbursed: 250000, recovered: 100000 },
      { month: '2026-06', disbursed: 0, recovered: 40000 },
    ] as any[]);

    expect(rows).toEqual([
      {
        name: 'may de 2026',
        fullLabel: 'mayo de 2026',
        disbursed: 250000,
        recovered: 100000,
      },
      {
        name: 'jun de 2026',
        fullLabel: 'junio de 2026',
        disbursed: 0,
        recovered: 40000,
      },
    ]);
  });

  it('preserves the raw month key when monthly chart data is invalid', () => {
    const rows = buildDashboardMonthlyChartData([
      { month: 'bad-key', disbursed: 180000, recovered: 50000 },
    ] as any[]);

    expect(rows).toEqual([
      {
        name: 'bad-key',
        fullLabel: 'bad-key',
        disbursed: 180000,
        recovered: 50000,
      },
    ]);
  });

  it('keeps every critical financial section visible and uses operational terminology', () => {
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Posición financiera, operación del periodo y riesgos que requieren atención.')).toBeInTheDocument();
    expect(screen.getByText('Posición actual')).toBeInTheDocument();
    expect(screen.getByText('Operación acumulada')).toBeInTheDocument();
    expect(screen.getByText('Riesgo operativo')).toBeInTheDocument();
    expect(screen.getByText('Capital de socios')).toBeInTheDocument();
    expect(screen.getByText('Intereses por pagar a socios')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bloques' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reordenar panel' })).not.toBeInTheDocument();
    const barSeries = screen.getAllByTestId('bar-series').map((node) => node.textContent);
    expect(barSeries).toContain('Recaudo|recovered');
    expect(barSeries).toContain('Desembolsos|disbursed');
  });

  it('shows explicit error state instead of silent zero metrics', () => {
    reportsState = {
      dashboardData: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 500 } },
      refetch: vi.fn(),
    } as any;

    renderDashboard();

    expect(screen.getByRole('heading', { name: 'No se pudo cargar el dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
