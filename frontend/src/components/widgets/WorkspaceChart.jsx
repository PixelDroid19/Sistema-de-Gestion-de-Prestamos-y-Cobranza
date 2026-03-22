import React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'

const DEFAULT_COLORS = ['#4f87ff', '#34c38f', '#f4c168', '#fb7185', '#7c5cff']

const isJsdomEnvironment = () => {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /jsdom/i.test(navigator.userAgent || '')
}

function WorkspaceChart({
  type = 'area',
  data = [],
  xKey = 'name',
  series = [],
  colors = DEFAULT_COLORS,
  height = 260,
  innerRadius = 56,
  outerRadius = 86,
}) {
  const palette = colors.length ? colors : DEFAULT_COLORS
  const chartHeight = Math.max(Number(height) || 260, 180)
  const useResponsiveContainer = !isJsdomEnvironment()

  const renderChart = (chartProps = {}) => {
    if (type === 'bar') {
      return (
        <BarChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }} {...chartProps}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.25)" />
          <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fill: 'var(--lf-shell-text-muted)', fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--lf-shell-text-muted)', fontSize: 12 }} />
          <Tooltip />
          {series.map((entry, index) => (
            <Bar key={entry.dataKey} dataKey={entry.dataKey} fill={entry.color || palette[index % palette.length]} radius={[12, 12, 0, 0]} />
          ))}
        </BarChart>
      )
    }

    if (type === 'pie') {
      return (
        <PieChart {...chartProps}>
          <Tooltip />
          <Pie data={data} dataKey={series[0]?.dataKey || 'value'} nameKey={xKey} innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={5}>
            {data.map((entry, index) => (
              <Cell key={`${entry[xKey] || 'slice'}-${index}`} fill={entry.color || palette[index % palette.length]} />
            ))}
          </Pie>
        </PieChart>
      )
    }

    return (
      <AreaChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }} {...chartProps}>
        <defs>
          {series.map((entry, index) => (
            <linearGradient id={`lf-chart-gradient-${entry.dataKey}`} key={entry.dataKey} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={entry.color || palette[index % palette.length]} stopOpacity={0.28} />
              <stop offset="95%" stopColor={entry.color || palette[index % palette.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.25)" />
        <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fill: 'var(--lf-shell-text-muted)', fontSize: 12 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--lf-shell-text-muted)', fontSize: 12 }} />
        <Tooltip />
        {series.map((entry, index) => (
          <Area
            key={entry.dataKey}
            type="monotone"
            dataKey={entry.dataKey}
            stroke={entry.color || palette[index % palette.length]}
            strokeWidth={3}
            fill={`url(#lf-chart-gradient-${entry.dataKey})`}
            fillOpacity={1}
          />
        ))}
      </AreaChart>
    )
  }

  return (
    <div className="lf-chart" style={{ height: chartHeight }}>
      {useResponsiveContainer ? (
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      ) : (
        <div className="lf-chart__static-fallback">
          {renderChart({ width: 960, height: chartHeight })}
        </div>
      )}
    </div>
  )
}

export default WorkspaceChart
