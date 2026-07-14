import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import Reports from '../Reports';

const mockExportContextualReport = vi.fn().mockResolvedValue(undefined);
const mockExportOutstandingReport = vi.fn().mockResolvedValue(undefined);
const mockExportMonthlyCashFlowExcel = vi.fn().mockResolvedValue(undefined);
const mockExportMonthlyCashFlowPdf = vi.fn().mockResolvedValue(undefined);
const mockExportOperatingExpensesReport = vi.fn().mockResolvedValue(undefined);
const mockExportAssociatesExcel = vi.fn().mockResolvedValue(undefined);
const mockCreateOperatingExpense = vi.fn().mockResolvedValue({});
const mockAnnulOperatingExpense = vi.fn().mockResolvedValue({});
const mockUseMonthlyCashFlow = vi.fn();
const mockUseDailyCashFlow = vi.fn();
const mockUseAnnualCashFlow = vi.fn();
const mockUseCreditHistoryMonthly = vi.fn();
const mockUsePayoutsReport = vi.fn();
const mockUseOperatingExpenses = vi.fn();
const mockUsePaymentCalendarOverview = vi.fn();
const mockUsePaymentSchedule = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

let currentUser = {
  id: 1,
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin' as 'admin' | 'employee' | 'socio' | 'customer',
  permissions: ['*'],
};

let reportsState = {
  overdueLoans: [
    {
      loanId: 18,
      customerId: 7,
      customerName: 'Cliente Exportación',
      daysOverdue: 8,
      overdueAmount: '100000.00',
      remainingCapital: '1800000.00',
    },
  ] as Array<Record<string, unknown>>,
  isLoading: false,
  isError: false,
  error: null,
};

let payoutsReportState = {
  payouts: [
    {
      paymentId: 41,
      loanId: 15,
      customerName: 'Cliente Historial',
      paymentDate: '2026-04-10',
      amount: '120000.00',
      paymentType: 'installment',
      status: 'completed',
      principalApplied: '90000.00',
      interestApplied: '30000.00',
      penaltyApplied: '0.00',
      createdByName: 'Operador Reportes',
    },
  ] as Array<Record<string, unknown>>,
  summary: {
    totalPayments: 1,
    totalAmount: '120000.00',
    totalPrincipal: '90000.00',
    totalInterest: '30000.00',
    totalPenalties: '0.00',
    collections: {
      daily: [{ period: '2026-04-10', installments: 1, amount: '120000.00' }],
      weekly: [],
      monthly: [],
    },
  },
  pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
  isLoading: false,
};

let operatingExpensesState = {
  expenses: [
    {
      id: 3,
      expenseDate: '2026-04-12',
      category: 'Papelería',
      description: 'Recibos',
      amount: '45000.00',
      paymentMethod: 'cash',
      status: 'completed',
      createdByName: 'Operador Reportes',
    },
  ] as Array<Record<string, unknown>>,
  pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
  isLoading: false,
};

let associateMovementsState = {
  data: {
    data: {
      report: {
        summary: { totalMovements: 2, contributions: 1000000, reinvestments: 0, profitabilityPaid: 25000, profitabilityPending: 0 },
        rows: [
          { id: 1, associateId: 4, associateName: 'Socio Reporte', movementType: 'contribution', amount: 1000000, date: '2026-07-01', reference: '' },
          { id: 2, associateId: 4, associateName: 'Socio Reporte', movementType: 'scheduled_profitability_paid', amount: 25000, date: '2026-07-10', reference: 1 },
        ],
      },
    },
  },
  isLoading: false,
  isError: false,
};

const createDefaultPaymentCalendarOverviewState = () => ({
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
    ],
    entries: [],
    nextAction: null,
  },
  isLoading: false,
  isError: false,
});

let paymentCalendarOverviewState = createDefaultPaymentCalendarOverviewState();

