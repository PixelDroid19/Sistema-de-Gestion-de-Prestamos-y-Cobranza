import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import Reports from '../Reports';

const mockExportDashboardSummary = vi.fn().mockResolvedValue(undefined);
const mockExportContextualReport = vi.fn().mockResolvedValue(undefined);
const mockExportMonthlyCashFlowExcel = vi.fn().mockResolvedValue(undefined);
const mockExportMonthlyCashFlowPdf = vi.fn().mockResolvedValue(undefined);
const mockExportOperatingExpensesReport = vi.fn().mockResolvedValue(undefined);
const mockCreateOperatingExpense = vi.fn().mockResolvedValue({});
const mockAnnulOperatingExpense = vi.fn().mockResolvedValue({});
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockUseFinancialAnalytics = vi.fn();
const mockUseMonthlyCashFlow = vi.fn();
const mockUseDailyCashFlow = vi.fn();
const mockUseCreditHistoryMonthly = vi.fn();
const mockUseCustomerProfitability = vi.fn();
const mockUsePayoutsReport = vi.fn();
const mockUseOperatingExpenses = vi.fn();
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

let financialAnalyticsState = {
  performanceAnalysis: { data: null as any, isLoading: false },
  forecastAnalysis: { data: null as any, isLoading: false },
  nextMonthProjection: { data: null as any, isLoading: false },
};

let payoutsReportState = {
  payouts: [] as Array<Record<string, unknown>>,
  summary: null as any,
  pagination: null as any,
  isLoading: false,
};

let operatingExpensesState = {
  expenses: [] as Array<Record<string, unknown>>,
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
        {
          id: 15,
          customerName: 'Cliente Historial',
          amount: 4000000,
          status: 'active',
        },
        {
          id: 18,
          customerName: 'Cliente Exportación',
          amount: 2500000,
          status: 'active',
        },
      ],
    },
  },
  isLoading: false,
};

let customersState = {
  data: {
    data: {
      customers: [
        {
          id: 7,
          name: 'Cliente Exportación',
          documentNumber: 'CC-7',
          status: 'active',
        },
        {
          id: 9,
          name: 'Cliente Historial',
          documentNumber: 'CC-9',
          status: 'active',
        },
      ],
    },
  },
  isLoading: false,
  isError: false,
};

