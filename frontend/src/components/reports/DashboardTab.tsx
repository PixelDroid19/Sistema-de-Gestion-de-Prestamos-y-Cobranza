import { useMemo, useState, type ReactNode } from 'react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DollarSign, TrendingUp, Users, Wallet } from 'lucide-react';
import { formatCurrency as formatCurrencyValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import MeasuredChart from '../shared/MeasuredChart';
import {
  EmptyState,
  InsightStrip,
  OperationalSelect,
  SectionSurface,
} from '../shared/Surfaces';
import { HelpTooltip } from '../shared/HelpSupport';
import { getLoanStatusLabel } from '../credits/creditsHelpers';

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];
const formatMoney = (value: unknown) => formatCurrencyValue(value);

type DashboardTabProps = {
  metrics: any;
  monthlyData: any[];
  statusData: any[];
  headerActions?: ReactNode;
};

export default function DashboardTab({ metrics, monthlyData, statusData, headerActions }: DashboardTabProps) {
  const [chartRange, setChartRange] = useState<'last6' | 'year' | 'historical'>('last6');

  const filteredMonthlyData = useMemo(() => {
    if (chartRange === 'last6') return monthlyData.slice(-6);
    if (chartRange === 'year') return monthlyData.slice(-12);
    return monthlyData;
  }, [chartRange, monthlyData]);

  const hasKpiTotals = useMemo(
    () => Number(metrics.totalDisbursed || 0) > 0 || Number(metrics.totalRecovered || 0) > 0,
    [metrics.totalDisbursed, metrics.totalRecovered],
  );
  const chartRangeLabel = chartRange === 'last6'
    ? tTerm('reports.chart.disbursementRecovery.range.last6')
    : chartRange === 'year'
      ? tTerm('reports.chart.disbursementRecovery.range.year')
      : tTerm('reports.chart.disbursementRecovery.range.historical');

  const chartHasData = useMemo(
    () => filteredMonthlyData.some((item: any) => Number(item?.disbursed || 0) > 0 || Number(item?.recovered || 0) > 0),
    [filteredMonthlyData],
  );

  const labeledStatusData = useMemo(
    () => statusData.map((item: any) => ({
      ...item,
      statusLabel: getLoanStatusLabel(item?.status),
    })),
    [statusData],
  );

  return (
    <div className="report-tab-layout">
      {headerActions ? (
        <div className="report-tab-actions">
          {headerActions}
        </div>
      ) : null}

      <InsightStrip
        className="report-dashboard-strip"
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
      {hasKpiTotals && !chartHasData ? (
        <p className="text-xs text-text-secondary">
          <span className="font-medium">{tTerm('reports.kpi.scope.label')}:</span> {tTerm('reports.kpi.scope.lifetime')}
        </p>
      ) : null}

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
              <OperationalSelect
                aria-label={tTerm('reports.chart.range.aria')}
                value={chartRange}
                onChange={(event) => setChartRange(event.target.value as 'last6' | 'year' | 'historical')}
              >
                <option value="last6">{tTerm('reports.chart.disbursementRecovery.range.last6')}</option>
                <option value="year">{tTerm('reports.chart.disbursementRecovery.range.year')}</option>
                <option value="historical">{tTerm('reports.chart.disbursementRecovery.range.historical')}</option>
              </OperationalSelect>
            </div>
          </div>
          {hasKpiTotals && !chartHasData ? (
            <p className="mb-4 text-xs text-text-secondary">
              <span className="font-medium">{tTerm('reports.chart.scope.label')}:</span> {tTerm('reports.chart.scope.selectedRange')} {tTerm('reports.chart.scope.currentRangePrefix')} {chartRangeLabel}.
            </p>
          ) : null}
          {chartHasData ? (
            <div className="h-72 w-full min-w-0 text-sm">
              <MeasuredChart className="h-full w-full min-w-0 text-sm" minHeight={288}>
                {({ width, height }) => (
                  <AreaChart
                    accessibilityLayer={false}
                    role="img"
                    aria-label={tTerm('reports.chart.disbursementRecovery.title')}
                    width={width}
                    height={height}
                    data={filteredMonthlyData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
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

        <SectionSurface>
          <h3 className="font-medium mb-6">{tTerm('reports.chart.portfolio.title')}</h3>
          <div className="h-64 w-full min-w-0">
            <MeasuredChart className="h-full w-full min-w-0" minHeight={256}>
              {({ width, height }) => (
                <PieChart
                  accessibilityLayer={false}
                  role="img"
                  aria-label={tTerm('reports.chart.portfolio.title')}
                  width={width}
                  height={height}
                >
                  <Pie
                    data={labeledStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="statusLabel"
                    rootTabIndex={-1}
                  >
                    {labeledStatusData.map((entry: any, index: number) => (
                      <Cell key={`portfolio-cell-${entry.status ?? 'unknown'}-${index}`} fill={COLORS[index % COLORS.length]} />
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
            {labeledStatusData.map((item: any, index: number) => (
              <div key={`portfolio-status-${item.status ?? 'unknown'}-${index}`} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-text-secondary">{item.statusLabel}</span>
                </div>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </SectionSurface>
      </div>
    </div>
  );
}