const creditHistoryData = {
  summary: {
    creditsCreated: 2,
    installmentsReceived: 4,
    totalPrincipalCreated: '4000000.00',
    totalPaymentsReceived: '2500000.00',
    totalInterestCollected: '350000.00',
    totalOperatingExpenses: '125000.00',
    collectedInterestAndPenalties: '350000.00',
    creditFlowBalance: '-1925000.00',
  },
  months: [
    {
      month: '2026-04',
      creditsCreated: 2,
      createdPrincipal: '4000000.00',
      installmentsReceived: 4,
      paymentsReceived: '2500000.00',
      operatingExpenses: '125000.00',
      collectedInterestAndPenalties: '350000.00',
      lossesAtRisk: '0.00',
      creditFlowBalance: '-1925000.00',
    },
  ],
  credits: [
    {
      creditId: 15,
      customerName: 'Cliente Historial',
      status: 'active',
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
      status: 'overdue',
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
      status: 'completed',
      amount: '120000.00',
      principalApplied: '90000.00',
      interestApplied: '30000.00',
      penaltyApplied: '0.00',
    },
  ],
};

const dailyCashFlowData = {
  summary: {
    totalInflows: '1500000.00',
    totalOutflows: '500000.00',
    totalOperatingExpenses: '100000.00',
    availableCash: '700000.00',
  },
  days: [
    {
      date: '2026-03-15',
      inflows: '1500000.00',
      outflows: '500000.00',
      operatingExpenses: '100000.00',
      netCashFlow: '700000.00',
      availableCash: '700000.00',
    },
  ],
};

const defaultMonthlyCashFlowData = {
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
};

