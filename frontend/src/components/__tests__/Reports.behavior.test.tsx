import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import Reports from '../Reports';

const mockExportDashboardSummary = vi.fn().mockResolvedValue(undefined);
const mockExportContextualReport = vi.fn().mockResolvedValue(undefined);
const mockExportMonthlyCashFlowExcel = vi.fn().mockResolvedValue(undefined);
const mockExportMonthlyCashFlowPdf = vi.fn().mockResolvedValue(undefined);
const mockToastError = vi.fn();
const mockUseFinancialAnalytics = vi.fn();
const mockUseMonthlyCashFlow = vi.fn();
const mockUsePaymentSchedule = vi.fn(() => ({
  schedule: [] as any[],
  summary: null as any,
  loan: null as any,
  isLoading: false,
}));

let currentUser = {
  id: 1,
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin' as 'admin' | 'employee' | 'socio' | 'customer',
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

let payoutsReportState = {
  payouts: [] as Array<Record<string, unknown>>,
  summary: null as any,
  pagination: null as any,
  isLoading: false,
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
  useFinancialAnalytics: (...args: unknown[]) => {
    mockUseFinancialAnalytics(...args);
    return {
      performanceAnalysis: { data: null, isLoading: false },
      forecastAnalysis: { data: null, isLoading: false },
      nextMonthProjection: { data: null, isLoading: false },
    };
  },
  useMonthlyCashFlow: (...args: unknown[]) => {
    mockUseMonthlyCashFlow(...args);
    return {
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
    };
  },
  usePayoutsReport: () => payoutsReportState,
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
    payoutsReportState = {
      payouts: [],
      summary: null,
      pagination: null,
      isLoading: false,
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
      schedule: [] as any[],
      summary: null as any,
      loan: null as any,
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

  it('keeps cash flow year unchanged when exponent notation is typed', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('button', { name: 'Flujo de caja' }));
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2e3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));

    await waitFor(() => {
      expect(mockExportMonthlyCashFlowExcel).toHaveBeenCalledWith(2026);
    });
    expect(mockUseMonthlyCashFlow).not.toHaveBeenCalledWith(2000);
  });

  it('keeps profitability analytics year unchanged when exponent notation is typed', async () => {
    renderReports();
    fireEvent.click(screen.getByRole('button', { name: 'Rentabilidad de clientes' }));
    await screen.findByRole('heading', { name: 'Rentabilidad por cliente' });
    fireEvent.change(screen.getByLabelText('Año analítico'), { target: { value: '2e3' } });

    expect(mockUseFinancialAnalytics).not.toHaveBeenCalledWith(2000);
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

  it('hides the payment calendar tab from report-only employees without credit view permission', () => {
    currentUser = {
      id: 5,
      name: 'Empleado reportes',
      email: 'employee.reports@test.com',
      role: 'employee',
      permissions: ['REPORTS_VIEW_ALL'],
    };

    renderReports();

    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Calendario de pagos' })).not.toBeInTheDocument();
  });

  it('renders report loan statuses with operational labels instead of raw enum keys', async () => {
    reportsState = {
      ...reportsState,
      statusBreakdown: [{ status: 'defaulted', count: 2 }],
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
      summary: {
        totalPrincipal: 1200000,
        totalInterest: 120000,
        totalPayment: 1320000,
        paidInstallments: 0,
        totalInstallments: 12,
      },
      loan: {
        id: 3,
        amount: 1200000,
        termMonths: 12,
        interestRate: 36,
        status: 'active',
      },
      isLoading: false,
    }));

    renderReports();

    expect(screen.getAllByText('En mora').length).toBeGreaterThan(0);
    expect(screen.queryByText('defaulted')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Calendario de pagos' }));

    expect(screen.getByRole('option', { name: /Cliente Operativo · #3 · .* · Activo/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /ACTIVE/ })).not.toBeInTheDocument();
    expect((await screen.findAllByText('Activo')).length).toBeGreaterThan(0);
    expect(screen.queryByText('active')).not.toBeInTheDocument();
  });

  it('renders payment calendar installment statuses with operational labels', () => {
    mockUsePaymentSchedule.mockImplementation(() => ({
      schedule: [
        {
          installmentNumber: 1,
          dueDate: '2026-01-10',
          openingBalance: 1200000,
          scheduledPayment: 110000,
          principalComponent: 90000,
          interestComponent: 20000,
          remainingBalance: 1110000,
          status: 'overdue',
        },
        {
          installmentNumber: 2,
          dueDate: '2026-02-10',
          openingBalance: 1110000,
          scheduledPayment: 110000,
          principalComponent: 92000,
          interestComponent: 18000,
          remainingBalance: 1018000,
          status: 'partial',
        },
        {
          installmentNumber: 3,
          dueDate: '2026-03-10',
          openingBalance: 1018000,
          scheduledPayment: 110000,
          principalComponent: 94000,
          interestComponent: 16000,
          remainingBalance: 924000,
          status: 'annulled',
        },
      ],
      summary: {
        totalPrincipal: 1200000,
        totalInterest: 120000,
        totalPayment: 1320000,
        paidInstallments: 0,
        totalInstallments: 12,
      },
      loan: {
        id: 3,
        amount: 1200000,
        termMonths: 12,
        interestRate: 36,
        status: 'active',
      },
      isLoading: false,
    }));

    renderReports();
    fireEvent.click(screen.getByRole('button', { name: 'Calendario de pagos' }));

    expect(screen.getByRole('cell', { name: 'Vencido' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Parcial' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Anulado' })).toBeInTheDocument();
    expect(screen.queryAllByRole('cell', { name: 'Pendiente' })).toHaveLength(0);
  });

  it('renders payout report columns with operational labels instead of raw id field names', () => {
    payoutsReportState = {
      payouts: [{
        id: 9,
        loanId: 3,
        paymentDate: '2026-05-10',
        amount: 250000,
        principalApplied: 200000,
        interestApplied: 50000,
        penaltyApplied: 0,
        paymentType: 'installment',
        paymentMethod: 'cash',
      }],
      summary: null,
      pagination: {
        totalPages: 2,
        totalItems: 30,
      },
      isLoading: false,
    };

    renderReports();

    fireEvent.click(screen.getByRole('button', { name: 'Pagos y desembolsos' }));

    expect(screen.getByRole('columnheader', { name: 'Pago' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Crédito' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /ID pago/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Crédito ID/i })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '#9' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '#3' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Efectivo' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'cash' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
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
