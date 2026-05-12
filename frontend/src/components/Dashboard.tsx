import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Banknote,
  GripHorizontal,
  Layers3,
  Plus,
  Settings2,
  Wallet,
  X,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from 'recharts';
import { Responsive, verticalCompactor } from 'react-grid-layout';
import { useDashboardReport } from '../services/reportService';
import { tTerm } from '../i18n/terminology';
import { getSafeErrorText } from '../services/safeErrorMessages';
import { safeLocalStorage } from '../lib/safeStorage';
import MeasuredChart from './shared/MeasuredChart';
import { ActionButton, EmptyState, IconActionButton, MetricCard, PageHeader, PageShell, ToolbarSurface } from './shared/Surfaces';
import { HelpTooltip } from './shared/HelpSupport';

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

const AVAILABLE_WIDGETS = [
  { id: 'balance_total', titleKey: 'dashboard.widget.balanceTotal.title' as const, defaultLayout: { w: 2, h: 2, minW: 1, minH: 2, maxH: 2 } },
  { id: 'prestamos_activos', titleKey: 'dashboard.widget.activeLoans.title' as const, defaultLayout: { w: 2, h: 2, minW: 1, minH: 2, maxH: 2 } },
  { id: 'tasa_mora', titleKey: 'dashboard.widget.delinquencyRate.title' as const, defaultLayout: { w: 2, h: 2, minW: 1, minH: 2, maxH: 2 } },
  { id: 'total_recuperado', titleKey: 'dashboard.widget.totalRecovered.title' as const, defaultLayout: { w: 2, h: 2, minW: 1, minH: 2, maxH: 2 } },
  { id: 'evolucion_desembolsos', titleKey: 'dashboard.widget.disbursementEvolution.title' as const, defaultLayout: { w: 4, h: 8, minW: 2, minH: 7 } },
  { id: 'rendimiento_mora', titleKey: 'dashboard.widget.recoveryPerformance.title' as const, defaultLayout: { w: 4, h: 8, minW: 2, minH: 7 } },
];

const defaultLayouts: ResponsiveLayouts = {
  lg: [
    { i: 'balance_total', x: 0, y: 0, w: 2, h: 2, minW: 1, minH: 2, maxH: 2 },
    { i: 'prestamos_activos', x: 2, y: 0, w: 2, h: 2, minW: 1, minH: 2, maxH: 2 },
    { i: 'tasa_mora', x: 4, y: 0, w: 2, h: 2, minW: 1, minH: 2, maxH: 2 },
    { i: 'total_recuperado', x: 6, y: 0, w: 2, h: 2, minW: 1, minH: 2, maxH: 2 },
    { i: 'evolucion_desembolsos', x: 0, y: 2, w: 4, h: 8, minW: 2, minH: 7 },
    { i: 'rendimiento_mora', x: 4, y: 2, w: 4, h: 8, minW: 2, minH: 7 },
  ],
  md: [
    { i: 'balance_total', x: 0, y: 0, w: 2, h: 2, minW: 1, minH: 2, maxH: 2 },
    { i: 'prestamos_activos', x: 2, y: 0, w: 2, h: 2, minW: 1, minH: 2, maxH: 2 },
    { i: 'tasa_mora', x: 0, y: 2, w: 2, h: 2, minW: 1, minH: 2, maxH: 2 },
    { i: 'total_recuperado', x: 2, y: 2, w: 2, h: 2, minW: 1, minH: 2, maxH: 2 },
    { i: 'evolucion_desembolsos', x: 0, y: 4, w: 4, h: 8, minW: 2, minH: 7 },
    { i: 'rendimiento_mora', x: 0, y: 12, w: 4, h: 8, minW: 2, minH: 7 },
  ],
  sm: [
    { i: 'balance_total', x: 0, y: 0, w: 1, h: 2, minW: 1, minH: 2, maxH: 2, static: true },
    { i: 'prestamos_activos', x: 1, y: 0, w: 1, h: 2, minW: 1, minH: 2, maxH: 2, static: true },
    { i: 'tasa_mora', x: 0, y: 2, w: 1, h: 2, minW: 1, minH: 2, maxH: 2, static: true },
    { i: 'total_recuperado', x: 1, y: 2, w: 1, h: 2, minW: 1, minH: 2, maxH: 2, static: true },
    { i: 'evolucion_desembolsos', x: 0, y: 4, w: 2, h: 8, minW: 2, minH: 7, static: true },
    { i: 'rendimiento_mora', x: 0, y: 12, w: 2, h: 8, minW: 2, minH: 7, static: true },
  ],
  xs: [
    { i: 'balance_total', x: 0, y: 0, w: 1, h: 2, minW: 1, minH: 2, maxH: 2, static: true },
    { i: 'prestamos_activos', x: 0, y: 2, w: 1, h: 2, minW: 1, minH: 2, maxH: 2, static: true },
    { i: 'tasa_mora', x: 0, y: 4, w: 1, h: 2, minW: 1, minH: 2, maxH: 2, static: true },
    { i: 'total_recuperado', x: 0, y: 6, w: 1, h: 2, minW: 1, minH: 2, maxH: 2, static: true },
    { i: 'evolucion_desembolsos', x: 0, y: 8, w: 1, h: 8, minW: 1, minH: 7, static: true },
    { i: 'rendimiento_mora', x: 0, y: 16, w: 1, h: 8, minW: 1, minH: 7, static: true },
  ],
  xxs: [
    { i: 'balance_total', x: 0, y: 0, w: 1, h: 2, minW: 1, minH: 2, maxH: 2, static: true },
    { i: 'prestamos_activos', x: 0, y: 2, w: 1, h: 2, minW: 1, minH: 2, maxH: 2, static: true },
    { i: 'tasa_mora', x: 0, y: 4, w: 1, h: 2, minW: 1, minH: 2, maxH: 2, static: true },
    { i: 'total_recuperado', x: 0, y: 6, w: 1, h: 2, minW: 1, minH: 2, maxH: 2, static: true },
    { i: 'evolucion_desembolsos', x: 0, y: 8, w: 1, h: 8, minW: 1, minH: 7, static: true },
    { i: 'rendimiento_mora', x: 0, y: 16, w: 1, h: 8, minW: 1, minH: 7, static: true },
  ],
};