const defaultAnnualCashFlowData = {
  filters: { fromYear: 2024, toYear: 2026 },
  years: [
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
};

let monthlyCashFlowState: { data: any; isLoading: boolean; isError: boolean } = {
  data: defaultMonthlyCashFlowData,
  isLoading: false,
  isError: false,
};

let annualCashFlowState: { data: any; isLoading: boolean; isError: boolean } = {
  data: defaultAnnualCashFlowData,
  isLoading: false,
  isError: false,
};

vi.mock('../../services/reportService', () => ({
  useReports: () => reportsState,
  useMonthlyCashFlow: (...args: unknown[]) => {
    mockUseMonthlyCashFlow(...args);
    return monthlyCashFlowState;
  },
  useDailyCashFlow: (...args: unknown[]) => {
    mockUseDailyCashFlow(...args);
    return { data: dailyCashFlowData, isLoading: false, isError: false };
  },
  useAnnualCashFlow: (...args: unknown[]) => {
    mockUseAnnualCashFlow(...args);
    return annualCashFlowState;
  },
  useCreditHistoryMonthly: (...args: unknown[]) => {
    mockUseCreditHistoryMonthly(...args);
    return { data: creditHistoryData, isLoading: false, isError: false };
  },
  useCreditHistoryFinancialProducts: () => ({
    financialProducts: [
      { id: 'prod-personal', name: 'Crédito personal' },
      { id: 'prod-comercial', name: 'Crédito comercial' },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
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
      actionableEntries: paymentCalendarOverviewState.data.actionableEntries,
      summary: paymentCalendarOverviewState.data.summary,
      nextAction: paymentCalendarOverviewState.data.nextAction,
      entries: paymentCalendarOverviewState.data.entries,
      isLoading: paymentCalendarOverviewState.isLoading,
      isError: paymentCalendarOverviewState.isError,
      refetch: vi.fn(),
    };
  },
  usePaymentSchedule: (...args: unknown[]) => {
    mockUsePaymentSchedule(...args);
    return {
      schedule: [],
      summary: null,
      loan: null,
      isLoading: false,
      refetch: vi.fn(),
    };
  },
  createOperatingExpense: (...args: unknown[]) => mockCreateOperatingExpense(...args),
  annulOperatingExpense: (...args: unknown[]) => mockAnnulOperatingExpense(...args),
  exportContextualReport: (...args: unknown[]) => mockExportContextualReport(...args),
  exportOutstandingReport: (...args: unknown[]) => mockExportOutstandingReport(...args),
  exportMonthlyCashFlowExcel: (...args: unknown[]) => mockExportMonthlyCashFlowExcel(...args),
  exportMonthlyCashFlowPdf: (...args: unknown[]) => mockExportMonthlyCashFlowPdf(...args),
  exportOperatingExpensesReport: (...args: unknown[]) => mockExportOperatingExpensesReport(...args),
}));

vi.mock('../../services/associateService', () => ({
  useAssociateMovements: () => associateMovementsState,
  exportAssociatesExcel: (...args: unknown[]) => mockExportAssociatesExcel(...args),
}));

vi.mock('../../services/loanService', () => ({
  useLoans: () => ({
    data: {
      data: {
        loans: [
          { id: 15, customerName: 'Cliente Historial', amount: 4000000, status: 'active' },
          { id: 18, customerName: 'Cliente Exportación', amount: 2500000, status: 'overdue' },
        ],
      },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../services/customerService', () => ({
  useCustomers: () => ({
    data: {
      data: {
        customers: [
          { id: 7, name: 'Cliente Exportación', documentNumber: 'CC-7', status: 'active' },
          { id: 9, name: 'Cliente Historial', documentNumber: 'CC-9', status: 'active' },
        ],
      },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../services/userService', () => ({
  useUsers: () => ({
    data: {
      data: {
        users: [
          { id: 1, name: 'Admin Reportes', email: 'admin.reportes@test.local', role: 'admin', isActive: true },
          { id: 7, name: 'Operador Reportes', email: 'operador.reportes@test.local', role: 'employee', isActive: true },
        ],
      },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../store/sessionStore', () => ({
  useSessionStore: () => ({ user: currentUser }),
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    apiErrorSafe: vi.fn(),
  },
}));

vi.mock('../../lib/confirmModal', () => ({
  requestInput: vi.fn().mockResolvedValue('Registro duplicado'),
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
    Pie: Mock,
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

const openReportView = (name: string) => {
  fireEvent.click(screen.getByRole('tab', { name }));
};

describe('Reports operational module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = {
      id: 1,
      name: 'Admin',
      email: 'admin@test.com',
      role: 'admin',
      permissions: ['*'],
    };
    reportsState = {
      overdueLoans: [
        {
          loanId: 18,
          customerId: 7,
          customerName: 'Cliente Exportación',
          daysOverdue: 8,
          overdueAmount: '100000.00',
          remainingCapital: '1800000.00',
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    };
    monthlyCashFlowState = {
      data: defaultMonthlyCashFlowData,
      isLoading: false,
      isError: false,
    };
    annualCashFlowState = {
      data: defaultAnnualCashFlowData,
      isLoading: false,
      isError: false,
    };
    payoutsReportState = {
      ...payoutsReportState,
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      isLoading: false,
    };
    operatingExpensesState = {
      ...operatingExpensesState,
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      isLoading: false,
    };
    paymentCalendarOverviewState = createDefaultPaymentCalendarOverviewState();
  });

  it('renders one operational catalog including associates and authorized expenses', () => {
    renderReports();

    expect(screen.getByRole('heading', { name: 'Reportes operativos' })).toBeInTheDocument();
    expect(screen.queryByText('Informes operativos')).not.toBeInTheDocument();
    expect(screen.queryByText('Elige el informe que necesitas')).not.toBeInTheDocument();
    const reportSelector = screen.getByRole('region', { name: 'Secciones de reportes' });
    expect(within(reportSelector).getAllByRole('tab')).toHaveLength(6);
    expect(within(reportSelector).getByRole('tab', { name: 'Cierre contable' })).toHaveAttribute('aria-selected', 'true');
    expect(within(reportSelector).getByRole('tab', { name: 'Créditos del período' })).toBeInTheDocument();
    expect(within(reportSelector).getByRole('tab', { name: 'Pago de cuotas' })).toBeInTheDocument();
    expect(within(reportSelector).getByRole('tab', { name: 'Cartera por cobrar' })).toBeInTheDocument();
    expect(within(reportSelector).getByRole('tab', { name: 'Movimientos de socios' })).toBeInTheDocument();
    expect(within(reportSelector).getByRole('tab', { name: 'Gastos operativos' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Calendario de pagos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Desembolsos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Movimientos operativos' })).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Dashboard general' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Analítica' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rentabilidad de clientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument();
  });

  it('keeps every report focused on one heading, optional filters, and one download action', () => {
    renderReports();

    const reports = [
      { tab: 'Cierre contable', heading: 'Cierre contable', hiddenFilter: 'Año' },
      { tab: 'Créditos del período', heading: 'Créditos del período', hiddenFilter: 'Desde período' },
      { tab: 'Pago de cuotas', heading: 'Pago de cuotas', hiddenFilter: 'Desde pagos' },
      { tab: 'Cartera por cobrar', heading: 'Cartera por cobrar' },
      { tab: 'Movimientos de socios', heading: 'Estado financiero de socios', hiddenFilter: 'Buscar socio' },
      { tab: 'Gastos operativos', heading: 'Control de gastos operativos', hiddenFilter: 'Desde gastos' },
    ];

    for (const report of reports) {
      fireEvent.click(screen.getByRole('tab', { name: report.tab }));

      expect(screen.getAllByRole('heading', { name: report.heading })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Descargar' })).toHaveLength(1);
      expect(screen.queryByRole('button', { name: 'Excel' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'PDF' })).not.toBeInTheDocument();
      if (report.hiddenFilter) {
        expect(screen.getByRole('button', { name: 'Filtros' })).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByLabelText(report.hiddenFilter)).not.toBeInTheDocument();
      }
    }
  });

  it('shows filtered associate movements as operational rows and exports that report', async () => {
    renderReports();
    fireEvent.click(screen.getByRole('tab', { name: 'Movimientos de socios' }));

    expect(screen.getByRole('heading', { name: 'Estado financiero de socios' })).toBeInTheDocument();
    expect(screen.getAllByText('Socio Reporte')).toHaveLength(2);
    expect(screen.getByText('Aporte de capital')).toBeInTheDocument();
    expect(screen.getByText('Interés programado pagado')).toBeInTheDocument();
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excel (xlsx)' }));
    await waitFor(() => expect(mockExportAssociatesExcel).toHaveBeenCalledWith({ format: 'xlsx' }));
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it('identifies payments without a retained creator as historical records', () => {
    payoutsReportState = {
      ...payoutsReportState,
      payouts: [{
        paymentId: 42,
        loanId: 15,
        customerName: 'Cliente Historial',
        paymentDate: '2026-04-10',
        amount: '120000.00',
        paymentType: 'installment',
        paymentMethod: 'cash',
        status: 'completed',
        principalApplied: '90000.00',
      }],
    };

    renderReports();
    fireEvent.click(screen.getByRole('tab', { name: 'Pago de cuotas' }));

    expect(screen.getByText('Registro histórico')).toBeInTheDocument();
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  });

  it('uses cashflow data as the default accounting close report and exports it', async () => {
    renderReports();

    expect(screen.getByRole('heading', { name: 'Cierre contable' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Entradas registradas' })).toBeInTheDocument();
    const cashFlowTable = screen.getByRole('table');
    expect(within(cashFlowTable).getByRole('columnheader', { name: 'Salidas registradas' })).toBeInTheDocument();
    expect(within(cashFlowTable).getAllByText('Socios').length).toBeGreaterThan(0);
    expect(within(cashFlowTable).getAllByText('Aportes').length).toBeGreaterThan(0);
    expect(within(cashFlowTable).getAllByText('Capital devuelto').length).toBeGreaterThan(0);
    expect(within(cashFlowTable).getAllByText('Gastos').length).toBeGreaterThan(0);
    expect(screen.queryByText('Cierre mensual')).not.toBeInTheDocument();
    expect(within(cashFlowTable).getAllByText('Préstamos').length).toBeGreaterThan(0);
    expect(within(cashFlowTable).getByRole('columnheader', { name: 'Caja disponible' })).toBeInTheDocument();
    expect(within(cashFlowTable).queryByRole('columnheader', { name: 'Capital recuperado' })).not.toBeInTheDocument();
    expect(within(cashFlowTable).queryByRole('columnheader', { name: 'Cartera por cobrar' })).not.toBeInTheDocument();
    expect(screen.getByText('Capital recuperado')).toBeInTheDocument();
    expect(screen.getAllByText('Cartera por cobrar').length).toBeGreaterThan(1);
    const monthlyCells = within(cashFlowTable).getByRole('row', { name: /2026-01/ }).querySelectorAll('td');
    expect(monthlyCells[2]).toHaveTextContent('COP 45.000.000');
    expect(screen.queryByText('Recaudo y préstamos')).not.toBeInTheDocument();
    expect(screen.queryByText('Salidas operativas')).not.toBeInTheDocument();
    expect(screen.queryByText('Caja y cartera')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Cierre contable' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Filtros' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Año')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'PDF' })).not.toBeInTheDocument();
    expect(cashFlowTable.querySelector('.report-value-stack__meta-pairs')?.textContent).toContain(' · ');
    expect(within(cashFlowTable).getByRole('columnheader', { name: 'Total' }).closest('tr')?.querySelector('.report-value-stack__meta')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    expect(screen.getByLabelText('Año')).toHaveValue(String(new Date().getFullYear()));

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));

    await waitFor(() => {
      expect(mockExportMonthlyCashFlowExcel).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Object),
      );
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

  it('opens expense management from the report catalog', () => {
    renderReports();

    fireEvent.click(screen.getByRole('tab', { name: 'Gastos operativos' }));

    expect(screen.getByRole('tab', { name: 'Gastos operativos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Control de gastos operativos' })).toBeInTheDocument();
    expect(screen.getAllByText('Registra los gastos del negocio. Puedes anularlos y quedan en el historial.')).toHaveLength(1);
  });

  it('keeps non-zero cashflow table values when rows arrive with total-prefixed fields', () => {
    monthlyCashFlowState = {
      data: {
        ...defaultMonthlyCashFlowData,
        months: [
          {
            month: '2026-01',
            totalInflows: '50000000.00',
            totalDisbursements: '40000000.00',
            totalAssociatePayments: '3000000.00',
            totalOperatingExpenses: '2000000.00',
            availableCash: '5000000.00',
            portfolioReceivable: '12500000.00',
            totalPrincipalRecovered: '37500000.00',
            totalCollectedProfit: '5000000.00',
            lossesAtRisk: '1000000.00',
          },
        ],
      },
      isLoading: false,
      isError: false,
    };
    annualCashFlowState = {
      data: {
        ...defaultAnnualCashFlowData,
        years: [
          {
            year: '2026',
            totalInflows: '50000000.00',
            totalDisbursements: '40000000.00',
            totalAssociatePayments: '3000000.00',
            totalOperatingExpenses: '2000000.00',
            availableCash: '5000000.00',
            portfolioReceivable: '8500000.00',
            totalPrincipalRecovered: '21500000.00',
            totalCollectedProfit: '5000000.00',
            lossesAtRisk: '1000000.00',
          },
        ],
      },
      isLoading: false,
      isError: false,
    };

    renderReports();

    expect(screen.getAllByText('COP 50.000.000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('COP 40.000.000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('COP 45.000.000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('COP 12.500.000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('COP 37.500.000').length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Más indicadores/ })).not.toBeInTheDocument();
  });

  it('keeps cashflow focused on a single monthly close without an annual subview', () => {
    renderReports();

    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.queryByText('Comparativo anual de caja')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver comparativo anual' })).not.toBeInTheDocument();
  });

  it('hides idle cashflow months by default without adding another subview toggle', () => {
    monthlyCashFlowState = {
      data: {
        ...defaultMonthlyCashFlowData,
        months: [
          {
            month: '2026-01',
            inflows: '0.00',
            outflows: '0.00',
            associatePayments: '0.00',
            operatingExpenses: '0.00',
            netCashFlow: '0.00',
            availableCash: '0.00',
            portfolioReceivable: '0.00',
            principalRecovered: '0.00',
            collectedProfit: '0.00',
            lossesAtRisk: '0.00',
          },
          {
            month: '2026-02',
            inflows: '0.00',
            outflows: '0.00',
            associatePayments: '0.00',
            operatingExpenses: '0.00',
            netCashFlow: '0.00',
            availableCash: '0.00',
            portfolioReceivable: '0.00',
            principalRecovered: '0.00',
            collectedProfit: '0.00',
            lossesAtRisk: '0.00',
          },
          {
            month: '2026-06',
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

    renderReports();

    expect(screen.queryByText('2026-01')).not.toBeInTheDocument();
    expect(screen.getByText('2026-06')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver 2 meses sin movimiento' })).not.toBeInTheDocument();
  });

  it('keeps the reports module usable when the outstanding report fails', () => {
    reportsState = {
      ...reportsState,
      overdueLoans: [],
      isError: true,
      error: new Error('outstanding unavailable') as any,
    };

    renderReports();

    expect(screen.getByRole('heading', { name: 'Cierre contable' })).toBeInTheDocument();

    openReportView('Cartera por cobrar');

    expect(screen.getByText('No se pudo cargar este reporte. Los demás informes siguen disponibles.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Créditos del período' })).toBeInTheDocument();
  });

  it('describes an empty receivable portfolio without implying that only overdue loans are included', () => {
    reportsState = {
      ...reportsState,
      overdueLoans: [],
      isLoading: false,
      isError: false,
      error: null,
    };

    renderReports();
    openReportView('Cartera por cobrar');

    expect(screen.getByText('No hay créditos con saldo por cobrar.')).toBeInTheDocument();
    expect(screen.queryByText('No hay créditos en mora.')).not.toBeInTheDocument();
  });

  it('summarizes the receivable portfolio before the overdue table', () => {
    reportsState = {
      ...reportsState,
      overdueLoans: [
        {
          loanId: 18,
          customerId: 7,
          customerName: 'Cliente Exportación',
          daysOverdue: 8,
          overdueAmount: '100000.00',
          remainingCapital: '1800000.00',
        },
        {
          loanId: 24,
          customerId: 9,
          customerName: 'Cliente Mora Alta',
          daysOverdue: 15,
          overdueAmount: '250000.00',
          remainingCapital: '2200000.00',
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    };

    renderReports();
    openReportView('Cartera por cobrar');

    expect(screen.getByText('Créditos en mora')).toBeInTheDocument();
    expect(screen.getByText('Mayor atraso')).toBeInTheDocument();
    expect(screen.getByText('Saldo vencido')).toBeInTheDocument();
    expect(screen.getByText('COP 350.000')).toBeInTheDocument();
    expect(screen.getAllByText('Capital pendiente').length).toBeGreaterThan(0);
    expect(screen.getByText('COP 4.000.000')).toBeInTheDocument();
    const reportPanel = screen.getAllByRole('heading', { name: 'Cartera por cobrar' }).at(-1)?.closest('.report-tab-panel');
    expect(reportPanel).not.toHaveTextContent('Créditos en mora');
  });

  it('exports the receivable portfolio to Excel and PDF', async () => {
    reportsState = {
      ...reportsState,
      overdueLoans: [
        {
          loanId: 18,
          customerId: 7,
          customerName: 'Cliente Exportación',
          daysOverdue: 8,
          overdueAmount: '100000.00',
          remainingCapital: '1800000.00',
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    };

    renderReports();
    openReportView('Cartera por cobrar');

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excel (xlsx)' }));
    await waitFor(() => {
      expect(mockExportOutstandingReport).toHaveBeenCalledWith('xlsx');
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    await waitFor(() => {
      expect(mockExportOutstandingReport).toHaveBeenCalledWith('pdf');
    });
  });

  it('uses balance-oriented labels when the receivable portfolio has no visible delay yet', () => {
    reportsState = {
      ...reportsState,
      overdueLoans: [
        {
          loanId: 18,
          customerId: 7,
          customerName: '',
          daysOverdue: 0,
          overdueAmount: '1680982.00',
          remainingCapital: '1680982.00',
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    };

    renderReports();
    openReportView('Cartera por cobrar');

    expect(screen.getByText('Créditos con saldo')).toBeInTheDocument();
    expect(screen.queryByText('Créditos en mora')).not.toBeInTheDocument();
    expect(screen.getAllByText('Saldo por cobrar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('COP 1.680.982').length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: 'Estado del atraso' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Saldo por cobrar' })).toBeInTheDocument();
    expect(screen.getByText('Cliente #7')).toBeInTheDocument();
    expect(screen.getByText('Al día')).toHaveClass('text-emerald-700');
    expect(screen.getAllByText('COP 1.680.982')).toEqual(
      expect.arrayContaining([expect.objectContaining({ className: expect.stringContaining('text-text-primary') })]),
    );
  });

  it('filters credit history and exports with the visible filters', async () => {
    renderReports();
    openReportView('Créditos del período');

    expect(screen.getByText('Créditos y capital prestado en el rango seleccionado.')).toBeInTheDocument();
    expect(screen.queryByText(/pagos recibidos y flujo acumulado/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.change(screen.getByLabelText('Desde período'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('Hasta período'), { target: { value: '2026-04-30' } });
    fireEvent.change(screen.getByLabelText('Estado del crédito'), { target: { value: 'active' } });

    await waitFor(() => {
      expect(mockUseCreditHistoryMonthly).toHaveBeenCalledWith(expect.objectContaining({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        status: 'active',
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    expect(screen.getByText('Exporta capital prestado, pagos recibidos y flujo acumulado con los filtros actuales.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Excel (xlsx)' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('credits', expect.objectContaining({
        fromDate: '2026-04-01',
        toDate: '2026-04-30',
        status: 'active',
        format: 'xlsx',
      }));
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

  it('shows a single credit-history table to avoid duplicated views', () => {
    renderReports();
    openReportView('Créditos del período');

    expect(screen.queryByLabelText('Detalle')).not.toBeInTheDocument();
    expect(screen.getByText('Detalle de créditos')).toBeInTheDocument();
    expect(screen.queryByText('Historial de recaudo')).not.toBeInTheDocument();
    expect(screen.queryByText('Créditos consultados por mes')).not.toBeInTheDocument();
  });

  it('keeps retired repeated reports out while retaining canonical expenses', () => {
    renderReports();

    expect(screen.queryByRole('tab', { name: 'Desembolsos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Movimientos operativos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Calendario de pagos' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Gastos operativos' })).toBeInTheDocument();
  });

  it('shows installment payments as a primary report and exports visible filters', async () => {
    renderReports();
    openReportView('Pago de cuotas');

    expect(screen.getByRole('heading', { name: 'Pago de cuotas' })).toBeInTheDocument();
    expect(screen.getByText('Total pagos')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Cliente Historial')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.change(screen.getByLabelText('Desde pagos'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('Hasta pagos'), { target: { value: '2026-04-30' } });
    fireEvent.change(screen.getByLabelText('Tipo de movimiento'), { target: { value: 'installment' } });

    await waitFor(() => {
      expect(mockUsePayoutsReport).toHaveBeenCalledWith(expect.objectContaining({
        fromDate: '2026-04-01',
        toDate: '2026-04-30',
        paymentType: 'installment',
      }), expect.any(Number), expect.any(Number));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excel (xlsx)' }));

    await waitFor(() => {
      expect(mockExportContextualReport).toHaveBeenCalledWith('payouts', expect.objectContaining({
        fromDate: '2026-04-01',
        toDate: '2026-04-30',
        paymentType: 'installment',
      }));
    });
  });

  it('hides finance-only expense tools from employees without finance permission', () => {
    currentUser = {
      id: 2,
      name: 'Operador',
      email: 'employee@test.com',
      role: 'employee',
      permissions: ['CREDITS_VIEW_ALL'],
    };

    renderReports();

    const reportSelector = screen.getByRole('region', { name: 'Secciones de reportes' });
    expect(within(reportSelector).queryByRole('tab', { name: 'Gastos operativos' })).not.toBeInTheDocument();
    expect(within(reportSelector).getAllByRole('tab')).toHaveLength(5);
    expect(screen.queryByRole('tab', { name: 'Calendario de pagos' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pago de cuotas' })).toBeInTheDocument();
  });
});
