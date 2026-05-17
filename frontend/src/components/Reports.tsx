import React, { useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, Users, DollarSign, AlertCircle, Download, Wallet, CalendarClock } from 'lucide-react';
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
import { useTranslation } from '../i18n';
import {
  formatCurrency as formatCurrencyValue,
  formatDate as formatDateValue,
  formatNumber as formatNumberValue,
} from '../i18n/format';
import { getSafeErrorText } from '../services/safeErrorMessages';
import { tTerm } from '../i18n/terminology';
import { getPaymentTypeLabel } from '../constants/paymentTypes';
import { getChipClassName } from '../constants/uiChips';
import { useSessionStore } from '../store/sessionStore';
import { useOperationalActions } from './hooks/useOperationalActions';
import { useQueryClient } from '@tanstack/react-query';
import { resolveOperationalGuard } from '../services/operationalGuards';
import MeasuredChart from './shared/MeasuredChart';
import {
  ActionButton,
  DataTableSurface,
  EmptyState,
  FormField,
  InsightStrip,
  PageHeader,
  PageShell,
  SectionSurface,
  SelectInput,
  TextInput,
  ToolbarSurface,
  ViewTabs,
} from './shared/Surfaces';
import { HelpTooltip } from './shared/HelpSupport';

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

const formatMoney = (value: unknown) => formatCurrencyValue(value);

