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

const formatMoney = (value: unknown) => `$${Number(value || 0).toLocaleString()}`;

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
  }, [chartRange]);
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
      successMessage: reportType === 'credits' ? 'Reporte de créditos exportado' : 'Reporte de pagos exportado',
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
      successMessage: format === 'excel' ? 'Flujo de caja exportado en Excel' : 'Flujo de caja exportado en PDF',
    });
    setIsCashFlowExporting(null);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-text-secondary">Cargando reportes…</div>;
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
            title={reportExportGuard.executable ? 'Exportar dashboard general' : (reportExportGuard.reason || 'Acción no disponible')}
            icon={<Download size={16} />}
          >
            {isExporting ? 'Exportando...' : tTerm('reports.cta.export')}
          </ActionButton>
        ) : null}
      />

      {reportExportGuard.visible && (
      <ToolbarSurface as="form" className="settings-config-form" aria-label="Exportar reportes por rango">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FormField label="Tipo de reporte">
            <SelectInput
              id="report-type"
              value={reportType}
              onChange={(event) => setReportType(event.target.value as 'credits' | 'payouts')}
            >
              <option value="credits">Créditos por rango</option>
              <option value="payouts">Pagos por rango</option>
            </SelectInput>
          </FormField>
          <FormField label="Desde">
            <TextInput
              id="report-from"
              type="date"
              value={reportRange.fromDate}
              onChange={(event) => setReportRange((prev) => ({ ...prev, fromDate: event.target.value }))}
            />
          </FormField>
          <FormField label="Hasta">
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
              title={hasInvalidRange ? 'El rango de fechas es inválido.' : (reportExportGuard.executable ? 'Exportar reporte contextual' : (reportExportGuard.reason || 'Acción no disponible'))}
              icon={<Download size={16} />}
            >
              {isExporting ? 'Exportando...' : (reportType === 'credits' ? 'Exportar créditos' : 'Exportar pagos')}
            </ActionButton>
          </div>
        </div>
        {reportType === 'credits' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
            <FormField label="Estado">
              <SelectInput
                id="report-status"
                value={reportStatusFilter}
                onChange={(event) => setReportStatusFilter(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="approved">Aprobado</option>
                <option value="active">Activo</option>
                <option value="overdue">Vencido</option>
                <option value="defaulted">En mora</option>
                <option value="closed">Cerrado</option>
                <option value="paid">Pagado</option>
              </SelectInput>
            </FormField>
            <FormField label="Formato">
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
          <p className="mt-2 text-sm text-red-600">La fecha "Desde" no puede ser mayor que "Hasta".</p>
        )}
      </ToolbarSurface>
      )}

      <ViewTabs
        data-tour="reports-tabs"
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
        tabs={[
          { id: 'dashboard', label: 'Dashboard General' },
          { id: 'cashflow', label: 'Flujo de caja', title: 'Control mensual de entradas, salidas y caja disponible' },
          { id: 'outstanding', label: 'Créditos en mora', title: 'Clientes y créditos con cuotas vencidas' },
          { id: 'profitability', label: 'Rentabilidad de clientes' },
          { id: 'payouts', label: 'Pagos y desembolsos', title: 'Resumen y detalle de pagos aplicados' },
          { id: 'schedule', label: 'Calendario de pagos', title: 'Cronograma de cuotas por crédito' },
        ]}
      />

      {activeTab === 'dashboard' && (
        <>
      <InsightStrip
        aria-label="Resumen general de reportes"
        items={[
          {
            id: 'reports-total-disbursed',
            label: 'Total desembolsado',
            value: formatMoney(metrics.totalDisbursed),
            helper: 'Capital entregado',
            icon: <DollarSign size={18} />,
            accent: 'blue',
          },
          {
            id: 'reports-interest-generated',
            label: 'Interés generado',
            value: formatMoney(metrics.totalInterestGenerated),
            helper: 'Programado en cronogramas',
            icon: <TrendingUp size={18} />,
            accent: 'emerald',
          },
          {
            id: 'reports-interest-paid',
            label: 'Interés pagado',
            value: formatMoney(metrics.totalInterestPaid),
            helper: 'Cobrado realmente',
            icon: <Wallet size={18} />,
            accent: 'rose',
          },
          {
            id: 'reports-active-loans',
            label: 'Créditos activos',
            value: metrics.totalActiveLoans,
            helper: 'Abiertos en cartera',
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
                aria-label="Rango de gráfica"
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
          <h3 className="font-medium mb-6">Estado de la Cartera</h3>
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
                  formatter={(value) => [`${value}`, 'Cantidad']}
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
              <h3 className="font-medium text-text-primary">Control financiero mensual</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Compara el dinero recibido por cuotas contra el capital entregado en préstamos. La caja disponible se calcula como entradas menos salidas acumuladas.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <FormField label="Año">
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
                title={reportExportGuard.executable ? 'Exportar flujo de caja mensual en Excel' : (reportExportGuard.reason || 'Acción no disponible')}
                icon={<Download size={16} />}
              >
                {isCashFlowExporting === 'excel' ? 'Exportando...' : 'Excel'}
              </ActionButton>
              <ActionButton
                onClick={() => handleExportCashFlow('pdf')}
                disabled={Boolean(isCashFlowExporting) || !reportExportGuard.executable}
                title={reportExportGuard.executable ? 'Exportar flujo de caja mensual en PDF' : (reportExportGuard.reason || 'Acción no disponible')}
                icon={<Download size={16} />}
              >
                {isCashFlowExporting === 'pdf' ? 'Exportando...' : 'PDF'}
              </ActionButton>
            </div>
          </ToolbarSurface>

          <InsightStrip
            aria-label="Resumen de flujo de caja"
            items={[
              {
                id: 'cashflow-inflows',
                label: 'Entradas por cuotas',
                value: formatMoney(cashFlowData?.summary?.totalInflows),
                helper: 'Pagos completados',
                icon: <Wallet size={18} />,
                accent: 'emerald',
              },
              {
                id: 'cashflow-outflows',
                label: 'Salidas por préstamos',
                value: formatMoney(cashFlowData?.summary?.totalOutflows),
                helper: 'Capital entregado',
                icon: <DollarSign size={18} />,
                accent: 'blue',
              },
              {
                id: 'cashflow-available',
                label: 'Caja disponible',
                value: formatMoney(cashFlowData?.summary?.availableCash),
                helper: 'Entradas menos salidas',
                icon: <TrendingUp size={18} />,
                accent: 'slate',
              },
              {
                id: 'cashflow-net-result',
                label: 'Resultado neto',
                value: formatMoney(cashFlowData?.summary?.netProfitIndicator),
                helper: 'Ganancia menos riesgo',
                icon: <AlertCircle size={18} />,
                accent: Number(cashFlowData?.summary?.netProfitIndicator || 0) < 0 ? 'rose' : 'emerald',
              },
            ]}
          />

          <InsightStrip
            aria-label="Detalle financiero del flujo de caja"
            items={[
              {
                id: 'cashflow-profit',
                label: 'Ganancia cobrada',
                value: formatMoney(cashFlowData?.summary?.totalCollectedProfit),
                helper: 'Interés y mora recibidos',
                icon: <TrendingUp size={18} />,
                accent: 'emerald',
              },
              {
                id: 'cashflow-loss-risk',
                label: 'Pérdidas en riesgo',
                value: formatMoney(cashFlowData?.summary?.lossesAtRisk),
                helper: 'Capital vencido/default',
                icon: <AlertCircle size={18} />,
                accent: 'rose',
              },
              {
                id: 'cashflow-payment-count',
                label: 'Pagos recibidos',
                value: Number(cashFlowData?.summary?.paymentCount || 0).toLocaleString(),
                helper: 'Operaciones completadas',
                icon: <Users size={18} />,
                accent: 'amber',
              },
            ]}
          />

          <DataTableSurface>
            <div className="px-4 py-4 sm:px-5">
              <h3 className="font-medium">Historial mensual</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Cada fila muestra el cuadre del mes y la caja acumulada disponible al cierre.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Entradas por cuotas</th>
                    <th>Salidas por préstamos</th>
                    <th>Flujo neto</th>
                    <th>Caja disponible</th>
                    <th>Ganancia cobrada</th>
                    <th>Pérdidas en riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {isCashFlowLoading ? (
                    <tr>
                      <td colSpan={7} className="table-empty-state">Cargando flujo de caja...</td>
                    </tr>
                  ) : (cashFlowData?.months || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="table-empty-state">No hay movimientos para el año seleccionado.</td>
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
            <h3 className="font-medium">Detalle de créditos en mora</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Días de Atraso</th>
                  <th>Monto en mora</th>
                  <th>Capital Restante</th>
                </tr>
              </thead>
              <tbody>
                {overdueLoans.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="font-medium">{item.customerName || `Cliente #${item.customerId}`}</td>
                    <td className="font-medium text-amber-600">{item.daysOverdue} días</td>
                    <td className="font-bold text-amber-600">${item.overdueAmount?.toLocaleString()}</td>
                    <td>${item.remainingCapital?.toLocaleString()}</td>
                  </tr>
                ))}
                {overdueLoans.length === 0 && (
                  <tr>
                    <td colSpan={4} className="table-empty-state">No hay créditos en mora.</td>
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
              <h3 className="font-medium">Rentabilidad por Cliente</h3>
              <FormField label="Año analítico" className="md:w-36">
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
                  <th>Cliente</th>
                  <th>Créditos totales</th>
                  <th>Interés Cobrado</th>
                  <th>Mora cobrada</th>
                  <th>Rentabilidad Total</th>
                </tr>
              </thead>
              <tbody>
                {profitabilityData.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="font-medium">{item.customerName || `Cliente #${item.customerId}`}</td>
                    <td>{item.totalLoans}</td>
                    <td className="text-emerald-600">${item.interestCollected?.toLocaleString()}</td>
                    <td className="text-amber-600">${item.lateFeesCollected?.toLocaleString()}</td>
                    <td className="font-bold text-brand-primary">${item.totalProfit?.toLocaleString()}</td>
                  </tr>
                ))}
                {profitabilityData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-empty-state">No hay datos de rentabilidad disponibles.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </DataTableSurface>

          <InsightStrip
            aria-label="Indicadores de rentabilidad de clientes"
            items={[
              {
                id: 'profitability-efficiency',
                label: 'Eficiencia de cobranza',
                value: `${advancedMetrics.collectionEfficiency.toFixed(2)}%`,
                helper: 'Recuperado vs esperado',
                icon: <TrendingUp size={18} />,
                accent: 'emerald',
              },
              {
                id: 'profitability-delinquency',
                label: 'Tendencia de mora',
                value: `${advancedMetrics.delinquencyTrend.toFixed(2)}%`,
                helper: 'Deterioro del periodo',
                icon: <AlertCircle size={18} />,
                accent: 'rose',
              },
              {
                id: 'profitability-projected',
                label: 'Cobro proyectado',
                value: formatMoney(advancedMetrics.projectedCollections),
                helper: 'Próximo mes',
                icon: <CalendarClock size={18} />,
                accent: 'blue',
              },
            ]}
          />

          <SectionSurface title="Tendencia avanzada de recuperación y mora">
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
                    <Line type="monotone" dataKey="recovered" stroke="#10b981" strokeWidth={2} dot={false} name="Recuperado" />
                    <Line type="monotone" dataKey="arrears" stroke="#ef4444" strokeWidth={2} dot={false} name="Mora" />
                  </LineChart>
                  )}
                </MeasuredChart>
              </div>
            ) : (
              <EmptyState compact title="No hay series avanzadas para el año seleccionado." />
            )}
          </SectionSurface>
        </div>
      )}

      {activeTab === 'payouts' && (
        <div className="flex flex-col gap-6">
          {/* Summary Cards */}
          {payoutSummary && (
            <InsightStrip
              aria-label="Resumen de pagos y desembolsos"
              items={[
                {
                  id: 'payouts-count',
                  label: 'Total pagos',
                  value: Number(payoutSummary.totalPayouts || 0).toLocaleString(),
                  helper: 'Operaciones del filtro',
                  icon: <Wallet size={18} />,
                  accent: 'blue',
                },
                {
                  id: 'payouts-amount',
                  label: 'Monto total',
                  value: formatMoney(payoutSummary.totalAmount),
                  helper: 'Total recibido',
                  icon: <DollarSign size={18} />,
                  accent: 'emerald',
                },
                {
                  id: 'payouts-principal',
                  label: 'Capital',
                  value: formatMoney(payoutSummary.totalPrincipal),
                  helper: 'Reduce saldo vivo',
                  icon: <DollarSign size={18} />,
                  accent: 'slate',
                },
                {
                  id: 'payouts-interest',
                  label: 'Interés',
                  value: formatMoney(payoutSummary.totalInterest),
                  helper: 'Interés cobrado',
                  icon: <TrendingUp size={18} />,
                  accent: 'emerald',
                },
                {
                  id: 'payouts-penalties',
                  label: 'Moras',
                  value: formatMoney(payoutSummary.totalPenalties),
                  helper: 'Penalidades cobradas',
                  icon: <AlertCircle size={18} />,
                  accent: 'amber',
                },
              ]}
            />
          )}

          <DataTableSurface>
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
              <h3 className="font-medium">Detalle de pagos</h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
                  <FormField label="Desde">
                    <TextInput
                    type="date"
                    value={payoutFilters.fromDate || ''}
                    onChange={(e) => setPayoutFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
                    />
                  </FormField>
                  <span className="pb-2.5 text-sm text-text-secondary">a</span>
                  <FormField label="Hasta">
                    <TextInput
                    type="date"
                    value={payoutFilters.toDate || ''}
                    onChange={(e) => setPayoutFilters((prev) => ({ ...prev, toDate: e.target.value }))}
                    />
                  </FormField>
                </div>
                <FormField label="Filas" className="w-24">
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
                    <th>ID Pago</th>
                    <th>ID crédito</th>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Capital</th>
                    <th>Interés</th>
                    <th>Mora</th>
                    <th>Tipo</th>
                    <th>Método</th>
                  </tr>
                </thead>
                <tbody>
                  {isPayoutsLoading ? (
                    <tr>
                      <td colSpan={9} className="table-empty-state">Cargando pagos...</td>
                    </tr>
                  ) : payouts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="table-empty-state">No hay pagos registrados.</td>
                    </tr>
                  ) : (
                    payouts.map((payout: any, i: number) => (
                      <tr key={i}>
                        <td className="font-mono text-text-secondary">#{payout.id}</td>
                        <td className="font-mono text-blue-600 dark:text-blue-400">#{payout.loanId}</td>
                        <td>{payout.paymentDate ? new Date(payout.paymentDate).toLocaleDateString() : 'N/A'}</td>
                        <td className="font-medium">${Number(payout.amount || 0).toLocaleString()}</td>
                        <td className="text-text-secondary">${Number(payout.principalApplied || 0).toLocaleString()}</td>
                        <td className="text-emerald-600">${Number(payout.interestApplied || 0).toLocaleString()}</td>
                        <td className="text-amber-600">${Number(payout.penaltyApplied || 0).toLocaleString()}</td>
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
                  Mostrando {(payoutPage - 1) * payoutPageSize + 1} a {Math.min(payoutPage * payoutPageSize, payoutPagination.totalItems)} de {payoutPagination.totalItems} pagos
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
              <h3 className="font-medium">Seleccionar crédito</h3>
              <p className="mt-1 text-sm text-text-secondary">Consulta el calendario operativo de un crédito específico.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <TextInput
                type="number"
                placeholder="Ingrese ID del crédito"
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
                {isScheduleLoading ? 'Cargando...' : 'Ver calendario'}
              </ActionButton>
            </div>
          </ToolbarSurface>

          {/* Schedule Display */}
          {scheduleLoan && scheduleSummary && (
            <>
              {/* Loan Summary */}
              <InsightStrip
                aria-label="Resumen del crédito consultado"
                items={[
                  {
                    id: 'schedule-loan-amount',
                    label: 'Monto del crédito',
                    value: formatMoney(scheduleLoan.amount),
                    helper: 'Capital original',
                    icon: <DollarSign size={18} />,
                    accent: 'blue',
                  },
                  {
                    id: 'schedule-loan-term',
                    label: 'Plazo',
                    value: `${scheduleLoan.termMonths} meses`,
                    helper: 'Tiempo pactado',
                    icon: <CalendarClock size={18} />,
                    accent: 'emerald',
                  },
                  {
                    id: 'schedule-loan-rate',
                    label: 'Tasa de interés',
                    value: `${scheduleLoan.interestRate}%`,
                    helper: 'Tasa anual',
                    icon: <TrendingUp size={18} />,
                    accent: 'amber',
                  },
                  {
                    id: 'schedule-loan-status',
                    label: 'Estado',
                    value: <span className="capitalize">{scheduleLoan.status}</span>,
                    helper: 'Situación operativa',
                    icon: <AlertCircle size={18} />,
                    accent: 'slate',
                  },
                ]}
              />

              {/* Schedule Totals */}
              <InsightStrip
                aria-label="Totales del calendario de pagos"
                items={[
                  {
                    id: 'schedule-total-principal',
                    label: 'Total capital',
                    value: formatMoney(scheduleSummary.totalPrincipal),
                    helper: 'Capital amortizado',
                    icon: <DollarSign size={18} />,
                    accent: 'slate',
                  },
                  {
                    id: 'schedule-total-interest',
                    label: 'Total interés',
                    value: formatMoney(scheduleSummary.totalInterest),
                    helper: 'Interés programado',
                    icon: <TrendingUp size={18} />,
                    accent: 'emerald',
                  },
                  {
                    id: 'schedule-total-payment',
                    label: 'Total a pagar',
                    value: formatMoney(scheduleSummary.totalPayment),
                    helper: 'Capital + interés',
                    icon: <Wallet size={18} />,
                    accent: 'blue',
                  },
                ]}
              />

              {/* Installment Progress */}
              <SectionSurface title="Progreso de cuotas">
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
                    {scheduleSummary.paidInstallments} de {scheduleSummary.totalInstallments} cuotas pagadas
                  </span>
                </div>
              </SectionSurface>

              <DataTableSurface>
                <div className="px-4 py-4 sm:px-5">
                  <h3 className="font-medium">Calendario de amortización</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Fecha vencimiento</th>
                        <th>Saldo inicial</th>
                        <th>Cuota</th>
                        <th>Capital</th>
                        <th>Interés</th>
                        <th>Saldo final</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((entry: any, i: number) => (
                        <tr key={i}>
                          <td className="font-medium">{entry.installmentNumber || i + 1}</td>
                          <td>{entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : 'N/A'}</td>
                          <td>${Number(entry.openingBalance || 0).toLocaleString()}</td>
                          <td className="font-medium">${Number(entry.scheduledPayment || 0).toLocaleString()}</td>
                          <td className="text-text-secondary">${Number(entry.principalComponent || 0).toLocaleString()}</td>
                          <td className="text-emerald-600">${Number(entry.interestComponent || 0).toLocaleString()}</td>
                          <td>${Number(entry.remainingBalance || 0).toLocaleString()}</td>
                          <td>
                            <span className={`px-2 py-1 rounded text-xs ${entry.status === 'paid' ? getChipClassName('success') : getChipClassName('warning')}`}>
                              {entry.status === 'paid' ? 'Pagado' : 'Pendiente'}
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
                title="Sin datos del calendario"
                description='Ingrese un ID de crédito y haga clic en "Ver calendario" para ver el calendario de pagos.'
              />
            </DataTableSurface>
          )}
        </div>
      )}

    </PageShell>
  );
}