vi.mock('../../services/reportService', () => ({
  useReports: () => reportsState,
  useFinancialAnalytics: (...args: unknown[]) => {
    mockUseFinancialAnalytics(...args);
    return financialAnalyticsState;
  },
  useMonthlyCashFlow: (...args: unknown[]) => {
    mockUseMonthlyCashFlow(...args);
    return {
      data: {
        year: 2026,
        summary: {
          totalInflows: '50000000.00',
          totalOutflows: '40000000.00',
          totalAssociateInterestPaid: '3000000.00',
          totalAssociateInterestPending: '1200000.00',
          totalOperatingExpenses: '2000000.00',
          availableCash: '5000000.00',
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
            associateInterestPaid: '3000000.00',
            associateInterestPending: '1200000.00',
            operatingExpenses: '2000000.00',
            netCashFlow: '5000000.00',
            availableCash: '5000000.00',
            collectedProfit: '5000000.00',
            lossesAtRisk: '0.00',
          },
        ],
      },
      isLoading: false,
      isError: false,
    };
  },
  useDailyCashFlow: (...args: unknown[]) => {
    mockUseDailyCashFlow(...args);
    return {
      data: {
        summary: {
          totalInflows: '1500000.00',
          totalOutflows: '500000.00',
          totalAssociateInterestPaid: '200000.00',
          totalAssociateInterestPending: '50000.00',
          totalOperatingExpenses: '100000.00',
          availableCash: '700000.00',
          totalCollectedProfit: '300000.00',
          lossesAtRisk: '0.00',
          netProfitIndicator: '300000.00',
          paymentCount: 2,
        },
        days: [
          {
            date: '2026-03-15',
            inflows: '1500000.00',
            outflows: '500000.00',
            associateInterestPaid: '200000.00',
            associateInterestPending: '50000.00',
            operatingExpenses: '100000.00',
            netCashFlow: '700000.00',
            availableCash: '700000.00',
            collectedProfit: '300000.00',
            lossesAtRisk: '0.00',
          },
        ],
      },
      isLoading: false,
      isError: false,
    };
  },
  useCreditHistoryMonthly: (...args: unknown[]) => {
    mockUseCreditHistoryMonthly(...args);
    return {
      data: {
        summary: {
          creditsCreated: 2,
          installmentsReceived: 4,
          totalPrincipalCreated: '4000000.00',
          totalPaymentsReceived: '2500000.00',
          totalInterestCollected: '350000.00',
          totalAssociateInterestPaid: '300000.00',
          totalOperatingExpenses: '125000.00',
          lossesAtRisk: '0.00',
          gains: '350000.00',
          availableCash: '-1925000.00',
        },
        months: [
          {
            month: '2026-04',
            creditsCreated: 2,
            createdPrincipal: '4000000.00',
            installmentsReceived: 4,
            paymentsReceived: '2500000.00',
            associateInterestPaid: '300000.00',
            operatingExpenses: '125000.00',
            gains: '350000.00',
            lossesAtRisk: '0.00',
            availableCash: '-1925000.00',
          },
        ],
      },
      isLoading: false,
      isError: false,
    };
  },
  useCustomerProfitability: (...args: unknown[]) => {
    mockUseCustomerProfitability(...args);
    return {
      items: reportsState.profitabilityItems,
      isLoading: false,
      isError: false,
      error: null,
    };
  },
  usePayoutsReport: (...args: unknown[]) => {
    mockUsePayoutsReport(...args);
    return payoutsReportState;
  },
  useOperatingExpenses: (...args: unknown[]) => {
    mockUseOperatingExpenses(...args);
    return operatingExpensesState;
  },
  usePaymentSchedule: (...args: unknown[]) => (mockUsePaymentSchedule as any)(...args),
  createOperatingExpense: (...args: unknown[]) => mockCreateOperatingExpense(...args),
  annulOperatingExpense: (...args: unknown[]) => mockAnnulOperatingExpense(...args),
  exportDashboardSummary: (...args: unknown[]) => mockExportDashboardSummary(...args),
  exportContextualReport: (...args: unknown[]) => mockExportContextualReport(...args),
  exportMonthlyCashFlowExcel: (...args: unknown[]) => mockExportMonthlyCashFlowExcel(...args),
  exportMonthlyCashFlowPdf: (...args: unknown[]) => mockExportMonthlyCashFlowPdf(...args),
  exportOperatingExpensesReport: (...args: unknown[]) => mockExportOperatingExpensesReport(...args),
}));

vi.mock('../../services/loanService', () => ({
  useLoans: () => loansState,
}));