export default function Reports() {
  const queryClient = useQueryClient();
  const { executeGuardedAction } = useOperationalActions(queryClient);
  const { locale } = useTranslation();
  const { user } = useSessionStore();
  const { 
    dashboardData, 
    monthlyPerformance,
    statusBreakdown,
    overdueLoans,
    profitabilityItems,
    isLoading, 
    isError, 
    error 
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
  const [chartRange, setChartRange] = useState<'last6' | 'year' | 'historical'>('last6');
  const [isExporting, setIsExporting] = useState(false);
  const [analyticsYear, setAnalyticsYear] = useState<number>(new Date().getFullYear());
  const [cashFlowYear, setCashFlowYear] = useState<number>(new Date().getFullYear());
  const [isCashFlowExporting, setIsCashFlowExporting] = useState<'excel' | 'pdf' | null>(null);
  const [reportType, setReportType] = useState<'credits' | 'payouts'>('credits');
  const [reportRange, setReportRange] = useState<{ fromDate: string; toDate: string }>({ fromDate: '', toDate: '' });
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('');
  const [reportFormat, setReportFormat] = useState<'xlsx' | 'pdf' | 'csv'>('xlsx');

  const { performanceAnalysis, forecastAnalysis, nextMonthProjection } = useFinancialAnalytics(analyticsYear);
  const { data: cashFlowData, isLoading: isCashFlowLoading } = useMonthlyCashFlow(cashFlowYear);

  const metrics = dashboardData?.metrics || {
    totalActiveLoans: 0,
    totalDisbursed: 0,
    totalRecovered: 0,
    totalInterestGenerated: 0,
    totalInterestPaid: 0,
    arrearsRate: 0,
  };

  const monthlyData = monthlyPerformance ?? [];
  const filteredMonthlyData = useMemo(() => {
    if (chartRange === 'last6') {
      return monthlyData.slice(-6);
    }

    if (chartRange === 'year') {
      return monthlyData.slice(-12);
    }

    return monthlyData;
  }, [chartRange, monthlyData]);

  const chartRangeLabel = useMemo(() => {
    if (chartRange === 'last6') {
      return tTerm('reports.chart.disbursementRecovery.range.last6');
    }

    if (chartRange === 'year') {
      return tTerm('reports.chart.disbursementRecovery.range.year');
    }

    return tTerm('reports.chart.disbursementRecovery.range.historical');
  }, [chartRange, locale]);
  const hasKpiTotals = useMemo(
    () => Number(metrics.totalDisbursed || 0) > 0 || Number(metrics.totalRecovered || 0) > 0,
    [metrics.totalDisbursed, metrics.totalRecovered],
  );
  const chartHasData = useMemo(
    () => filteredMonthlyData.some((item: any) => Number(item?.disbursed || 0) > 0 || Number(item?.recovered || 0) > 0),
    [filteredMonthlyData],
  );
  const statusData = statusBreakdown ?? [];
  const profitabilityData = profitabilityItems ?? [];
  const advancedPerformance = performanceAnalysis?.data as any;
  const advancedForecast = forecastAnalysis?.data as any;
  const advancedProjection = nextMonthProjection?.data as any;

  const advancedMetrics = useMemo(() => {
    const collectionEfficiency = Number(
      advancedPerformance?.collectionEfficiency
      ?? advancedPerformance?.efficiency
      ?? advancedPerformance?.summary?.collectionEfficiency
      ?? 0,
    );

    const delinquencyTrend = Number(
      advancedForecast?.delinquencyTrend
      ?? advancedForecast?.riskTrend
      ?? advancedForecast?.summary?.delinquencyTrend
      ?? 0,
    );

    const projectedCollections = Number(
      advancedProjection?.projectedCollections
      ?? advancedProjection?.projectedRecovered
      ?? advancedProjection?.summary?.projectedCollections
      ?? 0,
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

  const reportExportGuard = resolveOperationalGuard('credit.report.download', {
    role: user?.role,
    permissions: user?.permissions,
  });

  const hasInvalidRange = Boolean(
    reportRange.fromDate && reportRange.toDate && reportRange.fromDate > reportRange.toDate,
  );

  const handleExportReport = async () => {
    setIsExporting(true);
    await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: user?.permissions },
      run: async () => {
        await exportDashboardSummary();
      },
      successMessage: tTerm('reports.toast.export.success'),
    });
    setIsExporting(false);
  };

  const handleExportContextualReport = async () => {
    setIsExporting(true);
    await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: user?.permissions },
      run: async () => {
        await exportContextualReport(reportType, {
          fromDate: reportRange.fromDate || undefined,
          toDate: reportRange.toDate || undefined,
          status: reportType === 'credits' && reportStatusFilter ? reportStatusFilter : undefined,
          format: reportType === 'credits' ? reportFormat : undefined,
        });
      },
      successMessage: reportType === 'credits' ? tTerm('reports.toast.contextual.credits') : tTerm('reports.toast.contextual.payouts'),
    });
    setIsExporting(false);
  };

  const handleExportCashFlow = async (format: 'excel' | 'pdf') => {
    setIsCashFlowExporting(format);
    await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: user?.permissions },
      run: async () => {
        if (format === 'excel') {
          await exportMonthlyCashFlowExcel(cashFlowYear);
          return;
        }
        await exportMonthlyCashFlowPdf(cashFlowYear);
      },
      successMessage: format === 'excel' ? tTerm('reports.toast.cashflow.excel') : tTerm('reports.toast.cashflow.pdf'),
    });
    setIsCashFlowExporting(null);
  };

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FormField label={tTerm('reports.export.type')}>
            <SelectInput
              id="report-type"
              value={reportType}
              onChange={(event) => setReportType(event.target.value as 'credits' | 'payouts')}
            >
              <option value="credits">{tTerm('reports.export.type.credits')}</option>
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
          <div className="flex items-end">
            <ActionButton
              variant="primary"
              fullWidth
              onClick={handleExportContextualReport}
              disabled={isExporting || hasInvalidRange || !reportExportGuard.executable}
              title={hasInvalidRange ? tTerm('reports.export.invalidRange') : (reportExportGuard.executable ? tTerm('reports.cta.exportContextual') : (reportExportGuard.reason || tTerm('credits.action.unavailable')))}
              icon={<Download size={16} />}
            >
              {isExporting ? tTerm('credits.cta.exporting') : (reportType === 'credits' ? tTerm('reports.cta.exportCredits') : tTerm('reports.cta.exportPayouts'))}
            </ActionButton>
          </div>
        </div>
        {reportType === 'credits' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
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
                onChange={(event) => setReportFormat(event.target.value as 'xlsx' | 'pdf' | 'csv')}
              >
                <option value="xlsx">Excel (xlsx)</option>
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
              </SelectInput>
            </FormField>
          </div>
        )}
        {hasInvalidRange && (
          <p className="mt-2 text-sm text-red-600">{tTerm('reports.export.invalidRange')}</p>
        )}
      </ToolbarSurface>
      )}

      <ViewTabs
        data-tour="reports-tabs"
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
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
        <>
      <InsightStrip
        aria-label={tTerm('reports.summary.aria')}
        items={[
          {
            id: 'reports-total-disbursed',
            label: tTerm('reports.kpi.totalDisbursed.label'),
            value: formatMoney(metrics.totalDisbursed),
            helper: tTerm('reports.kpi.totalDisbursed.helper'),
            icon: <DollarSign size={18} />,
            accent: 'blue',
          },
          {
            id: 'reports-interest-generated',
            label: tTerm('reports.kpi.interestGenerated.label'),
            value: formatMoney(metrics.totalInterestGenerated),
            helper: tTerm('reports.kpi.interestGenerated.helper'),
            icon: <TrendingUp size={18} />,
            accent: 'emerald',
          },
          {
            id: 'reports-interest-paid',
            label: tTerm('reports.kpi.interestPaid.label'),
            value: formatMoney(metrics.totalInterestPaid),
            helper: tTerm('reports.kpi.interestPaid.helper'),
            icon: <Wallet size={18} />,
            accent: 'rose',
          },
          {
            id: 'reports-active-loans',
            label: tTerm('reports.kpi.activeLoans.label'),
            value: metrics.totalActiveLoans,
            helper: tTerm('reports.kpi.activeLoans.helper'),
            icon: <Users size={18} />,
            accent: 'amber',
          },
        ]}
      />
      <p className="text-xs text-text-secondary mt-1">
        <span className="font-medium">{tTerm('reports.kpi.scope.label')}:</span> {tTerm('reports.kpi.scope.lifetime')}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionSurface className="lg:col-span-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">
                {tTerm('reports.chart.disbursementRecovery.title')}
              </h3>
              <HelpTooltip text={tTerm('reports.chart.disbursementRecovery.help')} align="right" />
            </div>
            <div className="min-w-44">
              <SelectInput
                aria-label={tTerm('reports.chart.range.aria')}
                value={chartRange}
                onChange={(event) => setChartRange(event.target.value as 'last6' | 'year' | 'historical')}
              >
                <option value="last6">{tTerm('reports.chart.disbursementRecovery.range.last6')}</option>
                <option value="year">{tTerm('reports.chart.disbursementRecovery.range.year')}</option>
                <option value="historical">{tTerm('reports.chart.disbursementRecovery.range.historical')}</option>
              </SelectInput>
            </div>
           </div>
          <p className="text-xs text-text-secondary mb-4">
            <span className="font-medium">{tTerm('reports.chart.scope.label')}:</span> {tTerm('reports.chart.scope.selectedRange')} {tTerm('reports.chart.scope.currentRangePrefix')} {chartRangeLabel}.
          </p>
          {chartHasData ? (
            <div className="h-72 w-full min-w-0 text-sm">
              <MeasuredChart className="h-full w-full min-w-0 text-sm" minHeight={288}>
                {({ width, height }) => (
                <AreaChart width={width} height={height} data={filteredMonthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} tickFormatter={(value) => `$${value/1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value) => [`$${value}`, '']}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Area type="monotone" name={tTerm('reports.chart.disbursementRecovery.legend.disbursed')} dataKey="disbursed" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorDes)" />
                  <Area type="monotone" name={tTerm('reports.chart.disbursementRecovery.legend.recovered')} dataKey="recovered" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRec)" />
                </AreaChart>
                )}
              </MeasuredChart>
            </div>
          ) : (
            <EmptyState
              className="h-72 rounded-xl border border-dashed border-border-subtle bg-bg-base"
              title={hasKpiTotals
                ? tTerm('reports.chart.disbursementRecovery.emptyWithKpi')
                : tTerm('reports.chart.disbursementRecovery.empty')}
              description={hasKpiTotals
                ? tTerm('reports.chart.disbursementRecovery.emptyWithKpiHint')
                : tTerm('reports.chart.disbursementRecovery.emptyHint')}
            />
          )}
        </SectionSurface>

        {/* Pie Chart */}
        <SectionSurface>
          <h3 className="font-medium mb-6">{tTerm('reports.chart.portfolio.title')}</h3>
          <div className="h-64 w-full min-w-0">
            <MeasuredChart className="h-full w-full min-w-0" minHeight={256}>
              {({ width, height }) => (
              <PieChart width={width} height={height}>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                >
                  {statusData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                  formatter={(value) => [`${value}`, tTerm('reports.chart.portfolio.quantity')]}
                />
              </PieChart>
              )}
            </MeasuredChart>
          </div>
          <div className="flex flex-col gap-3 mt-4">
            {statusData.map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-text-secondary capitalize">{item.status}</span>
                </div>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
            </SectionSurface>
          </div>
        </>
      )}

      {activeTab === 'cashflow' && (
        <div className="flex flex-col gap-6">
          <ToolbarSurface className="items-stretch lg:items-end">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-text-primary">{tTerm('reports.cashflow.title')}</h3>
              <p className="mt-1 text-sm text-text-secondary">
                {tTerm('reports.cashflow.subtitle')}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <FormField label={tTerm('reports.cashflow.year')}>
                <TextInput
                  type="number"
                  value={cashFlowYear}
                  min={2000}
                  max={2100}
                  onChange={(event) => setCashFlowYear(Number(event.target.value) || new Date().getFullYear())}
                  className="sm:w-32"
                />
              </FormField>
              <ActionButton
                onClick={() => handleExportCashFlow('excel')}
                disabled={Boolean(isCashFlowExporting) || !reportExportGuard.executable}
                title={reportExportGuard.executable ? tTerm('reports.cashflow.cta.exportExcel') : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
                icon={<Download size={16} />}
              >
                {isCashFlowExporting === 'excel' ? tTerm('credits.cta.exporting') : tTerm('reports.cashflow.cta.excel')}
              </ActionButton>
              <ActionButton
                onClick={() => handleExportCashFlow('pdf')}
                disabled={Boolean(isCashFlowExporting) || !reportExportGuard.executable}
                title={reportExportGuard.executable ? tTerm('reports.cashflow.cta.exportPdf') : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
                icon={<Download size={16} />}
              >
                {isCashFlowExporting === 'pdf' ? tTerm('credits.cta.exporting') : tTerm('reports.cashflow.cta.pdf')}
              </ActionButton>
            </div>
          </ToolbarSurface>

          <InsightStrip
            aria-label={tTerm('reports.cashflow.summary.aria')}
            items={[
              {
                id: 'cashflow-inflows',
                label: tTerm('reports.cashflow.summary.inflows.label'),
                value: formatMoney(cashFlowData?.summary?.totalInflows),
                helper: tTerm('reports.cashflow.summary.inflows.helper'),
                icon: <Wallet size={18} />,
                accent: 'emerald',
              },
              {
                id: 'cashflow-outflows',
                label: tTerm('reports.cashflow.summary.outflows.label'),
                value: formatMoney(cashFlowData?.summary?.totalOutflows),
                helper: tTerm('reports.cashflow.summary.outflows.helper'),
                icon: <DollarSign size={18} />,
                accent: 'blue',
              },
              {
                id: 'cashflow-available',
                label: tTerm('reports.cashflow.summary.available.label'),
                value: formatMoney(cashFlowData?.summary?.availableCash),
                helper: tTerm('reports.cashflow.summary.available.helper'),
                icon: <TrendingUp size={18} />,
                accent: 'slate',
              },
              {
                id: 'cashflow-net-result',
                label: tTerm('reports.cashflow.summary.netResult.label'),
                value: formatMoney(cashFlowData?.summary?.netProfitIndicator),
                helper: tTerm('reports.cashflow.summary.netResult.helper'),
                icon: <AlertCircle size={18} />,
                accent: Number(cashFlowData?.summary?.netProfitIndicator || 0) < 0 ? 'rose' : 'emerald',
              },
            ]}
          />

          <InsightStrip
            aria-label={tTerm('reports.cashflow.detail.aria')}
            items={[
              {
                id: 'cashflow-profit',
                label: tTerm('reports.cashflow.detail.profit.label'),
                value: formatMoney(cashFlowData?.summary?.totalCollectedProfit),
                helper: tTerm('reports.cashflow.detail.profit.helper'),
                icon: <TrendingUp size={18} />,
                accent: 'emerald',
              },
              {
                id: 'cashflow-loss-risk',
                label: tTerm('reports.cashflow.detail.lossRisk.label'),
                value: formatMoney(cashFlowData?.summary?.lossesAtRisk),
                helper: tTerm('reports.cashflow.detail.lossRisk.helper'),
                icon: <AlertCircle size={18} />,
                accent: 'rose',
              },
              {
                id: 'cashflow-payment-count',
                label: tTerm('reports.cashflow.detail.paymentCount.label'),
                value: formatNumberValue(cashFlowData?.summary?.paymentCount || 0),
                helper: tTerm('reports.cashflow.detail.paymentCount.helper'),
                icon: <Users size={18} />,
                accent: 'amber',
              },
            ]}
          />

          <DataTableSurface>
            <div className="px-4 py-4 sm:px-5">
              <h3 className="font-medium">{tTerm('reports.cashflow.table.title')}</h3>
              <p className="mt-1 text-sm text-text-secondary">
                {tTerm('reports.cashflow.table.subtitle')}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th>{tTerm('reports.cashflow.table.month')}</th>
                    <th>{tTerm('reports.cashflow.table.inflows')}</th>
                    <th>{tTerm('reports.cashflow.table.outflows')}</th>
                    <th>{tTerm('reports.cashflow.table.netFlow')}</th>
                    <th>{tTerm('reports.cashflow.table.available')}</th>
                    <th>{tTerm('reports.cashflow.table.profit')}</th>
                    <th>{tTerm('reports.cashflow.table.lossRisk')}</th>
                  </tr>
                </thead>
                <tbody>
                  {isCashFlowLoading ? (
                    <tr>
                      <td colSpan={7} className="table-empty-state">{tTerm('reports.cashflow.table.loading')}</td>
                    </tr>
                  ) : (cashFlowData?.months || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="table-empty-state">{tTerm('reports.cashflow.table.empty')}</td>
                    </tr>
                  ) : (
                    (cashFlowData?.months || []).map((month: any) => (
                      <tr key={month.month}>
                        <td className="font-medium">{month.month}</td>
                        <td className="text-emerald-600">{formatMoney(month.inflows)}</td>
                        <td className="text-blue-600">{formatMoney(month.outflows)}</td>
                        <td className={Number(month.netCashFlow || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          {formatMoney(month.netCashFlow)}
                        </td>
                        <td className="font-semibold">{formatMoney(month.availableCash)}</td>
                        <td className="text-emerald-600">{formatMoney(month.collectedProfit)}</td>
                        <td className={Number(month.lossesAtRisk || 0) > 0 ? 'text-rose-600' : 'text-text-secondary'}>
                          {formatMoney(month.lossesAtRisk)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DataTableSurface>
        </div>
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
                  <tr key={i}>
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
        <div className="flex flex-col gap-6">
          <DataTableSurface>
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
              <h3 className="font-medium">{tTerm('reports.profitability.title')}</h3>
              <FormField label={tTerm('reports.profitability.year')} className="md:w-36">
                <TextInput
                  type="number"
                  value={analyticsYear}
                  onChange={(event) => setAnalyticsYear(Number(event.target.value) || new Date().getFullYear())}
                />
              </FormField>
            </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  <th>{tTerm('reports.profitability.customer')}</th>
                  <th>{tTerm('reports.profitability.totalLoans')}</th>
                  <th>{tTerm('reports.profitability.interestCollected')}</th>
                  <th>{tTerm('reports.profitability.lateFeesCollected')}</th>
                  <th>{tTerm('reports.profitability.totalProfit')}</th>
                </tr>
              </thead>
              <tbody>
                {profitabilityData.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="font-medium">{item.customerName || tTerm('credits.label.customerFallback', { id: item.customerId })}</td>
                    <td>{item.totalLoans}</td>
                    <td className="text-emerald-600">{formatMoney(item.interestCollected)}</td>
                    <td className="text-amber-600">{formatMoney(item.lateFeesCollected)}</td>
                    <td className="font-bold text-brand-primary">{formatMoney(item.totalProfit)}</td>
                  </tr>
                ))}
                {profitabilityData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-empty-state">{tTerm('reports.profitability.empty')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </DataTableSurface>

          <InsightStrip
            aria-label={tTerm('reports.profitability.summary.aria')}
            items={[
              {
                id: 'profitability-efficiency',
                label: tTerm('reports.profitability.summary.collectionEfficiency.label'),
                value: `${advancedMetrics.collectionEfficiency.toFixed(2)}%`,
                helper: tTerm('reports.profitability.summary.collectionEfficiency.helper'),
                icon: <TrendingUp size={18} />,
                accent: 'emerald',
              },
              {
                id: 'profitability-delinquency',
                label: tTerm('reports.profitability.summary.delinquencyTrend.label'),
                value: `${advancedMetrics.delinquencyTrend.toFixed(2)}%`,
                helper: tTerm('reports.profitability.summary.delinquencyTrend.helper'),
                icon: <AlertCircle size={18} />,
                accent: 'rose',
              },
              {
                id: 'profitability-projected',
                label: tTerm('reports.profitability.summary.projectedCollections.label'),
                value: formatMoney(advancedMetrics.projectedCollections),
                helper: tTerm('reports.profitability.summary.projectedCollections.helper'),
                icon: <CalendarClock size={18} />,
                accent: 'blue',
              },
            ]}
          />

          <SectionSurface title={tTerm('reports.profitability.trend.title')}>
            {advancedTrendSeries.length > 0 ? (
              <div className="h-72 min-w-0">
                <MeasuredChart className="h-full min-w-0" minHeight={288}>
                  {({ width, height }) => (
                  <LineChart width={width} height={height} data={advancedTrendSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="recovered" stroke="#10b981" strokeWidth={2} dot={false} name={tTerm('reports.profitability.trend.recovered')} />
                    <Line type="monotone" dataKey="arrears" stroke="#ef4444" strokeWidth={2} dot={false} name={tTerm('reports.profitability.trend.arrears')} />
                  </LineChart>
                  )}
                </MeasuredChart>
              </div>
            ) : (
              <EmptyState compact title={tTerm('reports.profitability.trend.empty')} />
            )}
          </SectionSurface>
        </div>
      )}

      {activeTab === 'payouts' && (
        <div className="flex flex-col gap-6">
          {/* Summary Cards */}
          {payoutSummary && (
            <InsightStrip
              aria-label={tTerm('reports.payouts.summary.aria')}
              items={[
                {
                  id: 'payouts-count',
                  label: tTerm('reports.payouts.summary.count.label'),
                  value: formatNumberValue(payoutSummary.totalPayouts || 0),
                  helper: tTerm('reports.payouts.summary.count.helper'),
                  icon: <Wallet size={18} />,
                  accent: 'blue',
                },
                {
                  id: 'payouts-amount',
                  label: tTerm('reports.payouts.summary.amount.label'),
                  value: formatMoney(payoutSummary.totalAmount),
                  helper: tTerm('reports.payouts.summary.amount.helper'),
                  icon: <DollarSign size={18} />,
                  accent: 'emerald',
                },
                {
                  id: 'payouts-principal',
                  label: tTerm('reports.payouts.summary.principal.label'),
                  value: formatMoney(payoutSummary.totalPrincipal),
                  helper: tTerm('reports.payouts.summary.principal.helper'),
                  icon: <DollarSign size={18} />,
                  accent: 'slate',
                },
                {
                  id: 'payouts-interest',
                  label: tTerm('reports.payouts.summary.interest.label'),
                  value: formatMoney(payoutSummary.totalInterest),
                  helper: tTerm('reports.payouts.summary.interest.helper'),
                  icon: <TrendingUp size={18} />,
                  accent: 'emerald',
                },
                {
                  id: 'payouts-penalties',
                  label: tTerm('reports.payouts.summary.penalties.label'),
                  value: formatMoney(payoutSummary.totalPenalties),
                  helper: tTerm('reports.payouts.summary.penalties.helper'),
                  icon: <AlertCircle size={18} />,
                  accent: 'amber',
                },
              ]}
            />
          )}

          <DataTableSurface>
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
              <h3 className="font-medium">{tTerm('reports.payouts.table.title')}</h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
                  <FormField label={tTerm('reports.export.from')}>
                    <TextInput
                    type="date"
                    value={payoutFilters.fromDate || ''}
                    onChange={(e) => setPayoutFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
                    />
                  </FormField>
                  <span className="pb-2.5 text-sm text-text-secondary">a</span>
                  <FormField label={tTerm('reports.export.to')}>
                    <TextInput
                    type="date"
                    value={payoutFilters.toDate || ''}
                    onChange={(e) => setPayoutFilters((prev) => ({ ...prev, toDate: e.target.value }))}
                    />
                  </FormField>
                </div>
                <FormField label={tTerm('reports.payouts.table.rows')} className="w-24">
                  <SelectInput
                    value={payoutPageSize}
                    onChange={(event) => {
                      setPayoutPageSize(Number(event.target.value));
                      setPayoutPage(1);
                    }}
                  >
                    {[10, 20, 50, 100].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </SelectInput>
                </FormField>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th>{tTerm('reports.payouts.table.paymentId')}</th>
                    <th>{tTerm('payouts.table.loanId')}</th>
                    <th>{tTerm('payouts.table.date')}</th>
                    <th>{tTerm('payouts.table.amount')}</th>
                    <th>{tTerm('reports.payouts.summary.principal.label')}</th>
                    <th>{tTerm('reports.payouts.summary.interest.label')}</th>
                    <th>{tTerm('reports.payouts.summary.penalties.label')}</th>
                    <th>{tTerm('payouts.form.paymentType')}</th>
                    <th>{tTerm('payouts.table.method')}</th>
                  </tr>
                </thead>
                <tbody>
                  {isPayoutsLoading ? (
                    <tr>
                      <td colSpan={9} className="table-empty-state">{tTerm('reports.payouts.table.loading')}</td>
                    </tr>
                  ) : payouts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="table-empty-state">{tTerm('reports.payouts.table.empty')}</td>
                    </tr>
                  ) : (
                    payouts.map((payout: any, i: number) => (
                      <tr key={i}>
                        <td className="font-mono text-text-secondary">#{payout.id}</td>
                        <td className="font-mono text-blue-600 dark:text-blue-400">#{payout.loanId}</td>
                        <td>{formatDateValue(payout.paymentDate) || tTerm('common.notAvailable')}</td>
                        <td className="font-medium">{formatMoney(payout.amount)}</td>
                        <td className="text-text-secondary">{formatMoney(payout.principalApplied)}</td>
                        <td className="text-emerald-600">{formatMoney(payout.interestApplied)}</td>
                        <td className="text-amber-600">{formatMoney(payout.penaltyApplied)}</td>
                        <td>
                          <span className={`px-2 py-1 rounded text-xs ${getChipClassName('info')}`}>
                            {getPaymentTypeLabel(payout.paymentType)}
                          </span>
                        </td>
                        <td className="text-text-secondary capitalize">{payout.paymentMethod || 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {payoutPagination && payoutPagination.totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-border-subtle bg-bg-surface px-4 py-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {tTerm('reports.payouts.pagination.summary', {
                    from: (payoutPage - 1) * payoutPageSize + 1,
                    to: Math.min(payoutPage * payoutPageSize, payoutPagination.totalItems),
                    total: payoutPagination.totalItems,
                  })}
                </div>
                <div className="flex gap-2">
                  <ActionButton
                    disabled={payoutPage === 1}
                    onClick={() => setPayoutPage((currentPage) => currentPage - 1)}
                    variant="ghost"
                    className="min-h-8 px-3 py-1.5 text-xs"
                  >
                    Anterior
                  </ActionButton>
                  <ActionButton
                    disabled={payoutPage === payoutPagination.totalPages}
                    onClick={() => setPayoutPage((currentPage) => currentPage + 1)}
                    variant="ghost"
                    className="min-h-8 px-3 py-1.5 text-xs"
                  >
                    Siguiente
                  </ActionButton>
                </div>
              </div>
            )}
          </DataTableSurface>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="flex flex-col gap-6">
          <ToolbarSurface className="items-stretch lg:items-end">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium">{tTerm('reports.schedule.selectTitle')}</h3>
              <p className="mt-1 text-sm text-text-secondary">{tTerm('reports.schedule.selectSubtitle')}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <TextInput
                type="number"
                placeholder={tTerm('reports.schedule.inputPlaceholder')}
                value={selectedLoanId || ''}
                onChange={(e) => setSelectedLoanId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="sm:w-64"
              />
              <ActionButton
                variant="primary"
                onClick={() => {
                  void refetchSchedule();
                }}
                disabled={!selectedLoanId || isScheduleLoading}
              >
                {isScheduleLoading ? tTerm('reports.schedule.cta.loading') : tTerm('reports.schedule.cta.view')}
              </ActionButton>
            </div>
          </ToolbarSurface>

          {/* Schedule Display */}
          {scheduleLoan && scheduleSummary && (
            <>
              {/* Loan Summary */}
              <InsightStrip
                aria-label={tTerm('reports.schedule.summary.aria')}
                items={[
                  {
                    id: 'schedule-loan-amount',
                    label: tTerm('schedule.summary.loanAmount'),
                    value: formatMoney(scheduleLoan.amount),
                    helper: tTerm('schedule.summary.loanAmountHelper'),
                    icon: <DollarSign size={18} />,
                    accent: 'blue',
                  },
                  {
                    id: 'schedule-loan-term',
                    label: tTerm('schedule.summary.term'),
                    value: tTerm('schedule.summary.termValue', { months: scheduleLoan.termMonths }),
                    helper: tTerm('schedule.summary.termHelper'),
                    icon: <CalendarClock size={18} />,
                    accent: 'emerald',
                  },
                  {
                    id: 'schedule-loan-rate',
                    label: tTerm('schedule.summary.interestRate'),
                    value: `${scheduleLoan.interestRate}%`,
                    helper: tTerm('schedule.summary.interestRateHelper'),
                    icon: <TrendingUp size={18} />,
                    accent: 'amber',
                  },
                  {
                    id: 'schedule-loan-status',
                    label: tTerm('schedule.summary.status'),
                    value: <span className="capitalize">{scheduleLoan.status}</span>,
                    helper: tTerm('schedule.summary.statusHelper'),
                    icon: <AlertCircle size={18} />,
                    accent: 'slate',
                  },
                ]}
              />

              {/* Schedule Totals */}
              <InsightStrip
                aria-label={tTerm('reports.schedule.totals.aria')}
                items={[
                  {
                    id: 'schedule-total-principal',
                    label: tTerm('schedule.stats.totalPrincipal'),
                    value: formatMoney(scheduleSummary.totalPrincipal),
                    helper: tTerm('schedule.stats.totalPrincipalHelper'),
                    icon: <DollarSign size={18} />,
                    accent: 'slate',
                  },
                  {
                    id: 'schedule-total-interest',
                    label: tTerm('schedule.stats.totalInterest'),
                    value: formatMoney(scheduleSummary.totalInterest),
                    helper: tTerm('schedule.stats.totalInterestHelper'),
                    icon: <TrendingUp size={18} />,
                    accent: 'emerald',
                  },
                  {
                    id: 'schedule-total-payment',
                    label: tTerm('schedule.stats.totalPayment'),
                    value: formatMoney(scheduleSummary.totalPayment),
                    helper: tTerm('schedule.stats.totalPaymentHelper'),
                    icon: <Wallet size={18} />,
                    accent: 'blue',
                  },
                ]}
              />

              {/* Installment Progress */}
              <SectionSurface title={tTerm('reports.schedule.progress.title')}>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-4 bg-bg-base rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${(Number(scheduleSummary.paidInstallments) / Number(scheduleSummary.totalInstallments)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-text-secondary">
                    {tTerm('reports.schedule.progress.summary', { paid: scheduleSummary.paidInstallments, total: scheduleSummary.totalInstallments })}
                  </span>
                </div>
              </SectionSurface>

              <DataTableSurface>
                <div className="px-4 py-4 sm:px-5">
                  <h3 className="font-medium">{tTerm('reports.schedule.table.title')}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr>
                        <th>{tTerm('schedule.table.header.period')}</th>
                        <th>{tTerm('schedule.table.header.dueDate')}</th>
                        <th>{tTerm('schedule.table.header.openingBalance')}</th>
                        <th>{tTerm('schedule.table.header.scheduledPayment')}</th>
                        <th>{tTerm('schedule.table.header.principal')}</th>
                        <th>{tTerm('schedule.table.header.interest')}</th>
                        <th>{tTerm('schedule.table.header.remaining')}</th>
                        <th>{tTerm('schedule.table.header.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((entry: any, i: number) => (
                        <tr key={i}>
                          <td className="font-medium">{entry.installmentNumber || i + 1}</td>
                          <td>{formatDateValue(entry.dueDate) || tTerm('common.notAvailable')}</td>
                          <td>{formatMoney(entry.openingBalance)}</td>
                          <td className="font-medium">{formatMoney(entry.scheduledPayment)}</td>
                          <td className="text-text-secondary">{formatMoney(entry.principalComponent)}</td>
                          <td className="text-emerald-600">{formatMoney(entry.interestComponent)}</td>
                          <td>{formatMoney(entry.remainingBalance)}</td>
                          <td>
                            <span className={`px-2 py-1 rounded text-xs ${entry.status === 'paid' ? getChipClassName('success') : getChipClassName('warning')}`}>
                              {entry.status === 'paid' ? tTerm('schedule.status.paid') : tTerm('schedule.status.pending')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataTableSurface>
            </>
          )}

          {!scheduleLoan && !isScheduleLoading && (
            <DataTableSurface>
              <EmptyState
                icon={<CalendarClock size={22} />}
                title={tTerm('reports.schedule.empty.title')}
                description={tTerm('reports.schedule.empty.description')}
              />
            </DataTableSurface>
          )}
        </div>
      )}

    </PageShell>
  );
}
