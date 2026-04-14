import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import Reports from '../Reports';

const mockExportDashboardSummary = vi.fn().mockResolvedValue(undefined);
const mockExportContextualReport = vi.fn().mockResolvedValue(undefined);
const mockToastError = vi.fn();

let currentUser = {
  id: 1,
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin' as 'admin' | 'socio' | 'customer',
  permissions: ['*'],
};

let reportsState = {
  dashboardData: {
    metrics: {
      totalActiveLoans: 1,
      totalDisbursed: 1000,
      totalRecovered: 500,
      arrearsRate: 5,
    },
  },
  monthlyPerformance: [] as Array<Record<string, unknown>>,
  statusBreakdown: [] as Array<Record<string, unknown>>,
  overdueLoans: [] as Array<Record<string, unknown>>,
  profitabilityItems: [] as Array<Record<string, unknown>>,
  isLoading: false,
  isError: false,
  error: null,
};

vi.mock('../../services/reportService', () => ({
  useReports: () => reportsState,
  useFinancialAnalytics: () => ({
    performanceAnalysis: { data: null, isLoading: false },
    forecastAnalysis: { data: null, isLoading: false },
    nextMonthProjection: { data: null, isLoading: false },
  }),
  usePayoutsReport: () => ({ payouts: [], summary: null, pagination: null, isLoading: false }),
  usePaymentSchedule: () => ({ schedule: [], summary: null, loan: null, isLoading: false }),
  exportDashboardSummary: (...args: unknown[]) => mockExportDashboardSummary(...args),
  exportContextualReport: (...args: unknown[]) => mockExportContextualReport(...args),
}));

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({ user: currentUser }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('recharts', () => {
  const Mock = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    BarChart: Mock,
    Bar: Mock,
    LineChart: Mock,
    Line: Mock,
    PieChart: Mock,
    Pie: Mock,
    Cell: Mock,
    XAxis: Mock,
    YAxis: Mock,
    CartesianGrid: Mock,
    Tooltip: Mock,
    Legend: Mock,
    ResponsiveContainer: Mock,
    AreaChart: Mock,
    Area: Mock,
  };
});

const renderReports = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Reports />
    </QueryClientProvider>,
  );
};

describe('Reports behavioral parity scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportsState = {
      dashboardData: {
        metrics: {
          totalActiveLoans: 1,
          totalDisbursed: 1000,
          totalRecovered: 500,
          arrearsRate: 5,
        },
      },
      monthlyPerformance: [],
      statusBreakdown: [],
      overdueLoans: [],
      profitabilityItems: [],
      isLoading: false,
      isError: false,
      error: null,
    };
    currentUser = {
      id: 1,
      name: 'Admin',
      email: 'admin@test.com',
      role: 'admin',
      permissions: ['*'],
    };
  });

  it('exports reports when action is in-scope and keeps canonical labels', async () => {
    renderReports();

    expect(screen.getByRole('heading', { name: 'Reportes y analítica' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reportes y Analíticas' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));

    await waitFor(() => {
      expect(mockExportDashboardSummary).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps out-of-scope action blocked with safe guard feedback', async () => {
    currentUser = {
      id: 2,
      name: 'Customer',
      email: 'customer@test.com',
      role: 'customer',
      permissions: ['*'],
    };

    renderReports();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument();
      expect(mockExportDashboardSummary).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  it('maintains stable hook order when loading resolves', () => {
    reportsState = {
      ...reportsState,
      isLoading: true,
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <Reports />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Cargando reportes...')).toBeInTheDocument();

    reportsState = {
      ...reportsState,
      isLoading: false,
    };

    rerender(
      <QueryClientProvider client={queryClient}>
        <Reports />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Reportes y analítica' })).toBeInTheDocument();
  });

  it('exports contextual report by selected type and date range', async () => {
    renderReports();

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01-31' } });
    fireEvent.change(screen.getByLabelText('Tipo de reporte'), { target: { value: 'payouts' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar pagos' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('payouts', {
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      });
    });
  });

  it('shows clear scope messaging when KPI totals and selected chart range diverge', () => {
    reportsState = {
      ...reportsState,
      dashboardData: {
        metrics: {
          totalActiveLoans: 2,
          totalDisbursed: 15000,
          totalRecovered: 9000,
          arrearsRate: 4,
        },
      },
      monthlyPerformance: Array.from({ length: 14 }, (_, index) => ({
        month: `2025-${String(index + 1).padStart(2, '0')}`,
        disbursed: index === 0 ? 3000 : 0,
        recovered: index === 0 ? 1200 : 0,
      })),
    };

    renderReports();

    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('Alcance KPI: Totales acumulados históricos de la cartera.') === true)).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('Alcance gráfico: El gráfico refleja únicamente el rango seleccionado. Rango actual del gráfico: Últimos 6 meses.') === true)).toBeInTheDocument();
    expect(screen.getByText('No hay actividad en el rango seleccionado, aunque existen totales históricos.')).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'year' } });

    expect(screen.getByText('No hay actividad en el rango seleccionado, aunque existen totales históricos.')).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'historical' } });

    expect(screen.queryByText('No hay actividad en el rango seleccionado, aunque existen totales históricos.')).not.toBeInTheDocument();
  });
});
