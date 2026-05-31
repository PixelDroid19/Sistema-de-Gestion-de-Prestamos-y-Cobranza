import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  useReports,
  usePayoutsReport,
  usePaymentSchedule,
  exportDashboardSummary,
  exportContextualReport,
  useFinancialAnalytics,
  useMonthlyCashFlow,
  useDailyCashFlow,
  useCreditHistoryMonthly,
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
import { useLoans } from '../services/loanService';
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
  PageHeader,
  PageShell,
  ViewTabs,
} from './shared/Surfaces';
import DashboardTab from './reports/DashboardTab';
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
  buildPayoutExportSummary,
} from './reports/reportExportSummary';
import {
  buildContextualExportParams,
  hasInvalidExportRange,
  parseOptionalPositiveId,
} from './reports/reportsExportHelpers';
import { getLoanStatusLabel } from './credits/creditsHelpers';

const formatMoney = (value: unknown) => formatCurrencyValue(value);

const getLoanCustomerName = (loan: any) => {
  const direct = loan?.customerName || loan?.clientName || loan?.borrowerName;
  const nested = loan?.customer?.name || loan?.Customer?.name;
  const composed = [loan?.customer?.firstName, loan?.customer?.lastName].filter(Boolean).join(' ').trim()
    || [loan?.Customer?.firstName, loan?.Customer?.lastName].filter(Boolean).join(' ').trim();
  return direct || nested || composed || tTerm('credits.label.customerFallback', { id: loan?.customerId ?? loan?.id });
};

