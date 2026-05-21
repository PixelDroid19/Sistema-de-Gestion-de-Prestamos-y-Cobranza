import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  useReports,
  usePayoutsReport,
  usePaymentSchedule,
  exportDashboardSummary,
  exportContextualReport,
  useFinancialAnalytics,
  useMonthlyCashFlow,
  exportMonthlyCashFlowExcel,
  exportMonthlyCashFlowPdf,
} from '../services/reportService';
import { useLoans } from '../services/loanService';
import { formatCurrency as formatCurrencyValue } from '../i18n/format';
import { getSafeErrorText } from '../services/safeErrorMessages';
import { tTerm } from '../i18n/terminology';
import { useSessionStore } from '../store/sessionStore';
import { useOperationalActions } from './hooks/useOperationalActions';
import { useQueryClient } from '@tanstack/react-query';
import { resolveOperationalGuard } from '../services/operationalGuards';
import {
  ActionButton,
  DataTableSurface,
  FormField,
  PageHeader,
  PageShell,
  SelectInput,
  TextInput,
  ToolbarSurface,
  ViewTabs,
} from './shared/Surfaces';
import DashboardTab from './reports/DashboardTab';
import CashflowTab from './reports/CashflowTab';
import ProfitabilityTab from './reports/ProfitabilityTab';
import PayoutsTab from './reports/PayoutsTab';
import ScheduleTab from './reports/ScheduleTab';

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
    status ? status.toUpperCase() : '',
  ].filter(Boolean).join(' · ');
};

