import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './AmortizationChart.css';

export interface AmortizationDatum {
  label: string;
  capital: number;
  interest: number;
  balance: number;
}

export interface AmortizationChartProps {
  data: AmortizationDatum[];
  formatCurrency: (value: number) => string;
  labels: { capital: string; interest: string; balance: string };
  height?: number;
  className?: string;
}

const CAPITAL_COLOR = '#10b981';
const INTEREST_COLOR = '#3b82f6';
const BALANCE_COLOR = '#f59e0b';

const compactMoney = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
};

type TooltipRenderProps = {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ payload?: AmortizationDatum }>;
};

const renderTooltip = (
  { active, label, payload }: TooltipRenderProps,
  formatCurrency: (value: number) => string,
  labels: AmortizationChartProps['labels'],
) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="amort-chart__tooltip">
      <p className="amort-chart__tooltip-title">{label}</p>
      <div className="amort-chart__tooltip-row">
        <span className="amort-chart__tooltip-key"><span className="amort-chart__swatch amort-chart__swatch--capital" />{labels.capital}</span>
        <span className="amort-chart__tooltip-value">{formatCurrency(row.capital)}</span>
      </div>
      <div className="amort-chart__tooltip-row">
        <span className="amort-chart__tooltip-key"><span className="amort-chart__swatch amort-chart__swatch--interest" />{labels.interest}</span>
        <span className="amort-chart__tooltip-value">{formatCurrency(row.interest)}</span>
      </div>
      <div className="amort-chart__tooltip-row amort-chart__tooltip-total">
        <span className="amort-chart__tooltip-key"><span className="amort-chart__swatch amort-chart__swatch--balance" />{labels.balance}</span>
        <span className="amort-chart__tooltip-value">{formatCurrency(row.balance)}</span>
      </div>
    </div>
  );
};

export default function AmortizationChart({
  data,
  formatCurrency,
  labels,
  height = 280,
  className = '',
}: AmortizationChartProps) {
  if (!data.length) return null;

  return (
    <div className={`amort-chart ${className}`.trim()}>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }} barCategoryGap="32%">
            <defs>
              <linearGradient id="amortCapital" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CAPITAL_COLOR} stopOpacity={0.95} />
                <stop offset="100%" stopColor={CAPITAL_COLOR} stopOpacity={0.75} />
              </linearGradient>
              <linearGradient id="amortInterest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={INTEREST_COLOR} stopOpacity={0.95} />
                <stop offset="100%" stopColor={INTEREST_COLOR} stopOpacity={0.75} />
              </linearGradient>
              <linearGradient id="amortBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BALANCE_COLOR} stopOpacity={0.18} />
                <stop offset="100%" stopColor={BALANCE_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid className="amort-chart__grid" horizontal vertical={false} />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              className="amort-chart__axis"
            />
            <YAxis
              yAxisId="cuota"
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={compactMoney}
              className="amort-chart__axis"
            />
            <YAxis
              yAxisId="balance"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={compactMoney}
              tick={{ fill: BALANCE_COLOR }}
              className="amort-chart__axis amort-chart__axis--balance"
            />

            <Tooltip
              cursor={{ fill: 'var(--hover-bg)', opacity: 0.5 }}
              content={(props) => renderTooltip(props as TooltipRenderProps, formatCurrency, labels)}
            />

            <Bar
              yAxisId="cuota"
              dataKey="capital"
              name={labels.capital}
              stackId="cuota"
              fill="url(#amortCapital)"
              maxBarSize={26}
              radius={[0, 0, 0, 0]}
              animationDuration={650}
              animationEasing="ease-out"
            />
            <Bar
              yAxisId="cuota"
              dataKey="interest"
              name={labels.interest}
              stackId="cuota"
              fill="url(#amortInterest)"
              maxBarSize={26}
              radius={[5, 5, 0, 0]}
              animationDuration={650}
              animationEasing="ease-out"
            />

            <Area
              yAxisId="balance"
              type="monotone"
              dataKey="balance"
              name={labels.balance}
              stroke="none"
              fill="url(#amortBalance)"
              animationDuration={900}
            />
            <Line
              yAxisId="balance"
              type="monotone"
              dataKey="balance"
              name={labels.balance}
              stroke={BALANCE_COLOR}
              strokeWidth={2.5}
              dot={{ r: 3, fill: BALANCE_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: BALANCE_COLOR, stroke: 'var(--bg-surface)', strokeWidth: 2 }}
              animationDuration={900}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="amort-chart__legend">
        <span className="amort-chart__legend-item"><span className="amort-chart__swatch amort-chart__swatch--capital" />{labels.capital}</span>
        <span className="amort-chart__legend-item"><span className="amort-chart__swatch amort-chart__swatch--interest" />{labels.interest}</span>
        <span className="amort-chart__legend-item"><span className="amort-chart__swatch amort-chart__swatch--balance" />{labels.balance}</span>
      </div>
    </div>
  );
}
