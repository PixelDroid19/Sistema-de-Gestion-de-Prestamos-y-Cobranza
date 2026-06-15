import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  useReports,
  usePayoutsReport,
  usePaymentCalendarOverview,
  usePaymentSchedule,
  exportDashboardSummary,
  exportFinancialAnalyticsReport,
  exportContextualReport,
  useFinancialAnalytics,
  useMonthlyCashFlow,
  useDailyCashFlow,
  useAnnualCashFlow,
  useCreditHistoryMonthly,
  useCreditHistoryFinancialProducts,
  useCustomerProfitability,
  exportMonthlyCashFlowExcel,
  exportMonthlyCashFlowPdf,
  useOperatingExpenses,
  createOperatingExpense,
  annulOperatingExpense,
  exportOperatingExpensesReport,
  type OperatingExpense,
  type OperatingExpenseExportFormat,
  type OperatingExpensePayload,
} from '../services/reportService';
import { formatCurrency as formatCurrencyValue } from '../i18n/format';
import { getSafeErrorText } from '../services/safeErrorMessages';
import { tTerm } from '../i18n/terminology';
import { getLocalDateInputValue } from '../lib/dateInput';
import { buildReportYearDateRange } from '../lib/reportYearInput';
import { useSessionStore } from '../store/sessionStore';
import { useResolvedPermissionNames } from '../services/permissionsService';
import { useOperationalActions } from './hooks/useOperationalActions';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import { resolveOperationalGuard } from '../services/operationalGuards';
import { PERMISSION } from '../constants/permissionNames';
import { requestInput } from '../lib/confirmModal';
import { toast } from '../lib/toast';
import {
  ActionButton,
  EmptyState,
  PageHeader,
  PageShell,
} from './shared/Surfaces';
import ReportsNavigation, { type ReportGroup } from './reports/ReportsNavigation';
import DashboardTab from './reports/DashboardTab';
import AnalyticsTab from './reports/AnalyticsTab';
import CashflowTab from './reports/CashflowTab';
import CreditHistoryMonthlyTab from './reports/CreditHistoryMonthlyTab';
import ProfitabilityTab from './reports/ProfitabilityTab';
import PayoutsTab from './reports/PayoutsTab';
import ScheduleTab from './reports/ScheduleTab';
import OperatingExpensesTab from './reports/OperatingExpensesTab';
import ReportsContextualExportModal from './reports/ReportsContextualExportModal';
import ReportTabExportButton from './reports/ReportTabExportButton';
import ReportsTabContent from './reports/ReportsTabContent';
import { ReportTabPanel } from './reports/ReportTabPanel';
import { ReportDataTableSection } from './reports/ReportDataTableSection';
import {
  buildCreditHistoryExportSummary,
  buildAnalyticsExportSummary,
  buildPayoutExportSummary,
} from './reports/reportExportSummary';
import {
  buildContextualExportParams,
  hasInvalidExportRange,
  parseOptionalPositiveId,
} from './reports/reportsExportHelpers';

const formatMoney = (value: unknown) => formatCurrencyValue(value);

