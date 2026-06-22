import { useMemo, type ReactNode } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Activity, AlertCircle, CalendarClock, Landmark, TrendingUp, Wallet } from 'lucide-react';
import { formatCompactCurrency, formatCurrency as formatCurrencyValue, formatNumber, formatPercent } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { parseReportYearInput } from '../../lib/reportYearInput';
import MeasuredChart from '../shared/MeasuredChart';
import {
  AppInput,
  EmptyState,
  FormField,
  SectionSurface,
} from '../shared/Surfaces';
import { ReportDataTableSection } from './ReportDataTableSection';
import { ReportMetricsSection } from './ReportMetricsSection';
import { ReportTabPanel } from './ReportTabPanel';
import { TableStatusPill } from '../shared/tables';

type AnalyticsTabProps = {
  analyticsYear: number;
  onAnalyticsYearChange: (year: number) => void;
  performanceAnalysis?: any;
  executiveDashboard?: any;
  comprehensiveAnalytics?: any;
  comparativeAnalysis?: any;
  forecastAnalysis?: any;
  nextMonthProjection?: any;
  exportActions?: ReactNode;
};

type AnalyticsComparisonRow = {
  id: string;
  type: 'currency' | 'count';
  label: string;
  current: number;
  previous: number;
  changePercent: number;
};

type AnalyticsMonthlyRow = {
  id: string;
  month: string;
  earnings: number;
  interest: number;
  penalties: number;
  movingAverage: number;
  changePercent: number;
  trend: string;
};

const formatMoney = (value: unknown) => formatCurrencyValue(value);
const formatChartMoney = (value: unknown) => formatCompactCurrency(value);

const MONTH_LABEL_PATTERN = /^(\d{4})-(\d{2})$/;

