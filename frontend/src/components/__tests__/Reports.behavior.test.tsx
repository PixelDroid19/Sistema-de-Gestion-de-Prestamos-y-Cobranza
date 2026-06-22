import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import Reports from '../Reports';

const mockExportDashboardSummary = vi.fn().mockResolvedValue(undefined);
const mockExportFinancialAnalyticsReport = vi.fn().mockResolvedValue(undefined);
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
const mockUseAnnualCashFlow = vi.fn();
const mockUseCreditHistoryMonthly = vi.fn();
const mockUseCreditHistoryFinancialProducts = vi.fn();
const mockUseCustomerProfitability = vi.fn();
const mockUseCustomerReports = vi.fn();
const mockUsePayoutsReport = vi.fn();
const mockUseOperatingExpenses = vi.fn();
const mockUsePaymentCalendarOverview = vi.fn();
const mockUsePaymentSchedule = vi.fn(() => ({
  schedule: [] as any[],
  summary: null as any,
  loan: null as any,
  isLoading: false,
}));
const mockUseUsers = vi.fn();

let currentUser = {
  id: 1,
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin' as 'admin' | 'employee' | 'socio' | 'customer',
  permissions: ['*'],
};

const buildDashboardMetrics = (overrides: Record<string, number> = {}) => ({
  totalActiveLoans: 1,
  totalDisbursed: 1000,
  totalRecovered: 500,
  totalCurrentLent: 650,
  totalPendingCollection: 720,
  totalInterestGenerated: 240,
  totalInterestPaid: 80,
  totalInterestPending: 160,
  totalAssociatePayments: 30,
  totalCustomers: 7,
  totalFinalizedLoans: 2,
  totalOverdueLoans: 1,
  totalPendingInstallments: 4,
  totalOverdueInstallments: 1,
  availableCash: 1200,
  periodProfit: 65,
  periodLoss: 300,
  arrearsRate: 5,
  recoveryRate: 50,
  ...overrides,
});

let reportsState = {
  dashboardData: {
    metrics: buildDashboardMetrics(),
  },
  monthlyPerformance: [] as Array<Record<string, unknown>>,
  statusBreakdown: [] as Array<Record<string, unknown>>,
  overdueLoans: [] as Array<Record<string, unknown>>,
  profitabilityItems: [] as Array<Record<string, unknown>>,
  customerAnalytics: null as any,
  profitabilityPagination: null as any,
  isLoading: false,
  isError: false,
  error: null,
};

let customerReportsState: Record<number, {
  history: any;
  creditProfile: any;
  isLoading?: boolean;
}> = {};

let financialAnalyticsState = {
  performanceAnalysis: { data: null as any, isLoading: false },
  executiveDashboard: { data: null as any, isLoading: false },
  comprehensiveAnalytics: { data: null as any, isLoading: false },
  comparativeAnalysis: { data: null as any, isLoading: false },
  forecastAnalysis: { data: null as any, isLoading: false },
  nextMonthProjection: { data: null as any, isLoading: false },
};

let payoutsReportState = {
  payouts: [] as Array<Record<string, unknown>>,
  summary: null as any,
  pagination: null as any,
  isLoading: false,
};

