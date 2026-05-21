import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import Reports from '../Reports';

const mockExportDashboardSummary = vi.fn().mockResolvedValue(undefined);
const mockExportContextualReport = vi.fn().mockResolvedValue(undefined);
const mockExportMonthlyCashFlowExcel = vi.fn().mockResolvedValue(undefined);
const mockExportMonthlyCashFlowPdf = vi.fn().mockResolvedValue(undefined);
const mockToastError = vi.fn();
const mockUsePaymentSchedule = vi.fn(() => ({ schedule: [], summary: null, loan: null, isLoading: false }));

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
      totalInterestGenerated: 240,
      totalInterestPaid: 80,
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

let loansState = {
  data: {
    data: {
      loans: [
        {
          id: 3,
          customerName: 'Cliente Operativo',
          amount: 1200000,
          status: 'active',
        },
      ],
    },
  },
  isLoading: false,
};

vi.mock('../../services/reportService', () => ({
  useReports: () => reportsState,
  useFinancialAnalytics: () => ({
    performanceAnalysis: { data: null, isLoading: false },
    forecastAnalysis: { data: null, isLoading: false },
    nextMonthProjection: { data: null, isLoading: false },
  }),
  useMonthlyCashFlow: () => ({
    data: {
      year: 2026,
      summary: {
        totalInflows: '50000000.00',
        totalOutflows: '40000000.00',
        availableCash: '10000000.00',
        totalCollectedProfit: '5000000.00',
        lossesAtRisk: '0.00',
        netProfitIndicator: '5000000.00',
        paymentCount: 3,
      },
      months: [
        {
          month: '2026-01',
          inflows: '50000000.00',
          outflows: '40000000.00',
          netCashFlow: '10000000.00',
          availableCash: '10000000.00',
          collectedProfit: '5000000.00',
          lossesAtRisk: '0.00',
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  usePayoutsReport: () => ({ payouts: [], summary: null, pagination: null, isLoading: false }),
  usePaymentSchedule: (...args: unknown[]) => (mockUsePaymentSchedule as any)(...args),
  exportDashboardSummary: (...args: unknown[]) => mockExportDashboardSummary(...args),
  exportContextualReport: (...args: unknown[]) => mockExportContextualReport(...args),
  exportMonthlyCashFlowExcel: (...args: unknown[]) => mockExportMonthlyCashFlowExcel(...args),
  exportMonthlyCashFlowPdf: (...args: unknown[]) => mockExportMonthlyCashFlowPdf(...args),
}));

vi.mock('../../services/loanService', () => ({
  useLoans: () => loansState,
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
          totalInterestGenerated: 240,
          totalInterestPaid: 80,
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
    loansState = {
      data: {
        data: {
          loans: [
            {
              id: 3,
              customerName: 'Cliente Operativo',
              amount: 1200000,
              status: 'active',
            },
          ],
        },
      },
      isLoading: false,
    };
    mockUsePaymentSchedule.mockImplementation(() => ({
      schedule: [],
      summary: null,
      loan: null,
      isLoading: false,
    }));
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
    expect(screen.getByText('Interés generado')).toBeInTheDocument();
    expect(screen.getByText('Interés pagado')).toBeInTheDocument();

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

    expect(screen.getByText('Cargando reportes…')).toBeInTheDocument();

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
        status: undefined,
        format: undefined,
      });
    });
  });

  it('exports credits report with status filter and selected format', async () => {
    mockExportContextualReport.mockClear();
    renderReports();

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-02-28' } });
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'active' } });
    fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar historial' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('credits', {
        fromDate: '2026-02-01',
        toDate: '2026-02-28',
        status: 'active',
        format: 'pdf',
      });
    });
  });

  it('exports the customer profitability Excel when profitability tab is active', async () => {
    reportsState = {
      ...reportsState,
      profitabilityItems: [{
        customerId: 7,
        customerName: 'pepito perez',
        totalLoans: 2,
        interestCollected: 60000,
        lateFeesCollected: 0,
        totalProfit: 60000,
      }],
    };
    mockExportContextualReport.mockClear();
    renderReports();

    fireEvent.click(screen.getByRole('button', { name: 'Rentabilidad de clientes' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-05-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar rentabilidad' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('profitability', {
        fromDate: '2026-05-01',
        toDate: '2026-05-20',
        status: undefined,
        format: undefined,
      });
    });
  });

  it('shows monthly cash flow control and exports Excel/PDF', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('button', { name: 'Flujo de caja' }));

    expect(screen.getByRole('heading', { name: 'Control financiero mensual' })).toBeInTheDocument();
    expect(screen.getAllByText('Entradas por cuotas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Salidas por préstamos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Caja disponible').length).toBeGreaterThan(0);
    expect(screen.getByText('2026-01')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => {
      expect(mockExportMonthlyCashFlowExcel).toHaveBeenCalledWith(2026);
    });

    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    await waitFor(() => {
      expect(mockExportMonthlyCashFlowPdf).toHaveBeenCalledWith(2026);
    });
  });

  it('selects a loan for the payment calendar without requiring a manual loan ID', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('button', { name: 'Calendario de pagos' }));

    expect(screen.queryByPlaceholderText('Ingrese ID del crédito')).not.toBeInTheDocument();
    const loanSelect = screen.getByLabelText('Crédito');
    expect(loanSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Cliente Operativo · #3/ })).toBeInTheDocument();

    fireEvent.change(loanSelect, { target: { value: '3' } });

    await waitFor(() => {
      expect(mockUsePaymentSchedule).toHaveBeenLastCalledWith(3);
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
          totalInterestGenerated: 3200,
          totalInterestPaid: 1800,
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

    fireEvent.change(screen.getByLabelText('Rango de gráfica'), { target: { value: 'year' } });

    expect(screen.getByText('No hay actividad en el rango seleccionado, aunque existen totales históricos.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rango de gráfica'), { target: { value: 'historical' } });

    expect(screen.queryByText('No hay actividad en el rango seleccionado, aunque existen totales históricos.')).not.toBeInTheDocument();
  });
});