export default function Reports() {
  const queryClient = useQueryClient();
  const { executeGuardedAction } = useOperationalActions(queryClient);
  const { user } = useSessionStore();
  const {
    dashboardData,
    monthlyPerformance,
    statusBreakdown,
    overdueLoans,
    profitabilityItems,
    isLoading,
    isError,
    error,
  } = useReports();

  // Payouts report state
  const [payoutFilters, setPayoutFilters] = useState<{ fromDate?: string; toDate?: string }>({});
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutPageSize, setPayoutPageSize] = useState(20);
  const { payouts, summary: payoutSummary, pagination: payoutPagination, isLoading: isPayoutsLoading } = usePayoutsReport(payoutFilters, payoutPage, payoutPageSize);

  // Payment schedule state
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const {
    schedule,
    summary: scheduleSummary,
    loan: scheduleLoan,
    isLoading: isScheduleLoading,
    refetch: refetchSchedule,
  } = usePaymentSchedule(selectedLoanId);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'cashflow' | 'outstanding' | 'profitability' | 'payouts' | 'schedule'>('dashboard');
  const [isExporting, setIsExporting] = useState(false);
  const [analyticsYear, setAnalyticsYear] = useState<number>(new Date().getFullYear());
  const [cashFlowYear, setCashFlowYear] = useState<number>(new Date().getFullYear());
  const [isCashFlowExporting, setIsCashFlowExporting] = useState<'excel' | 'pdf' | null>(null);
  const [reportType, setReportType] = useState<'credits' | 'payouts' | 'profitability'>('credits');
  const [reportRange, setReportRange] = useState<{ fromDate: string; toDate: string }>({ fromDate: '', toDate: '' });
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('');
  const [reportFormat, setReportFormat] = useState<'xlsx' | 'pdf'>('xlsx');

  const { performanceAnalysis, forecastAnalysis, nextMonthProjection } = useFinancialAnalytics(analyticsYear);
  const { data: cashFlowData, isLoading: isCashFlowLoading } = useMonthlyCashFlow(cashFlowYear);
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
  const profitabilityData = profitabilityItems ?? [];

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
    role: user?.role, permissions: user?.permissions,
  });

  const hasInvalidRange = Boolean(
    reportRange.fromDate && reportRange.toDate && reportRange.fromDate > reportRange.toDate,
  );

  const handleExportReport = async () => {
    setIsExporting(true);
    await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: user?.permissions },
      run: async () => { await exportDashboardSummary(); },
      successMessage: tTerm('reports.toast.export.success'),
    });
    setIsExporting(false);
  };

  const handleExportContextualReport = async () => {
    const effectiveReportType = activeTab === 'profitability' ? 'profitability' : reportType;
    setIsExporting(true);
    await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: user?.permissions },
      run: async () => {
        await exportContextualReport(effectiveReportType, {
          fromDate: reportRange.fromDate || undefined,
          toDate: reportRange.toDate || undefined,
          status: effectiveReportType === 'credits' && reportStatusFilter ? reportStatusFilter : undefined,
          format: effectiveReportType === 'credits' ? reportFormat : undefined,
        });
      },
      successMessage: effectiveReportType === 'credits'
        ? tTerm('reports.toast.contextual.credits')
        : effectiveReportType === 'profitability'
          ? tTerm('reports.toast.contextual.profitability')
          : tTerm('reports.toast.contextual.payouts'),
    });
    setIsExporting(false);
  };

  const handleReportsTabChange = (tabId: string) => {
    const nextTab = tabId as typeof activeTab;
    setActiveTab(nextTab);
    if (nextTab === 'profitability') {
      setReportType('profitability');
    } else if (reportType === 'profitability') {
      setReportType('credits');
    }
  };

  const handleExportCashFlow = async (format: 'excel' | 'pdf') => {
    setIsCashFlowExporting(format);
    await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: user?.permissions },
      run: async () => {
        if (format === 'excel') { await exportMonthlyCashFlowExcel(cashFlowYear); return; }
        await exportMonthlyCashFlowPdf(cashFlowYear);
      },
      successMessage: format === 'excel' ? tTerm('reports.toast.cashflow.excel') : tTerm('reports.toast.cashflow.pdf'),
    });
    setIsCashFlowExporting(null);
  };

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
        actions={reportExportGuard.visible ? (
          <ActionButton
            onClick={handleExportReport}
            disabled={isExporting || !reportExportGuard.executable}
            title={reportExportGuard.executable ? tTerm('reports.cta.exportDashboard') : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
            icon={<Download size={16} />}
          >
            {isExporting ? tTerm('credits.cta.exporting') : tTerm('reports.cta.export')}
          </ActionButton>
        ) : null}
      />

      {reportExportGuard.visible && (
        <ToolbarSurface as="form" className="settings-config-form" aria-label={tTerm('reports.export.aria')}>
          <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.9fr)_minmax(10rem,0.9fr)_max-content_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)]">
            <FormField label={tTerm('reports.export.type')}>
              <SelectInput
                id="report-type"
                value={reportType}
                onChange={(event) => setReportType(event.target.value as 'credits' | 'payouts' | 'profitability')}
              >
                <option value="credits">{tTerm('reports.export.type.credits')}</option>
                <option value="profitability">{tTerm('reports.export.type.profitability')}</option>
                <option value="payouts">{tTerm('reports.export.type.payouts')}</option>
              </SelectInput>
            </FormField>
            <FormField label={tTerm('reports.export.from')}>
              <TextInput
                id="report-from"
                type="date"
                value={reportRange.fromDate}
                onChange={(event) => setReportRange((prev) => ({ ...prev, fromDate: event.target.value }))}
              />
            </FormField>
            <FormField label={tTerm('reports.export.to')}>
              <TextInput
                id="report-to"
                type="date"
                value={reportRange.toDate}
                onChange={(event) => setReportRange((prev) => ({ ...prev, toDate: event.target.value }))}
              />
            </FormField>
            <div className="flex min-w-0 flex-col">
              <span className="form-field-label invisible select-none" aria-hidden="true">
                {tTerm('reports.cta.export')}
              </span>
              <ActionButton
                variant="primary"
                onClick={handleExportContextualReport}
                disabled={isExporting || hasInvalidRange || !reportExportGuard.executable}
                title={hasInvalidRange ? tTerm('reports.export.invalidRange') : (reportExportGuard.executable ? tTerm('reports.cta.exportContextual') : (reportExportGuard.reason || tTerm('credits.action.unavailable')))}
                icon={<Download size={16} />}
                className="h-10 min-h-10 px-5"
              >
                {isExporting
                  ? tTerm('credits.cta.exporting')
                  : reportType === 'credits'
                    ? tTerm('reports.cta.exportCredits')
                    : reportType === 'profitability'
                      ? tTerm('reports.cta.exportProfitability')
                      : tTerm('reports.cta.exportPayouts')}
              </ActionButton>
            </div>
            {reportType === 'credits' && (
              <>
              <FormField label={tTerm('reports.export.status')}>
                <SelectInput
                  id="report-status"
                  value={reportStatusFilter}
                  onChange={(event) => setReportStatusFilter(event.target.value)}
                >
                  <option value="">{tTerm('credits.filter.all')}</option>
                  <option value="approved">{tTerm('credits.status.approved')}</option>
                  <option value="active">{tTerm('common.status.active')}</option>
                  <option value="overdue">{tTerm('schedule.status.overdue')}</option>
                  <option value="defaulted">{tTerm('credits.status.defaulted')}</option>
                  <option value="closed">{tTerm('common.status.closed')}</option>
                  <option value="paid">{tTerm('schedule.status.paid')}</option>
                </SelectInput>
              </FormField>
              <FormField label={tTerm('reports.export.format')}>
                <SelectInput
                  id="report-format"
                  value={reportFormat}
                  onChange={(event) => setReportFormat(event.target.value as 'xlsx' | 'pdf')}
                >
                  <option value="xlsx">Excel (xlsx)</option>
                  <option value="pdf">PDF</option>
                </SelectInput>
              </FormField>
              </>
            )}
          </div>
          {hasInvalidRange && (
            <p className="mt-2 text-sm text-red-600">{tTerm('reports.export.invalidRange')}</p>
          )}
        </ToolbarSurface>
      )}

      <ViewTabs
        data-tour="reports-tabs"
        activeTab={activeTab}
        onChange={handleReportsTabChange}
        tabs={[
          { id: 'dashboard', label: tTerm('reports.tab.dashboard') },
          { id: 'cashflow', label: tTerm('reports.tab.cashflow'), title: tTerm('reports.tab.cashflow.title') },
          { id: 'outstanding', label: tTerm('reports.tab.outstanding'), title: tTerm('reports.tab.outstanding.title') },
          { id: 'profitability', label: tTerm('reports.tab.profitability') },
          { id: 'payouts', label: tTerm('reports.tab.payouts'), title: tTerm('reports.tab.payouts.title') },
          { id: 'schedule', label: tTerm('reports.tab.schedule'), title: tTerm('reports.tab.schedule.title') },
        ]}
      />

      {activeTab === 'dashboard' && (
        <DashboardTab metrics={metrics} monthlyData={monthlyData} statusData={statusData} />
      )}

      {activeTab === 'cashflow' && (
        <CashflowTab
          cashFlowYear={cashFlowYear}
          onCashFlowYearChange={setCashFlowYear}
          cashFlowData={cashFlowData}
          isCashFlowLoading={isCashFlowLoading}
          isCashFlowExporting={isCashFlowExporting}
          onExportCashFlow={handleExportCashFlow}
          reportExportGuard={reportExportGuard}
        />
      )}

      {activeTab === 'outstanding' && (
        <DataTableSurface>
          <div className="px-4 py-4 sm:px-5">
            <h3 className="font-medium">{tTerm('reports.outstanding.title')}</h3>
          </div>
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
        </DataTableSurface>
      )}

      {activeTab === 'profitability' && (
        <ProfitabilityTab
          profitabilityData={profitabilityData}
          analyticsYear={analyticsYear}
          onAnalyticsYearChange={setAnalyticsYear}
          advancedMetrics={advancedMetrics}
          advancedTrendSeries={advancedTrendSeries}
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
    </PageShell>
  );
}