export default function Reports() {
  const queryClient = useQueryClient();
  const { executeGuardedAction } = useOperationalActions(queryClient);
  const { user } = useSessionStore();
  const resolvedPermissions = useResolvedPermissionNames(user);
  const permissionSet = useMemo(
    () => new Set(resolvedPermissions.map((permission) => permission.toUpperCase())),
    [resolvedPermissions],
  );
  const canAccessPermission = (permission: string) => (
    user?.role === 'admin' || permissionSet.has('*') || permissionSet.has(permission)
  );
  const canViewPaymentScheduleTab = canAccessPermission(PERMISSION.CREDITS_VIEW_ALL);
  const canViewOperatingExpensesTab = canAccessPermission(PERMISSION.FINANCE_VIEW_ALL);
  const canCreateOperatingExpenses = canAccessPermission(PERMISSION.FINANCE_CREATE);
  const canAnnulOperatingExpenses = canAccessPermission(PERMISSION.FINANCE_ANNUL);
  const {
    dashboardData,
    monthlyPerformance,
    statusBreakdown,
    overdueLoans,
    isLoading: isReportsLoading,
    isError,
    error,
  } = useReports();

  // Payouts report state
  const [payoutFilters, setPayoutFilters] = useState<{ fromDate?: string; toDate?: string; paymentType?: string; status?: string; employeeId?: string }>({});
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutPageSize, setPayoutPageSize] = useState(20);
  const { payouts, summary: payoutSummary, pagination: payoutPagination, isLoading: isPayoutsLoading } = usePayoutsReport(payoutFilters, payoutPage, payoutPageSize);
  const canFilterPayoutsByEmployee = user?.role === 'admin';
  const canFilterExpensesByEmployee = user?.role === 'admin' && canViewOperatingExpensesTab;

  const [expenseFilters, setExpenseFilters] = useState<{ fromDate?: string; toDate?: string; status?: string; employeeId?: string }>({});
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize] = useState(20);
  const {
    expenses,
    pagination: expensePagination,
    isLoading: isExpensesLoading,
  } = useOperatingExpenses(expenseFilters, expensePage, expensePageSize, canViewOperatingExpensesTab);
  const [isCreatingExpense, setIsCreatingExpense] = useState(false);
  const [annullingExpenseId, setAnnullingExpenseId] = useState<number | null>(null);
  const [exportingExpensesFormat, setExportingExpensesFormat] = useState<OperatingExpenseExportFormat | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'cashflow' | 'creditHistory' | 'outstanding' | 'profitability' | 'payouts' | 'schedule' | 'expenses'>('dashboard');

  // Payment schedule state
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const calendarAsOfDate = useMemo(() => getLocalDateInputValue(), []);
  const [scheduleAgendaFilters, setScheduleAgendaFilters] = useState({
    search: '',
    status: '',
    startDate: '',
    endDate: '',
  });
  const updateScheduleAgendaFilters = (
    patch: Partial<typeof scheduleAgendaFilters>,
  ) => {
    setScheduleAgendaFilters((current) => {
      const next = { ...current, ...patch };
      if (next.startDate && next.endDate && next.startDate > next.endDate) {
        return current;
      }
      return next;
    });
  };
  const scheduleAgendaQueryFilters = useMemo(() => ({
    asOfDate: calendarAsOfDate,
    ...(scheduleAgendaFilters.search ? { search: scheduleAgendaFilters.search } : {}),
    ...(scheduleAgendaFilters.status ? { status: scheduleAgendaFilters.status } : {}),
    ...(scheduleAgendaFilters.startDate ? { startDate: scheduleAgendaFilters.startDate } : {}),
    ...(scheduleAgendaFilters.endDate ? { endDate: scheduleAgendaFilters.endDate } : {}),
  }), [calendarAsOfDate, scheduleAgendaFilters]);
  const {
    actionableEntries: scheduleAgenda,
    summary: scheduleAgendaSummary,
    isLoading: isScheduleAgendaLoading,
    isError: isScheduleAgendaError,
    refetch: refetchScheduleAgenda,
  } = usePaymentCalendarOverview(
    scheduleAgendaQueryFilters,
    activeTab === 'schedule' && canViewPaymentScheduleTab,
  );
  const {
    schedule,
    summary: scheduleSummary,
    loan: scheduleLoan,
    isLoading: isScheduleLoading,
    refetch: refetchSchedule,
  } = usePaymentSchedule(selectedLoanId);

  const [isExporting, setIsExporting] = useState(false);
  const [dashboardExportFormat, setDashboardExportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [isAnalyticsExporting, setIsAnalyticsExporting] = useState(false);
  const [analyticsExportFormat, setAnalyticsExportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [analyticsYear, setAnalyticsYear] = useState<number>(new Date().getFullYear());
  const [profitabilityDateRange, setProfitabilityDateRange] = useState<{ fromDate: string; toDate: string }>(() => (
    buildReportYearDateRange(new Date().getFullYear())
  ));
  const [profitabilityPage, setProfitabilityPage] = useState(1);
  const [profitabilityPageSize, setProfitabilityPageSize] = useState(10);
  const {
    items: profitabilityItems,
    customerAnalytics,
    pagination: profitabilityPagination,
  } = useCustomerProfitability({
    ...profitabilityDateRange,
    page: profitabilityPage,
    pageSize: profitabilityPageSize,
  });
  const [cashFlowYear, setCashFlowYear] = useState<number>(new Date().getFullYear());
  const [cashFlowRange, setCashFlowRange] = useState<{ fromDate: string; toDate: string }>({ fromDate: '', toDate: '' });
  const [dailyCashFlowDate, setDailyCashFlowDate] = useState<string>(() => getLocalDateInputValue());
  const [creditHistoryFilters, setCreditHistoryFilters] = useState<{
    startDate: string;
    endDate: string;
    status: string;
    customerId: string;
    loanId: string;
    financialProductId: string;
  }>({
    startDate: '',
    endDate: '',
    status: '',
    customerId: '',
    loanId: '',
    financialProductId: '',
  });
  const [isCashFlowExporting, setIsCashFlowExporting] = useState<'excel' | 'pdf' | null>(null);
  const [reportType, setReportType] = useState<'credits' | 'payouts' | 'profitability'>('credits');
  const [reportRange, setReportRange] = useState<{ fromDate: string; toDate: string }>({ fromDate: '', toDate: '' });
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('');
  const [reportPaymentTypeFilter, setReportPaymentTypeFilter] = useState<string>('');
  const [reportEmployeeIdFilter, setReportEmployeeIdFilter] = useState<string>('');
  const [reportCustomerIdFilter, setReportCustomerIdFilter] = useState<string>('');
  const [reportLoanIdFilter, setReportLoanIdFilter] = useState<string>('');
  const [reportFinancialProductIdFilter, setReportFinancialProductIdFilter] = useState<string>('');
  const [reportFormat, setReportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [contextualExportOpen, setContextualExportOpen] = useState(false);
  const {
    performanceAnalysis,
    executiveDashboard,
    comprehensiveAnalytics,
    comparativeAnalysis,
    forecastAnalysis,
    nextMonthProjection,
  } = useFinancialAnalytics(analyticsYear);
  const cashFlowFilters = useMemo(() => ({
    ...(cashFlowRange.fromDate ? { fromDate: cashFlowRange.fromDate } : {}),
    ...(cashFlowRange.toDate ? { toDate: cashFlowRange.toDate } : {}),
  }), [cashFlowRange]);
  const { data: cashFlowData, isLoading: isCashFlowLoading } = useMonthlyCashFlow(cashFlowYear, cashFlowFilters);
  const annualCashFlowFilters = useMemo(() => ({
    fromYear: cashFlowYear - 2,
    toYear: cashFlowYear,
  }), [cashFlowYear]);
  const { data: annualCashFlowData, isLoading: isAnnualCashFlowLoading } = useAnnualCashFlow(annualCashFlowFilters);
  const dailyCashFlowFilters = useMemo(() => ({
    ...(dailyCashFlowDate ? { date: dailyCashFlowDate } : {}),
  }), [dailyCashFlowDate]);
  const { data: dailyCashFlowData, isLoading: isDailyCashFlowLoading } = useDailyCashFlow(dailyCashFlowFilters);
  const creditHistoryQueryFilters = useMemo(() => ({
    ...(creditHistoryFilters.startDate ? { startDate: creditHistoryFilters.startDate } : {}),
    ...(creditHistoryFilters.endDate ? { endDate: creditHistoryFilters.endDate } : {}),
    ...(creditHistoryFilters.status ? { status: creditHistoryFilters.status } : {}),
    ...(/^\d+$/.test(creditHistoryFilters.customerId.trim()) ? { customerId: Number(creditHistoryFilters.customerId) } : {}),
    ...(/^\d+$/.test(creditHistoryFilters.loanId.trim()) ? { loanId: Number(creditHistoryFilters.loanId) } : {}),
    ...(creditHistoryFilters.financialProductId ? { financialProductId: creditHistoryFilters.financialProductId } : {}),
  }), [creditHistoryFilters]);
  const { data: creditHistoryData, isLoading: isCreditHistoryLoading } = useCreditHistoryMonthly(creditHistoryQueryFilters);
  const { financialProducts: creditHistoryFinancialProducts } = useCreditHistoryFinancialProducts();

  const metrics = dashboardData?.metrics || {
    totalActiveLoans: 0, totalDisbursed: 0, totalRecovered: 0,
    totalInterestGenerated: 0, totalInterestPaid: 0, arrearsRate: 0,
  };
  const monthlyData = monthlyPerformance ?? [];
  const statusData = statusBreakdown ?? [];
  const profitabilityData = profitabilityItems;
  const isLoading = isReportsLoading;
  const creditHistoryFinancialProductOptions = useMemo(
    () => creditHistoryFinancialProducts.map((product) => ({ value: product.id, label: product.name })),
    [creditHistoryFinancialProducts],
  );
  const activeCreditHistoryFinancialProductLabel = useMemo(
    () => creditHistoryFinancialProductOptions.find((product) => product.value === creditHistoryFilters.financialProductId)?.label || '',
    [creditHistoryFilters.financialProductId, creditHistoryFinancialProductOptions],
  );

  const updateProfitabilityDateRange = (key: 'fromDate' | 'toDate', value: string) => {
    if (key === 'fromDate' && value && profitabilityDateRange.toDate && value > profitabilityDateRange.toDate) {
      return;
    }
    if (key === 'toDate' && value && profitabilityDateRange.fromDate && value < profitabilityDateRange.fromDate) {
      return;
    }

    setProfitabilityDateRange((prev) => ({ ...prev, [key]: value }));
    setProfitabilityPage(1);
  };

  // ─── Export handlers ──────────────────────────────────────────────────────

  const reportExportGuard = resolveOperationalGuard('credit.report.download', {
    role: user?.role, permissions: resolvedPermissions,
  });

  const updateReportRange = (key: 'fromDate' | 'toDate', value: string) => {
    if (key === 'fromDate' && value && reportRange.toDate && value > reportRange.toDate) {
      return;
    }
    if (key === 'toDate' && value && reportRange.fromDate && value < reportRange.fromDate) {
      return;
    }

    setReportRange((prev) => ({ ...prev, [key]: value }));
  };

  const hasInvalidRange = Boolean(
    reportRange.fromDate && reportRange.toDate && reportRange.fromDate > reportRange.toDate,
  );
  const reportSupportsCustomerLoanFilters = reportType === 'credits' || reportType === 'payouts';
  const normalizedReportCustomerId = reportCustomerIdFilter.trim();
  const normalizedReportLoanId = reportLoanIdFilter.trim();
  const hasInvalidReportCustomerId = reportSupportsCustomerLoanFilters
    && normalizedReportCustomerId.length > 0
    && !/^[1-9]\d*$/.test(normalizedReportCustomerId);
  const hasInvalidReportLoanId = reportSupportsCustomerLoanFilters
    && normalizedReportLoanId.length > 0
    && !/^[1-9]\d*$/.test(normalizedReportLoanId);
  const reportCustomerId = reportSupportsCustomerLoanFilters
    && normalizedReportCustomerId.length > 0
    && !hasInvalidReportCustomerId
    ? Number(normalizedReportCustomerId)
    : undefined;
  const reportLoanId = reportSupportsCustomerLoanFilters
    && normalizedReportLoanId.length > 0
    && !hasInvalidReportLoanId
    ? Number(normalizedReportLoanId)
    : undefined;

  const handleExportReport = async (): Promise<boolean> => {
    setIsExporting(true);
    const success = await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: resolvedPermissions },
      run: async () => { await exportDashboardSummary(dashboardExportFormat); },
      successMessage: dashboardExportFormat === 'pdf'
        ? tTerm('reports.toast.dashboard.pdf')
        : tTerm('reports.toast.dashboard.excel'),
    });
    setIsExporting(false);
    return success;
  };

  const handleExportAnalytics = async (): Promise<boolean> => {
    setIsAnalyticsExporting(true);
    const success = await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: resolvedPermissions },
      run: async () => { await exportFinancialAnalyticsReport(analyticsYear, analyticsExportFormat); },
      successMessage: analyticsExportFormat === 'pdf'
        ? tTerm('reports.toast.analytics.pdf')
        : tTerm('reports.toast.analytics.excel'),
    });
    setIsAnalyticsExporting(false);
    return success;
  };

  const contextualExportSuccessMessage = (type: typeof reportType) => (
    type === 'credits'
      ? tTerm('reports.toast.contextual.credits')
      : type === 'profitability'
        ? tTerm('reports.toast.contextual.profitability')
        : tTerm('reports.toast.contextual.payouts')
  );

  const runContextualExport = async (
    type: typeof reportType,
    params: ReturnType<typeof buildContextualExportParams>,
  ): Promise<boolean> => {
    setIsExporting(true);
    const success = await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: resolvedPermissions },
      run: async () => { await exportContextualReport(type, params); },
      successMessage: contextualExportSuccessMessage(type),
    });
    setIsExporting(false);
    return success;
  };

  const handleExportContextualReport = async (): Promise<boolean> => {
    if (hasInvalidExportRange(reportRange.fromDate, reportRange.toDate)
      || hasInvalidReportCustomerId
      || hasInvalidReportLoanId) {
      return false;
    }

    return runContextualExport(
      reportType,
      buildContextualExportParams(reportType, {
        fromDate: reportRange.fromDate,
        toDate: reportRange.toDate,
        status: reportStatusFilter,
        format: reportFormat,
        paymentType: reportPaymentTypeFilter,
        employeeId: reportType === 'payouts' ? reportEmployeeIdFilter || undefined : undefined,
        customerId: reportCustomerId,
        loanId: reportLoanId,
        financialProductId: reportType === 'credits' ? reportFinancialProductIdFilter || undefined : undefined,
      }),
    );
  };

  const creditHistoryExportBlocked = hasInvalidExportRange(
    creditHistoryFilters.startDate,
    creditHistoryFilters.endDate,
  ) || !reportExportGuard.executable;

  const handleExportCreditHistory = async (): Promise<boolean> => {
    if (creditHistoryExportBlocked) {
      return false;
    }

    return runContextualExport(
      'credits',
      buildContextualExportParams('credits', {
        fromDate: creditHistoryFilters.startDate,
        toDate: creditHistoryFilters.endDate,
        status: creditHistoryFilters.status,
        format: reportFormat,
        customerId: parseOptionalPositiveId(creditHistoryFilters.customerId),
        loanId: parseOptionalPositiveId(creditHistoryFilters.loanId),
        financialProductId: creditHistoryFilters.financialProductId || undefined,
      }),
    );
  };

  const payoutExportBlocked = hasInvalidExportRange(
    payoutFilters.fromDate || '',
    payoutFilters.toDate || '',
  ) || !reportExportGuard.executable;

  const handleExportPayouts = async (): Promise<boolean> => {
    if (payoutExportBlocked) {
      return false;
    }

    return runContextualExport(
      'payouts',
      buildContextualExportParams('payouts', {
        fromDate: payoutFilters.fromDate,
        toDate: payoutFilters.toDate,
        status: payoutFilters.status,
        format: reportFormat,
        paymentType: payoutFilters.paymentType,
        employeeId: payoutFilters.employeeId,
      }),
    );
  };

  const profitabilityExportBlocked = hasInvalidExportRange(
    profitabilityDateRange.fromDate,
    profitabilityDateRange.toDate,
  ) || !reportExportGuard.executable;

  const handleExportProfitability = async (): Promise<boolean> => {
    if (profitabilityExportBlocked) {
      return false;
    }

    return runContextualExport(
      'profitability',
      buildContextualExportParams('profitability', {
        fromDate: profitabilityDateRange.fromDate,
        toDate: profitabilityDateRange.toDate,
        format: reportFormat,
      }),
    );
  };

  const handleReportsTabChange = (tabId: string) => {
    setActiveTab(tabId as typeof activeTab);
  };

  const handleExportCashFlow = async (format: 'excel' | 'pdf'): Promise<boolean> => {
    setIsCashFlowExporting(format);
    const success = await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: resolvedPermissions },
      run: async () => {
        if (format === 'excel') { await exportMonthlyCashFlowExcel(cashFlowYear, cashFlowFilters); return; }
        await exportMonthlyCashFlowPdf(cashFlowYear, cashFlowFilters);
      },
      successMessage: format === 'excel' ? tTerm('reports.toast.cashflow.excel') : tTerm('reports.toast.cashflow.pdf'),
    });
    setIsCashFlowExporting(null);
    return success;
  };

  const invalidateFinancialViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.operatingExpenses.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
    ]);
  };

  const handleCreateOperatingExpense = async (payload: OperatingExpensePayload) => {
    setIsCreatingExpense(true);
    try {
      await createOperatingExpense(payload);
      await invalidateFinancialViews();
      toast.success({ description: tTerm('reports.expenses.toast.created') });
    } catch (mutationError) {
      toast.apiErrorSafe(mutationError, { domain: 'reports', action: 'generic' });
      throw mutationError;
    } finally {
      setIsCreatingExpense(false);
    }
  };

  const handleAnnulOperatingExpense = async (expense: OperatingExpense) => {
    const reason = await requestInput({
      title: tTerm('reports.expenses.prompt.annul.title'),
      message: tTerm('reports.expenses.prompt.annul.message'),
      label: tTerm('reports.expenses.prompt.annul.label'),
      placeholder: tTerm('reports.expenses.prompt.annul.placeholder'),
      confirmLabel: tTerm('reports.expenses.cta.annul'),
      confirmVariant: 'danger',
    });

    const normalizedReason = String(reason || '').trim();
    if (!normalizedReason) {
      if (reason !== null) {
        toast.error({ description: tTerm('reports.expenses.error.reasonRequired') });
      }
      return;
    }

    setAnnullingExpenseId(expense.id);
    try {
      await annulOperatingExpense(expense.id, normalizedReason);
      await invalidateFinancialViews();
      toast.success({ description: tTerm('reports.expenses.toast.annulled') });
    } catch (mutationError) {
      toast.apiErrorSafe(mutationError, { domain: 'reports', action: 'generic' });
    } finally {
      setAnnullingExpenseId(null);
    }
  };

  const handleExportOperatingExpenses = async (format: OperatingExpenseExportFormat): Promise<boolean> => {
    setExportingExpensesFormat(format);
    const success = await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: resolvedPermissions },
      run: async () => { await exportOperatingExpensesReport(format, expenseFilters); },
      successMessage: format === 'pdf'
        ? tTerm('reports.expenses.toast.exportPdf')
        : tTerm('reports.expenses.toast.exportExcel'),
    });
    setExportingExpensesFormat(null);
    return success;
  };

  const reportGroups = useMemo<ReportGroup[]>(() => [
    {
      id: 'overview',
      label: tTerm('reports.group.overview'),
      title: tTerm('reports.group.overview.title'),
      leaves: [
        { id: 'dashboard', label: tTerm('reports.tab.dashboard') },
      ],
    },
    {
      id: 'performance',
      label: tTerm('reports.group.performance'),
      title: tTerm('reports.group.performance.title'),
      leaves: [
        { id: 'analytics', label: tTerm('reports.tab.analytics'), title: tTerm('reports.tab.analytics.title') },
        { id: 'profitability', label: tTerm('reports.tab.profitability') },
      ],
    },
    {
      id: 'cashflow',
      label: tTerm('reports.tab.cashflow'),
      title: tTerm('reports.tab.cashflow.title'),
      leaves: [
        { id: 'cashflow', label: tTerm('reports.tab.cashflow'), title: tTerm('reports.tab.cashflow.title') },
      ],
    },
    {
      id: 'operations',
      label: tTerm('reports.group.operations'),
      title: tTerm('reports.group.operations.title'),
      leaves: [
        { id: 'payouts', label: tTerm('reports.tab.payouts'), title: tTerm('reports.tab.payouts.title') },
        { id: 'creditHistory', label: tTerm('reports.tab.creditHistory'), title: tTerm('reports.tab.creditHistory.title') },
        { id: 'outstanding', label: tTerm('reports.tab.outstanding'), title: tTerm('reports.tab.outstanding.title') },
        ...(canViewOperatingExpensesTab
          ? [{ id: 'expenses', label: tTerm('reports.tab.expenses'), title: tTerm('reports.tab.expenses.title') }]
          : []),
        ...(canViewPaymentScheduleTab
          ? [{ id: 'schedule', label: tTerm('reports.tab.schedule'), title: tTerm('reports.tab.schedule.title') }]
          : []),
      ],
    },
  ], [canViewOperatingExpensesTab, canViewPaymentScheduleTab]);

  useEffect(() => {
    if (activeTab === 'schedule' && !canViewPaymentScheduleTab) {
      setActiveTab('dashboard');
    }
    if (activeTab === 'expenses' && !canViewOperatingExpensesTab) {
      setActiveTab('dashboard');
    }
  }, [activeTab, canViewOperatingExpensesTab, canViewPaymentScheduleTab]);

  // ─── Loading / Error states ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <PageShell data-tour="reports-page">
        <PageHeader
          title={tTerm('reports.module.title')}
          subtitle={tTerm('reports.module.subtitle')}
          guideKey="reports"
          tourId="reports-header"
        />
        <EmptyState compact title={tTerm('reports.state.loading')} />
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell data-tour="reports-page">
        <PageHeader
          title={tTerm('reports.module.title')}
          subtitle={tTerm('reports.module.subtitle')}
          guideKey="reports"
          tourId="reports-header"
        />
        <EmptyState
          compact
          title={getSafeErrorText(error, { domain: 'reports', action: 'reports.load' })}
        />
      </PageShell>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <PageShell data-tour="reports-page">
      <PageHeader
        title={tTerm('reports.module.title')}
        subtitle={tTerm('reports.module.subtitle')}
        guideKey="reports"
        tourId="reports-header"
      />

      <ReportsNavigation
        data-tour="reports-tabs"
        activeTab={activeTab}
        onChange={handleReportsTabChange}
        groups={reportGroups}
        primaryAriaLabel={tTerm('reports.tabs.aria')}
        secondaryAriaLabel={tTerm('reports.subtabs.aria')}
      />

      {contextualExportOpen && reportExportGuard.visible && (
        <ReportsContextualExportModal
          onClose={() => setContextualExportOpen(false)}
          reportType={reportType}
          onReportTypeChange={setReportType}
          reportRange={reportRange}
          onReportRangeChange={updateReportRange}
          reportStatusFilter={reportStatusFilter}
          onReportStatusFilterChange={setReportStatusFilter}
          reportPaymentTypeFilter={reportPaymentTypeFilter}
          onReportPaymentTypeFilterChange={setReportPaymentTypeFilter}
          reportEmployeeIdFilter={reportEmployeeIdFilter}
          onReportEmployeeIdFilterChange={setReportEmployeeIdFilter}
          canFilterByEmployee={canFilterPayoutsByEmployee}
          reportCustomerIdFilter={reportCustomerIdFilter}
          onReportCustomerIdFilterChange={setReportCustomerIdFilter}
          reportLoanIdFilter={reportLoanIdFilter}
          onReportLoanIdFilterChange={setReportLoanIdFilter}
          reportFinancialProductIdFilter={reportFinancialProductIdFilter}
          onReportFinancialProductIdFilterChange={setReportFinancialProductIdFilter}
          financialProductOptions={creditHistoryFinancialProductOptions}
          reportFormat={reportFormat}
          onReportFormatChange={setReportFormat}
          isExporting={isExporting}
          hasInvalidRange={hasInvalidRange}
          hasInvalidReportCustomerId={hasInvalidReportCustomerId}
          hasInvalidReportLoanId={hasInvalidReportLoanId}
          exportExecutable={reportExportGuard.executable}
          exportDisabledReason={reportExportGuard.reason}
          onExport={async () => {
            const success = await handleExportContextualReport();
            if (success) {
              setContextualExportOpen(false);
            }
            return success;
          }}
        />
      )}

      <ReportsTabContent>
      {activeTab === 'dashboard' && (
        <DashboardTab
          metrics={metrics}
          monthlyData={monthlyData}
          statusData={statusData}
          headerActions={reportExportGuard.visible ? (
            <>
              <ReportTabExportButton
                modalTitle={tTerm('reports.export.tab.dashboard.title')}
                modalSubtitle={tTerm('reports.export.tab.dashboard.subtitle')}
                exportLabel={tTerm('reports.cta.exportDashboard')}
                format={dashboardExportFormat}
                onFormatChange={(format) => setDashboardExportFormat(format)}
                isExporting={isExporting}
                disabled={!reportExportGuard.executable}
                disabledTitle={reportExportGuard.executable ? undefined : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
                onExport={handleExportReport}
              />
              <ActionButton
                variant="ghost"
                onClick={() => setContextualExportOpen(true)}
                disabled={!reportExportGuard.executable}
                title={reportExportGuard.executable ? tTerm('reports.cta.exportContextual') : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
                icon={<Download size={16} />}
              >
                {tTerm('reports.cta.exportContextual')}
              </ActionButton>
            </>
          ) : null}
        />
      )}

      {activeTab === 'cashflow' && (
        <CashflowTab
          cashFlowYear={cashFlowYear}
          onCashFlowYearChange={setCashFlowYear}
          cashFlowRange={cashFlowRange}
          onCashFlowRangeChange={setCashFlowRange}
          cashFlowData={cashFlowData}
          isCashFlowLoading={isCashFlowLoading}
          annualCashFlowData={annualCashFlowData}
          isAnnualCashFlowLoading={isAnnualCashFlowLoading}
          dailyCashFlowDate={dailyCashFlowDate}
          onDailyCashFlowDateChange={setDailyCashFlowDate}
          dailyCashFlowData={dailyCashFlowData}
          isDailyCashFlowLoading={isDailyCashFlowLoading}
          isCashFlowExporting={isCashFlowExporting}
          onExportCashFlow={handleExportCashFlow}
          reportExportGuard={reportExportGuard}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          analyticsYear={analyticsYear}
          onAnalyticsYearChange={setAnalyticsYear}
          performanceAnalysis={performanceAnalysis?.data}
          executiveDashboard={executiveDashboard?.data}
          comprehensiveAnalytics={comprehensiveAnalytics?.data}
          comparativeAnalysis={comparativeAnalysis?.data}
          forecastAnalysis={forecastAnalysis?.data}
          nextMonthProjection={nextMonthProjection?.data}
          exportActions={reportExportGuard.visible ? (
            <ReportTabExportButton
              modalTitle={tTerm('reports.export.tab.analytics.title')}
              modalSubtitle={tTerm('reports.export.tab.analytics.subtitle')}
              summary={buildAnalyticsExportSummary({ year: analyticsYear })}
              exportLabel={tTerm('reports.cta.exportAnalytics')}
              format={analyticsExportFormat}
              onFormatChange={(format) => setAnalyticsExportFormat(format)}
              isExporting={isAnalyticsExporting}
              disabled={!reportExportGuard.executable}
              disabledTitle={reportExportGuard.executable ? undefined : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
              onExport={handleExportAnalytics}
            />
          ) : null}
        />
      )}

      {activeTab === 'creditHistory' && (
        <CreditHistoryMonthlyTab
          filters={creditHistoryFilters}
          onFiltersChange={setCreditHistoryFilters}
          data={creditHistoryData}
          financialProductOptions={creditHistoryFinancialProductOptions}
          isLoading={isCreditHistoryLoading}
          exportActions={reportExportGuard.visible ? (
            <ReportTabExportButton
              modalTitle={tTerm('reports.export.tab.creditHistory.title')}
              modalSubtitle={tTerm('reports.export.tab.creditHistory.subtitle')}
              summary={buildCreditHistoryExportSummary({
                ...creditHistoryFilters,
                financialProductLabel: activeCreditHistoryFinancialProductLabel,
              })}
              exportLabel={tTerm('reports.cta.exportCredits')}
              format={reportFormat}
              onFormatChange={setReportFormat}
              isExporting={isExporting}
              disabled={creditHistoryExportBlocked}
              disabledTitle={creditHistoryExportBlocked && hasInvalidExportRange(creditHistoryFilters.startDate, creditHistoryFilters.endDate)
                ? tTerm('reports.export.invalidRange')
                : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
              onExport={handleExportCreditHistory}
            />
          ) : null}
        />
      )}

      {activeTab === 'outstanding' && (
        <div className="report-tab-layout">
          <ReportTabPanel
            title={tTerm('reports.outstanding.title')}
            subtitle={tTerm('reports.outstanding.subtitle')}
          />
          <ReportDataTableSection>
              <thead>
                <tr>
                  <th>{tTerm('reports.outstanding.customer')}</th>
                  <th>{tTerm('reports.outstanding.daysOverdue')}</th>
                  <th>{tTerm('reports.outstanding.amount')}</th>
                  <th>{tTerm('reports.outstanding.remainingCapital')}</th>
                </tr>
              </thead>
              <tbody>
                {overdueLoans.map((item: any, i: number) => (
                  <tr key={`overdue-${item.loanId ?? item.customerId ?? 'row'}-${item.daysOverdue ?? 'days'}-${i}`}>
                    <td className="font-medium">{item.customerName || tTerm('credits.label.customerFallback', { id: item.customerId })}</td>
                    <td className="font-medium text-amber-600">{tTerm('credits.agenda.daysOverdue', { count: item.daysOverdue })}</td>
                    <td className="font-bold text-amber-600">{formatMoney(item.overdueAmount)}</td>
                    <td>{formatMoney(item.remainingCapital)}</td>
                  </tr>
                ))}
                {overdueLoans.length === 0 && (
                  <tr>
                    <td colSpan={4} className="table-empty-state">{tTerm('reports.outstanding.empty')}</td>
                  </tr>
                )}
              </tbody>
          </ReportDataTableSection>
        </div>
      )}

      {activeTab === 'profitability' && (
        <ProfitabilityTab
          profitabilityData={profitabilityData}
          customerAnalytics={customerAnalytics}
          profitabilityDateRange={profitabilityDateRange}
          onProfitabilityDateRangeChange={updateProfitabilityDateRange}
          profitabilityPagination={profitabilityPagination}
          profitabilityPage={profitabilityPage}
          onProfitabilityPageChange={setProfitabilityPage}
          profitabilityPageSize={profitabilityPageSize}
          onProfitabilityPageSizeChange={(pageSize) => {
            setProfitabilityPageSize(pageSize);
            setProfitabilityPage(1);
          }}
          exportActions={reportExportGuard.visible ? (
            <ReportTabExportButton
              modalTitle={tTerm('reports.export.tab.profitability.title')}
              modalSubtitle={tTerm('reports.export.tab.profitability.subtitle')}
              exportLabel={tTerm('reports.cta.exportProfitability')}
              format={reportFormat}
              onFormatChange={setReportFormat}
              showRangeFields
              range={profitabilityDateRange}
              onRangeChange={updateProfitabilityDateRange}
              isExporting={isExporting}
              disabled={profitabilityExportBlocked}
              disabledTitle={profitabilityExportBlocked && hasInvalidExportRange(
                profitabilityDateRange.fromDate,
                profitabilityDateRange.toDate,
              )
                ? tTerm('reports.export.invalidRange')
                : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
              onExport={handleExportProfitability}
            />
          ) : null}
        />
      )}

      {activeTab === 'payouts' && (
        <PayoutsTab
          payoutFilters={payoutFilters}
          onPayoutFiltersChange={setPayoutFilters}
          canFilterByEmployee={canFilterPayoutsByEmployee}
          payoutPage={payoutPage}
          onPayoutPageChange={setPayoutPage}
          payoutPageSize={payoutPageSize}
          onPayoutPageSizeChange={setPayoutPageSize}
          payouts={payouts}
          payoutSummary={payoutSummary}
          payoutPagination={payoutPagination}
          isPayoutsLoading={isPayoutsLoading}
          exportActions={reportExportGuard.visible ? (
            <ReportTabExportButton
              modalTitle={tTerm('reports.export.tab.payouts.title')}
              modalSubtitle={tTerm('reports.export.tab.payouts.subtitle')}
              summary={buildPayoutExportSummary({
                ...payoutFilters,
                employeeLabel: payoutFilters.employeeId ? tTerm('reports.payouts.filter.employee') : undefined,
              })}
              exportLabel={tTerm('reports.cta.exportPayouts')}
              format={reportFormat}
              onFormatChange={setReportFormat}
              isExporting={isExporting}
              disabled={payoutExportBlocked}
              disabledTitle={payoutExportBlocked && hasInvalidExportRange(payoutFilters.fromDate || '', payoutFilters.toDate || '')
                ? tTerm('reports.export.invalidRange')
                : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
              onExport={handleExportPayouts}
            />
          ) : null}
        />
      )}

      {activeTab === 'expenses' && (
        <OperatingExpensesTab
          expenseFilters={expenseFilters}
          onExpenseFiltersChange={setExpenseFilters}
          expensePage={expensePage}
          expensePageSize={expensePageSize}
          onExpensePageChange={setExpensePage}
          expenses={expenses}
          pagination={expensePagination}
          isLoading={isExpensesLoading}
          canCreate={canCreateOperatingExpenses}
          canAnnul={canAnnulOperatingExpenses}
          isCreating={isCreatingExpense}
          annullingExpenseId={annullingExpenseId}
          exportingFormat={exportingExpensesFormat}
          onCreateExpense={handleCreateOperatingExpense}
          onAnnulExpense={handleAnnulOperatingExpense}
          onExportExpenses={handleExportOperatingExpenses}
          canFilterByEmployee={canFilterExpensesByEmployee}
        />
      )}

      {activeTab === 'schedule' && (
        <ScheduleTab
          scheduleAgenda={scheduleAgenda}
          scheduleAgendaSummary={scheduleAgendaSummary}
          isScheduleAgendaLoading={isScheduleAgendaLoading}
          isScheduleAgendaError={isScheduleAgendaError}
          onRefetchAgenda={() => { void refetchScheduleAgenda(); }}
          scheduleAgendaFilters={scheduleAgendaFilters}
          onScheduleAgendaFiltersChange={updateScheduleAgendaFilters}
          selectedLoanId={selectedLoanId}
          onLoanIdChange={setSelectedLoanId}
          schedule={schedule}
          scheduleSummary={scheduleSummary}
          scheduleLoan={scheduleLoan}
          isScheduleLoading={isScheduleLoading}
          onRefetch={() => { void refetchSchedule(); }}
        />
      )}
      </ReportsTabContent>
    </PageShell>
  );
}
