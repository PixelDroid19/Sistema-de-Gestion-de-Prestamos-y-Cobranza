import React, { useEffect, useMemo, useState } from 'react';
import { GripHorizontal, Plus, Settings2, X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from 'recharts';
import * as ReactGridLayout from 'react-grid-layout';
import { useDashboardReport } from '../services/reportService';
import { tTerm } from '../i18n/terminology';
import { getSafeErrorText } from '../services/safeErrorMessages';
import { safeLocalStorage } from '../lib/safeStorage';
import MeasuredChart from './shared/MeasuredChart';

type LayoutType = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
};

type LayoutItemType = LayoutType;
type ResponsiveLayouts = Record<string, LayoutType[]>;

const { Responsive, WidthProvider } = ReactGridLayout as unknown as {
  Responsive: React.ComponentType<any>;
  WidthProvider: (gridComponent: React.ComponentType<any>) => React.ComponentType<any>;
};
const ResponsiveGridLayout = typeof WidthProvider === 'function'
  ? WidthProvider(Responsive)
  : Responsive;

const AVAILABLE_WIDGETS = [
  { id: 'balance_total', titleKey: 'dashboard.widget.balanceTotal.title' as const, defaultLayout: { w: 1, h: 2, minW: 1, minH: 2 } },
  { id: 'prestamos_activos', titleKey: 'dashboard.widget.activeLoans.title' as const, defaultLayout: { w: 1, h: 2, minW: 1, minH: 2 } },
  { id: 'tasa_mora', titleKey: 'dashboard.widget.delinquencyRate.title' as const, defaultLayout: { w: 1, h: 2, minW: 1, minH: 2 } },
  { id: 'total_recuperado', titleKey: 'dashboard.widget.totalRecovered.title' as const, defaultLayout: { w: 1, h: 2, minW: 1, minH: 2 } },
  { id: 'evolucion_desembolsos', titleKey: 'dashboard.widget.disbursementEvolution.title' as const, defaultLayout: { w: 2, h: 5, minW: 2, minH: 4 } },
  { id: 'rendimiento_mora', titleKey: 'dashboard.widget.recoveryPerformance.title' as const, defaultLayout: { w: 2, h: 5, minW: 2, minH: 4 } },
];

const defaultLayouts: ResponsiveLayouts = {
  lg: [
    { i: 'balance_total', x: 0, y: 0, w: 1, h: 2, minW: 1, minH: 2 },
    { i: 'prestamos_activos', x: 1, y: 0, w: 1, h: 2, minW: 1, minH: 2 },
    { i: 'tasa_mora', x: 2, y: 0, w: 1, h: 2, minW: 1, minH: 2 },
    { i: 'total_recuperado', x: 3, y: 0, w: 1, h: 2, minW: 1, minH: 2 },
    { i: 'evolucion_desembolsos', x: 0, y: 2, w: 2, h: 5, minW: 2, minH: 4 },
    { i: 'rendimiento_mora', x: 2, y: 2, w: 2, h: 5, minW: 2, minH: 4 },
  ],
};

type DashboardLoanLike = {
  id: number;
  amount?: number | string;
  totalPaid?: number | string;
  Customer?: { name?: string };
  customerName?: string;
};

const sanitizeCustomerName = (value: string): string => value.replace(/(qa|seed|test|dev)\s*/ig, '').trim();

export const buildDashboardChartData = (recentLoans: DashboardLoanLike[]) => {
  return recentLoans.slice(0, 6).reverse().map((loan) => {
    const rawName = loan.Customer?.name || loan.customerName || '';
    const customerName = sanitizeCustomerName(rawName);
    const shortName = customerName && customerName.length > 2
      ? customerName.split(' ')[0]
      : `${tTerm('dashboard.chart.customerFallbackPrefix')} #${loan.id}`;

    return {
      name: shortName,
      disbursed: Number(loan.amount || 0),
      recovered: Number(loan.totalPaid || 0),
    };
  });
};