const BREAKPOINT_COLUMNS = { lg: 8, md: 4, sm: 2, xs: 1, xxs: 1 };
const KPI_WIDGET_IDS = new Set(['balance_total', 'prestamos_activos', 'tasa_mora', 'total_recuperado']);

const normalizeLayoutEntry = (entry: LayoutType, breakpoint: string): LayoutType => {
  const widgetDef = AVAILABLE_WIDGETS.find((widget) => widget.id === entry.i);
  const fallback = widgetDef?.defaultLayout || { w: 1, h: 3, minW: 1, minH: 3 };
  const columnCount = BREAKPOINT_COLUMNS[breakpoint as keyof typeof BREAKPOINT_COLUMNS] || 1;
  const isKpiWidget = KPI_WIDGET_IDS.has(entry.i);
  const minHeight = isKpiWidget ? (fallback.minH || fallback.h) : Math.max(Number(entry.minH || 0), fallback.minH || 3);
  const minWidth = Math.min(columnCount, Math.max(Number(entry.minW || 0), fallback.minW || 1));
  const width = Math.min(columnCount, Math.max(Number(entry.w || 0), fallback.w, minWidth));
  const height = isKpiWidget ? fallback.h : Math.max(Number(entry.h || 0), fallback.h, minHeight);

  return {
    ...entry,
    x: Math.max(0, Math.min(Number(entry.x || 0), Math.max(columnCount - width, 0))),
    y: Math.max(0, Number(entry.y || 0)),
    w: width,
    h: height,
    minW: minWidth,
    minH: minHeight,
    maxH: isKpiWidget ? fallback.h : entry.maxH,
    static: columnCount <= 2 ? true : entry.static,
  };
};

