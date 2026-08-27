import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  useReports,
  exportContextualReport,
  exportOutstandingReport,
  useMonthlyCashFlow,
  useCreditHistoryMonthly,
  usePayoutsReport,
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
import { tTerm } from '../i18n/terminology';
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
  PageHeader,
  PageShell,
} from './shared/Surfaces';
import ReportsNavigation, { type ReportGroup } from './reports/ReportsNavigation';
import CashflowTab from './reports/CashflowTab';
import CreditHistoryMonthlyTab from './reports/CreditHistoryMonthlyTab';
import OutstandingTab from './reports/OutstandingTab';
import OperatingExpensesTab from './reports/OperatingExpensesTab';
import PayoutsTab from './reports/PayoutsTab';
import ReportsTabContent from './reports/ReportsTabContent';
import AssociateMovementsTab from './reports/AssociateMovementsTab';
import { ReportDownloadActions } from './reports/ReportDownloadModal';
import {
  buildContextualExportParams,
  hasInvalidExportRange,
  parseOptionalPositiveId,
} from './reports/reportsExportHelpers';

const PRIMARY_REPORT_TAB_IDS = ['cashflow', 'creditHistory', 'payouts', 'outstanding', 'associates', 'expenses'] as const;
type PrimaryReportTab = typeof PRIMARY_REPORT_TAB_IDS[number];
const isPrimaryReportTab = (tabId: string): tabId is PrimaryReportTab => (
  PRIMARY_REPORT_TAB_IDS.includes(tabId as PrimaryReportTab)
);