let paymentCalendarOverviewState: any = {
  data: {
    asOfDate: '2026-06-05',
    summary: {
      totalLoans: 2,
      totalEntries: 2,
      paidCount: 0,
      pendingCount: 1,
      overdueCount: 1,
      dueTodayCount: 0,
      actionableCount: 2,
      totalPayableAmount: 210000,
      totalLateFeeAmount: 10000,
    },
    agenda: [
      {
        loanId: 15,
        customerName: 'Cliente Historial',
        totalInstallments: 12,
        installmentNumber: 4,
        dueDate: '2026-06-10',
        status: 'pending',
        payableAmount: 110000,
        scheduledPayment: 110000,
        lateFeeDue: 0,
        daysOverdue: 0,
        canPay: true,
        isNextPayable: true,
      },
      {
        loanId: 18,
        customerName: 'Cliente Exportación',
        totalInstallments: 10,
        installmentNumber: 6,
        dueDate: '2026-05-28',
        status: 'overdue',
        payableAmount: 100000,
        scheduledPayment: 90000,
        lateFeeDue: 10000,
        daysOverdue: 8,
        canPay: true,
        isNextPayable: false,
      },
    ],
    actionableEntries: [
      {
        loanId: 15,
        customerName: 'Cliente Historial',
        totalInstallments: 12,
        installmentNumber: 4,
        dueDate: '2026-06-10',
        status: 'pending',
        payableAmount: 110000,
        scheduledPayment: 110000,
        lateFeeDue: 0,
        daysOverdue: 0,
        canPay: true,
        isNextPayable: true,
      },
      {
        loanId: 18,
        customerName: 'Cliente Exportación',
        totalInstallments: 10,
        installmentNumber: 6,
        dueDate: '2026-05-28',
        status: 'overdue',
        payableAmount: 100000,
        scheduledPayment: 90000,
        lateFeeDue: 10000,
        daysOverdue: 8,
        canPay: true,
        isNextPayable: false,
      },
    ],
    nextAction: null,
    entries: [],
  },
  agenda: [] as Array<Record<string, unknown>>,
  summary: null as any,
  isLoading: false,
  isError: false,
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

const creditHistoryFinancialProductsState = [
  { id: 'prod-personal', name: 'Crédito personal' },
  { id: 'prod-comercial', name: 'Crédito comercial' },
];

vi.mock('../../services/reportService', () => ({
  useReports: () => reportsState,
  exportFinancialAnalyticsReport: (...args: unknown[]) => mockExportFinancialAnalyticsReport(...args),
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
          totalAssociatePayments: '3000000.00',
          totalOperatingExpenses: '2000000.00',
          availableCash: '5000000.00',
          portfolioReceivable: '12500000.00',
          totalPrincipalRecovered: '37500000.00',
          totalCollectedProfit: '5000000.00',
          lossesAtRisk: '0.00',
          netProfitIndicator: '0.00',
          paymentCount: 3,
        },
        months: [
          {
            month: '2026-01',
            inflows: '50000000.00',
            outflows: '40000000.00',
            associatePayments: '3000000.00',
            operatingExpenses: '2000000.00',
            netCashFlow: '5000000.00',
            availableCash: '5000000.00',
            portfolioReceivable: '12500000.00',
            principalRecovered: '37500000.00',
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
          totalAssociatePayments: '200000.00',
          totalOperatingExpenses: '100000.00',
          availableCash: '700000.00',
          totalCollectedProfit: '300000.00',
          lossesAtRisk: '0.00',
          netProfitIndicator: '0.00',
          paymentCount: 2,
        },
        days: [
          {
            date: '2026-03-15',
            inflows: '1500000.00',
            outflows: '500000.00',
            associatePayments: '200000.00',
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
  useAnnualCashFlow: (...args: unknown[]) => {
    mockUseAnnualCashFlow(...args);
    return {
      data: {
        filters: { fromYear: 2024, toYear: 2026 },
        summary: {
          totalInflows: '76000000.00',
          totalOutflows: '60000000.00',
          totalAssociatePayments: '4000000.00',
          totalOperatingExpenses: '3000000.00',
          availableCash: '9000000.00',
          portfolioReceivable: '12500000.00',
          totalPrincipalRecovered: '37500000.00',
          totalCollectedProfit: '9000000.00',
          lossesAtRisk: '0.00',
          netProfitIndicator: '2000000.00',
        },
        years: [
          {
            year: '2024',
            inflows: '10000000.00',
            outflows: '8000000.00',
            associatePayments: '500000.00',
            operatingExpenses: '300000.00',
            netCashFlow: '1200000.00',
            portfolioReceivable: '1500000.00',
            principalRecovered: '6500000.00',
            collectedProfit: '1200000.00',
            lossesAtRisk: '0.00',
          },
          {
            year: '2025',
            inflows: '16000000.00',
            outflows: '12000000.00',
            associatePayments: '500000.00',
            operatingExpenses: '700000.00',
            netCashFlow: '2800000.00',
            portfolioReceivable: '2500000.00',
            principalRecovered: '9500000.00',
            collectedProfit: '2800000.00',
            lossesAtRisk: '0.00',
          },
          {
            year: '2026',
            inflows: '50000000.00',
            outflows: '40000000.00',
            associatePayments: '3000000.00',
            operatingExpenses: '2000000.00',
            netCashFlow: '5000000.00',
            portfolioReceivable: '8500000.00',
            principalRecovered: '21500000.00',
            collectedProfit: '5000000.00',
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
        credits: [
          {
            creditId: 15,
            customerName: 'Cliente Historial',
            status: 'Activo',
            creditDate: '2026-04-01',
            amount: '4000000.00',
            principalOutstanding: '2500000.00',
            totalPaid: '1500000.00',
            interestPaid: '350000.00',
            penaltyPaid: '0.00',
          },
          {
            creditId: 18,
            customerName: 'Cliente Exportación',
            status: 'Vencido',
            creditDate: '2026-04-08',
            amount: '2500000.00',
            principalOutstanding: '1800000.00',
            totalPaid: '700000.00',
            interestPaid: '90000.00',
            penaltyPaid: '10000.00',
          },
        ],
        payments: [
          {
            paymentId: 41,
            creditId: 15,
            customerName: 'Cliente Historial',
            paymentDate: '2026-04-10',
            paymentType: 'Cuota',
            status: 'Aplicado',
            amount: '120000.00',
            principalApplied: '90000.00',
            interestApplied: '30000.00',
            penaltyApplied: '0.00',
          },
          {
            paymentId: 42,
            creditId: 18,
            customerName: 'Cliente Exportación',
            paymentDate: '2026-04-12',
            paymentType: 'Cuota',
            status: 'Aplicado',
            amount: '150000.00',
            principalApplied: '100000.00',
            interestApplied: '40000.00',
            penaltyApplied: '10000.00',
          },
        ],
      },
      isLoading: false,
      isError: false,
    };
  },
  useCreditHistoryFinancialProducts: (...args: unknown[]) => {
    mockUseCreditHistoryFinancialProducts(...args);
    return {
      financialProducts: creditHistoryFinancialProductsState,
      isLoading: false,
      isError: false,
      error: null,
    };
  },
  useCustomerProfitability: (...args: unknown[]) => {
    mockUseCustomerProfitability(...args);
    return {
      items: reportsState.profitabilityItems,
      customerAnalytics: reportsState.customerAnalytics,
      pagination: reportsState.profitabilityPagination,
      isLoading: false,
      isError: false,
      error: null,
    };
  },
  useCustomerReports: (customerId: number) => {
    mockUseCustomerReports(customerId);
    const entry = customerReportsState[customerId];
    return {
      history: entry?.history ?? null,
      creditProfile: entry?.creditProfile ?? null,
      isLoading: entry?.isLoading ?? false,
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
  usePaymentCalendarOverview: (...args: unknown[]) => {
    mockUsePaymentCalendarOverview(...args);
    return {
      data: paymentCalendarOverviewState.data,
      agenda: paymentCalendarOverviewState.data.agenda,
      actionableEntries: paymentCalendarOverviewState.data.actionableEntries ?? paymentCalendarOverviewState.data.agenda,
      summary: paymentCalendarOverviewState.data.summary,
      nextAction: paymentCalendarOverviewState.data.nextAction,
      entries: paymentCalendarOverviewState.data.entries,
      isLoading: paymentCalendarOverviewState.isLoading,
      isError: paymentCalendarOverviewState.isError,
      refetch: vi.fn(),
    };
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

vi.mock('../../services/userService', () => ({
  useUsers: (...args: unknown[]) => {
    mockUseUsers(...args);
    return {
      data: {
        data: {
          users: [
            { id: 1, name: 'Admin Reportes', email: 'admin.reportes@test.local', role: 'admin', isActive: true },
            { id: 7, name: 'Operador Reportes', email: 'operador.reportes@test.local', role: 'employee', isActive: true },
            { id: 99, name: 'Cliente Registro', email: 'cliente@test.local', role: 'customer', isActive: true },
          ],
        },
      },
      isLoading: false,
      isError: false,
    };
  },
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

const advancedReportValuesByLabel: Record<string, string> = {
  'Dashboard general': 'dashboard',
  'Analítica': 'analytics',
  'Rentabilidad de clientes': 'profitability',
  'Créditos en mora': 'outstanding',
  'Gastos operativos': 'expenses',
  'Calendario de pagos': 'schedule',
};

const openReportView = (name: string) => {
  const directTab = screen.queryByRole('tab', { name });
  if (directTab) {
    fireEvent.click(directTab);
    return;
  }

  fireEvent.click(screen.getByRole('tab', { name: 'Otros informes' }));
  const optionValue = advancedReportValuesByLabel[name];
  if (!optionValue) {
    throw new Error(`No advanced report mapping configured for ${name}`);
  }
  fireEvent.change(screen.getByRole('combobox', { name: 'Informe adicional' }), {
    target: { value: optionValue },
  });
};

const selectComboboxOption = (comboboxName: string, value: string) => {
  fireEvent.focus(screen.getByRole('combobox', { name: comboboxName }));
  fireEvent.mouseDown(screen.getByRole('option', { name: new RegExp(`Número ${value}\\b`) }));
};

const selectCustomerOption = (value: string) => {
  selectComboboxOption('Clientes para filtrar', value);
};

const selectCreditOption = (value: string) => {
  selectComboboxOption('Créditos para filtrar', value);
};

describe('Reports behavioral parity scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportsState = {
      dashboardData: {
        metrics: buildDashboardMetrics(),
      },
      monthlyPerformance: [],
      statusBreakdown: [],
      overdueLoans: [],
      profitabilityItems: [],
      customerAnalytics: null,
      profitabilityPagination: null,
      isLoading: false,
      isError: false,
      error: null,
    };
    financialAnalyticsState = {
      performanceAnalysis: { data: null, isLoading: false },
      executiveDashboard: { data: null, isLoading: false },
      comprehensiveAnalytics: { data: null, isLoading: false },
      comparativeAnalysis: { data: null, isLoading: false },
      forecastAnalysis: { data: null, isLoading: false },
      nextMonthProjection: { data: null, isLoading: false },
    };
    payoutsReportState = {
      payouts: [],
      summary: null,
      pagination: null,
      isLoading: false,
    };
    paymentCalendarOverviewState = {
      data: {
        asOfDate: '2026-06-05',
        summary: {
          totalLoans: 2,
          totalEntries: 2,
          paidCount: 0,
          pendingCount: 1,
          overdueCount: 1,
          dueTodayCount: 0,
          actionableCount: 2,
          totalPayableAmount: 210000,
          totalLateFeeAmount: 10000,
        },
        agenda: [
          {
            loanId: 15,
            customerName: 'Cliente Historial',
            totalInstallments: 12,
            installmentNumber: 4,
            dueDate: '2026-06-10',
            status: 'pending',
            payableAmount: 110000,
            scheduledPayment: 110000,
            lateFeeDue: 0,
            daysOverdue: 0,
            canPay: true,
            isNextPayable: true,
          },
          {
            loanId: 18,
            customerName: 'Cliente Exportación',
            totalInstallments: 10,
            installmentNumber: 6,
            dueDate: '2026-05-28',
            status: 'overdue',
            payableAmount: 100000,
            scheduledPayment: 90000,
            lateFeeDue: 10000,
            daysOverdue: 8,
            canPay: true,
            isNextPayable: false,
          },
        ],
        actionableEntries: [
          {
            loanId: 15,
            customerName: 'Cliente Historial',
            totalInstallments: 12,
            installmentNumber: 4,
            dueDate: '2026-06-10',
            status: 'pending',
            payableAmount: 110000,
            scheduledPayment: 110000,
            lateFeeDue: 0,
            daysOverdue: 0,
            canPay: true,
            isNextPayable: true,
          },
          {
            loanId: 18,
            customerName: 'Cliente Exportación',
            totalInstallments: 10,
            installmentNumber: 6,
            dueDate: '2026-05-28',
            status: 'overdue',
            payableAmount: 100000,
            scheduledPayment: 90000,
            lateFeeDue: 10000,
            daysOverdue: 8,
            canPay: true,
            isNextPayable: false,
          },
        ],
        nextAction: null,
        entries: [],
      },
      agenda: [],
      summary: null,
      isLoading: false,
      isError: false,
    };
    customerReportsState = {};
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

  it('keeps the main reports in a short navigation and moves secondary reports out of the tab row', () => {
    renderReports();

    expect(screen.getByRole('tab', { name: 'Cierre contable' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Créditos del período' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pago de cuotas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Otros informes' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Dashboard general' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Analítica' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Rentabilidad de clientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Créditos en mora' })).not.toBeInTheDocument();

    openReportView('Dashboard general');

    expect(screen.getByRole('heading', { name: 'Otros informes administrativos' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Informe adicional' })).toHaveDisplayValue('Dashboard general');
  });

  it('exports reports when action is in-scope and keeps canonical labels', async () => {
    renderReports();

    expect(screen.getByRole('heading', { name: 'Reportes y analítica' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reportes y Analíticas' })).not.toBeInTheDocument();
    openReportView('Dashboard general');
    expect(screen.getByText('Capital recuperado')).toBeInTheDocument();
    expect(screen.getByText('Interés pagado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(screen.getByRole('heading', { name: 'Exportar dashboard general' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar dashboard general' }));

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

    openReportView('Dashboard general');
    fireEvent.click(screen.getByRole('button', { name: 'Exportación contextual' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01-31' } });
    fireEvent.change(screen.getByLabelText('Tipo de reporte'), { target: { value: 'payouts' } });
    fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'pdf' } });
    selectCustomerOption('7');
    selectCreditOption('15');
    fireEvent.change(screen.getByLabelText('Tipo de movimiento'), { target: { value: 'capital' } });
    fireEvent.change(screen.getByLabelText('Estado de pago'), { target: { value: 'annulled' } });
    fireEvent.focus(screen.getByRole('combobox', { name: 'Registrado por' }));
    fireEvent.mouseDown(screen.getByRole('option', { name: /Operador Reportes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar pagos' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('payouts', {
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        status: 'annulled',
        format: 'pdf',
        paymentType: 'capital',
        employeeId: '7',
        customerId: 7,
        loanId: 15,
      });
    });
  });

  it('exports credits report with status filter and selected format', async () => {
    mockExportContextualReport.mockClear();
    renderReports();

    openReportView('Créditos del período');
    fireEvent.change(screen.getByLabelText('Desde período'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('Hasta período'), { target: { value: '2026-02-28' } });
    fireEvent.change(screen.getByLabelText('Estado del crédito'), { target: { value: 'active' } });
    fireEvent.click(screen.getByRole('button', { name: 'Más filtros' }));
    fireEvent.change(screen.getByLabelText('Tipo de crédito'), { target: { value: 'prod-comercial' } });
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
        financialProductId: 'prod-comercial',
      });
    });
  });

  it('keeps contextual export date range unchanged when the operator enters an inverted range', async () => {
    renderReports();

    openReportView('Créditos del período');
    const fromInput = screen.getByLabelText('Desde período');
    const toInput = screen.getByLabelText('Hasta período');

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

    openReportView('Dashboard general');
    fireEvent.click(screen.getByRole('button', { name: 'Exportación contextual' }));

    const customerSelect = document.getElementById('report-customer')!;
    const creditSelect = document.getElementById('report-loan')!;

    selectCustomerOption('7');
    selectCreditOption('18');
    fireEvent.mouseDown(screen.getAllByRole('button', { name: 'Quitar selección' })[0]);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Quitar selección' }));

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

  it('includes the selected credit type in the contextual credit export modal', async () => {
    mockExportContextualReport.mockClear();
    renderReports();

    openReportView('Dashboard general');
    fireEvent.click(screen.getByRole('button', { name: 'Exportación contextual' }));
    fireEvent.change(screen.getByLabelText('Tipo de crédito'), { target: { value: 'prod-personal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar historial' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('credits', expect.objectContaining({
        financialProductId: 'prod-personal',
      }));
    });
  });

  it('hides the employee selector in contextual payout export for non-admin users', () => {
    currentUser = {
      id: 7,
      name: 'Empleado reportes',
      email: 'employee.reports@test.com',
      role: 'employee',
      permissions: ['REPORTS_VIEW_ALL'],
    };

    renderReports();

    openReportView('Dashboard general');
    fireEvent.click(screen.getByRole('button', { name: 'Exportación contextual' }));
    fireEvent.change(screen.getByLabelText('Tipo de reporte'), { target: { value: 'payouts' } });

    expect(screen.queryByLabelText('Registrado por')).not.toBeInTheDocument();
  });

  it('keeps investor associate exports out of the reports contextual exporter', async () => {
    mockExportContextualReport.mockClear();
    renderReports();

    openReportView('Dashboard general');
    fireEvent.click(screen.getByRole('button', { name: 'Exportación contextual' }));

    const reportType = screen.getByLabelText('Tipo de reporte');
    expect(reportType).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Socios inversionistas' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Socio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar socios' })).not.toBeInTheDocument();
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

    openReportView('Rentabilidad de clientes');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    const exportDialog = screen.getByRole('dialog');
    fireEvent.change(within(exportDialog).getByLabelText('Desde'), { target: { value: '2026-05-01' } });
    fireEvent.change(within(exportDialog).getByLabelText('Hasta'), { target: { value: '2026-05-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar rentabilidad' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('profitability', {
        fromDate: '2026-05-01',
        toDate: '2026-05-20',
        status: undefined,
        format: 'xlsx',
      });
    });
  });

  it('exports the customer profitability PDF when selected in the profitability tab', async () => {
    mockExportContextualReport.mockClear();
    renderReports();

    openReportView('Rentabilidad de clientes');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar rentabilidad' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('profitability', {
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
        status: undefined,
        format: 'pdf',
      });
    });
  });

  it('shows customer operating control with delinquency, behavior, and risk', async () => {
    reportsState = {
      ...reportsState,
      profitabilityItems: [{
        customerId: 7,
        customerName: 'Ana Mora',
        totalLoans: 3,
        activeLoanCount: 2,
        closedLoanCount: 1,
        overdueLoanCount: 2,
        paymentCount: 5,
        outstandingBalance: 1200000,
        interestCollected: 60000,
        lateFeesCollected: 10000,
        totalProfit: 70000,
        paymentBehavior: 'critical',
        riskLevel: 'high',
      }],
      customerAnalytics: {
        summary: {
          delinquentCustomerCount: 1,
        },
        topByLoanCount: [{
          customerId: 7,
          customerName: 'Ana Mora',
          loanCount: 3,
          activeLoanCount: 2,
          closedLoanCount: 1,
          overdueLoanCount: 2,
          outstandingBalance: '1200000.00',
          paymentBehavior: 'critical',
          riskLevel: 'high',
        }],
        topByOutstandingBalance: [{
          customerId: 7,
          customerName: 'Ana Mora',
          loanCount: 3,
          overdueLoanCount: 2,
          outstandingBalance: '1200000.00',
          paymentBehavior: 'critical',
          riskLevel: 'high',
        }],
        delinquentCustomers: [{
          customerId: 7,
          customerName: 'Ana Mora',
          overdueLoanCount: 2,
          outstandingBalance: '1200000.00',
          paymentBehavior: 'critical',
          riskLevel: 'high',
        }],
      },
      profitabilityPagination: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    };

    renderReports();

    openReportView('Rentabilidad de clientes');

    expect(screen.getByRole('heading', { name: 'Clientes con más créditos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clientes con mayor saldo pendiente' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clientes morosos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Control operativo de clientes' })).toBeInTheDocument();
    expect(screen.getByText('Clientes morosos: 1. Revisa esta página para abrir el detalle operativo del cliente.')).toBeInTheDocument();
    expect(screen.getByText('Clientes con mora activa en el rango consultado: 1.')).toBeInTheDocument();
    expect(screen.getAllByText('Ana Mora').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('3 créditos').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2 activos · 1 finalizados').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('COP 1.200.000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2 en mora').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Crítico').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Alto').length).toBeGreaterThanOrEqual(1);
  });

  it('opens customer detail from profitability control and shows history, behavior, and risk', async () => {
    reportsState = {
      ...reportsState,
      profitabilityItems: [{
        customerId: 7,
        customerName: 'Ana Mora',
        totalLoans: 3,
        activeLoanCount: 2,
        closedLoanCount: 1,
        overdueLoanCount: 2,
        paymentCount: 5,
        outstandingBalance: 1200000,
        interestCollected: 60000,
        lateFeesCollected: 10000,
        totalProfit: 70000,
        paymentBehavior: 'critical',
        riskLevel: 'high',
      }],
      customerAnalytics: {
        summary: {
          delinquentCustomerCount: 1,
        },
        topByLoanCount: [],
        topByOutstandingBalance: [],
        delinquentCustomers: [],
      },
      profitabilityPagination: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    };

    customerReportsState = {
      7: {
        history: {
          data: {
            timeline: [
              {
                id: 'payment-1',
                entityType: 'payment',
                occurredAt: '2026-05-12T00:00:00.000Z',
                data: { amount: 250000, status: 'completed' },
              },
              {
                id: 'alert-1',
                entityType: 'alert',
                occurredAt: '2026-05-10T00:00:00.000Z',
                data: { notes: 'Seguimiento por mora activa', status: 'active' },
              },
            ],
          },
        },
        creditProfile: {
          data: {
            profile: {
              summary: {
                totalLoans: 3,
                activeLoans: 2,
                closedLoans: 1,
                completedPayments: 5,
                totalPaid: '1450000.00',
              },
              profitability: {
                outstandingBalance: 1200000,
                paymentBehavior: 'critical',
                riskLevel: 'high',
              },
            },
          },
        },
      },
    };

    renderReports();

    openReportView('Rentabilidad de clientes');
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle del cliente' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Detalle de Ana Mora' })).toBeInTheDocument();
    expect(within(dialog).getAllByText('Historial de créditos').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('Total pagado')).toBeInTheDocument();
    expect(within(dialog).getByText('Riesgo')).toBeInTheDocument();
    expect(within(dialog).getByText('Actividad reciente')).toBeInTheDocument();
    expect(within(dialog).getByText('Pago')).toBeInTheDocument();
    expect(within(dialog).getByText('COP 250.000')).toBeInTheDocument();
    expect(within(dialog).getByText('Seguimiento por mora activa')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Crítico').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('Alto').length).toBeGreaterThan(0);
    expect(mockUseCustomerReports).toHaveBeenCalledWith(7);
  });

  it('shows monthly cash flow control and exports Excel/PDF', async () => {
    renderReports();

    openReportView('Cierre contable');
    fireEvent.change(screen.getByLabelText('Desde cierre'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Hasta cierre'), { target: { value: '2026-03-31' } });
    fireEvent.change(screen.getByLabelText('Fecha de resumen diario'), { target: { value: '2026-03-15' } });

    expect(screen.getByRole('heading', { name: 'Cierre contable mensual' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Comparativo anual de caja' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resumen diario de caja' })).toBeInTheDocument();
    expect(screen.getAllByText('Entradas por cuotas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Salidas por préstamos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pagos a socios').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gastos operativos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Caja disponible').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cartera por cobrar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Capital recuperado').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/12[.,]500[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/37[.,]500[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2[.,]000[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/700[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getByText('2026-01')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2024' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2025' })).toBeInTheDocument();
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
    await waitFor(() => {
      expect(mockUseAnnualCashFlow).toHaveBeenCalledWith({
        fromYear: 2024,
        toYear: 2026,
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

    openReportView('Cierre contable');
    const fromInput = screen.getByLabelText('Desde cierre');
    const toInput = screen.getByLabelText('Hasta cierre');

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

    openReportView('Créditos del período');
    fireEvent.change(screen.getByLabelText('Desde período'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('Hasta período'), { target: { value: '2026-04-30' } });
    fireEvent.change(screen.getByLabelText('Estado del crédito'), { target: { value: 'active' } });
    fireEvent.click(screen.getByRole('button', { name: 'Más filtros' }));
    fireEvent.change(screen.getByLabelText('Tipo de crédito'), { target: { value: 'prod-personal' } });
    selectCustomerOption('7');
    selectCreditOption('15');

    expect(screen.getByRole('heading', { name: 'Créditos del período' })).toBeInTheDocument();
    expect(screen.getAllByText('Capital prestado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cuotas recibidas').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pagos a socios')).not.toBeInTheDocument();
    expect(screen.getAllByText('Gastos operativos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Interés y mora').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Caja disponible').length).toBeGreaterThan(0);
    expect(screen.getByText('2026-04')).toBeInTheDocument();
    expect(screen.getAllByText(/4[.,]000[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2[.,]500[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/125[.,]000/).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(mockUseCreditHistoryMonthly).toHaveBeenCalledWith({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        status: 'active',
        customerId: 7,
        loanId: 15,
        financialProductId: 'prod-personal',
      });
    });
  });

  it('shows detailed credit rows and collection history inside the monthly credit history tab', () => {
    renderReports();

    openReportView('Créditos del período');

    expect(screen.getByRole('heading', { name: 'Detalle de créditos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Historial de recaudo' })).toBeInTheDocument();
    expect(screen.getAllByText('Cliente Historial').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Cliente Exportación').length).toBeGreaterThan(1);
    expect(screen.getByText('Crédito #15')).toBeInTheDocument();
    expect(screen.getByText('Crédito #18')).toBeInTheDocument();
    expect(screen.getAllByText('Aplicado').length).toBeGreaterThan(0);
  });

  it('requires selecting a credit in monthly credit history instead of typing exponent-like text', async () => {
    renderReports();

    openReportView('Créditos del período');
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
    fireEvent.mouseDown(screen.getAllByRole('button', { name: 'Quitar selección' })[0]);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Quitar selección' }));

    expect(customerSelect).toHaveValue('');
    expect(creditSelect).toHaveValue('');
    expect(mockUseCreditHistoryMonthly).not.toHaveBeenCalledWith({ customerId: 2000, loanId: 100000 });
  });

  it('keeps monthly credit history date range unchanged when the operator enters an inverted range', async () => {
    renderReports();

    openReportView('Créditos del período');
    const fromInput = screen.getByLabelText('Desde período');
    const toInput = screen.getByLabelText('Hasta período');

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

    openReportView('Cierre contable');
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2e3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));

    await waitFor(() => {
      expect(mockExportMonthlyCashFlowExcel).toHaveBeenCalledWith(2026, {});
    });
    expect(mockUseMonthlyCashFlow).not.toHaveBeenCalledWith(2000);
  });

  it('keeps the profitability range unchanged when an inverted date is typed', async () => {
    renderReports();
    openReportView('Rentabilidad de clientes');
    await screen.findByRole('heading', { name: 'Rentabilidad por cliente' });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2027-01-01' } });

    expect(mockUseCustomerProfitability).not.toHaveBeenCalledWith({
      fromDate: '2027-01-01',
      toDate: '2026-12-31',
      page: 1,
      pageSize: 10,
    });
  });

  it('reloads customer profitability when the profitability range changes', async () => {
    renderReports();

    openReportView('Rentabilidad de clientes');

    await waitFor(() => {
      expect(mockUseCustomerProfitability).toHaveBeenCalledWith({
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
        page: 1,
        pageSize: 10,
      });
    });

    mockUseCustomerProfitability.mockClear();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2025-03-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2025-03-31' } });

    await waitFor(() => {
      expect(mockUseCustomerProfitability).toHaveBeenCalledWith({
        fromDate: '2025-03-01',
        toDate: '2025-03-31',
        page: 1,
        pageSize: 10,
      });
    });
  });

  it('uses the visible profitability range as the default export range', async () => {
    mockExportContextualReport.mockClear();
    renderReports();

    openReportView('Rentabilidad de clientes');
    await screen.findByRole('heading', { name: 'Rentabilidad por cliente' });

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-04-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar rentabilidad' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('profitability', {
        fromDate: '2026-04-01',
        toDate: '2026-04-30',
        status: undefined,
        format: 'xlsx',
      });
    });
  });

  it('renders the analytics tab from the backend analytics contract instead of synthetic profitability metrics', async () => {
    financialAnalyticsState = {
      performanceAnalysis: {
        data: {
          summary: {
            totalEarnings: '450000.00',
            totalInterest: '350000.00',
            totalPenalties: '50000.00',
            paymentCount: 15,
            totalLoans: 6,
            totalLoanAmount: '8000000.00',
          },
          monthlyPerformance: [
            { month: '2026-01', earnings: '100000.00', interest: '80000.00', penalties: '12000.00', trend: 'stable', changePercent: 0, movingAverage: '100000.00' },
          ],
        },
        isLoading: false,
      },
      executiveDashboard: {
        data: {
          summary: {
            totalActiveLoans: 6,
            portfolioAmount: '8000000.00',
          },
          previousYear: {
            totalInterest: '200000.00',
            paymentCount: 10,
          },
          trends: {
            earningsMovingAverage: '140000.00',
          },
        },
        isLoading: false,
      },
      comprehensiveAnalytics: {
        data: {
          summary: {
            totalEarnings: '450000.00',
            totalInterest: '350000.00',
            totalPenalties: '50000.00',
            paymentCount: 15,
            totalLoans: 6,
            totalLoanAmount: '8000000.00',
          },
          yearOverYear: {
            previousYearEarnings: '300000.00',
            earningsChange: 50,
          },
          monthlyDetails: [
            {
              month: '2026-01',
              totalEarnings: '100000.00',
              totalInterest: '80000.00',
              totalPenalties: '12000.00',
              trend: 'stable',
              changePercent: 0,
              movingAverage: '100000.00',
            },
          ],
        },
        isLoading: false,
      },
      comparativeAnalysis: {
        data: {
          comparison: {
            earnings: { current: '450000.00', previous: '300000.00', changePercent: 50 },
            interest: { current: '350000.00', previous: '200000.00', changePercent: 75 },
            penalties: { current: '50000.00', previous: '25000.00', changePercent: 100 },
            payments: { current: 15, previous: 10, changePercent: 50 },
            loanAmount: { current: '8000000.00', previous: '6000000.00', changePercent: 33.33 },
          },
        },
        isLoading: false,
      },
      forecastAnalysis: {
        data: {
          forecast: {
            nextMonthEarnings: '170000.00',
          },
          analysis: {
            trend: 'up',
            currentMovingAverage: '140000.00',
          },
        },
        isLoading: false,
      },
      nextMonthProjection: {
        data: {
          projection: {
            month: '2026-07',
            projectedEarnings: '170000.00',
            confidenceLevel: 'medium',
            basedOnMonths: 6,
          },
          historicalSummary: {
            averageEarnings: '135000.00',
            lastMonthEarnings: '150000.00',
          },
        },
        isLoading: false,
      },
    };

    renderReports();

    openReportView('Analítica');

    await screen.findByRole('heading', { name: 'Analítica financiera' });
    expect(screen.getByText('Ingresos del año')).toBeInTheDocument();
    expect(screen.getByText('Interés cobrado')).toBeInTheDocument();
    expect(screen.getByText('Mora cobrada')).toBeInTheDocument();
    expect(screen.queryByText('Ganancia total')).not.toBeInTheDocument();
    expect(screen.getByText('Comparativo anual')).toBeInTheDocument();
    expect(screen.getByText('Proyección del siguiente periodo')).toBeInTheDocument();
    expect(screen.getByText('Pagos')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mora' })).toBeInTheDocument();
    expect(screen.getByText('Promedio móvil')).toBeInTheDocument();
  });

  it('switches the projection panel to the selected analytical year forecast when the year is not the current one', async () => {
    financialAnalyticsState = {
      performanceAnalysis: {
        data: {
          summary: {
            totalEarnings: '450000.00',
            totalInterest: '350000.00',
            totalPenalties: '50000.00',
            paymentCount: 15,
            totalLoans: 6,
            totalLoanAmount: '8000000.00',
          },
          monthlyPerformance: [
            { month: '2025-11', earnings: '100000.00', interest: '80000.00', penalties: '0.00', trend: 'stable', changePercent: 0, movingAverage: '100000.00' },
            { month: '2025-12', earnings: '120000.00', interest: '90000.00', penalties: '10000.00', trend: 'up', changePercent: 20, movingAverage: '110000.00' },
          ],
        },
        isLoading: false,
      },
      executiveDashboard: { data: null, isLoading: false },
      comprehensiveAnalytics: {
        data: {
          monthlyDetails: [
            { month: '2025-11', totalEarnings: '100000.00', totalInterest: '80000.00', totalPenalties: '0.00', trend: 'stable', changePercent: 0, movingAverage: '100000.00' },
            { month: '2025-12', totalEarnings: '120000.00', totalInterest: '90000.00', totalPenalties: '10000.00', trend: 'up', changePercent: 20, movingAverage: '110000.00' },
          ],
        },
        isLoading: false,
      },
      comparativeAnalysis: { data: null, isLoading: false },
      forecastAnalysis: {
        data: {
          historicalData: [
            { month: '2025-11', earnings: '100000.00' },
            { month: '2025-12', earnings: '120000.00' },
          ],
          forecast: { nextMonthEarnings: '150000.00' },
          analysis: { trend: 'up', currentMovingAverage: '110000.00' },
        },
        isLoading: false,
      },
      nextMonthProjection: {
        data: {
          projection: {
            month: '2026-07',
            projectedEarnings: '359282.00',
            confidenceLevel: 'medium',
            basedOnMonths: 6,
          },
          historicalSummary: {
            averageEarnings: '95848.00',
            lastMonthEarnings: '454535.00',
          },
        },
        isLoading: false,
      },
    };

    renderReports();

    openReportView('Analítica');

    await screen.findByRole('heading', { name: 'Analítica financiera' });
    expect(screen.getByText('2026-07 · Base histórica de 6 meses')).toBeInTheDocument();
    expect(screen.getAllByText('COP 359.282').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Año analítico'), { target: { value: '2025' } });

    await waitFor(() => {
      expect(screen.getByText('2026-01 · Proyección con la serie del año analítico.')).toBeInTheDocument();
      expect(screen.getAllByText('COP 150.000').length).toBeGreaterThan(0);
    });
  });

  it('exports the analytics tab with the selected analytical year and format', async () => {
    mockExportFinancialAnalyticsReport.mockClear();
    financialAnalyticsState = {
      performanceAnalysis: {
        data: {
          summary: {
            totalEarnings: '450000.00',
            totalInterest: '350000.00',
            totalPenalties: '50000.00',
            paymentCount: 15,
            totalLoans: 6,
            totalLoanAmount: '8000000.00',
          },
          monthlyPerformance: [],
        },
        isLoading: false,
      },
      executiveDashboard: { data: null, isLoading: false },
      comprehensiveAnalytics: { data: { monthlyDetails: [] }, isLoading: false },
      comparativeAnalysis: { data: null, isLoading: false },
      forecastAnalysis: { data: { forecast: { nextMonthEarnings: '150000.00' }, analysis: { trend: 'up' } }, isLoading: false },
      nextMonthProjection: { data: { projection: { month: '2026-07', projectedEarnings: '170000.00', confidenceLevel: 'medium', basedOnMonths: 6 }, historicalSummary: { averageEarnings: '135000.00', lastMonthEarnings: '150000.00' } }, isLoading: false },
    };

    renderReports();

    openReportView('Analítica');
    await screen.findByRole('heading', { name: 'Analítica financiera' });

    fireEvent.change(screen.getByLabelText('Año analítico'), { target: { value: '2025' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));

    expect(screen.getByText('Año analítico: 2025')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar analítica' }));

    await waitFor(() => {
      expect(mockExportFinancialAnalyticsReport).toHaveBeenCalledWith(2025, 'pdf');
    });
  });

  it('exports the dashboard summary using the selected file format', async () => {
    mockExportDashboardSummary.mockClear();

    renderReports();

    openReportView('Dashboard general');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(screen.getByRole('heading', { name: 'Exportar dashboard general' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar dashboard general' }));

    await waitFor(() => {
      expect(mockExportDashboardSummary).toHaveBeenCalledWith('pdf');
    });
  });

  it('shows dashboard export actions only on the dashboard tab', () => {
    renderReports();

    openReportView('Dashboard general');

    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportación contextual' })).toBeInTheDocument();

    openReportView('Cierre contable');

    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportación contextual' })).not.toBeInTheDocument();
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
          summary: {
            totalEarnings: '1000.00',
            totalInterest: '800.00',
            totalPenalties: '50.00',
            paymentCount: 1,
            totalLoans: 1,
            totalLoanAmount: '1000.00',
          },
          monthlyPerformance: [
            { month: '2026-01', earnings: '1000.00', interest: '800.00', penalties: '50.00', trend: 'up', changePercent: 12, movingAverage: '1000.00' },
          ],
        },
        isLoading: false,
      },
      executiveDashboard: { data: null, isLoading: false },
      comprehensiveAnalytics: {
        data: {
          monthlyDetails: [
            { month: '2026-01', totalEarnings: '1000.00', totalInterest: '800.00', totalPenalties: '50.00', trend: 'up', changePercent: 12, movingAverage: '1000.00' },
          ],
        },
        isLoading: false,
      },
      comparativeAnalysis: { data: null, isLoading: false },
      forecastAnalysis: {
        data: {
          forecast: { nextMonthEarnings: '1200.00' },
          analysis: { trend: 'up', currentMovingAverage: '1000.00' },
        },
        isLoading: false,
      },
      nextMonthProjection: {
        data: {
          projection: { month: '2026-02', projectedEarnings: '1200.00', confidenceLevel: 'medium', basedOnMonths: 6 },
          historicalSummary: { averageEarnings: '1000.00', lastMonthEarnings: '1000.00' },
        },
        isLoading: false,
      },
    };

    renderReports();

    openReportView('Dashboard general');

    await waitFor(() => {
      expect(screen.getByTestId('recharts-area-chart')).toHaveAttribute('data-accessibility-layer', 'false');
      expect(screen.getByTestId('recharts-pie-chart')).toHaveAttribute('data-accessibility-layer', 'false');
      expect(screen.getByTestId('recharts-pie')).toHaveAttribute('data-root-tab-index', '-1');
    });

    openReportView('Analítica');

    await waitFor(() => {
      expect(screen.getByTestId('recharts-line-chart')).toHaveAttribute('data-accessibility-layer', 'false');
    });
  });

  it('selects a loan for the payment calendar without requiring a manual loan ID', async () => {
    renderReports();

    openReportView('Calendario de pagos');

    expect(screen.queryByPlaceholderText('Ingrese ID del crédito')).not.toBeInTheDocument();
    const loanSelect = screen.getByLabelText('Crédito');
    expect(loanSelect).toBeInTheDocument();
    fireEvent.focus(loanSelect);
    expect(screen.getByRole('option', { name: /Cliente Operativo .*Número 3 .*Estado Activo/ })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('option', { name: /Número 3\b/ }));

    await waitFor(() => {
      expect(mockUsePaymentSchedule).toHaveBeenLastCalledWith(3);
    });
  });

  it('hides the payment calendar from additional reports for report-only employees without credit view permission', () => {
    currentUser = {
      id: 5,
      name: 'Empleado reportes',
      email: 'employee.reports@test.com',
      role: 'employee',
      permissions: ['REPORTS_VIEW_ALL'],
    };

    renderReports();

    openReportView('Dashboard general');

    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Calendario de pagos' })).not.toBeInTheDocument();
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

    openReportView('Dashboard general');
    expect(screen.getAllByText('En mora').length).toBeGreaterThan(0);
    expect(screen.queryByText('defaulted')).not.toBeInTheDocument();

    openReportView('Calendario de pagos');

    fireEvent.focus(screen.getByLabelText('Crédito'));
    expect(screen.getByRole('option', { name: /Cliente Operativo .*Número 3 .*Estado Activo/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /ACTIVE/ })).not.toBeInTheDocument();
    expect((await screen.findAllByText('Activo')).length).toBeGreaterThan(0);
    expect(screen.queryByText('active')).not.toBeInTheDocument();
  });

  it('renders the installments agenda in reports and opens the selected loan schedule from the row action', async () => {
    renderReports();

    openReportView('Calendario de pagos');

    const agendaSection = screen.getByRole('heading', { name: 'Detalle de cuotas' }).closest('.data-table-surface');
    expect(agendaSection).not.toBeNull();

    expect(screen.getByRole('heading', { name: 'Cuotas próximas y vencidas' })).toBeInTheDocument();
    expect(screen.getByText('Cuotas por gestionar')).toBeInTheDocument();
    expect(screen.getByText('Cliente Historial')).toBeInTheDocument();
    expect(screen.getByText('Cliente Exportación')).toBeInTheDocument();
    expect(screen.getByText('Sin mora')).toBeInTheDocument();
    expect(screen.getByText('8 días de atraso')).toBeInTheDocument();
    expect(within(agendaSection as HTMLElement).getByRole('cell', { name: 'Vencido' })).toBeInTheDocument();

    fireEvent.click(within(agendaSection as HTMLElement).getAllByRole('button', { name: 'Abrir cronograma' })[0]);

    await waitFor(() => {
      expect(mockUsePaymentSchedule).toHaveBeenLastCalledWith(15);
    });
  });

  it('updates the report installments agenda filters through the canonical calendar overview hook', async () => {
    renderReports();

    openReportView('Calendario de pagos');

    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente o crédito' }), {
      target: { value: 'Historial' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Estado de cuota' }), {
      target: { value: 'overdue' },
    });
    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-05-01' },
    });
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-05-31' },
    });

    await waitFor(() => {
      expect(mockUsePaymentCalendarOverview).toHaveBeenLastCalledWith({
        asOfDate: expect.any(String),
        search: 'Historial',
        status: 'overdue',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      }, true);
    });
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
    openReportView('Calendario de pagos');

    const amortizationSection = screen.getByRole('heading', { name: 'Calendario de amortización' }).closest('.data-table-surface');
    expect(amortizationSection).not.toBeNull();

    expect(within(amortizationSection as HTMLElement).getByRole('cell', { name: 'Vencido' })).toBeInTheDocument();
    expect(within(amortizationSection as HTMLElement).getByRole('cell', { name: 'Parcial' })).toBeInTheDocument();
    expect(within(amortizationSection as HTMLElement).getByRole('cell', { name: 'Anulado' })).toBeInTheDocument();
    expect(within(amortizationSection as HTMLElement).queryAllByRole('cell', { name: 'Pendiente' })).toHaveLength(0);
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

    openReportView('Pago de cuotas');

    expect(screen.queryByRole('columnheader', { name: /ID pago/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Crédito ID/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: '#9' })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: '#3' })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Efectivo' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'cash' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
  });

  it('shows installment collections by day, week, and month from the payout report summary', () => {
    payoutsReportState = {
      payouts: [],
      summary: {
        totalPayouts: 2,
        totalAmount: '300.00',
        totalPrincipal: '220.00',
        totalInterest: '80.00',
        totalPenalties: '0.00',
        collectionBreakdown: {
          daily: [{ key: '2026-06-03', label: '2026-06-03', installmentCount: 1, totalAmount: '200.00', totalPrincipal: '150.00', totalInterest: '50.00', totalPenalties: '0.00' }],
          weekly: [{ key: '2026-06-01', label: '2026-06-01 / 2026-06-07', installmentCount: 2, totalAmount: '300.00', totalPrincipal: '220.00', totalInterest: '80.00', totalPenalties: '0.00' }],
          monthly: [{ key: '2026-06', label: '2026-06', installmentCount: 2, totalAmount: '300.00', totalPrincipal: '220.00', totalInterest: '80.00', totalPenalties: '0.00' }],
        },
      },
      pagination: null,
      isLoading: false,
    };

    renderReports();

    openReportView('Pago de cuotas');

    expect(screen.getByText('Recaudo de cuotas')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Cuotas cobradas' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Día' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Semana' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Mes' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2026-06-01 / 2026-06-07' })).toBeInTheDocument();
  });

  it('filters payout report by movement type', async () => {
    renderReports();

    openReportView('Pago de cuotas');
    fireEvent.change(screen.getByLabelText('Tipo de movimiento'), { target: { value: 'capital' } });

    await waitFor(() => {
      expect(mockUsePayoutsReport).toHaveBeenCalledWith({ paymentType: 'capital' }, 1, 20);
    });
  });

  it('filters payout report by payment status', async () => {
    renderReports();

    openReportView('Pago de cuotas');
    fireEvent.change(screen.getByLabelText('Estado de pago'), { target: { value: 'annulled' } });

    await waitFor(() => {
      expect(mockUsePayoutsReport).toHaveBeenCalledWith({ status: 'annulled' }, 1, 20);
    });
  });

  it('filters payout report by employee who registered the payment', async () => {
    renderReports();

    openReportView('Pago de cuotas');
    fireEvent.focus(screen.getByRole('combobox', { name: 'Registrado por' }));
    fireEvent.mouseDown(screen.getByRole('option', { name: /Operador Reportes/ }));

    await waitFor(() => {
      expect(mockUsePayoutsReport).toHaveBeenCalledWith({ employeeId: '7' }, 1, 20);
    });
    fireEvent.focus(screen.getByRole('combobox', { name: 'Registrado por' }));
    expect(screen.queryByRole('option', { name: 'Cliente Registro' })).not.toBeInTheDocument();
  });

  it('keeps payout report date range unchanged when the operator enters an inverted range', async () => {
    renderReports();

    openReportView('Pago de cuotas');
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

    openReportView('Gastos operativos');

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

  it('filters operating expenses by employee who registered the expense', async () => {
    currentUser = {
      id: 1,
      name: 'Admin',
      email: 'admin@test.com',
      role: 'admin',
      permissions: ['*'],
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
        createdBy: { name: 'Operador Reportes' },
      }],
      pagination: {
        totalPages: 1,
        totalItems: 1,
      },
      isLoading: false,
    };
    mockUseOperatingExpenses.mockClear();
    mockExportOperatingExpensesReport.mockClear();

    renderReports();

    openReportView('Gastos operativos');
    fireEvent.focus(screen.getByRole('combobox', { name: 'Registrado por' }));
    fireEvent.mouseDown(screen.getByRole('option', { name: /Operador Reportes/ }));

    await waitFor(() => {
      expect(mockUseOperatingExpenses).toHaveBeenCalledWith({
        employeeId: '7',
      }, 1, 20, true);
    });
    fireEvent.focus(screen.getByRole('combobox', { name: 'Registrado por' }));
    expect(screen.getByRole('option', { name: /Operador Reportes · operador\.reportes@test\.local/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Cliente Registro' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: /Excel/i }));

    await waitFor(() => {
      expect(mockExportOperatingExpensesReport).toHaveBeenCalledWith('xlsx', {
        employeeId: '7',
      });
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
    openReportView('Gastos operativos');

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

    openReportView('Gastos operativos');
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

    openReportView('Gastos operativos');
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

    openReportView('Dashboard general');

    expect(screen.queryByRole('option', { name: 'Gastos operativos' })).not.toBeInTheDocument();
  });

  it('shows the dashboard control indicators from canonical report metrics', async () => {
    renderReports();

    openReportView('Dashboard general');

    expect(screen.getByText('Capital recuperado')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Indicadores de control' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Más indicadores (14)' }));

    expect(await screen.findByRole('dialog', { name: 'Indicadores financieros complementarios' })).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Créditos finalizados')).toBeInTheDocument();
    expect(screen.getAllByText('Créditos en mora').length).toBeGreaterThan(0);
    expect(screen.getByText('Interés pendiente')).toBeInTheDocument();
    expect(screen.getByText('Cuotas pendientes')).toBeInTheDocument();
    expect(screen.getByText('Cuotas vencidas')).toBeInTheDocument();
    expect(screen.getByText('Caja disponible')).toBeInTheDocument();
    expect(screen.getByText('Recaudo menos créditos, socios y gastos')).toBeInTheDocument();
    expect(screen.getByText('Resultado de intereses y mora')).toBeInTheDocument();
    expect(screen.getByText('Intereses y mora menos socios y gastos')).toBeInTheDocument();
    expect(screen.getByText('Pérdida del período')).toBeInTheDocument();
    const normalizedText = document.body.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(normalizedText).toMatch(/(?:1[.,]200|1200)/);
    expect(normalizedText).toMatch(/(?:300)/);
  });

  it('shows complementary dashboard financial indicators from canonical summary data', async () => {
    renderReports();

    openReportView('Dashboard general');
    fireEvent.click(screen.getByRole('button', { name: 'Más indicadores (14)' }));

    expect(await screen.findByRole('dialog', { name: 'Indicadores financieros complementarios' })).toBeInTheDocument();
    expect(screen.getByText('Capital actualmente prestado')).toBeInTheDocument();
    expect(screen.getByText('Saldo pendiente por cobrar')).toBeInTheDocument();
    expect(screen.getByText('Recuperación de créditos')).toBeInTheDocument();
    expect(screen.getByText('Porcentaje de mora')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();
  });

  it('shows clear scope messaging when KPI totals and selected chart range diverge', () => {
    reportsState = {
      ...reportsState,
      dashboardData: {
        metrics: buildDashboardMetrics({
          totalActiveLoans: 2,
          totalDisbursed: 15000,
          totalRecovered: 9000,
          totalInterestGenerated: 3200,
          totalInterestPaid: 1800,
          arrearsRate: 4,
        }),
      },
      monthlyPerformance: Array.from({ length: 14 }, (_, index) => ({
        month: `2025-${String(index + 1).padStart(2, '0')}`,
        disbursed: index === 0 ? 3000 : 0,
        recovered: index === 0 ? 1200 : 0,
      })),
    };

    renderReports();

    openReportView('Dashboard general');
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('Alcance KPI: Totales acumulados históricos de la cartera.') === true)).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('Alcance gráfico: El gráfico refleja únicamente el rango seleccionado. Rango actual del gráfico: Últimos 6 meses.') === true)).toBeInTheDocument();
    expect(screen.getByText('No hay actividad en el rango seleccionado, aunque existen totales históricos.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rango de gráfica'), { target: { value: 'year' } });

    expect(screen.getByText('No hay actividad en el rango seleccionado, aunque existen totales históricos.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rango de gráfica'), { target: { value: 'historical' } });

    expect(screen.queryByText('No hay actividad en el rango seleccionado, aunque existen totales históricos.')).not.toBeInTheDocument();
  });
});