const normalizeLayouts = (candidate: unknown): ResponsiveLayouts => {
  if (!candidate || typeof candidate !== 'object') return defaultLayouts;

  const next: ResponsiveLayouts = { ...defaultLayouts };
  Object.entries(candidate as ResponsiveLayouts).forEach(([breakpoint, entries]) => {
    if (!Array.isArray(entries)) return;
    const knownEntries = entries
      .filter((entry) => AVAILABLE_WIDGETS.some((widget) => widget.id === entry.i))
      .map((entry) => normalizeLayoutEntry(entry, breakpoint));

    const missingEntries = defaultLayouts[breakpoint]?.filter(
      (entry) => !knownEntries.some((knownEntry) => knownEntry.i === entry.i),
    ) ?? [];

    next[breakpoint] = [...knownEntries, ...missingEntries];
  });

  return next;
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
    const displayCustomerName = customerName || `${tTerm('dashboard.chart.customerFallbackPrefix')} #${loan.id}`;

    return {
      name: `Crédito #${loan.id}`,
      customerName: displayCustomerName,
      disbursed: Number(loan.amount || 0),
      recovered: Number(loan.totalPaid || 0),
    };
  });
};

export default function Dashboard() {
  const { dashboardData, isLoading, isError, error, refetch } = useDashboardReport();
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [gridContainerWidth, setGridContainerWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() => (
    typeof window === 'undefined' ? 1280 : window.innerWidth
  ));
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
  const effectiveGridWidth = Math.max(320, Math.min(gridContainerWidth || viewportWidth, viewportWidth));
  const isMobileLayout = effectiveGridWidth < 640;

  const formatCurrency = (value: number | string | undefined) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
  };

  useEffect(() => {
    const savedLayouts = safeLocalStorage.getItem('dashboard_layouts');
    const savedWidgets = safeLocalStorage.getItem('dashboard_widgets');
    if (savedLayouts) {
      try {
        setLayouts(normalizeLayouts(JSON.parse(savedLayouts)));
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const element = gridContainerRef.current;
    if (!element) return undefined;

    const measure = () => {
      const main = element.closest('main');
      const mainStyles = main ? window.getComputedStyle(main) : null;
      const mainInnerWidth = main
        ? main.clientWidth
          - Number.parseFloat(mainStyles?.paddingLeft || '0')
          - Number.parseFloat(mainStyles?.paddingRight || '0')
        : 0;
      const elementWidth = Math.floor(element.getBoundingClientRect().width || element.clientWidth || 0);
      const nextWidth = Math.floor(Math.min(
        elementWidth || Number.POSITIVE_INFINITY,
        mainInnerWidth || Number.POSITIVE_INFINITY,
        window.innerWidth,
      ));
      setGridContainerWidth(nextWidth);
    };

    measure();
    const frame = window.requestAnimationFrame(measure);
    const timer = window.setTimeout(measure, 100);

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timer);
        window.removeEventListener('resize', measure);
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isError, isLoading]);

  const handleLayoutChange = (_layout: unknown, allLayouts: unknown) => {
    const normalizedLayouts = normalizeLayouts(allLayouts);
    setLayouts(normalizedLayouts);
    safeLocalStorage.setItem('dashboard_layouts', JSON.stringify(normalizedLayouts));
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
          <MetricCard
            label={tTerm('dashboard.widget.balanceTotal.title')}
            value={formatCurrency(summary.totalOutstandingAmount)}
            helper={`${summary.totalLoans || 0} ${tTerm('dashboard.widget.balanceTotal.subtitle')}`}
            tooltip="Saldo total pendiente de la cartera. Resume el capital e importes por recuperar en los créditos registrados."
            icon={<Wallet size={18} />}
            accent="teal"
            className="h-full"
          />
        );
      case 'prestamos_activos':
        return (
          <MetricCard
            label={tTerm('dashboard.widget.activeLoans.title')}
            value={summary.activeLoans || 0}
            helper={`${summary.defaultedLoans || 0} ${tTerm('dashboard.widget.activeLoans.subtitle')}`}
            tooltip="Créditos que siguen abiertos y pueden requerir seguimiento, cobro o consulta operativa."
            icon={<Activity size={18} />}
            accent="emerald"
            className="h-full"
          />
        );
      case 'tasa_mora':
        return (
          <MetricCard
            label={tTerm('dashboard.widget.delinquencyRate.title')}
            value={summary.totalLoans ? `${Math.round(((summary.defaultedLoans || 0) / summary.totalLoans) * 100)}%` : '0%'}
            helper={`${collections.overdueAlerts || 0} ${tTerm('dashboard.widget.delinquencyRate.subtitle')}`}
            tooltip="Porcentaje de créditos con atraso frente al total de créditos. Ayuda a medir riesgo operativo de cobranza."
            icon={<AlertTriangle size={18} />}
            accent="amber"
            className="h-full"
          />
        );
      case 'total_recuperado':
        return (
          <MetricCard
            label={tTerm('dashboard.widget.totalRecovered.title')}
            value={formatCurrency(summary.totalRecoveredAmount)}
            helper={`${collections.pendingPromises || 0} ${tTerm('dashboard.widget.totalRecovered.subtitle')}`}
            tooltip="Dinero recuperado mediante pagos registrados. Sirve para comparar recaudo contra cartera pendiente."
            icon={<Banknote size={18} />}
            accent="blue"
            className="h-full"
          />
        );
      case 'evolucion_desembolsos':
        return (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{tTerm('dashboard.widget.disbursementEvolution.kicker')}</div>
                <div className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                  {tTerm('dashboard.widget.disbursementEvolution.title')}
                  <HelpTooltip
                    text="Compara el capital entregado en créditos contra el dinero recuperado por pagos registrados."
                    align="right"
                  />
                </div>
              </div>
              <div className="text-xs text-text-secondary">{recentLoans.length} {tTerm('dashboard.widget.disbursementEvolution.recordsRecent')}</div>
            </div>
            <p className="text-xs text-text-secondary mb-4">
              <span className="font-medium">{tTerm('dashboard.chart.scope.label')}:</span> {tTerm('dashboard.chart.scope.recent')} {tTerm('dashboard.chart.scope.currentRangePrefix')} {tTerm('dashboard.chart.range.last6')}.
            </p>
            {chartHasData ? (
              <div className="min-h-[220px] min-w-0 flex-1">
                <MeasuredChart className="h-full min-h-[220px] min-w-0" minHeight={220}>
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
                    <Tooltip
                      formatter={(value) => value != null ? formatCurrency(Number(value)) : ''}
                      labelFormatter={(label, payload) => {
                        const customerName = payload?.[0]?.payload?.customerName;
                        return customerName ? `${label} · ${customerName}` : label;
                      }}
                    />
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
              <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-base px-6 text-center">
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
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{tTerm('dashboard.widget.recoveryPerformance.kicker')}</div>
                <div className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                  {tTerm('dashboard.widget.recoveryPerformance.title')}
                  <HelpTooltip
                    text="Muestra la recuperación registrada frente al dinero desembolsado para detectar diferencias de cartera."
                    align="right"
                  />
                </div>
              </div>
              <div className="text-xs text-text-secondary">{tTerm('dashboard.widget.recoveryPerformance.subtitle')}</div>
            </div>
            <div className="min-h-[220px] min-w-0 flex-1">
              <MeasuredChart className="h-full min-h-[220px] min-w-0" minHeight={220}>
                {({ width, height }) => (
                <BarChart width={width} height={height} data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} width={72} tickFormatter={(value) => formatCurrency(Number(value))} />
                  <Tooltip
                    formatter={(value) => value != null ? formatCurrency(Number(value)) : ''}
                    labelFormatter={(label, payload) => {
                      const customerName = payload?.[0]?.payload?.customerName;
                      return customerName ? `${label} · ${customerName}` : label;
                    }}
                  />
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
    return (
      <PageShell>
        <EmptyState title={tTerm('dashboard.loading')} icon={<Activity size={18} />} compact />
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell>
        <EmptyState
          title={tTerm('dashboard.error.title')}
          description={getSafeErrorText(error, { domain: 'reports', action: 'reports.load' })}
          icon={<AlertTriangle size={18} />}
          action={(
            <ActionButton type="button" onClick={() => void refetch()}>
              {tTerm('dashboard.error.retry')}
            </ActionButton>
          )}
        />
      </PageShell>
    );
  }

  return (
    <PageShell data-tour="dashboard-page">
      <PageHeader
        title={tTerm('dashboard.module.title')}
        subtitle={tTerm('dashboard.module.subtitle')}
        guideKey="dashboard"
        tourId="dashboard-header"
        actions={(
        <div className="flex flex-wrap gap-2">
          <ActionButton
            onClick={() => setShowWidgetManager(!showWidgetManager)}
            variant={showWidgetManager ? 'primary' : 'secondary'}
            icon={<Layers3 size={16} />}
          >
            {tTerm('dashboard.cta.widgets')}
          </ActionButton>
          <ActionButton
            onClick={() => setIsEditMode(!isEditMode)}
            variant={isEditMode ? 'primary' : 'secondary'}
            icon={<Settings2 size={16} />}
          >
            {isEditMode ? tTerm('dashboard.cta.saveLayout') : tTerm('dashboard.cta.editLayout')}
          </ActionButton>
        </div>
        )}
      />

      <p className="text-xs text-text-secondary -mt-3">
        <span className="font-medium">{tTerm('dashboard.kpi.scope.label')}:</span> {tTerm('dashboard.kpi.scope.lifetime')}
      </p>

      {showWidgetManager && (
        <ToolbarSurface className="animate-in fade-in slide-in-from-top-4" data-tour="dashboard-toolbar">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-text-primary">{tTerm('dashboard.widgetManager.title')}</h3>
            <IconActionButton
              label="Cerrar gestor de widgets"
              icon={<X size={16} />}
              onClick={() => setShowWidgetManager(false)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_WIDGETS.map((widget) => {
              const isVisible = visibleWidgets.includes(widget.id);
              return (
                <ActionButton
                  key={widget.id}
                  onClick={() => toggleWidget(widget.id)}
                  variant={isVisible ? 'primary' : 'secondary'}
                  className="!min-h-0 !rounded-full !px-3 !py-1.5"
                  icon={isVisible ? <X size={14} /> : <Plus size={14} />}
                >
                  {tTerm(widget.titleKey)}
                </ActionButton>
              );
            })}
          </div>
        </ToolbarSurface>
      )}

      {isMobileLayout ? (
        <div className="space-y-4">
          {visibleWidgets.map((id) => {
            const isMetricWidget = KPI_WIDGET_IDS.has(id);
            return (
              <div
                key={id}
                className={isMetricWidget ? 'min-h-[112px]' : 'dashboard-widget min-h-[360px]'}
              >
                <div className={isMetricWidget ? 'h-full' : 'dashboard-widget-content'}>
                  {renderWidgetContent(id)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <div
        ref={gridContainerRef}
        data-tour="dashboard-grid"
      >
        <Responsive
          key={`dashboard-grid-${Math.round(effectiveGridWidth)}`}
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={BREAKPOINT_COLUMNS}
          width={effectiveGridWidth}
          onLayoutChange={handleLayoutChange}
          rowHeight={46}
          margin={[18, 18]}
          containerPadding={[0, 0]}
          dragConfig={{ enabled: isEditMode, handle: '.drag-handle' }}
          resizeConfig={{ enabled: isEditMode }}
          compactor={verticalCompactor}
        >
          {visibleWidgets.map((id) => {
            const isMetricWidget = KPI_WIDGET_IDS.has(id);
            return (
            <div key={id} className="dashboard-grid-item group">
              <div className={isMetricWidget ? 'h-full min-w-0' : 'dashboard-widget'}>
                {isEditMode && (
                  <div className="drag-handle absolute right-2 top-2 z-10 cursor-move rounded-lg border border-border-subtle bg-bg-elevated/90 p-1.5 text-text-secondary shadow-sm backdrop-blur transition-colors hover:text-text-primary">
                    <GripHorizontal size={16} />
                  </div>
                )}
                {isEditMode && (
                  <IconActionButton
                    onClick={() => toggleWidget(id)}
                    className="absolute left-2 top-2 z-10 bg-bg-elevated/90 shadow-sm backdrop-blur"
                    label={`Ocultar ${tTerm(AVAILABLE_WIDGETS.find((widget) => widget.id === id)?.titleKey ?? 'dashboard.cta.widgets')}`}
                    icon={<X size={16} />}
                    variant="danger"
                  />
                )}
                <div className={isMetricWidget ? 'h-full' : 'dashboard-widget-content'}>
                  {renderWidgetContent(id)}
                </div>
              </div>
            </div>
            );
          })}
        </Responsive>
      </div>
      )}
    </PageShell>
  );
}