const toNumber = (value: unknown) => {
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatSignedPercent = (value: unknown) => {
  const numericValue = toNumber(value);
  const prefix = numericValue > 0 ? '+' : '';
  return `${prefix}${formatPercent(numericValue, { maximumFractionDigits: 2 })}`;
};

const getChangeToneClassName = (value: unknown) => {
  const numericValue = toNumber(value);
  if (numericValue > 0) return 'text-emerald-600';
  if (numericValue < 0) return 'text-rose-600';
  return 'text-text-secondary';
};

const getTrendLabel = (value: unknown) => {
  const trendKey = String(value || 'stable');
  if (trendKey === 'up') return tTerm('reports.analytics.trend.up');
  if (trendKey === 'down') return tTerm('reports.analytics.trend.down');
  return tTerm('reports.analytics.trend.stable');
};

const getTrendClassName = (value: unknown) => {
  const trendKey = String(value || 'stable');
  if (trendKey === 'up') return 'bg-emerald-100 text-emerald-700';
  if (trendKey === 'down') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-700';
};

const getConfidenceLabel = (value: unknown) => {
  const level = String(value || 'low');
  if (level === 'medium') return tTerm('reports.analytics.projection.confidence.medium');
  if (level === 'high') return tTerm('reports.analytics.projection.confidence.high');
  return tTerm('reports.analytics.projection.confidence.low');
};

const getConfidenceClassName = (value: unknown) => {
  const level = String(value || 'low');
  if (level === 'high') return 'bg-emerald-100 text-emerald-700';
  if (level === 'medium') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
};

const deriveNextMonthLabel = (value: unknown) => {
  const monthLabel = String(value || '').trim();
  const match = MONTH_LABEL_PATTERN.exec(monthLabel);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  const nextDate = new Date(year, month, 1);
  const nextYear = nextDate.getFullYear();
  const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
};

export default function AnalyticsTab({
  analyticsYear,
  onAnalyticsYearChange,
  performanceAnalysis,
  executiveDashboard,
  comprehensiveAnalytics,
  comparativeAnalysis,
  forecastAnalysis,
  nextMonthProjection,
  exportActions,
}: AnalyticsTabProps) {
  const handleYearChange = (value: string) => {
    const parsedYear = parseReportYearInput(value);
    if (parsedYear !== null) {
      onAnalyticsYearChange(parsedYear);
    }
  };

  const summary = performanceAnalysis?.summary
    ?? comprehensiveAnalytics?.summary
    ?? executiveDashboard?.summary
    ?? {};

  const yearOverYear = comprehensiveAnalytics?.yearOverYear ?? {};
  const comparison = comparativeAnalysis?.comparison ?? {};
  const forecast = forecastAnalysis?.forecast ?? {};
  const forecastAnalysisSummary = forecastAnalysis?.analysis ?? {};
  const projection = nextMonthProjection?.projection ?? {};
  const projectionHistory = nextMonthProjection?.historicalSummary ?? {};
  const currentYear = new Date().getFullYear();
  const usesCurrentProjection = analyticsYear === currentYear && projection?.projectedEarnings != null;

  const comparisonRows = useMemo<AnalyticsComparisonRow[]>(() => ([
    {
      id: 'earnings',
      type: 'currency' as const,
      label: tTerm('reports.analytics.comparison.earnings'),
      current: comparison?.earnings?.current ?? summary.totalEarnings ?? 0,
      previous: comparison?.earnings?.previous ?? yearOverYear.previousYearEarnings ?? 0,
      changePercent: comparison?.earnings?.changePercent ?? yearOverYear.earningsChange ?? 0,
    },
    {
      id: 'interest',
      type: 'currency' as const,
      label: tTerm('reports.analytics.comparison.interest'),
      current: comparison?.interest?.current ?? summary.totalInterest ?? 0,
      previous: comparison?.interest?.previous ?? executiveDashboard?.previousYear?.totalInterest ?? 0,
      changePercent: comparison?.interest?.changePercent ?? 0,
    },
    {
      id: 'penalties',
      type: 'currency' as const,
      label: tTerm('reports.analytics.comparison.penalties'),
      current: comparison?.penalties?.current ?? summary.totalPenalties ?? 0,
      previous: comparison?.penalties?.previous ?? 0,
      changePercent: comparison?.penalties?.changePercent ?? 0,
    },
    {
      id: 'payments',
      type: 'count' as const,
      label: tTerm('reports.analytics.comparison.payments'),
      current: comparison?.payments?.current ?? summary.paymentCount ?? 0,
      previous: comparison?.payments?.previous ?? executiveDashboard?.previousYear?.paymentCount ?? 0,
      changePercent: comparison?.payments?.changePercent ?? 0,
    },
    {
      id: 'capital',
      type: 'currency' as const,
      label: tTerm('reports.analytics.comparison.loanAmount'),
      current: comparison?.loanAmount?.current ?? summary.totalLoanAmount ?? executiveDashboard?.summary?.portfolioAmount ?? 0,
      previous: comparison?.loanAmount?.previous ?? 0,
      changePercent: comparison?.loanAmount?.changePercent ?? 0,
    },
  ]), [comparison, executiveDashboard?.previousYear?.paymentCount, executiveDashboard?.previousYear?.totalInterest, executiveDashboard?.summary?.portfolioAmount, summary.paymentCount, summary.totalEarnings, summary.totalInterest, summary.totalLoanAmount, summary.totalPenalties, yearOverYear.earningsChange, yearOverYear.previousYearEarnings]);

  const monthlyRows = useMemo<AnalyticsMonthlyRow[]>(() => {
    const detailedRows = Array.isArray(comprehensiveAnalytics?.monthlyDetails)
      ? comprehensiveAnalytics.monthlyDetails
      : Array.isArray(performanceAnalysis?.monthlyPerformance)
        ? performanceAnalysis.monthlyPerformance
        : Array.isArray(executiveDashboard?.monthlyEarnings)
          ? executiveDashboard.monthlyEarnings
          : [];

    return detailedRows.map((row: any, index: number): AnalyticsMonthlyRow => ({
      id: `${row?.month || 'month'}-${index}`,
      month: row?.month || `${tTerm('reports.chart.disbursementRecovery.monthFallbackPrefix')} ${index + 1}`,
      earnings: toNumber(row?.totalEarnings ?? row?.earnings),
      interest: toNumber(row?.totalInterest ?? row?.interest),
      penalties: toNumber(row?.totalPenalties ?? row?.penalties),
      movingAverage: toNumber(row?.movingAverage ?? 0),
      changePercent: toNumber(row?.changePercent ?? 0),
      trend: row?.trend || 'stable',
    }));
  }, [comprehensiveAnalytics?.monthlyDetails, executiveDashboard?.monthlyEarnings, performanceAnalysis?.monthlyPerformance]);

  const forecastHistory = useMemo(
    () => Array.isArray(forecastAnalysis?.historicalData) ? forecastAnalysis.historicalData : [],
    [forecastAnalysis?.historicalData],
  );

  const selectedProjectionValue = usesCurrentProjection
    ? projection?.projectedEarnings ?? forecast?.nextMonthEarnings
    : forecast?.nextMonthEarnings;

  const selectedProjectionMonth = usesCurrentProjection
    ? projection?.month
    : deriveNextMonthLabel(
      forecastHistory[forecastHistory.length - 1]?.month
      ?? monthlyRows[monthlyRows.length - 1]?.month,
    );

  const selectedProjectionAverage = usesCurrentProjection
    ? projectionHistory?.averageEarnings
    : (
      forecastHistory.length > 0
        ? forecastHistory.reduce((sum: number, entry: Record<string, unknown>) => sum + toNumber(entry?.earnings), 0) / forecastHistory.length
        : 0
    );

  const selectedProjectionLastMonth = usesCurrentProjection
    ? projectionHistory?.lastMonthEarnings
    : forecastHistory[forecastHistory.length - 1]?.earnings;

  const projectionHighlights = useMemo(() => ([
    {
      id: 'trend',
      label: tTerm('reports.analytics.projection.trend'),
      value: getTrendLabel(forecastAnalysisSummary?.trend),
      className: getTrendClassName(forecastAnalysisSummary?.trend),
    },
    ...(usesCurrentProjection
      ? [{
        id: 'confidence',
        label: tTerm('reports.analytics.projection.confidence.label'),
        value: getConfidenceLabel(projection?.confidenceLevel),
        className: getConfidenceClassName(projection?.confidenceLevel),
      }]
      : []),
  ]), [forecastAnalysisSummary?.trend, projection?.confidenceLevel, usesCurrentProjection]);

  const primaryItems = useMemo(() => ([
    {
      id: 'analytics-total-earnings',
      label: tTerm('reports.analytics.kpi.totalEarnings.label'),
      value: formatMoney(summary.totalEarnings),
      helper: tTerm('reports.analytics.kpi.totalEarnings.helper'),
      icon: <TrendingUp size={18} />,
      accent: 'emerald' as const,
    },
    {
      id: 'analytics-total-interest',
      label: tTerm('reports.analytics.kpi.totalInterest.label'),
      value: formatMoney(summary.totalInterest),
      helper: tTerm('reports.analytics.kpi.totalInterest.helper'),
      icon: <Wallet size={18} />,
      accent: 'blue' as const,
    },
    {
      id: 'analytics-penalties',
      label: tTerm('reports.analytics.kpi.totalPenalties.label'),
      value: formatMoney(summary.totalPenalties),
      helper: tTerm('reports.analytics.kpi.totalPenalties.helper'),
      icon: <AlertCircle size={18} />,
      accent: 'rose' as const,
    },
    {
      id: 'analytics-yoy-change',
      label: tTerm('reports.analytics.kpi.yearOverYear.label'),
      value: formatSignedPercent(comparison?.earnings?.changePercent ?? yearOverYear.earningsChange ?? 0),
      helper: tTerm('reports.analytics.kpi.yearOverYear.helper'),
      icon: <Activity size={18} />,
      accent: 'amber' as const,
    },
  ]), [comparison?.earnings?.changePercent, summary.totalEarnings, summary.totalInterest, summary.totalPenalties, yearOverYear.earningsChange]);

  const secondaryItems = useMemo(() => ([
    {
      id: 'analytics-next-projection',
      label: tTerm('reports.analytics.kpi.nextProjection.label'),
      value: formatMoney(selectedProjectionValue),
      helper: tTerm(
        usesCurrentProjection
          ? 'reports.analytics.kpi.nextProjection.helper'
          : 'reports.analytics.kpi.nextProjection.helperHistoricalYear',
      ),
      icon: <CalendarClock size={18} />,
      accent: 'slate' as const,
    },
    {
      id: 'analytics-payments',
      label: tTerm('reports.analytics.kpi.paymentCount.label'),
      value: formatNumber(summary.paymentCount),
      helper: tTerm('reports.analytics.kpi.paymentCount.helper'),
      icon: <Activity size={18} />,
      accent: 'blue' as const,
    },
    {
      id: 'analytics-loans',
      label: tTerm('reports.analytics.kpi.totalLoans.label'),
      value: formatNumber(summary.totalLoans ?? executiveDashboard?.summary?.totalActiveLoans),
      helper: tTerm('reports.analytics.kpi.totalLoans.helper'),
      icon: <Landmark size={18} />,
      accent: 'amber' as const,
    },
    {
      id: 'analytics-loan-amount',
      label: tTerm('reports.analytics.kpi.totalLoanAmount.label'),
      value: formatMoney(summary.totalLoanAmount ?? executiveDashboard?.summary?.portfolioAmount),
      helper: tTerm('reports.analytics.kpi.totalLoanAmount.helper'),
      icon: <Wallet size={18} />,
      accent: 'slate' as const,
    },
    {
      id: 'analytics-moving-average',
      label: tTerm('reports.analytics.kpi.movingAverage.label'),
      value: formatMoney(forecastAnalysisSummary?.currentMovingAverage ?? executiveDashboard?.trends?.earningsMovingAverage),
      helper: tTerm('reports.analytics.kpi.movingAverage.helper'),
      icon: <TrendingUp size={18} />,
      accent: 'emerald' as const,
    },
  ]), [executiveDashboard?.summary?.portfolioAmount, executiveDashboard?.summary?.totalActiveLoans, executiveDashboard?.trends?.earningsMovingAverage, forecastAnalysisSummary?.currentMovingAverage, selectedProjectionValue, summary.paymentCount, summary.totalLoanAmount, summary.totalLoans, usesCurrentProjection]);

  return (
    <div className="report-tab-layout">
      <ReportTabPanel
        title={tTerm('reports.analytics.title')}
        subtitle={tTerm('reports.analytics.subtitle')}
        filterColumns={2}
        headerActions={exportActions}
        filters={(
          <FormField label={tTerm('reports.analytics.year')}>
            <AppInput
              variant="integer"
              value={String(analyticsYear)}
              onValueChange={(value) => handleYearChange(value)}
            />
          </FormField>
        )}
      />

      <ReportMetricsSection
        primaryAriaLabel={tTerm('reports.analytics.summary.aria')}
        secondaryAriaLabel={tTerm('reports.analytics.summary.moreAria')}
        detailModalTitle={tTerm('reports.analytics.summary.moreTitle')}
        detailModalSubtitle={tTerm('reports.analytics.summary.moreSubtitle')}
        primaryItems={primaryItems}
        secondaryItems={secondaryItems}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.95fr)] gap-6">
        <SectionSurface
          title={tTerm('reports.analytics.chart.title')}
          subtitle={tTerm('reports.analytics.chart.subtitle')}
        >
          {monthlyRows.length > 0 ? (
            <div className="h-80 min-w-0">
              <MeasuredChart className="h-full min-w-0" minHeight={320}>
                {({ width, height }) => (
                  <LineChart
                    accessibilityLayer={false}
                    role="img"
                    aria-label={tTerm('reports.analytics.chart.title')}
                    width={width}
                    height={height}
                    data={monthlyRows}
                    margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(value) => formatChartMoney(value)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: unknown) => [formatMoney(value), '']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="earnings" stroke="#2563eb" strokeWidth={2.5} dot={false} name={tTerm('reports.analytics.chart.earnings')} />
                    <Line type="monotone" dataKey="interest" stroke="#10b981" strokeWidth={2.5} dot={false} name={tTerm('reports.analytics.chart.interest')} />
                    <Line type="monotone" dataKey="penalties" stroke="#ef4444" strokeWidth={2.25} dot={false} name={tTerm('reports.analytics.chart.penalties')} />
                    <Line type="monotone" dataKey="movingAverage" stroke="#f59e0b" strokeWidth={2} dot={false} name={tTerm('reports.analytics.chart.movingAverage')} />
                  </LineChart>
                )}
              </MeasuredChart>
            </div>
          ) : (
            <EmptyState
              compact
              title={tTerm('reports.analytics.chart.empty')}
              description={tTerm('reports.analytics.chart.emptyHint')}
            />
          )}
        </SectionSurface>

        <SectionSurface
          title={tTerm('reports.analytics.projection.title')}
          subtitle={tTerm(
            usesCurrentProjection
              ? 'reports.analytics.projection.subtitle'
              : 'reports.analytics.projection.subtitleHistoricalYear',
          )}
          bodyClassName="space-y-4"
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                {tTerm('reports.analytics.projection.nextMonth')}
              </p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">
                {formatMoney(selectedProjectionValue)}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {usesCurrentProjection
                  ? tTerm('reports.analytics.projection.reference', {
                    month: selectedProjectionMonth || tTerm('common.notAvailable'),
                    months: formatNumber(projection?.basedOnMonths || 0),
                  })
                  : tTerm('reports.analytics.projection.referenceHistoricalYear', {
                    month: selectedProjectionMonth || tTerm('common.notAvailable'),
                  })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {projectionHighlights.map((item) => (
                <TableStatusPill key={item.id} className={item.className}>
                  {item.label}: {item.value}
                </TableStatusPill>
              ))}
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-text-secondary">{tTerm('reports.analytics.projection.averageEarnings')}</dt>
                <dd className="mt-1 font-semibold text-text-primary">{formatMoney(selectedProjectionAverage)}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-secondary">{tTerm('reports.analytics.projection.lastMonthEarnings')}</dt>
                <dd className="mt-1 font-semibold text-text-primary">{formatMoney(selectedProjectionLastMonth)}</dd>
              </div>
            </dl>
          </div>
        </SectionSurface>
      </div>

      <ReportDataTableSection
        title={tTerm('reports.analytics.comparison.title')}
        subtitle={tTerm('reports.analytics.comparison.subtitle')}
        minWidthClassName="min-w-[780px]"
      >
        <thead>
          <tr>
            <th>{tTerm('reports.analytics.comparison.metric')}</th>
            <th>{tTerm('reports.analytics.comparison.current')}</th>
            <th>{tTerm('reports.analytics.comparison.previous')}</th>
            <th>{tTerm('reports.analytics.comparison.change')}</th>
          </tr>
        </thead>
        <tbody>
          {comparisonRows.map((row) => (
            <tr key={row.id}>
              <td className="font-medium">{row.label}</td>
              <td>{row.type === 'count' ? formatNumber(row.current) : formatMoney(row.current)}</td>
              <td>{row.type === 'count' ? formatNumber(row.previous) : formatMoney(row.previous)}</td>
              <td className={`font-semibold ${getChangeToneClassName(row.changePercent)}`}>
                {formatSignedPercent(row.changePercent)}
              </td>
            </tr>
          ))}
        </tbody>
      </ReportDataTableSection>

      <ReportDataTableSection
        title={tTerm('reports.analytics.monthlyTable.title')}
        subtitle={tTerm('reports.analytics.monthlyTable.subtitle')}
        minWidthClassName="min-w-[920px]"
      >
        <thead>
          <tr>
            <th>{tTerm('reports.analytics.monthlyTable.month')}</th>
            <th>{tTerm('reports.analytics.monthlyTable.earnings')}</th>
            <th>{tTerm('reports.analytics.monthlyTable.interest')}</th>
            <th>{tTerm('reports.analytics.monthlyTable.penalties')}</th>
            <th>{tTerm('reports.analytics.monthlyTable.change')}</th>
            <th>{tTerm('reports.analytics.monthlyTable.trend')}</th>
            <th>{tTerm('reports.analytics.monthlyTable.movingAverage')}</th>
          </tr>
        </thead>
        <tbody>
          {monthlyRows.map((row) => (
            <tr key={row.id}>
              <td className="font-medium">{row.month}</td>
              <td>{formatMoney(row.earnings)}</td>
              <td>{formatMoney(row.interest)}</td>
              <td>{formatMoney(row.penalties)}</td>
              <td className={getChangeToneClassName(row.changePercent)}>{formatSignedPercent(row.changePercent)}</td>
              <td>
                <TableStatusPill className={getTrendClassName(row.trend)}>
                  {getTrendLabel(row.trend)}
                </TableStatusPill>
              </td>
              <td>{formatMoney(row.movingAverage)}</td>
            </tr>
          ))}
          {monthlyRows.length === 0 ? (
            <tr>
              <td colSpan={7} className="table-empty-state">{tTerm('reports.analytics.monthlyTable.empty')}</td>
            </tr>
          ) : null}
        </tbody>
      </ReportDataTableSection>
    </div>
  );
}
