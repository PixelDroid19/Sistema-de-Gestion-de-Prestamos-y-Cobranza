import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard, { buildDashboardChartData } from '../Dashboard';

let reportsState = {
  dashboardData: {
    summary: {
      totalOutstandingAmount: 950000,
      totalLoans: 3,
      activeLoans: 2,
      defaultedLoans: 1,
      totalRecoveredAmount: 240000,
    },
    collections: {
      overdueAlerts: 4,
      pendingPromises: 2,
    },
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
    WidthProvider: (component: unknown) => component,
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
          defaultedLoans: 1,
          totalRecoveredAmount: 240000,
        },
        collections: {
          overdueAlerts: 4,
          pendingPromises: 2,
        },
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

  it('maps disbursed and recovered keys for dashboard charts', () => {
    const rows = buildDashboardChartData([
      { id: 1, amount: 250000, totalPaid: 100000, customerName: 'seed Carlos' },
    ] as any[]);

    expect(rows).toEqual([
      {
        name: 'Carlos',
        disbursed: 250000,
        recovered: 100000,
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
    expect(screen.getByText('Préstamos activos')).toBeInTheDocument();
    expect(screen.getByText('Recuperado vs desembolsado')).toBeInTheDocument();

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