export default function Dashboard() {
  const { dashboardData, isLoading, isError, error, refetch } = useDashboardReport();
  const [layouts, setLayouts] = useState(defaultLayouts);
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(AVAILABLE_WIDGETS.map((w) => w.id));
  const [isEditMode, setIsEditMode] = useState(false);
  const [showWidgetManager, setShowWidgetManager] = useState(false);

  const summary = dashboardData?.summary || {};
  const collections = dashboardData?.collections || {};
  const recentLoans = Array.isArray(dashboardData?.recentActivity?.loans) ? dashboardData.recentActivity.loans : [];
  const chartData = useMemo(() => buildDashboardChartData(recentLoans), [recentLoans]);

  const hasKpiTotals = Number(summary.totalOutstandingAmount || 0) > 0 || Number(summary.totalRecoveredAmount || 0) > 0;
  const chartHasData = chartData.some((row) => Number(row.disbursed || 0) > 0 || Number(row.recovered || 0) > 0);

  const formatCurrency = (value: number | string | undefined) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
  };

  useEffect(() => {
    const savedLayouts = safeLocalStorage.getItem('dashboard_layouts');
    const savedWidgets = safeLocalStorage.getItem('dashboard_widgets');
    if (savedLayouts) {
      try {
        setLayouts(JSON.parse(savedLayouts));
      } catch {
        setLayouts(defaultLayouts);
      }
    }
    if (savedWidgets) {
      try {
        setVisibleWidgets(JSON.parse(savedWidgets));
      } catch {
        setVisibleWidgets(AVAILABLE_WIDGETS.map((w) => w.id));
      }
    }
  }, []);

  const handleLayoutChange = (_layout: LayoutType, allLayouts: ResponsiveLayouts) => {
    setLayouts(allLayouts);
    safeLocalStorage.setItem('dashboard_layouts', JSON.stringify(allLayouts));
  };

  const toggleWidget = (widgetId: string) => {
    setVisibleWidgets((prev) => {
      const isVisible = prev.includes(widgetId);
      const next = isVisible ? prev.filter((id) => id !== widgetId) : [...prev, widgetId];
      safeLocalStorage.setItem('dashboard_widgets', JSON.stringify(next));

      if (!isVisible) {
        const widgetDef = AVAILABLE_WIDGETS.find((w) => w.id === widgetId);
        if (widgetDef) {
          const nextLayouts = { ...layouts };
          Object.keys(nextLayouts).forEach((breakpoint) => {
            const currentLayout = nextLayouts[breakpoint as keyof typeof nextLayouts] || [];
            if (!currentLayout.find((entry: LayoutItemType) => entry.i === widgetId)) {
              nextLayouts[breakpoint as keyof typeof nextLayouts] = [
                ...currentLayout,
                {
                  i: widgetId,
                  x: 0,
                  y: Infinity,
                  w: widgetDef.defaultLayout.w,
                  h: widgetDef.defaultLayout.h,
                  minW: widgetDef.defaultLayout.minW,
                  minH: widgetDef.defaultLayout.minH,
                },
              ];
            }
          });
          setLayouts(nextLayouts);
        }
      }

      return next;
    });
  };

  const renderWidgetContent = (id: string) => {
    switch (id) {
      case 'balance_total':
        return (
          <div className="flex flex-col h-full justify-center">
            <div className="text-sm font-medium text-text-secondary mb-2">{tTerm('dashboard.widget.balanceTotal.title')}</div>
            <div className="text-2xl font-bold text-text-primary">{formatCurrency(summary.totalOutstandingAmount)}</div>
            <div className="text-xs text-text-secondary mt-2">{summary.totalLoans || 0} {tTerm('dashboard.widget.balanceTotal.subtitle')}</div>
          </div>
        );
      case 'prestamos_activos':
        return (
          <div className="flex flex-col h-full justify-center">
            <div className="text-sm font-medium text-text-secondary mb-2">{tTerm('dashboard.widget.activeLoans.title')}</div>
            <div className="text-2xl font-bold text-text-primary">{summary.activeLoans || 0}</div>
            <div className="text-xs text-text-secondary mt-2">{summary.defaultedLoans || 0} {tTerm('dashboard.widget.activeLoans.subtitle')}</div>
          </div>
        );
      case 'tasa_mora':
        return (
          <div className="flex flex-col h-full justify-center">
            <div className="text-sm font-medium text-text-secondary mb-2">{tTerm('dashboard.widget.delinquencyRate.title')}</div>
            <div className="text-2xl font-bold text-text-primary">{summary.totalLoans ? `${Math.round(((summary.defaultedLoans || 0) / summary.totalLoans) * 100)}%` : '0%'}</div>
            <div className="text-xs text-text-secondary mt-2">{collections.overdueAlerts || 0} {tTerm('dashboard.widget.delinquencyRate.subtitle')}</div>
          </div>
        );
      case 'total_recuperado':
        return (
          <div className="flex flex-col h-full justify-center">
            <div className="text-sm font-medium text-text-secondary mb-2">{tTerm('dashboard.widget.totalRecovered.title')}</div>
            <div className="text-2xl font-bold text-text-primary">{formatCurrency(summary.totalRecoveredAmount)}</div>
            <div className="text-xs text-text-secondary mt-2">{collections.pendingPromises || 0} {tTerm('dashboard.widget.totalRecovered.subtitle')}</div>
          </div>
        );
      case 'evolucion_desembolsos':
        return (
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{tTerm('dashboard.widget.disbursementEvolution.kicker')}</div>
                <div className="text-lg font-semibold text-text-primary">{tTerm('dashboard.widget.disbursementEvolution.title')}</div>
              </div>
              <div className="text-xs text-text-secondary">{recentLoans.length} {tTerm('dashboard.widget.disbursementEvolution.recordsRecent')}</div>
            </div>
            <p className="text-xs text-text-secondary mb-4">
              <span className="font-medium">{tTerm('dashboard.chart.scope.label')}:</span> {tTerm('dashboard.chart.scope.recent')} {tTerm('dashboard.chart.scope.currentRangePrefix')} {tTerm('dashboard.chart.range.last6')}.
            </p>
            {chartHasData ? (
              <div className="flex-1 min-h-[150px] min-w-0">
                <MeasuredChart className="h-full min-h-[150px] min-w-0" minHeight={150}>
                  {({ width, height }) => (
                  <AreaChart width={width} height={height} data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashboard-disbursed-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="dashboard-recovered-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} dy={5} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} width={72} tickFormatter={(value) => formatCurrency(Number(value))} />
                    <Tooltip formatter={(value) => value != null ? formatCurrency(Number(value)) : ''} />
                    <Area
                      type="monotone"
                      name={tTerm('dashboard.chart.disbursementRecovery.legend.disbursed')}
                      dataKey="disbursed"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#dashboard-disbursed-gradient)"
                    />
                    <Area
                      type="monotone"
                      name={tTerm('dashboard.chart.disbursementRecovery.legend.recovered')}
                      dataKey="recovered"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#dashboard-recovered-gradient)"
                    />
                  </AreaChart>
                  )}
                </MeasuredChart>
              </div>
            ) : (
              <div className="flex-1 min-h-[150px] rounded-xl border border-dashed border-border-subtle bg-bg-base flex flex-col items-center justify-center text-center px-6">
                <p className="text-sm font-medium text-text-primary">
                  {hasKpiTotals
                    ? tTerm('dashboard.chart.disbursementRecovery.emptyWithKpi')
                    : tTerm('dashboard.chart.disbursementRecovery.empty')}
                </p>
                <p className="text-xs text-text-secondary mt-2">
                  {hasKpiTotals
                    ? tTerm('dashboard.chart.disbursementRecovery.emptyWithKpiHint')
                    : tTerm('dashboard.chart.disbursementRecovery.emptyHint')}
                </p>
              </div>
            )}
          </div>
        );
      case 'rendimiento_mora':
        return (
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{tTerm('dashboard.widget.recoveryPerformance.kicker')}</div>
                <div className="text-lg font-semibold text-text-primary">{tTerm('dashboard.widget.recoveryPerformance.title')}</div>
              </div>
              <div className="text-xs text-text-secondary">{tTerm('dashboard.widget.recoveryPerformance.subtitle')}</div>
            </div>
            <div className="flex-1 min-h-[150px] min-w-0">
              <MeasuredChart className="h-full min-h-[150px] min-w-0" minHeight={150}>
                {({ width, height }) => (
                <BarChart width={width} height={height} data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} width={72} tickFormatter={(value) => formatCurrency(Number(value))} />
                  <Tooltip formatter={(value) => value != null ? formatCurrency(Number(value)) : ''} />
                  <Bar name={tTerm('dashboard.chart.disbursementRecovery.legend.recovered')} dataKey="recovered" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar name={tTerm('dashboard.chart.disbursementRecovery.legend.disbursed')} dataKey="disbursed" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
                )}
              </MeasuredChart>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-text-secondary">{tTerm('dashboard.loading')}</div>;
  }

  if (isError) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 text-center">
          <h2 className="text-lg font-semibold text-text-primary">{tTerm('dashboard.error.title')}</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {getSafeErrorText(error, { domain: 'reports', action: 'reports.load' })}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-hover-bg"
          >
            {tTerm('dashboard.error.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{tTerm('dashboard.module.title')}</h2>
          <p className="text-sm text-text-secondary mt-1">{tTerm('dashboard.module.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowWidgetManager(!showWidgetManager)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${showWidgetManager ? 'bg-hover-bg border-border-strong' : 'bg-bg-surface border-border-subtle hover:bg-hover-bg'}`}
          >
            <Plus size={16} /> {tTerm('dashboard.cta.widgets')}
          </button>
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${isEditMode ? 'bg-text-primary text-bg-base border-text-primary' : 'bg-bg-surface border-border-subtle hover:bg-hover-bg'}`}
          >
            <Settings2 size={16} /> {isEditMode ? tTerm('dashboard.cta.saveLayout') : tTerm('dashboard.cta.editLayout')}
          </button>
        </div>
      </div>

      <p className="text-xs text-text-secondary -mt-3">
        <span className="font-medium">{tTerm('dashboard.kpi.scope.label')}:</span> {tTerm('dashboard.kpi.scope.lifetime')}
      </p>

      {showWidgetManager && (
        <div className="bg-bg-surface border border-border-subtle rounded-xl shadow-sm p-4 mb-2 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-text-primary">{tTerm('dashboard.widgetManager.title')}</h3>
            <button onClick={() => setShowWidgetManager(false)} className="text-text-secondary hover:text-text-primary">
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_WIDGETS.map((widget) => {
              const isVisible = visibleWidgets.includes(widget.id);
              return (
                <button
                  key={widget.id}
                  onClick={() => toggleWidget(widget.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                    isVisible
                      ? 'bg-text-primary text-bg-base border-text-primary'
                      : 'bg-bg-base text-text-secondary border-border-subtle hover:border-border-strong'
                  }`}
                >
                  {isVisible ? <X size={14} /> : <Plus size={14} />} {tTerm(widget.titleKey)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 4, md: 3, sm: 2, xs: 1, xxs: 1 }}
          rowHeight={60}
          onLayoutChange={handleLayoutChange}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          margin={[24, 24]}
          containerPadding={[0, 0]}
          draggableHandle=".drag-handle"
        >
          {visibleWidgets.map((id) => (
            <div key={id} className="bg-bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden flex flex-col group">
              {isEditMode && (
                <div className="drag-handle absolute top-2 right-2 z-10 p-1.5 bg-bg-elevated/80 backdrop-blur rounded cursor-move transition-opacity border border-border-subtle shadow-sm text-text-secondary hover:text-text-primary">
                  <GripHorizontal size={16} />
                </div>
              )}
              {isEditMode && (
                <button
                  onClick={() => toggleWidget(id)}
                  className="absolute top-2 left-2 z-10 p-1.5 bg-bg-elevated/80 backdrop-blur rounded cursor-pointer transition-opacity border border-border-subtle shadow-sm text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <X size={16} />
                </button>
              )}
              <div className="flex-1 h-full overflow-hidden p-5">
                {renderWidgetContent(id)}
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
