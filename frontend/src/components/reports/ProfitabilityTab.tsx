import type { ReactNode } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { AlertCircle, CalendarClock, TrendingUp } from 'lucide-react';
import { formatCurrency as formatCurrencyValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { parseReportYearInput } from '../../lib/reportYearInput';
import MeasuredChart from '../shared/MeasuredChart';
import {
  EmptyState,
  AppInput,
  FormField,
  SectionSurface,
} from '../shared/Surfaces';
import { ReportDataTableSection } from './ReportDataTableSection';
import { ReportMetricsSection } from './ReportMetricsSection';
import { ReportTabPanel } from './ReportTabPanel';

const formatMoney = (value: unknown) => formatCurrencyValue(value);

type ProfitabilityTabProps = {
  profitabilityData: any[];
  analyticsYear: number;
  onAnalyticsYearChange: (year: number) => void;
  advancedMetrics: { collectionEfficiency: number; delinquencyTrend: number; projectedCollections: number };
  advancedTrendSeries: any[];
  exportActions?: ReactNode;
};

export default function ProfitabilityTab({
  profitabilityData,
  analyticsYear,
  onAnalyticsYearChange,
  advancedMetrics,
  advancedTrendSeries,
  exportActions,
}: ProfitabilityTabProps) {
  const handleYearChange = (value: string) => {
    const parsedYear = parseReportYearInput(value);
    if (parsedYear !== null) {
      onAnalyticsYearChange(parsedYear);
    }
  };

  return (
    <div className="report-tab-layout">
      <ReportTabPanel
        title={tTerm('reports.profitability.title')}
        subtitle={tTerm('reports.profitability.subtitle')}
        headerActions={exportActions}
        filterColumns={2}
        filters={(
          <FormField label={tTerm('reports.profitability.year')}>
            <AppInput
              variant="integer"
              value={String(analyticsYear)}
              onValueChange={(v) => handleYearChange(v)}
            />
          </FormField>
        )}
      />

      <ReportDataTableSection title={tTerm('reports.profitability.table.title')}>
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
      </ReportDataTableSection>

      <ReportMetricsSection
        primaryAriaLabel={tTerm('reports.profitability.summary.aria')}
        primaryItems={[
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
                <LineChart
                  accessibilityLayer={false}
                  role="img"
                  aria-label={tTerm('reports.profitability.trend.title')}
                  width={width}
                  height={height}
                  data={advancedTrendSeries}
                >
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
  );
}