vi.mock('../../services/customerService', () => ({
  useCustomers: () => customersState,
}));

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({ user: currentUser }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('recharts', () => {
  const Mock = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const chartMock = (testId: string) => (
    { children, accessibilityLayer }: { children?: ReactNode; accessibilityLayer?: boolean }
  ) => (
    <div data-testid={testId} data-accessibility-layer={String(accessibilityLayer)}>
      {children}
    </div>
  );
  return {
    BarChart: Mock,
    Bar: Mock,
    LineChart: chartMock('recharts-line-chart'),
    Line: Mock,
    PieChart: chartMock('recharts-pie-chart'),
    Pie: ({ children, rootTabIndex }: { children?: ReactNode; rootTabIndex?: number }) => (
      <div data-testid="recharts-pie" data-root-tab-index={String(rootTabIndex)}>
        {children}
      </div>
    ),
    Cell: Mock,
    XAxis: Mock,
    YAxis: Mock,
    CartesianGrid: Mock,
    Tooltip: Mock,
    Legend: Mock,
    ResponsiveContainer: Mock,
    AreaChart: chartMock('recharts-area-chart'),
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

const selectCustomerOption = (value: string) => {
  fireEvent.change(screen.getByRole('combobox', { name: 'Clientes para filtrar' }), {
    target: { value },
  });
};

const selectCreditOption = (value: string) => {
  fireEvent.change(screen.getByRole('combobox', { name: 'Créditos para filtrar' }), {
    target: { value },
  });
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
    financialAnalyticsState = {
      performanceAnalysis: { data: null, isLoading: false },
      forecastAnalysis: { data: null, isLoading: false },
      nextMonthProjection: { data: null, isLoading: false },
    };
    payoutsReportState = {
      payouts: [],
      summary: null,
      pagination: null,
      isLoading: false,
    };
    operatingExpensesState = {
      expenses: [],
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
            {
              id: 15,
              customerName: 'Cliente Historial',
              amount: 4000000,
              status: 'active',
            },
            {
              id: 18,
              customerName: 'Cliente Exportación',
              amount: 2500000,
              status: 'active',
            },
          ],
        },
      },
      isLoading: false,
    };
    customersState = {
      data: {
        data: {
          customers: [
            {
              id: 7,
              name: 'Cliente Exportación',
              documentNumber: 'CC-7',
              status: 'active',
            },
            {
              id: 9,
              name: 'Cliente Historial',
              documentNumber: 'CC-9',
              status: 'active',
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
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

    fireEvent.click(screen.getByRole('button', { name: 'Resumen general' }));

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
      expect(screen.queryByRole('button', { name: 'Resumen general' })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'Exportar datos' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01-31' } });
    fireEvent.change(screen.getByLabelText('Tipo de reporte'), { target: { value: 'payouts' } });
    fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'pdf' } });
    selectCustomerOption('7');
    selectCreditOption('15');
    fireEvent.change(screen.getByLabelText('Tipo de movimiento'), { target: { value: 'capital' } });
    fireEvent.change(screen.getByLabelText('Estado de pago'), { target: { value: 'annulled' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar pagos' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('payouts', {
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        status: 'annulled',
        format: 'pdf',
        paymentType: 'capital',
        customerId: 7,
        loanId: 15,
      });
    });
  });

  it('exports credits report with status filter and selected format', async () => {
    mockExportContextualReport.mockClear();
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Historial mensual' }));
    fireEvent.change(screen.getByLabelText('Desde historial'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('Hasta historial'), { target: { value: '2026-02-28' } });
    fireEvent.change(screen.getByLabelText('Estado del crédito'), { target: { value: 'active' } });
    fireEvent.click(screen.getByRole('button', { name: 'Más filtros' }));
    selectCustomerOption('9');
    selectCreditOption('18');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar historial' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('credits', {
        fromDate: '2026-02-01',
        toDate: '2026-02-28',
        status: 'active',
        format: 'pdf',
        customerId: 9,
        loanId: 18,
      });
    });
  });

  it('keeps contextual export date range unchanged when the operator enters an inverted range', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Historial mensual' }));
    const fromInput = screen.getByLabelText('Desde historial');
    const toInput = screen.getByLabelText('Hasta historial');

    fireEvent.change(fromInput, { target: { value: '2026-06-01' } });
    fireEvent.change(toInput, { target: { value: '2026-06-30' } });

    fireEvent.change(toInput, { target: { value: '2026-05-31' } });

    expect(toInput).toHaveDisplayValue('2026-06-30');

    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar historial' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('credits', expect.objectContaining({
        fromDate: '2026-06-01',
        toDate: '2026-06-30',
      }));
    });
    expect(mockExportContextualReport).not.toHaveBeenCalledWith('credits', expect.objectContaining({
      fromDate: '2026-06-01',
      toDate: '2026-05-31',
    }));
  });

  it('clears contextual customer and credit selection when the operator clears the selectors', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar datos' }));

    const customerSelect = document.getElementById('report-customer')!;
    const creditSelect = document.getElementById('report-loan')!;

    selectCustomerOption('7');
    selectCreditOption('18');
    fireEvent.change(customerSelect, { target: { value: '' } });
    fireEvent.change(creditSelect, { target: { value: '' } });

    expect(customerSelect).toHaveValue('');
    expect(creditSelect).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Exportar historial' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalled();
    });
    const [, payload] = mockExportContextualReport.mock.calls.at(-1) || [];
    expect(payload).not.toHaveProperty('customerId');
    expect(payload).not.toHaveProperty('loanId');
  });

  it('exports associates report with selected PDF format', async () => {
    mockExportContextualReport.mockClear();
    renderReports();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar datos' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-04-30' } });
    fireEvent.change(screen.getByLabelText('Tipo de reporte'), { target: { value: 'associates' } });
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'inactive' } });
    fireEvent.change(screen.getByLabelText('Socio'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar socios' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('associates', {
        fromDate: '2026-04-01',
        toDate: '2026-04-30',
        status: 'inactive',
        format: 'pdf',
        paymentType: undefined,
        associateId: 8,
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

    fireEvent.click(screen.getByRole('tab', { name: 'Rentabilidad de clientes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
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

    fireEvent.click(screen.getByRole('tab', { name: 'Flujo de caja' }));
    fireEvent.change(screen.getByLabelText('Desde flujo de caja'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Hasta flujo de caja'), { target: { value: '2026-03-31' } });
    fireEvent.change(screen.getByLabelText('Fecha de resumen diario'), { target: { value: '2026-03-15' } });

    expect(screen.getByRole('heading', { name: 'Control financiero mensual' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resumen diario de caja' })).toBeInTheDocument();
    expect(screen.getAllByText('Entradas por cuotas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Salidas por préstamos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pagado a socios').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pendiente a socios').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gastos operativos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Caja disponible').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3[.,]000[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1[.,]200[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2[.,]000[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/700[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getByText('2026-01')).toBeInTheDocument();
    expect(screen.getByText('2026-03-15')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockUseMonthlyCashFlow).toHaveBeenCalledWith(2026, {
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });
    });
    await waitFor(() => {
      expect(mockUseDailyCashFlow).toHaveBeenCalledWith({
        date: '2026-03-15',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => {
      expect(mockExportMonthlyCashFlowExcel).toHaveBeenCalledWith(2026, {
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    await waitFor(() => {
      expect(mockExportMonthlyCashFlowPdf).toHaveBeenCalledWith(2026, {
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });
    });
  });

  it('keeps monthly cash flow date range unchanged when the operator enters an inverted range', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Flujo de caja' }));
    const fromInput = screen.getByLabelText('Desde flujo de caja');
    const toInput = screen.getByLabelText('Hasta flujo de caja');

    fireEvent.change(fromInput, { target: { value: '2026-03-01' } });
    fireEvent.change(toInput, { target: { value: '2026-03-31' } });

    await waitFor(() => {
      expect(mockUseMonthlyCashFlow).toHaveBeenCalledWith(2026, {
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });
    });

    mockUseMonthlyCashFlow.mockClear();
    fireEvent.change(toInput, { target: { value: '2026-02-28' } });

    expect(toInput).toHaveDisplayValue('2026-03-31');
    expect(mockUseMonthlyCashFlow).not.toHaveBeenCalledWith(2026, {
      fromDate: '2026-03-01',
      toDate: '2026-02-28',
    });
  });

  it('consults monthly credit history by date range from the reports screen', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Historial mensual' }));
    fireEvent.change(screen.getByLabelText('Desde historial'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('Hasta historial'), { target: { value: '2026-04-30' } });
    fireEvent.change(screen.getByLabelText('Estado del crédito'), { target: { value: 'active' } });
    fireEvent.click(screen.getByRole('button', { name: 'Más filtros' }));
    selectCustomerOption('7');
    selectCreditOption('15');

    expect(screen.getByRole('heading', { name: 'Historial mensual de créditos' })).toBeInTheDocument();
    expect(screen.getAllByText('Capital prestado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cuotas recibidas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pagado a socios').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gastos operativos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ganancias').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Caja disponible').length).toBeGreaterThan(0);
    expect(screen.getByText('2026-04')).toBeInTheDocument();
    expect(screen.getAllByText(/4[.,]000[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2[.,]500[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/300[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/125[.,]000/).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(mockUseCreditHistoryMonthly).toHaveBeenCalledWith({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        status: 'active',
        customerId: 7,
        loanId: 15,
      });
    });
  });

  it('requires selecting a credit in monthly credit history instead of typing exponent-like text', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Historial mensual' }));
    fireEvent.click(screen.getByRole('button', { name: 'Más filtros' }));
    const customerSelect = screen.getByRole('combobox', { name: 'Clientes para filtrar' });
    const creditSelect = screen.getByRole('combobox', { name: 'Créditos para filtrar' });

    selectCustomerOption('7');
    selectCreditOption('15');

    await waitFor(() => {
      expect(mockUseCreditHistoryMonthly).toHaveBeenCalledWith(expect.objectContaining({
        customerId: 7,
        loanId: 15,
      }));
    });

    mockUseCreditHistoryMonthly.mockClear();
    fireEvent.change(customerSelect, { target: { value: '' } });
    fireEvent.change(creditSelect, { target: { value: '' } });

    expect(customerSelect).toHaveValue('');
    expect(creditSelect).toHaveValue('');
    expect(mockUseCreditHistoryMonthly).not.toHaveBeenCalledWith({ customerId: 2000, loanId: 100000 });
  });

  it('keeps monthly credit history date range unchanged when the operator enters an inverted range', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Historial mensual' }));
    const fromInput = screen.getByLabelText('Desde historial');
    const toInput = screen.getByLabelText('Hasta historial');

    fireEvent.change(fromInput, { target: { value: '2026-05-01' } });
    fireEvent.change(toInput, { target: { value: '2026-05-31' } });

    await waitFor(() => {
      expect(mockUseCreditHistoryMonthly).toHaveBeenCalledWith(expect.objectContaining({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      }));
    });

    mockUseCreditHistoryMonthly.mockClear();
    fireEvent.change(toInput, { target: { value: '2026-04-30' } });

    expect(toInput).toHaveDisplayValue('2026-05-31');
    expect(mockUseCreditHistoryMonthly).not.toHaveBeenCalledWith({
      startDate: '2026-05-01',
      endDate: '2026-04-30',
    });
  });

  it('keeps cash flow year unchanged when exponent notation is typed', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Flujo de caja' }));
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2e3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));

    await waitFor(() => {
      expect(mockExportMonthlyCashFlowExcel).toHaveBeenCalledWith(2026, {});
    });
    expect(mockUseMonthlyCashFlow).not.toHaveBeenCalledWith(2000);
  });

  it('keeps profitability analytics year unchanged when exponent notation is typed', async () => {
    renderReports();
    fireEvent.click(screen.getByRole('tab', { name: 'Rentabilidad de clientes' }));
    await screen.findByRole('heading', { name: 'Rentabilidad por cliente' });
    fireEvent.change(screen.getByLabelText('Año analítico'), { target: { value: '2e3' } });

    expect(mockUseFinancialAnalytics).not.toHaveBeenCalledWith(2000);
    expect(mockUseCustomerProfitability).not.toHaveBeenCalledWith({
      fromDate: '2000-01-01',
      toDate: '2000-12-31',
    });
  });

  it('reloads customer profitability when the analytics year changes', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Rentabilidad de clientes' }));

    await waitFor(() => {
      expect(mockUseCustomerProfitability).toHaveBeenCalledWith({
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
      });
    });

    mockUseCustomerProfitability.mockClear();
    fireEvent.change(screen.getByLabelText('Año analítico'), { target: { value: '2025' } });

    await waitFor(() => {
      expect(mockUseCustomerProfitability).toHaveBeenCalledWith({
        fromDate: '2025-01-01',
        toDate: '2025-12-31',
      });
    });
  });

  it('shows dashboard export actions only on the dashboard tab', () => {
    renderReports();

    expect(screen.getByRole('button', { name: 'Resumen general' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar datos' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Flujo de caja' }));

    expect(screen.queryByRole('button', { name: 'Resumen general' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar datos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeInTheDocument();
  });

  it('keeps report charts out of the keyboard focus order', async () => {
    reportsState = {
      ...reportsState,
      monthlyPerformance: [
        { month: '2026-01', disbursed: 1000, recovered: 800 },
      ],
      statusBreakdown: [
        { status: 'active', count: 1 },
      ],
    };
    financialAnalyticsState = {
      performanceAnalysis: {
        data: {
          monthlyTrend: [
            { month: '2026-01', recovered: 800, arrears: 50 },
          ],
        },
        isLoading: false,
      },
      forecastAnalysis: { data: null, isLoading: false },
      nextMonthProjection: { data: null, isLoading: false },
    };

    renderReports();

    await waitFor(() => {
      expect(screen.getByTestId('recharts-area-chart')).toHaveAttribute('data-accessibility-layer', 'false');
      expect(screen.getByTestId('recharts-pie-chart')).toHaveAttribute('data-accessibility-layer', 'false');
      expect(screen.getByTestId('recharts-pie')).toHaveAttribute('data-root-tab-index', '-1');
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Rentabilidad de clientes' }));

    await waitFor(() => {
      expect(screen.getByTestId('recharts-line-chart')).toHaveAttribute('data-accessibility-layer', 'false');
    });
  });

  it('selects a loan for the payment calendar without requiring a manual loan ID', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Calendario de pagos' }));

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

    expect(screen.getByRole('button', { name: 'Resumen general' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Calendario de pagos' })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('tab', { name: 'Calendario de pagos' }));

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
    fireEvent.click(screen.getByRole('tab', { name: 'Calendario de pagos' }));

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

    fireEvent.click(screen.getByRole('tab', { name: 'Pagos y desembolsos' }));

    expect(screen.queryByRole('columnheader', { name: /ID pago/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Crédito ID/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: '#9' })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: '#3' })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Efectivo' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'cash' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
  });

  it('filters payout report by movement type', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Pagos y desembolsos' }));
    fireEvent.change(screen.getByLabelText('Tipo de movimiento'), { target: { value: 'capital' } });

    await waitFor(() => {
      expect(mockUsePayoutsReport).toHaveBeenCalledWith({ paymentType: 'capital' }, 1, 20);
    });
  });

  it('filters payout report by payment status', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Pagos y desembolsos' }));
    fireEvent.change(screen.getByLabelText('Estado de pago'), { target: { value: 'annulled' } });

    await waitFor(() => {
      expect(mockUsePayoutsReport).toHaveBeenCalledWith({ status: 'annulled' }, 1, 20);
    });
  });

  it('keeps payout report date range unchanged when the operator enters an inverted range', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Pagos y desembolsos' }));
    const fromInput = screen.getByLabelText('Desde pagos');
    const toInput = screen.getByLabelText('Hasta pagos');

    fireEvent.change(fromInput, { target: { value: '2026-07-01' } });
    fireEvent.change(toInput, { target: { value: '2026-07-31' } });

    await waitFor(() => {
      expect(mockUsePayoutsReport).toHaveBeenCalledWith({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      }, 1, 20);
    });

    mockUsePayoutsReport.mockClear();
    fireEvent.change(toInput, { target: { value: '2026-06-30' } });

    expect(toInput).toHaveDisplayValue('2026-07-31');
    expect(mockUsePayoutsReport).not.toHaveBeenCalledWith({
      fromDate: '2026-07-01',
      toDate: '2026-06-30',
    }, 1, 20);
  });

  it('manages operating expenses with finance permissions and preserves annulment history', async () => {
    currentUser = {
      id: 8,
      name: 'Empleado finanzas',
      email: 'finance@test.com',
      role: 'employee',
      permissions: ['REPORTS_VIEW_ALL', 'FINANCE_VIEW_ALL', 'FINANCE_CREATE', 'FINANCE_ANNUL'],
    };
    operatingExpensesState = {
      expenses: [{
        id: 11,
        amount: 850000,
        expenseDate: '2026-05-10T00:00:00.000Z',
        category: 'Arriendo',
        description: 'Arriendo oficina',
        paymentMethod: 'Transferencia',
        reference: 'TRX-99',
        status: 'completed',
        createdBy: { name: 'Empleado finanzas' },
      }],
      pagination: {
        totalPages: 1,
        totalItems: 1,
      },
      isLoading: false,
    };

    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Gastos operativos' }));

    expect(screen.getByRole('heading', { name: 'Control de gastos operativos' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Arriendo oficina' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Completado' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Desde gastos'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('Hasta gastos'), { target: { value: '2026-05-31' } });
    fireEvent.change(screen.getByLabelText('Estado del gasto'), { target: { value: 'completed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: /Excel/i }));

    await waitFor(() => {
      expect(mockExportOperatingExpensesReport).toHaveBeenCalledWith('xlsx', {
        fromDate: '2026-05-01',
        toDate: '2026-05-31',
        status: 'completed',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: /PDF/i }));

    await waitFor(() => {
      expect(mockExportOperatingExpensesReport).toHaveBeenCalledWith('pdf', {
        fromDate: '2026-05-01',
        toDate: '2026-05-31',
        status: 'completed',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Registrar gasto' }));
    fireEvent.change(await screen.findByLabelText('Monto', { selector: '#operating-expense-amount' }), { target: { value: '1250000' } });
    fireEvent.change(screen.getByLabelText('Fecha del gasto'), { target: { value: '2026-05-13' } });
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Servicios' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Internet oficina' } });
    fireEvent.change(screen.getByLabelText('Medio de pago'), { target: { value: 'Transferencia' } });
    fireEvent.change(screen.getByLabelText('Referencia'), { target: { value: 'TRX-100' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar gasto' }).at(-1)!);

    await waitFor(() => {
      expect(mockCreateOperatingExpense).toHaveBeenCalledWith({
        amount: 1250000,
        expenseDate: '2026-05-13',
        category: 'Servicios',
        description: 'Internet oficina',
        paymentMethod: 'Transferencia',
        reference: 'TRX-100',
        notes: undefined,
      });
    });

    expect(screen.queryByRole('button', { name: 'Anular gasto #11' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anular gasto' }));
    fireEvent.change(await screen.findByLabelText('Motivo de anulación'), {
      target: { value: 'Registro duplicado' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Anular gasto' }).at(-1)!);

    await waitFor(() => {
      expect(mockAnnulOperatingExpense).toHaveBeenCalledWith(11, 'Registro duplicado');
    });
  });

  it('paginates operating expenses through the shared table shell', () => {
    currentUser = {
      id: 8,
      name: 'Empleado finanzas',
      email: 'finance@test.com',
      role: 'employee',
      permissions: ['REPORTS_VIEW_ALL', 'FINANCE_VIEW_ALL'],
    };
    operatingExpensesState = {
      expenses: [{
        id: 11,
        amount: 850000,
        expenseDate: '2026-05-10T00:00:00.000Z',
        category: 'Arriendo',
        description: 'Arriendo oficina',
        paymentMethod: 'Transferencia',
        status: 'completed',
        createdBy: { name: 'Empleado finanzas' },
      }],
      pagination: {
        totalPages: 3,
        totalItems: 45,
      },
      isLoading: false,
    };

    renderReports();
    fireEvent.click(screen.getByRole('tab', { name: 'Gastos operativos' }));

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
    expect(screen.queryByText('reports.payouts.pagination.previous')).not.toBeInTheDocument();
  });

  it('rejects exponent-like text in operating expense amounts without restoring a stale value', async () => {
    currentUser = {
      id: 8,
      name: 'Empleado finanzas',
      email: 'finance@test.com',
      role: 'employee',
      permissions: ['REPORTS_VIEW_ALL', 'FINANCE_VIEW_ALL', 'FINANCE_CREATE'],
    };

    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Gastos operativos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar gasto' }));

    const amountInput = await screen.findByLabelText('Monto', { selector: '#operating-expense-amount' });
    (amountInput as HTMLInputElement).focus();
    fireEvent.change(amountInput, { target: { value: '1250000' } });
    fireEvent.keyDown(amountInput, { key: 'a', metaKey: true });
    (amountInput as HTMLInputElement).setSelectionRange(0, (amountInput as HTMLInputElement).value.length);
    fireEvent.select(amountInput);
    fireEvent.change(amountInput, { target: { value: '1' } });
    fireEvent.keyDown(amountInput, { key: 'e' });

    await waitFor(() => {
      expect(amountInput).toHaveDisplayValue('1');
    });

    fireEvent.change(amountInput, { target: { value: '15' } });

    expect(amountInput).toHaveDisplayValue('15');

    fireEvent.change(screen.getByLabelText('Fecha del gasto'), { target: { value: '2026-05-13' } });
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Servicios' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Internet oficina' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar gasto' }).at(-1)!);

    await waitFor(() => {
      expect(mockCreateOperatingExpense).toHaveBeenCalledWith(expect.objectContaining({
        amount: 15,
      }));
    });
  });

  it('keeps operating expense date range unchanged when the operator enters an inverted range', async () => {
    currentUser = {
      id: 8,
      name: 'Empleado finanzas',
      email: 'finance@test.com',
      role: 'employee',
      permissions: ['REPORTS_VIEW_ALL', 'FINANCE_VIEW_ALL'],
    };

    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Gastos operativos' }));
    const fromInput = screen.getByLabelText('Desde gastos');
    const toInput = screen.getByLabelText('Hasta gastos');

    fireEvent.change(fromInput, { target: { value: '2026-05-01' } });
    fireEvent.change(toInput, { target: { value: '2026-05-31' } });

    await waitFor(() => {
      expect(mockUseOperatingExpenses).toHaveBeenCalledWith({
        fromDate: '2026-05-01',
        toDate: '2026-05-31',
      }, 1, 20, true);
    });

    mockUseOperatingExpenses.mockClear();
    fireEvent.change(toInput, { target: { value: '2026-04-30' } });

    expect(toInput).toHaveDisplayValue('2026-05-31');
    expect(mockUseOperatingExpenses).not.toHaveBeenCalledWith({
      fromDate: '2026-05-01',
      toDate: '2026-04-30',
    }, 1, 20, true);
  });

  it('hides operating expenses from employees without finance permission', () => {
    currentUser = {
      id: 9,
      name: 'Empleado reportes',
      email: 'reports@test.com',
      role: 'employee',
      permissions: ['REPORTS_VIEW_ALL'],
    };

    renderReports();

    expect(screen.queryByRole('tab', { name: 'Gastos operativos' })).not.toBeInTheDocument();
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