export default function Reports() {
  const location = useLocation();
  const navigate = useNavigate();
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
  const canViewOperatingExpensesTab = canAccessPermission(PERMISSION.FINANCE_VIEW_ALL);
  const canCreateOperatingExpenses = canAccessPermission(PERMISSION.FINANCE_CREATE);
  const canAnnulOperatingExpenses = canAccessPermission(PERMISSION.FINANCE_ANNUL);
  const isExpenseRegistrationLink = (
    canViewOperatingExpensesTab
    && new URLSearchParams(location.search).get('view') === 'expenses'
  );
  const {
    overdueLoans,
    isLoading: isOutstandingLoading,
    isError: isOutstandingError,
  } = useReports();

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

  const [activeTab, setActiveTab] = useState<PrimaryReportTab>(() => (
    isExpenseRegistrationLink ? 'expenses' : 'cashflow'
  ));
  useEffect(() => {
    if (isExpenseRegistrationLink) {
      setActiveTab('expenses');
    }
  }, [isExpenseRegistrationLink, setActiveTab]);
  const [payoutFilters, setPayoutFilters] = useState<{
    fromDate?: string;
    toDate?: string;
    status?: string;
    paymentType?: string;
    employeeId?: string;
  }>({});
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutPageSize, setPayoutPageSize] = useState(20);
  const {
    payouts,
    summary: payoutSummary,
    pagination: payoutPagination,
    isLoading: isPayoutsLoading,
  } = usePayoutsReport(payoutFilters, payoutPage, payoutPageSize);

  const [isExporting, setIsExporting] = useState(false);
  const [isOutstandingExporting, setIsOutstandingExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [cashFlowYear, setCashFlowYear] = useState<number>(new Date().getFullYear());
  const [cashFlowRange, setCashFlowRange] = useState<{ fromDate: string; toDate: string }>({ fromDate: '', toDate: '' });
  const handleCashFlowRangeChange = (range: { fromDate: string; toDate: string }) => {
    setCashFlowRange(range);
    const selectedYear = Number((range.fromDate || range.toDate).slice(0, 4));
    if (Number.isInteger(selectedYear) && selectedYear >= 2000 && selectedYear <= 2100) {
      setCashFlowYear(selectedYear);
    }
  };
  const [creditHistoryFilters, setCreditHistoryFilters] = useState<{
    startDate: string;
    endDate: string;
    status: string;
    customerId: string;
  }>({
    startDate: '',
    endDate: '',
    status: '',
    customerId: '',
  });
  const [isCashFlowExporting, setIsCashFlowExporting] = useState<'excel' | 'pdf' | null>(null);

  const cashFlowFilters = useMemo(() => ({
    ...(cashFlowRange.fromDate ? { fromDate: cashFlowRange.fromDate } : {}),
    ...(cashFlowRange.toDate ? { toDate: cashFlowRange.toDate } : {}),
  }), [cashFlowRange]);
  const { data: cashFlowData, isLoading: isCashFlowLoading } = useMonthlyCashFlow(cashFlowYear, cashFlowFilters);
  const creditHistoryQueryFilters = useMemo(() => ({
    ...(creditHistoryFilters.startDate ? { startDate: creditHistoryFilters.startDate } : {}),
    ...(creditHistoryFilters.endDate ? { endDate: creditHistoryFilters.endDate } : {}),
    ...(creditHistoryFilters.status ? { status: creditHistoryFilters.status } : {}),
    ...(/^\d+$/.test(creditHistoryFilters.customerId.trim()) ? { customerId: Number(creditHistoryFilters.customerId) } : {}),
  }), [creditHistoryFilters]);
  const { data: creditHistoryData, isLoading: isCreditHistoryLoading } = useCreditHistoryMonthly(creditHistoryQueryFilters);

  // ─── Export handlers ──────────────────────────────────────────────────────

  const reportExportGuard = resolveOperationalGuard('credit.report.download', {
    role: user?.role, permissions: resolvedPermissions,
  });

  const runContextualExport = async (
    type: 'credits' | 'payouts',
    params: ReturnType<typeof buildContextualExportParams>,
  ): Promise<boolean> => {
    setIsExporting(true);
    const success = await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: resolvedPermissions },
      run: async () => { await exportContextualReport(type, params); },
      successMessage: type === 'payouts'
        ? tTerm('reports.toast.contextual.payouts')
        : tTerm('reports.toast.contextual.credits'),
    });
    setIsExporting(false);
    return success;
  };

  const creditHistoryExportBlocked = hasInvalidExportRange(
    creditHistoryFilters.startDate,
    creditHistoryFilters.endDate,
  ) || !reportExportGuard.executable;

  const handleExportCreditHistoryWithFormat = async (format: 'xlsx' | 'pdf'): Promise<boolean> => {
    const result = await runContextualExport(
      'credits',
      buildContextualExportParams('credits', {
        fromDate: creditHistoryFilters.startDate,
        toDate: creditHistoryFilters.endDate,
        status: creditHistoryFilters.status,
        format,
        customerId: parseOptionalPositiveId(creditHistoryFilters.customerId),
      }),
    );
    return result;
  };

  const payoutExportBlocked = hasInvalidExportRange(
    payoutFilters.fromDate || '',
    payoutFilters.toDate || '',
  ) || !reportExportGuard.executable;

  const handleExportPayoutsWithFormat = async (format: 'xlsx' | 'pdf'): Promise<boolean> => {
    const result = await runContextualExport(
      'payouts',
      buildContextualExportParams('payouts', {
        fromDate: payoutFilters.fromDate,
        toDate: payoutFilters.toDate,
        status: payoutFilters.status,
        paymentType: payoutFilters.paymentType,
        employeeId: payoutFilters.employeeId,
        format,
      }),
    );
    return result;
  };

  const handleReportsTabChange = (tabId: string) => {
    if (isPrimaryReportTab(tabId)) {
      setActiveTab(tabId);

      if (location.search) {
        const searchParams = new URLSearchParams(location.search);
        searchParams.delete('view');
        const search = searchParams.toString();
        navigate({
          pathname: location.pathname,
          search: search ? `?${search}` : '',
        }, { replace: true });
      }
    }
  };

  const handleExportOutstanding = async (format: 'xlsx' | 'pdf'): Promise<boolean> => {
    setIsOutstandingExporting(format);
    const success = await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: resolvedPermissions },
      run: async () => { await exportOutstandingReport(format); },
      successMessage: tTerm('reports.toast.outstanding'),
    });
    setIsOutstandingExporting(null);
    return success;
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
      id: 'commercial',
      label: tTerm('reports.group.commercial'),
      title: tTerm('reports.group.commercial.title'),
      leaves: [
        { id: 'creditHistory', label: tTerm('reports.tab.creditHistory'), title: tTerm('reports.tab.creditHistory.title') },
        { id: 'payouts', label: tTerm('reports.tab.payouts'), title: tTerm('reports.tab.payouts.title') },
        { id: 'outstanding', label: tTerm('reports.tab.outstanding'), title: tTerm('reports.tab.outstanding.title') },
      ],
    },
    {
      id: 'statistical',
      label: tTerm('reports.group.statistical'),
      title: tTerm('reports.group.statistical.title'),
      leaves: [
        { id: 'associates', label: tTerm('reports.tab.associates'), title: tTerm('reports.tab.associates.title') },
      ],
    },
    {
      id: 'accounting',
      label: tTerm('reports.group.accounting'),
      title: tTerm('reports.group.accounting.title'),
      leaves: [
        { id: 'cashflow', label: tTerm('reports.tab.cashflow'), title: tTerm('reports.tab.cashflow.title') },
        ...(canViewOperatingExpensesTab
          ? [{ id: 'expenses', label: tTerm('reports.tab.expenses'), title: tTerm('reports.expenses.subtitle') }]
          : []),
      ],
    },
  ], [canViewOperatingExpensesTab]);
  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <PageShell className="reports-module-page" data-tour="reports-page">
      <PageHeader
        title={tTerm('reports.module.title')}
        subtitle={tTerm('reports.module.subtitle')}
        tourId="reports-header"
      />

      <div className="reports-workspace" data-testid="reports-workspace">
        <ReportsNavigation
          data-tour="reports-tabs"
          activeTab={activeTab}
          onChange={handleReportsTabChange}
          groups={reportGroups}
          primaryAriaLabel={tTerm('reports.tabs.aria')}
        />

        <ReportsTabContent>
      {activeTab === 'cashflow' && (
        <CashflowTab
          cashFlowYear={cashFlowYear}
          onCashFlowYearChange={setCashFlowYear}
          cashFlowRange={cashFlowRange}
          onCashFlowRangeChange={handleCashFlowRangeChange}
          cashFlowData={cashFlowData}
          isCashFlowLoading={isCashFlowLoading}
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
            <ReportDownloadActions
              isExporting={isExporting}
              disabled={creditHistoryExportBlocked}
              disabledReason={hasInvalidExportRange(creditHistoryFilters.startDate, creditHistoryFilters.endDate)
                ? tTerm('reports.export.invalidRange')
                : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
              onDownload={(format) => handleExportCreditHistoryWithFormat(format === 'pdf' ? 'pdf' : 'xlsx')}
            />
          ) : null}
        />
      )}

      {activeTab === 'outstanding' && (
        <OutstandingTab
          overdueLoans={overdueLoans}
          isLoading={isOutstandingLoading}
          isError={isOutstandingError}
          exportActions={reportExportGuard.visible ? (
            <ReportDownloadActions
              isExporting={isOutstandingExporting !== null}
              disabled={!reportExportGuard.executable}
              disabledReason={reportExportGuard.reason || tTerm('credits.action.unavailable')}
              onDownload={(format) => handleExportOutstanding(format === 'pdf' ? 'pdf' : 'xlsx')}
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
          canFilterByEmployee={canFilterExpensesByEmployee}
          exportActions={reportExportGuard.visible ? (
            <ReportDownloadActions
              isExporting={isExporting}
              disabled={payoutExportBlocked}
              disabledReason={hasInvalidExportRange(payoutFilters.fromDate || '', payoutFilters.toDate || '')
                ? tTerm('reports.export.invalidRange')
                : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
              onDownload={(format) => handleExportPayoutsWithFormat(format === 'pdf' ? 'pdf' : 'xlsx')}
            />
          ) : null}
        />
      )}

      {activeTab === 'associates' && <AssociateMovementsTab />}

      {canViewOperatingExpensesTab && activeTab === 'expenses' && (
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

        </ReportsTabContent>
      </div>
    </PageShell>
  );
}
