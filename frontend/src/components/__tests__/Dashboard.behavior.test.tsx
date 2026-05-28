import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard, { buildDashboardMonthlyChartData } from '../Dashboard';

let reportsState = {
  dashboardData: {
    summary: {
      totalOutstandingAmount: 950000,
      totalLoans: 3,
      activeLoans: 2,
      delinquentLoans: 1,
      defaultedLoans: 0,
      totalRecoveredAmount: 240000,
    },
    collections: {
      overdueAlerts: 4,
      pendingPromises: 2,
    },
    monthlyPerformance: [
      {
        month: '2026-05',
        disbursed: 100000,
        recovered: 45000,
      },
    ],
    recentActivity: {
      loans: [
        {
          id: 11,
          amount: 100000,
          totalPaid: 45000,
          customerName: 'QA Diana',
        },
      ],
    },
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
    reportsState = {
      dashboardData: {
        summary: {
          totalOutstandingAmount: 950000,
          totalLoans: 3,
          activeLoans: 2,
          delinquentLoans: 1,
          defaultedLoans: 0,
          totalRecoveredAmount: 240000,
        },
        collections: {
          overdueAlerts: 4,
          pendingPromises: 2,
        },
        monthlyPerformance: [
          {
            month: '2026-05',
            disbursed: 100000,
            recovered: 45000,
          },
        ],
        recentActivity: {
          loans: [
            {
              id: 11,
              amount: 100000,
              totalPaid: 45000,
              customerName: 'QA Diana',
            },
          ],
        },
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

  it('uses terminology labels in dashboard widgets and chart legends', () => {
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Resumen operativo de la cartera.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bloques' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reordenar panel' })).toBeInTheDocument();
    expect(screen.getByText('Balance total')).toBeInTheDocument();
    expect(screen.getByText('Créditos activos')).toBeInTheDocument();
    expect(screen.getAllByText('Recuperado vs desembolsado')).toHaveLength(2);
    expect(screen.getByText('Desembolsado y recuperado por mes')).toBeInTheDocument();
    expect(screen.getByLabelText('Resume por mes cuánto capital salió en desembolsos y cuánto dinero volvió por pagos registrados.')).toBeInTheDocument();
    expect(screen.getByText('1 en mora')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();

    const areaSeries = screen.getAllByTestId('area-series').map((node) => node.textContent);
    const barSeries = screen.getAllByTestId('bar-series').map((node) => node.textContent);

    expect(areaSeries).toContain('Desembolsado|disbursed');
    expect(barSeries).toContain('Recuperado|recovered');
    expect(barSeries).toContain('Desembolsado|disbursed');
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
