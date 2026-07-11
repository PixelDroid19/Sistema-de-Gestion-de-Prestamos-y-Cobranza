import { useMemo } from 'react';
import { AlertTriangle, BarChart3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { useDashboardReport } from '../services/reportService';
import { useTranslation } from '../i18n';
import { formatCurrency as formatCurrencyValue } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { getSafeErrorText } from '../services/safeErrorMessages';
import MeasuredChart from './shared/MeasuredChart';
import { ActionButton, EmptyState, PageHeader, PageShell, SectionSurface, StatusChip } from './shared/Surfaces';

type DashboardMonthlyPerformanceLike = {
  month?: string;
  inflows?: number | string;
  outflows?: number | string;
  disbursed?: number | string;
  recovered?: number | string;
};

const formatDashboardMonth = (monthKey: string, locale: string, options: Intl.DateTimeFormatOptions) => {
  const match = /^([0-9]{4})-([0-9]{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return monthKey;
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(/\./g, '');
};

export const buildDashboardMonthlyChartData = (
  monthlyPerformance: DashboardMonthlyPerformanceLike[],
  locale = 'es-CO',
) => monthlyPerformance.map((entry) => {
  const monthKey = String(entry?.month || '').trim();
  return {
    name: formatDashboardMonth(monthKey, locale, { month: 'short', year: 'numeric' }),
    fullLabel: formatDashboardMonth(monthKey, locale, { month: 'long', year: 'numeric' }),
    inflows: Number(entry?.inflows ?? entry?.recovered ?? 0),
    outflows: Number(entry?.outflows ?? entry?.disbursed ?? 0),
  };
});

type MetricProps = { label: string; value: string; detail?: string; danger?: boolean };

function OperationalMetric({ label, value, detail, danger = false }: MetricProps) {
  return (
    <article className="min-w-0 border-b border-border-subtle px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{label}</p>
      <p className={`mt-2 truncate font-mono text-xl font-semibold tabular-nums ${danger ? 'text-danger' : 'text-text-primary'}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-text-secondary">{detail}</p> : null}
    </article>
  );
}

export default function Dashboard() {
  const { dashboardData, isLoading, isError, error, refetch } = useDashboardReport();
  const { locale } = useTranslation();
  const money = (value: unknown) => formatCurrencyValue(Number(value || 0));
  const position = dashboardData?.position || {};
  const period = dashboardData?.period || {};
  const risk = dashboardData?.risk || {};
  const trend = Array.isArray(dashboardData?.trend) ? dashboardData.trend : [];
  const chartData = useMemo(() => buildDashboardMonthlyChartData(trend, locale), [trend, locale]);
  const netNegative = Number(period.netResult || 0) < 0;

  if (isLoading) return <PageShell><EmptyState title={tTerm('dashboard.loading')} icon={<BarChart3 size={18} />} compact /></PageShell>;
  if (isError) {
    return (
      <PageShell>
        <EmptyState
          title={tTerm('dashboard.error.title')}
          description={getSafeErrorText(error, { domain: 'reports', action: 'reports.load' })}
          icon={<AlertTriangle size={18} />}
          action={<ActionButton onClick={() => void refetch()}>{tTerm('dashboard.error.retry')}</ActionButton>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell data-tour="dashboard-page">
      <PageHeader title={tTerm('dashboard.module.title')} subtitle={tTerm('dashboard.module.subtitle')} guideKey="dashboard" tourId="dashboard-header" />

      <SectionSurface title={tTerm('dashboard.position.title')} subtitle={tTerm('dashboard.position.subtitle')} bodyClassName="grid sm:grid-cols-2 xl:grid-cols-5">
        <OperationalMetric label={tTerm('dashboard.position.availableCash')} value={money(position.availableCash)} danger={Number(position.availableCash || 0) < 0} />
        <OperationalMetric label={tTerm('dashboard.position.receivables')} value={money(position.receivables)} />
        <OperationalMetric label={tTerm('dashboard.position.capitalPlaced')} value={money(position.capitalPlaced)} />
        <OperationalMetric label={tTerm('dashboard.position.associateCapital')} value={money(position.associateCapital)} />
        <OperationalMetric label={tTerm('dashboard.position.associateLiabilities')} value={money(position.associateLiabilities)} />
      </SectionSurface>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <SectionSurface title={tTerm('dashboard.period.title')} subtitle={tTerm('dashboard.period.subtitle')} bodyClassName="grid sm:grid-cols-2 xl:grid-cols-3">
          <OperationalMetric label={tTerm('dashboard.period.collections')} value={money(period.collections)} />
          <OperationalMetric label={tTerm('dashboard.period.associateContributions')} value={money(period.associateContributions)} />
          <OperationalMetric label={tTerm('dashboard.period.disbursements')} value={money(period.disbursements)} />
          <OperationalMetric label={tTerm('dashboard.period.operatingExpenses')} value={money(period.operatingExpenses)} />
          <OperationalMetric label={tTerm('dashboard.period.associatePayments')} value={money(period.associatePayments)} />
          <OperationalMetric label={tTerm('dashboard.period.capitalReturns')} value={money(period.capitalReturns)} />
          <div className="border-t border-border-subtle px-4 py-4 sm:col-span-2 xl:col-span-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{tTerm('dashboard.period.netResult')}</p>
                <p className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${netNegative ? 'text-danger' : 'text-text-primary'}`}>{money(period.netResult)}</p>
              </div>
              <p className="max-w-sm text-xs leading-5 text-text-secondary">{tTerm('dashboard.period.reconciliation')}</p>
            </div>
          </div>
        </SectionSurface>

        <SectionSurface title={tTerm('dashboard.risk.title')} subtitle={tTerm('dashboard.risk.subtitle')} bodyClassName="divide-y divide-border-subtle">
          <div className="flex items-center justify-between gap-4 px-4 py-4"><span className="text-sm text-text-secondary">{tTerm('dashboard.risk.delinquentLoans')}</span><StatusChip tone={Number(risk.delinquentLoans || 0) > 0 ? 'danger' : 'neutral'}>{String(risk.delinquentLoans || 0)}</StatusChip></div>
          <div className="flex items-center justify-between gap-4 px-4 py-4"><span className="text-sm text-text-secondary">{tTerm('dashboard.risk.capitalAtRisk')}</span><strong className="font-mono tabular-nums text-text-primary">{money(risk.capitalAtRisk)}</strong></div>
          <div className="flex items-center justify-between gap-4 px-4 py-4"><span className="text-sm text-text-secondary">{tTerm('dashboard.risk.associateObligations')}</span><strong className="font-mono tabular-nums text-text-primary">{money(risk.overdueAssociateAmount)}</strong></div>
          <div className="flex items-center justify-between gap-4 px-4 py-4"><span className="text-sm text-text-secondary">{tTerm('dashboard.risk.arrearsRate')}</span><strong className="font-mono tabular-nums text-text-primary">{Number(risk.arrearsRate || 0).toFixed(1)}%</strong></div>
        </SectionSurface>
      </div>

      <SectionSurface title={tTerm('dashboard.trend.title')} subtitle={tTerm('dashboard.trend.subtitle')}>
        {chartData.length ? (
          <MeasuredChart className="h-[300px] min-w-0" minHeight={300}>
            {({ width, height }) => (
              <BarChart width={width} height={height} data={chartData} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} width={78} tick={{ fill: 'currentColor', fontSize: 10 }} tickFormatter={(value) => money(value)} />
                <Tooltip formatter={(value) => money(value)} labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullLabel || ''} />
                <Bar name={tTerm('dashboard.trend.inflows')} dataKey="inflows" fill="#28766e" radius={[4, 4, 0, 0]} />
                <Bar name={tTerm('dashboard.trend.outflows')} dataKey="outflows" fill="#87929d" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </MeasuredChart>
        ) : <EmptyState title={tTerm('dashboard.trend.empty')} compact />}
      </SectionSurface>
    </PageShell>
  );
}
