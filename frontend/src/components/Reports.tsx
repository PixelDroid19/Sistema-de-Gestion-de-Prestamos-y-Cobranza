import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Users, DollarSign, AlertCircle, Download, Calendar } from 'lucide-react';
import { useReports } from '../services/reportService';

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Ocurrio un error inesperado.';
};

export default function Reports() {
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

  const [activeTab, setActiveTab] = useState<'dashboard' | 'outstanding' | 'profitability'>('dashboard');

  if (isLoading) {
    return <div className="p-8 text-center text-text-secondary">Cargando reportes...</div>;
  }

  if (isError) {
    return <div className="p-8 text-center text-red-500">Error al cargar reportes: {getErrorMessage(error)}</div>;
  }

  const metrics = dashboardData?.metrics || {
    totalActiveLoans: 0,
    totalDisbursed: 0,
    totalRecovered: 0,
    arrearsRate: 0
  };

  const monthlyData = monthlyPerformance;
  const statusData = statusBreakdown;
  const profitabilityData = profitabilityItems;

  return (
    <div className="flex flex-col gap-6 h-full pb-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Reportes y Analíticas</h2>
          <p className="text-sm text-text-secondary mt-1">Métricas clave y rendimiento de la cartera de créditos.</p>
        </div>
        <button
          type="button"
          disabled
          title="La exportacion de esta vista aun no esta disponible"
          className="flex items-center gap-2 bg-bg-surface border border-border-strong text-text-primary px-4 py-2 rounded-lg text-sm font-medium opacity-60 cursor-not-allowed"
        >
          <Download size={16} /> Exportar
        </button>
      </div>

      <div className="flex gap-6 border-b border-border-subtle">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Dashboard General
        </button>
        <button 
          onClick={() => setActiveTab('outstanding')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'outstanding' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Créditos en Mora
        </button>
        <button 
          onClick={() => setActiveTab('profitability')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'profitability' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Rentabilidad de Clientes
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
              <DollarSign size={20} />
            </div>
          </div>
          <h3 className="text-text-secondary text-sm font-medium">Total Desembolsado</h3>
          <p className="text-2xl font-semibold mt-1">${metrics.totalDisbursed.toLocaleString()}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={20} />
            </div>
          </div>
          <h3 className="text-text-secondary text-sm font-medium">Total Recuperado</h3>
          <p className="text-2xl font-semibold mt-1">${metrics.totalRecovered.toLocaleString()}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg text-yellow-600 dark:text-yellow-400">
              <Users size={20} />
            </div>
          </div>
          <h3 className="text-text-secondary text-sm font-medium">Créditos Activos</h3>
          <p className="text-2xl font-semibold mt-1">{metrics.totalActiveLoans}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-600 dark:text-red-400">
              <AlertCircle size={20} />
            </div>
          </div>
          <h3 className="text-text-secondary text-sm font-medium">Tasa de Morosidad</h3>
          <p className="text-2xl font-semibold mt-1">{metrics.arrearsRate}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-medium">Desembolsos vs Recuperación</h3>
            <div className="flex items-center gap-2 bg-bg-base border border-border-subtle rounded-lg px-3 py-1.5">
              <Calendar size={14} className="text-text-secondary" />
              <select className="bg-transparent text-sm text-text-secondary focus:outline-none cursor-pointer appearance-none pr-2">
                <option>Últimos 6 meses</option>
                <option>Este año</option>
              </select>
            </div>
          </div>
          <div className="h-72 w-full text-sm">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                <Area type="monotone" name="Desembolsado" dataKey="disbursed" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorDes)" />
                <Area type="monotone" name="Recuperado" dataKey="recovered" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRec)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
          <h3 className="font-medium mb-6">Estado de la Cartera</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
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
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-3 mt-4">
            {statusData.map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-text-secondary capitalize">{item.status}</span>
                </div>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'outstanding' && (
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
          <h3 className="font-medium mb-6">Detalle de Créditos en Mora</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-text-secondary border-b border-border-subtle">
                <tr>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Días de Atraso</th>
                  <th className="pb-3 font-medium">Monto en Mora</th>
                  <th className="pb-3 font-medium">Capital Restante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {overdueLoans.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-hover-bg transition-colors">
                    <td className="py-4 font-medium">{item.customerName || `Cliente #${item.customerId}`}</td>
                    <td className="py-4 text-status-warning font-medium">{item.daysOverdue} días</td>
                    <td className="py-4 font-bold text-status-warning">${item.overdueAmount?.toLocaleString()}</td>
                    <td className="py-4">${item.remainingCapital?.toLocaleString()}</td>
                  </tr>
                ))}
                {overdueLoans.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-text-secondary">No hay créditos en mora.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'profitability' && (
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
          <h3 className="font-medium mb-6">Rentabilidad por Cliente</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-text-secondary border-b border-border-subtle">
                <tr>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Préstamos Totales</th>
                  <th className="pb-3 font-medium">Interés Cobrado</th>
                  <th className="pb-3 font-medium">Mora Cobrada</th>
                  <th className="pb-3 font-medium">Rentabilidad Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {profitabilityData.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-hover-bg transition-colors">
                    <td className="py-4 font-medium">{item.customerName || `Cliente #${item.customerId}`}</td>
                    <td className="py-4">{item.totalLoans}</td>
                    <td className="py-4 text-emerald-600">${item.interestCollected?.toLocaleString()}</td>
                    <td className="py-4 text-amber-600">${item.lateFeesCollected?.toLocaleString()}</td>
                    <td className="py-4 font-bold text-brand-primary">${item.totalProfit?.toLocaleString()}</td>
                  </tr>
                ))}
                {profitabilityData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-text-secondary">No hay datos de rentabilidad disponibles.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