const getLoanOptionLabel = (loan: any) => {
  const id = Number(loan?.id);
  const customerName = getLoanCustomerName(loan);
  const amount = formatMoney(loan?.amount);
  const status = String(loan?.status || '').trim();
  return [
    customerName,
    Number.isFinite(id) ? `#${id}` : '',
    amount,
    status ? getLoanStatusLabel(status) : '',
  ].filter(Boolean).join(' · ');
};

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
  const [payoutFilters, setPayoutFilters] = useState<{ fromDate?: string; toDate?: string; paymentType?: string; status?: string }>({});
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutPageSize, setPayoutPageSize] = useState(20);
  const { payouts, summary: payoutSummary, pagination: payoutPagination, isLoading: isPayoutsLoading } = usePayoutsReport(payoutFilters, payoutPage, payoutPageSize);

  const [expenseFilters, setExpenseFilters] = useState<{ fromDate?: string; toDate?: string; status?: string }>({});
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

  // Payment schedule state
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const {
    schedule,
    summary: scheduleSummary,
    loan: scheduleLoan,
    isLoading: isScheduleLoading,
    refetch: refetchSchedule,
  } = usePaymentSchedule(selectedLoanId);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'cashflow' | 'creditHistory' | 'outstanding' | 'profitability' | 'payouts' | 'schedule' | 'expenses'>('dashboard');
  const [isExporting, setIsExporting] = useState(false);
  const [analyticsYear, setAnalyticsYear] = useState<number>(new Date().getFullYear());
  const profitabilityDateRange = useMemo(
    () => buildReportYearDateRange(analyticsYear),
    [analyticsYear],
  );
  const [profitabilityExportRange, setProfitabilityExportRange] = useState(profitabilityDateRange);
  const {
    items: profitabilityItems,
    isLoading: isProfitabilityLoading,
  } = useCustomerProfitability(profitabilityDateRange);

  useEffect(() => {
    setProfitabilityExportRange(profitabilityDateRange);
  }, [profitabilityDateRange]);
  const [cashFlowYear, setCashFlowYear] = useState<number>(new Date().getFullYear());
  const [cashFlowRange, setCashFlowRange] = useState<{ fromDate: string; toDate: string }>({ fromDate: '', toDate: '' });
  const [dailyCashFlowDate, setDailyCashFlowDate] = useState<string>(() => getLocalDateInputValue());
  const [creditHistoryFilters, setCreditHistoryFilters] = useState<{ startDate: string; endDate: string; status: string; customerId: string; loanId: string }>({
    startDate: '',
    endDate: '',
    status: '',
    customerId: '',
    loanId: '',
  });
  const [isCashFlowExporting, setIsCashFlowExporting] = useState<'excel' | 'pdf' | null>(null);
  const [reportType, setReportType] = useState<'credits' | 'payouts' | 'profitability' | 'associates'>('credits');
  const [reportRange, setReportRange] = useState<{ fromDate: string; toDate: string }>({ fromDate: '', toDate: '' });
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('');
  const [reportPaymentTypeFilter, setReportPaymentTypeFilter] = useState<string>('');
  const [reportAssociateIdFilter, setReportAssociateIdFilter] = useState<string>('');
  const [reportCustomerIdFilter, setReportCustomerIdFilter] = useState<string>('');
  const [reportLoanIdFilter, setReportLoanIdFilter] = useState<string>('');
  const [reportFormat, setReportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [contextualExportOpen, setContextualExportOpen] = useState(false);

  const { performanceAnalysis, forecastAnalysis, nextMonthProjection } = useFinancialAnalytics(analyticsYear);
  const cashFlowFilters = useMemo(() => ({
    ...(cashFlowRange.fromDate ? { fromDate: cashFlowRange.fromDate } : {}),
    ...(cashFlowRange.toDate ? { toDate: cashFlowRange.toDate } : {}),
  }), [cashFlowRange]);
  const { data: cashFlowData, isLoading: isCashFlowLoading } = useMonthlyCashFlow(cashFlowYear, cashFlowFilters);
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
  }), [creditHistoryFilters]);
  const { data: creditHistoryData, isLoading: isCreditHistoryLoading } = useCreditHistoryMonthly(creditHistoryQueryFilters);
  const { data: scheduleLoansData, isLoading: isScheduleLoansLoading } = useLoans(
    { pageSize: 100 },
    { enabled: activeTab === 'schedule' },
  );

  const scheduleLoanOptions = useMemo(() => {
    const loans = Array.isArray(scheduleLoansData?.data?.loans)
      ? scheduleLoansData.data.loans
      : Array.isArray(scheduleLoansData?.data)
        ? scheduleLoansData.data
        : [];

    return loans
      .map((loan: any) => ({ id: Number(loan?.id), label: getLoanOptionLabel(loan) }))
      .filter((loan: { id: number; label: string }): loan is { id: number; label: string } => Number.isFinite(loan.id) && loan.label.length > 0)
      .sort((a: { id: number }, b: { id: number }) => b.id - a.id);
  }, [scheduleLoansData]);

  const metrics = dashboardData?.metrics || {
    totalActiveLoans: 0, totalDisbursed: 0, totalRecovered: 0,
    totalInterestGenerated: 0, totalInterestPaid: 0, arrearsRate: 0,
  };
  const monthlyData = monthlyPerformance ?? [];
  const statusData = statusBreakdown ?? [];
  const profitabilityData = profitabilityItems;
  const isLoading = isReportsLoading || isProfitabilityLoading;

  const updateProfitabilityExportRange = (key: 'fromDate' | 'toDate', value: string) => {
    if (key === 'fromDate' && value && profitabilityExportRange.toDate && value > profitabilityExportRange.toDate) {
      return;
    }
    if (key === 'toDate' && value && profitabilityExportRange.fromDate && value < profitabilityExportRange.fromDate) {
      return;
    }

    setProfitabilityExportRange((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Advanced analytics ───────────────────────────────────────────────────

  const advancedPerformance = performanceAnalysis?.data as any;
  const advancedForecast = forecastAnalysis?.data as any;
  const advancedProjection = nextMonthProjection?.data as any;

  const advancedMetrics = useMemo(() => {
    const collectionEfficiency = Number(
      advancedPerformance?.collectionEfficiency ?? advancedPerformance?.efficiency
      ?? advancedPerformance?.summary?.collectionEfficiency ?? 0,
    );
    const delinquencyTrend = Number(
      advancedForecast?.delinquencyTrend ?? advancedForecast?.riskTrend
      ?? advancedForecast?.summary?.delinquencyTrend ?? 0,
    );
    const projectedCollections = Number(
      advancedProjection?.projectedCollections ?? advancedProjection?.projectedRecovered
      ?? advancedProjection?.summary?.projectedCollections ?? 0,
    );
    return {
      collectionEfficiency: Number.isFinite(collectionEfficiency) ? collectionEfficiency : 0,
      delinquencyTrend: Number.isFinite(delinquencyTrend) ? delinquencyTrend : 0,
      projectedCollections: Number.isFinite(projectedCollections) ? projectedCollections : 0,
    };
  }, [advancedForecast, advancedPerformance, advancedProjection]);

  const advancedTrendSeries = useMemo(() => {
    const rawSeries =
      (Array.isArray(advancedPerformance?.monthlyTrend) && advancedPerformance.monthlyTrend)
      || (Array.isArray(advancedForecast?.monthlyTrend) && advancedForecast.monthlyTrend)
      || (Array.isArray(advancedForecast?.trend) && advancedForecast.trend)
      || [];
    return rawSeries.map((item: any, index: number) => ({
      period: item?.month || item?.period || `P${index + 1}`,
      recovered: Number(item?.recovered ?? item?.collections ?? item?.value ?? 0),
      arrears: Number(item?.arrears ?? item?.overdue ?? item?.risk ?? 0),
    }));
  }, [advancedForecast, advancedPerformance]);

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
  const normalizedReportAssociateId = reportAssociateIdFilter.trim();
  const hasInvalidAssociateId = reportType === 'associates'
    && normalizedReportAssociateId.length > 0
    && !/^[1-9]\d*$/.test(normalizedReportAssociateId);
  const reportAssociateId = reportType === 'associates'
    && normalizedReportAssociateId.length > 0
    && !hasInvalidAssociateId
    ? Number(normalizedReportAssociateId)
    : undefined;
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

  const handleExportReport = async () => {
    setIsExporting(true);
    await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: resolvedPermissions },
      run: async () => { await exportDashboardSummary(); },
      successMessage: tTerm('reports.toast.export.success'),
    });
    setIsExporting(false);
  };

  const contextualExportSuccessMessage = (type: typeof reportType) => (
    type === 'credits'
      ? tTerm('reports.toast.contextual.credits')
      : type === 'profitability'
        ? tTerm('reports.toast.contextual.profitability')
        : type === 'associates'
          ? tTerm('reports.toast.contextual.associates')
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
      || hasInvalidAssociateId
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
        associateId: reportAssociateId,
        customerId: reportCustomerId,
        loanId: reportLoanId,
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
      }),
    );
  };

  const profitabilityExportBlocked = hasInvalidExportRange(
    profitabilityExportRange.fromDate,
    profitabilityExportRange.toDate,
  ) || !reportExportGuard.executable;

  const handleExportProfitability = async (): Promise<boolean> => {
    if (profitabilityExportBlocked) {
      return false;
    }

    return runContextualExport(
      'profitability',
      buildContextualExportParams('profitability', {
        fromDate: profitabilityExportRange.fromDate,
        toDate: profitabilityExportRange.toDate,
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

  const reportTabs = useMemo(() => [
    { id: 'dashboard', label: tTerm('reports.tab.dashboard') },
    { id: 'cashflow', label: tTerm('reports.tab.cashflow'), title: tTerm('reports.tab.cashflow.title') },
    { id: 'creditHistory', label: tTerm('reports.tab.creditHistory'), title: tTerm('reports.tab.creditHistory.title') },
    { id: 'outstanding', label: tTerm('reports.tab.outstanding'), title: tTerm('reports.tab.outstanding.title') },
    { id: 'profitability', label: tTerm('reports.tab.profitability') },
    { id: 'payouts', label: tTerm('reports.tab.payouts'), title: tTerm('reports.tab.payouts.title') },
    ...(canViewOperatingExpensesTab
      ? [{ id: 'expenses', label: tTerm('reports.tab.expenses'), title: tTerm('reports.tab.expenses.title') }]
      : []),
    ...(canViewPaymentScheduleTab
      ? [{ id: 'schedule', label: tTerm('reports.tab.schedule'), title: tTerm('reports.tab.schedule.title') }]
      : []),
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
    return <div className="p-8 text-center text-text-secondary">{tTerm('reports.state.loading')}</div>;
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-red-500">
        {getSafeErrorText(error, { domain: 'reports', action: 'reports.load' })}
      </div>
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

      <ViewTabs
        data-tour="reports-tabs"
        activeTab={activeTab}
        onChange={handleReportsTabChange}
        tabs={reportTabs}
        className="reports-page-tabs"
        ariaLabel={tTerm('reports.tabs.aria')}
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
          reportAssociateIdFilter={reportAssociateIdFilter}
          onReportAssociateIdFilterChange={setReportAssociateIdFilter}
          reportCustomerIdFilter={reportCustomerIdFilter}
          onReportCustomerIdFilterChange={setReportCustomerIdFilter}
          reportLoanIdFilter={reportLoanIdFilter}
          onReportLoanIdFilterChange={setReportLoanIdFilter}
          reportFormat={reportFormat}
          onReportFormatChange={setReportFormat}
          isExporting={isExporting}
          hasInvalidRange={hasInvalidRange}
          hasInvalidAssociateId={hasInvalidAssociateId}
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
              <ActionButton
                variant="secondary"
                onClick={() => { void handleExportReport(); }}
                disabled={isExporting || !reportExportGuard.executable}
                title={reportExportGuard.executable ? tTerm('reports.cta.exportDashboard') : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
                icon={<Download size={16} />}
              >
                {isExporting ? tTerm('credits.cta.exporting') : tTerm('reports.cta.exportSummary')}
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={() => setContextualExportOpen(true)}
                disabled={!reportExportGuard.executable}
                title={reportExportGuard.executable ? tTerm('reports.cta.openExports') : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
                icon={<Download size={16} />}
              >
                {tTerm('reports.cta.openExports')}
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
          dailyCashFlowDate={dailyCashFlowDate}
          onDailyCashFlowDateChange={setDailyCashFlowDate}
          dailyCashFlowData={dailyCashFlowData}
          isDailyCashFlowLoading={isDailyCashFlowLoading}
          isCashFlowExporting={isCashFlowExporting}
          onExportCashFlow={handleExportCashFlow}
          reportExportGuard={reportExportGuard}
        />
      )}

      {activeTab === 'creditHistory' && (
        <CreditHistoryMonthlyTab
          filters={creditHistoryFilters}
          onFiltersChange={setCreditHistoryFilters}
          data={creditHistoryData}
          isLoading={isCreditHistoryLoading}
          exportActions={reportExportGuard.visible ? (
            <ReportTabExportButton
              modalTitle={tTerm('reports.export.tab.creditHistory.title')}
              modalSubtitle={tTerm('reports.export.tab.creditHistory.subtitle')}
              summary={buildCreditHistoryExportSummary(creditHistoryFilters)}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
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
            </table>
          </div>
          </ReportDataTableSection>
        </div>
      )}

      {activeTab === 'profitability' && (
        <ProfitabilityTab
          profitabilityData={profitabilityData}
          analyticsYear={analyticsYear}
          onAnalyticsYearChange={setAnalyticsYear}
          advancedMetrics={advancedMetrics}
          advancedTrendSeries={advancedTrendSeries}
          exportActions={reportExportGuard.visible ? (
            <ReportTabExportButton
              modalTitle={tTerm('reports.export.tab.profitability.title')}
              modalSubtitle={tTerm('reports.export.tab.profitability.subtitle')}
              exportLabel={tTerm('reports.cta.exportProfitability')}
              format={reportFormat}
              onFormatChange={setReportFormat}
              showFormat={false}
              showRangeFields
              range={profitabilityExportRange}
              onRangeChange={updateProfitabilityExportRange}
              isExporting={isExporting}
              disabled={profitabilityExportBlocked}
              disabledTitle={profitabilityExportBlocked && hasInvalidExportRange(
                profitabilityExportRange.fromDate,
                profitabilityExportRange.toDate,
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
              summary={buildPayoutExportSummary(payoutFilters)}
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
        />
      )}

      {activeTab === 'schedule' && (
        <ScheduleTab
          selectedLoanId={selectedLoanId}
          onLoanIdChange={setSelectedLoanId}
          loanOptions={scheduleLoanOptions}
          schedule={schedule}
          scheduleSummary={scheduleSummary}
          scheduleLoan={scheduleLoan}
          isScheduleLoading={isScheduleLoading || isScheduleLoansLoading}
          onRefetch={() => { void refetchSchedule(); }}
        />
      )}
      </ReportsTabContent>
    </PageShell>
  );
}
