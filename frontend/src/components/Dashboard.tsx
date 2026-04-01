import React, { useState, useEffect } from 'react';
import { Info, ChevronDown, ChevronLeft, ChevronRight, MoreVertical, Lock, Zap, GripHorizontal, Plus, X, Settings2, DollarSign, Users, AlertCircle, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Responsive, WidthProvider, Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout/legacy';
import { useReports } from '../services/reportService';

const ResponsiveGridLayout = WidthProvider(Responsive);

const AVAILABLE_WIDGETS = [
  { id: 'balance_total', title: 'Cartera Activa', defaultLayout: { w: 1, h: 2, minW: 1, minH: 2 } },
  { id: 'prestamos_activos', title: 'Préstamos Activos', defaultLayout: { w: 1, h: 2, minW: 1, minH: 2 } },
  { id: 'tasa_mora', title: 'Tasa de Mora', defaultLayout: { w: 1, h: 2, minW: 1, minH: 2 } },
  { id: 'total_recuperado', title: 'Total Recuperado', defaultLayout: { w: 1, h: 2, minW: 1, minH: 2 } },
  { id: 'evolucion_desembolsos', title: 'Evolución de Desembolsos', defaultLayout: { w: 2, h: 5, minW: 2, minH: 4 } },
  { id: 'rendimiento_mora', title: 'Rendimiento de Mora', defaultLayout: { w: 2, h: 5, minW: 2, minH: 4 } },
];

const defaultLayouts: ResponsiveLayouts = {
  lg: [
    { i: 'balance_total', x: 0, y: 0, w: 1, h: 2, minW: 1, minH: 2 },
    { i: 'prestamos_activos', x: 1, y: 0, w: 1, h: 2, minW: 1, minH: 2 },
    { i: 'tasa_mora', x: 2, y: 0, w: 1, h: 2, minW: 1, minH: 2 },
    { i: 'total_recuperado', x: 3, y: 0, w: 1, h: 2, minW: 1, minH: 2 },
    { i: 'evolucion_desembolsos', x: 0, y: 2, w: 2, h: 5, minW: 2, minH: 4 },
    { i: 'rendimiento_mora', x: 2, y: 2, w: 2, h: 5, minW: 2, minH: 4 },
  ]
};

export default function Dashboard() {
  const { dashboardData, isLoading } = useReports();
  const [layouts, setLayouts] = useState(defaultLayouts);
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(AVAILABLE_WIDGETS.map(w => w.id));
  const [isEditMode, setIsEditMode] = useState(false);
  const [showWidgetManager, setShowWidgetManager] = useState(false);
  const summary = dashboardData?.summary || {};
  const collections = dashboardData?.collections || {};
  const recentLoans = Array.isArray(dashboardData?.recentActivity?.loans) ? dashboardData.recentActivity.loans : [];
  
  const chartData = recentLoans.slice(0, 6).reverse().map((loan: any) => {
    // Extraer un nombre significativo del cliente o usar el ID del crédito
    let customerName = loan.Customer?.name || loan.customerName || '';
    
    // Limpiar nombres de prueba generados por seeds o QA ignorando mayúsculas/minúsculas en cualquier parte del string
    if (customerName) {
      customerName = customerName.replace(/(qa|seed|test|dev)\s*/ig, '').trim();
    }

    // Si después de limpiar se queda vacío o es muy corto, usa el ID del crédito para que siempre se vea profesional
    const shortName = customerName && customerName.length > 2 ? customerName.split(' ')[0] : `Crédito #${loan.id}`;
    
    return {
      name: shortName,
      Desembolsado: Number(loan.amount || 0),
      Recuperado: Number(loan.totalPaid || 0),
    };
  });

  const formatCurrency = (value: number | string | undefined) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
  };

  // Load saved layout from localStorage on mount
  useEffect(() => {
    const savedLayouts = localStorage.getItem('dashboard_layouts');
    const savedWidgets = localStorage.getItem('dashboard_widgets');
    if (savedLayouts) {
      try { setLayouts(JSON.parse(savedLayouts)); } catch (e) {}
    }
    if (savedWidgets) {
      try { setVisibleWidgets(JSON.parse(savedWidgets)); } catch (e) {}
    }
  }, []);

  const handleLayoutChange = (layout: Layout, allLayouts: any) => {
    setLayouts(allLayouts);
    localStorage.setItem('dashboard_layouts', JSON.stringify(allLayouts));
  };

  const toggleWidget = (widgetId: string) => {
    setVisibleWidgets(prev => {
      const isVisible = prev.includes(widgetId);
      const newWidgets = isVisible ? prev.filter(id => id !== widgetId) : [...prev, widgetId];
      localStorage.setItem('dashboard_widgets', JSON.stringify(newWidgets));
      
      // If adding, ensure it has a layout entry
      if (!isVisible) {
        const widgetDef = AVAILABLE_WIDGETS.find(w => w.id === widgetId);
        if (widgetDef) {
          const newLayouts = { ...layouts };
          Object.keys(newLayouts).forEach(breakpoint => {
            const currentLayout = newLayouts[breakpoint as keyof typeof newLayouts] || [];
            if (!currentLayout.find((l: LayoutItem) => l.i === widgetId)) {
               newLayouts[breakpoint as keyof typeof newLayouts] = [
                 ...currentLayout,
                 {
                   i: widgetId,
                   x: 0,
                   y: Infinity, // puts it at the bottom
                   w: widgetDef.defaultLayout.w,
                   h: widgetDef.defaultLayout.h,
                   minW: widgetDef.defaultLayout.minW,
                   minH: widgetDef.defaultLayout.minH
                 }
               ];
            }
          });
          setLayouts(newLayouts);
        }
      }
      
      return newWidgets;
    });
  };

  const renderWidgetContent = (id: string) => {
    switch (id) {
      case 'balance_total':
        return (
          <div className="flex flex-col h-full justify-center">
            <div className="text-sm font-medium text-text-secondary mb-2">Balance Total</div>
            <div className="text-2xl font-bold text-text-primary">{formatCurrency(summary.totalOutstandingAmount)}</div>
            <div className="text-xs text-text-secondary mt-2">{summary.totalLoans || 0} créditos en cartera</div>
          </div>
        );
      case 'prestamos_activos':
        return (
          <div className="flex flex-col h-full justify-center">
            <div className="text-sm font-medium text-text-secondary mb-2">Préstamos Activos</div>
            <div className="text-2xl font-bold text-text-primary">{summary.activeLoans || 0}</div>
            <div className="text-xs text-text-secondary mt-2">{summary.defaultedLoans || 0} en mora</div>
          </div>
        );
      case 'tasa_mora':
        return (
          <div className="flex flex-col h-full justify-center">
            <div className="text-sm font-medium text-text-secondary mb-2">Tasa de Mora</div>
            <div className="text-2xl font-bold text-text-primary">{summary.totalLoans ? `${Math.round(((summary.defaultedLoans || 0) / summary.totalLoans) * 100)}%` : '0%'}</div>
            <div className="text-xs text-text-secondary mt-2">{collections.overdueAlerts || 0} alertas activas</div>
          </div>
        );
      case 'total_recuperado':
        return (
          <div className="flex flex-col h-full justify-center">
            <div className="text-sm font-medium text-text-secondary mb-2">Total Recuperado</div>
            <div className="text-2xl font-bold text-text-primary">{formatCurrency(summary.totalRecoveredAmount)}</div>
            <div className="text-xs text-text-secondary mt-2">{collections.pendingPromises || 0} promesas pendientes</div>
          </div>
        );
      case 'evolucion_desembolsos':
        return (
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Actividad</div>
                <div className="text-lg font-semibold text-text-primary">Evolución de Desembolsos</div>
              </div>
              <div className="text-xs text-text-secondary">{recentLoans.length} registros recientes</div>
            </div>
            <div className="flex-1 min-h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 10}} dy={5} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1b1f', border: 'none', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 'rendimiento_mora':
        return (
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Recuperación</div>
                <div className="text-lg font-semibold text-text-primary">Rendimiento de Mora</div>
              </div>
              <div className="text-xs text-text-secondary">Recuperado vs originado</div>
            </div>
            <div className="flex-1 min-h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} width={72} />
                  <Tooltip formatter={(value) => value != null ? formatCurrency(Number(value)) : ''} />
                  <Bar dataKey="recovered" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 'premium':
        return (
          <div className="relative overflow-hidden bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-[#1a1b1f] dark:to-[#2a2b30] h-full flex flex-col p-5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/20 blur-3xl rounded-full"></div>
            <div className="relative z-10 flex flex-col h-full">
              <h3 className="text-xl font-semibold leading-tight mb-2">
                <span className="text-yellow-500"><Zap size={20} className="inline fill-yellow-500 mr-1" /></span> Premium <span className="bg-yellow-500 text-bg-base px-2 py-0.5 rounded text-xs inline-block ml-2 align-middle">-40%</span>
              </h3>
              <p className="text-sm text-text-secondary mb-4 font-medium">¡Gran oportunidad!</p>
              <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                Desbloquea beneficios adaptados a tus preferencias y mejora tu rendimiento.
              </p>
              <div className="flex items-center justify-between mt-auto">
                <button className="text-xs text-text-secondary hover:text-text-primary font-medium">Ocultar</button>
                <button className="bg-text-primary text-bg-base px-5 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity">Comenzar</button>
              </div>
            </div>
          </div>
        );
      case 'anuncios':
        return (
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Novedades</div>
                <div className="text-lg font-semibold text-text-primary">Anuncios</div>
              </div>
              <button className="text-text-secondary hover:text-text-primary"><MoreVertical size={16} /></button>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800/30">
                <div className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Nueva función disponible</div>
                <div className="text-xs text-blue-600 dark:text-blue-400">Ahora puedes exportar tus reportes en formato PDF.</div>
              </div>
              <div className="bg-bg-base rounded-xl p-3 border border-border-subtle">
                <div className="text-sm font-medium text-text-primary mb-1">Mantenimiento programado</div>
                <div className="text-xs text-text-secondary">El sistema estará inactivo el domingo de 2am a 4am.</div>
              </div>
              <div className="bg-bg-base rounded-xl p-3 border border-border-subtle">
                <div className="text-sm font-medium text-text-primary mb-1">Actualización de términos</div>
                <div className="text-xs text-text-secondary">Hemos actualizado nuestras políticas de privacidad.</div>
              </div>
            </div>
          </div>
        );
      case 'campanas_populares':
        return (
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Directorio</div>
                <div className="text-lg font-semibold text-text-primary">Campañas Populares</div>
              </div>
              <button className="flex items-center gap-2 bg-bg-elevated px-3 py-1.5 rounded-lg text-sm text-text-secondary border border-border-subtle hover:bg-hover-bg transition-colors">
                <span className="bg-bg-base px-1.5 py-0.5 rounded text-xs border border-border-subtle shadow-sm">⌘2</span> Lista <ChevronDown size={14} />
              </button>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr>
                    <th className="p-3 text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle">Nombre</th>
                    <th className="p-3 text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle">Admin</th>
                    <th className="hidden sm:table-cell p-3 text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle">Estado</th>
                    <th className="p-3 text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-hover-bg/50 transition-colors">
                    <td className="p-3 text-sm text-text-primary border-b border-border-subtle font-medium">IBO Advertising</td>
                    <td className="p-3 text-sm text-text-primary border-b border-border-subtle">
                      <div className="flex items-center gap-2">
                        <img src="https://i.pravatar.cc/150?u=7" className="w-6 h-6 rounded-full" alt="Admin" />
                        <span>Samuel</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell p-3 text-sm text-text-primary border-b border-border-subtle"><span className="px-2 py-1 bg-hover-bg rounded text-xs text-text-secondary font-medium">Público</span></td>
                    <td className="p-3 text-sm text-text-primary border-b border-border-subtle text-right"><button className="bg-text-primary text-bg-base px-4 py-1.5 rounded-full text-xs font-medium hover:opacity-90 transition-opacity">Unirse</button></td>
                  </tr>
                  <tr className="hover:bg-hover-bg/50 transition-colors">
                    <td className="p-3 text-sm text-text-primary border-b border-border-subtle font-medium">Pela Design</td>
                    <td className="p-3 text-sm text-text-primary border-b border-border-subtle">
                      <div className="flex items-center gap-2">
                        <img src="https://i.pravatar.cc/150?u=hossein" className="w-6 h-6 rounded-full" alt="Admin" />
                        <span>Hossein</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell p-3 text-sm text-text-primary border-b border-border-subtle"><span className="px-2 py-1 bg-hover-bg rounded text-xs text-text-secondary font-medium">Público</span></td>
                    <td className="p-3 text-sm text-text-primary border-b border-border-subtle text-right"><button className="bg-text-primary text-bg-base px-4 py-1.5 rounded-full text-xs font-medium hover:opacity-90 transition-opacity">Unirse</button></td>
                  </tr>
                  <tr className="hover:bg-hover-bg/50 transition-colors">
                    <td className="p-3 text-sm text-text-primary border-b border-border-subtle font-medium">Emma Fashion</td>
                    <td className="p-3 text-sm text-text-primary border-b border-border-subtle">
                      <div className="flex items-center gap-2">
                        <img src="https://i.pravatar.cc/150?u=12" className="w-6 h-6 rounded-full" alt="Admin" />
                        <span>Maria</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell p-3 text-sm text-text-primary border-b border-border-subtle"><span className="px-2 py-1 bg-hover-bg rounded text-xs text-text-secondary font-medium flex items-center gap-1 w-fit"><Lock size={10} /> Privado</span></td>
                    <td className="p-3 text-sm text-text-primary border-b border-border-subtle text-right"><button className="border border-border-strong text-text-primary px-4 py-1.5 rounded-full text-xs font-medium hover:bg-hover-bg transition-colors">Pedir acceso</button></td>
                  </tr>
                  <tr className="hover:bg-hover-bg/50 transition-colors">
                    <td className="p-3 text-sm text-text-primary border-b border-border-subtle font-medium">Anaco Project</td>
                    <td className="p-3 text-sm text-text-primary border-b border-border-subtle">
                      <div className="flex items-center gap-2">
                        <img src="https://i.pravatar.cc/150?u=15" className="w-6 h-6 rounded-full" alt="Admin" />
                        <span>Stephanie</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell p-3 text-sm text-text-primary border-b border-border-subtle"><span className="px-2 py-1 bg-hover-bg rounded text-xs text-text-secondary font-medium">Público</span></td>
                    <td className="p-3 text-sm text-text-primary border-b border-border-subtle text-right"><button className="bg-text-primary text-bg-base px-4 py-1.5 rounded-full text-xs font-medium hover:opacity-90 transition-opacity">Unirse</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Dashboard</h2>
          <p className="text-sm text-text-secondary mt-1">Resumen general de tu cuenta.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowWidgetManager(!showWidgetManager)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${showWidgetManager ? 'bg-hover-bg border-border-strong' : 'bg-bg-surface border-border-subtle hover:bg-hover-bg'}`}
          >
            <Plus size={16} /> Widgets
          </button>
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${isEditMode ? 'bg-text-primary text-bg-base border-text-primary' : 'bg-bg-surface border-border-subtle hover:bg-hover-bg'}`}
          >
            <Settings2 size={16} /> {isEditMode ? 'Guardar Diseño' : 'Editar Diseño'}
          </button>
        </div>
      </div>

      {showWidgetManager && (
        <div className="bg-bg-surface border border-border-subtle rounded-xl shadow-sm p-4 mb-2 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-text-primary">Administrar Widgets</h3>
            <button onClick={() => setShowWidgetManager(false)} className="text-text-secondary hover:text-text-primary">
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_WIDGETS.map(widget => {
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
                  {isVisible ? <X size={14} /> : <Plus size={14} />} {widget.title}
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
          {visibleWidgets.map(id => (
            <div key={id} className="bg-bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden flex flex-col group">
              {isEditMode && (
                <div className="drag-handle absolute top-2 right-2 z-10 p-1.5 bg-bg-elevated/80 backdrop-blur rounded cursor-move transition-opacity border border-border-subtle shadow-sm text-text-secondary hover:text-text-primary">
                  <GripHorizontal size={16} />
                </div>
              )}
              {isEditMode && id !== 'premium' && (
                <button 
                  onClick={() => toggleWidget(id)}
                  className="absolute top-2 left-2 z-10 p-1.5 bg-bg-elevated/80 backdrop-blur rounded cursor-pointer transition-opacity border border-border-subtle shadow-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <X size={16} />
                </button>
              )}
              <div className={`flex-1 h-full overflow-hidden ${id === 'premium' ? '' : 'p-5'}`}>
                {renderWidgetContent(id)}
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
