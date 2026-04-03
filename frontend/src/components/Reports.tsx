import React, { useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Users, DollarSign, AlertCircle, Download, Calendar, Wallet, CalendarClock } from 'lucide-react';
import { useReports, usePayoutsReport, usePaymentSchedule, exportDashboardSummary } from '../services/reportService';
import { getSafeErrorText } from '../services/safeErrorMessages';
import { tTerm } from '../i18n/terminology';
import { getPaymentTypeLabel } from '../constants/paymentTypes';
import { getChipClassName } from '../constants/uiChips';
import { useSessionStore } from '../store/sessionStore';
import { useOperationalActions } from './hooks/useOperationalActions';
import { useQueryClient } from '@tanstack/react-query';

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

export default function Reports() {
  const queryClient = useQueryClient();
  const { executeGuardedAction } = useOperationalActions(queryClient);
  const { user } = useSessionStore();
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

  // Payouts report state
  const [payoutFilters, setPayoutFilters] = useState<{ fromDate?: string; toDate?: string }>({});
  const [payoutPage, setPayoutPage] = useState(1);
  const { payouts, summary: payoutSummary, pagination: payoutPagination, isLoading: isPayoutsLoading } = usePayoutsReport(payoutFilters, payoutPage, 20);

  // Payment schedule state
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const { schedule, summary: scheduleSummary, loan: scheduleLoan, isLoading: isScheduleLoading } = usePaymentSchedule(selectedLoanId);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'outstanding' | 'profitability' | 'payouts' | 'schedule'>('dashboard');
  const [chartRange, setChartRange] = useState<'last6' | 'year' | 'historical'>('last6');
  const [isExporting, setIsExporting] = useState(false);

  const metrics = dashboardData?.metrics || {
    totalActiveLoans: 0,
    totalDisbursed: 0,
    totalRecovered: 0,
    arrearsRate: 0,
  };

  const monthlyData = monthlyPerformance ?? [];
  const filteredMonthlyData = useMemo(() => {
    if (chartRange === 'last6') {
      return monthlyData.slice(-6);
    }

    if (chartRange === 'year') {
      return monthlyData.slice(-12);
    }

    return monthlyData;
  }, [chartRange, monthlyData]);

  const chartRangeLabel = useMemo(() => {
    if (chartRange === 'last6') {
      return tTerm('reports.chart.disbursementRecovery.range.last6');
    }

    if (chartRange === 'year') {
      return tTerm('reports.chart.disbursementRecovery.range.year');
    }

    return tTerm('reports.chart.disbursementRecovery.range.historical');
  }, [chartRange]);
  const hasKpiTotals = useMemo(
    () => Number(metrics.totalDisbursed || 0) > 0 || Number(metrics.totalRecovered || 0) > 0,
    [metrics.totalDisbursed, metrics.totalRecovered],
  );
  const chartHasData = useMemo(
    () => filteredMonthlyData.some((item: any) => Number(item?.disbursed || 0) > 0 || Number(item?.recovered || 0) > 0),
    [filteredMonthlyData],
  );
  const statusData = statusBreakdown ?? [];
  const profitabilityData = profitabilityItems ?? [];

  const handleExportReport = async () => {
    setIsExporting(true);
    await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: user?.permissions },
      run: async () => {
        await exportDashboardSummary();
      },
      successMessage: tTerm('reports.toast.export.success'),
    });
    setIsExporting(false);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-text-secondary">Cargando reportes...</div>;
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-red-500">
        {getSafeErrorText(error, { domain: 'reports', action: 'reports.load' })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full pb-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">{tTerm('reports.module.title')}</h2>
          <p className="text-sm text-text-secondary mt-1">{tTerm('reports.module.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={handleExportReport}
          disabled={isExporting}
          className="flex items-center gap-2 bg-bg-surface border border-border-strong text-text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-hover-bg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Download size={16} /> {isExporting ? 'Exportando...' : tTerm('reports.cta.export')}
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
          title="Clientes y creditos con cuotas vencidas"
        >
          Créditos en Mora
        </button>
        <button 
          onClick={() => setActiveTab('profitability')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'profitability' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Rentabilidad de Clientes
        </button>
        <button 
          onClick={() => setActiveTab('payouts')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'payouts' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          title="Resumen y detalle de pagos aplicados"
        >
          Pagos y Desembolsos
        </button>
        <button 
          onClick={() => setActiveTab('schedule')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'schedule' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          title="Cronograma de cuotas por prestamo"
        >
          Calendario de Pagos
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
      <p className="text-xs text-text-secondary mt-1">
        <span className="font-medium">{tTerm('reports.kpi.scope.label')}:</span> {tTerm('reports.kpi.scope.lifetime')}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-medium" title={tTerm('reports.chart.disbursementRecovery.help')}>
              {tTerm('reports.chart.disbursementRecovery.title')}
            </h3>
            <div className="flex items-center gap-2 bg-bg-base border border-border-subtle rounded-lg px-3 py-1.5">
              <Calendar size={14} className="text-text-secondary" />
              <select
                value={chartRange}
                 onChange={(event) => setChartRange(event.target.value as 'last6' | 'year' | 'historical')}
                 className="bg-transparent text-sm text-text-secondary focus:outline-none cursor-pointer appearance-none pr-2"
               >
                 <option value="last6">{tTerm('reports.chart.disbursementRecovery.range.last6')}</option>
                 <option value="year">{tTerm('reports.chart.disbursementRecovery.range.year')}</option>
                 <option value="historical">{tTerm('reports.chart.disbursementRecovery.range.historical')}</option>
               </select>
             </div>
           </div>
          <p className="text-xs text-text-secondary mb-4">
            <span className="font-medium">{tTerm('reports.chart.scope.label')}:</span> {tTerm('reports.chart.scope.selectedRange')} {tTerm('reports.chart.scope.currentRangePrefix')} {chartRangeLabel}.
          </p>
          {chartHasData ? (
            <div className="h-72 w-full text-sm">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredMonthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 w-full rounded-xl border border-dashed border-border-subtle bg-bg-base flex flex-col items-center justify-center text-center px-6">
              <p className="text-sm font-medium text-text-primary">
                {hasKpiTotals
                  ? tTerm('reports.chart.disbursementRecovery.emptyWithKpi')
                  : tTerm('reports.chart.disbursementRecovery.empty')}
              </p>
              <p className="text-xs text-text-secondary mt-2">
                {hasKpiTotals
                  ? tTerm('reports.chart.disbursementRecovery.emptyWithKpiHint')
                  : tTerm('reports.chart.disbursementRecovery.emptyHint')}
              </p>
            </div>
          )}
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

      {activeTab === 'payouts' && (
        <div className="flex flex-col gap-6">
          {/* Summary Cards */}
          {payoutSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                    <Wallet size={20} />
                  </div>
                </div>
                <h3 className="text-text-secondary text-sm font-medium">Total Pagos</h3>
                <p className="text-2xl font-semibold mt-1">{Number(payoutSummary.totalPayouts || 0).toLocaleString()}</p>
              </div>
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <DollarSign size={20} />
                  </div>
                </div>
                <h3 className="text-text-secondary text-sm font-medium">Monto Total</h3>
                <p className="text-2xl font-semibold mt-1">${Number(payoutSummary.totalAmount || 0).toLocaleString()}</p>
              </div>
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
                <h3 className="text-text-secondary text-sm font-medium">Capital</h3>
                <p className="text-2xl font-semibold mt-1">${Number(payoutSummary.totalPrincipal || 0).toLocaleString()}</p>
              </div>
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
                <h3 className="text-text-secondary text-sm font-medium">Interés</h3>
                <p className="text-2xl font-semibold mt-1 text-emerald-600">${Number(payoutSummary.totalInterest || 0).toLocaleString()}</p>
              </div>
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
                <h3 className="text-text-secondary text-sm font-medium">Moras</h3>
                <p className="text-2xl font-semibold mt-1 text-amber-600">${Number(payoutSummary.totalPenalties || 0).toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Payouts Table */}
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-medium">Detalle de Pagos</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={payoutFilters.fromDate || ''}
                    onChange={(e) => setPayoutFilters({ ...payoutFilters, fromDate: e.target.value })}
                    className="bg-bg-base text-sm text-text-primary rounded-lg px-3 py-2 border border-border-subtle focus:outline-none"
                  />
                  <span className="text-text-secondary">a</span>
                  <input
                    type="date"
                    value={payoutFilters.toDate || ''}
                    onChange={(e) => setPayoutFilters({ ...payoutFilters, toDate: e.target.value })}
                    className="bg-bg-base text-sm text-text-primary rounded-lg px-3 py-2 border border-border-subtle focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-text-secondary border-b border-border-subtle">
                  <tr>
                    <th className="pb-3 font-medium">ID Pago</th>
                    <th className="pb-3 font-medium">ID Préstamo</th>
                    <th className="pb-3 font-medium">Fecha</th>
                    <th className="pb-3 font-medium">Monto</th>
                    <th className="pb-3 font-medium">Capital</th>
                    <th className="pb-3 font-medium">Interés</th>
                    <th className="pb-3 font-medium">Mora</th>
                    <th className="pb-3 font-medium">Tipo</th>
                    <th className="pb-3 font-medium">Método</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {isPayoutsLoading ? (
                    <tr>
                      <td colSpan={9} className="py-4 text-center text-text-secondary">Cargando pagos...</td>
                    </tr>
                  ) : payouts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-4 text-center text-text-secondary">No hay pagos registrados.</td>
                    </tr>
                  ) : (
                    payouts.map((payout: any, i: number) => (
                      <tr key={i} className="hover:bg-hover-bg transition-colors">
                        <td className="py-4 font-mono text-text-secondary">#{payout.id}</td>
                        <td className="py-4 font-mono text-blue-600 dark:text-blue-400">#{payout.loanId}</td>
                        <td className="py-4">{payout.paymentDate ? new Date(payout.paymentDate).toLocaleDateString() : 'N/A'}</td>
                        <td className="py-4 font-medium">${Number(payout.amount || 0).toLocaleString()}</td>
                        <td className="py-4 text-text-secondary">${Number(payout.principalApplied || 0).toLocaleString()}</td>
                        <td className="py-4 text-emerald-600">${Number(payout.interestApplied || 0).toLocaleString()}</td>
                        <td className="py-4 text-amber-600">${Number(payout.penaltyApplied || 0).toLocaleString()}</td>
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded text-xs ${getChipClassName('info')}`}>
                            {getPaymentTypeLabel(payout.paymentType)}
                          </span>
                        </td>
                        <td className="py-4 text-text-secondary capitalize">{payout.paymentMethod || 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {payoutPagination && payoutPagination.totalPages > 1 && (
              <div className="mt-4 flex justify-between items-center text-sm text-text-secondary">
                <div>
                  Mostrando {(payoutPage - 1) * 20 + 1} a {Math.min(payoutPage * 20, payoutPagination.totalItems)} de {payoutPagination.totalItems} pagos
                </div>
                <div className="flex gap-2">
                  <button 
                    disabled={payoutPage === 1}
                    onClick={() => setPayoutPage(payoutPage - 1)}
                    className="px-3 py-1 border border-border-subtle rounded hover:bg-hover-bg disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button 
                    disabled={payoutPage === payoutPagination.totalPages}
                    onClick={() => setPayoutPage(payoutPage + 1)}
                    className="px-3 py-1 border border-border-subtle rounded hover:bg-hover-bg disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="flex flex-col gap-6">
          {/* Loan Selector */}
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
            <h3 className="font-medium mb-4">Seleccionar Préstamo</h3>
            <div className="flex gap-4 items-center">
              <input
                type="number"
                placeholder="Ingrese ID del préstamo"
                value={selectedLoanId || ''}
                onChange={(e) => setSelectedLoanId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="bg-bg-base text-sm text-text-primary rounded-lg px-4 py-2 border border-border-subtle focus:outline-none w-64"
              />
              <button
                onClick={() => {/* Trigger refetch by toggling */}}
                disabled={!selectedLoanId || isScheduleLoading}
                className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50"
              >
                {isScheduleLoading ? 'Cargando...' : 'Ver Calendario'}
              </button>
            </div>
          </div>

          {/* Schedule Display */}
          {scheduleLoan && scheduleSummary && (
            <>
              {/* Loan Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                      <DollarSign size={20} />
                    </div>
                  </div>
                  <h3 className="text-text-secondary text-sm font-medium">Monto del Préstamo</h3>
                  <p className="text-2xl font-semibold mt-1">${Number(scheduleLoan.amount || 0).toLocaleString()}</p>
                </div>
                <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                      <CalendarClock size={20} />
                    </div>
                  </div>
                  <h3 className="text-text-secondary text-sm font-medium">Plazo</h3>
                  <p className="text-2xl font-semibold mt-1">{scheduleLoan.termMonths} meses</p>
                </div>
                <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
                  <h3 className="text-text-secondary text-sm font-medium">Tasa de Interés</h3>
                  <p className="text-2xl font-semibold mt-1">{scheduleLoan.interestRate}%</p>
                </div>
                <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
                  <h3 className="text-text-secondary text-sm font-medium">Estado</h3>
                  <p className="text-2xl font-semibold mt-1 capitalize">{scheduleLoan.status}</p>
                </div>
              </div>

              {/* Schedule Totals */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
                  <h3 className="text-text-secondary text-sm font-medium">Total Capital</h3>
                  <p className="text-2xl font-semibold mt-1">${Number(scheduleSummary.totalPrincipal || 0).toLocaleString()}</p>
                </div>
                <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
                  <h3 className="text-text-secondary text-sm font-medium">Total Interés</h3>
                  <p className="text-2xl font-semibold mt-1 text-emerald-600">${Number(scheduleSummary.totalInterest || 0).toLocaleString()}</p>
                </div>
                <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
                  <h3 className="text-text-secondary text-sm font-medium">Total a Pagar</h3>
                  <p className="text-2xl font-semibold mt-1 text-brand-primary">${Number(scheduleSummary.totalPayment || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Installment Progress */}
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
                <h3 className="font-medium mb-4">Progreso de Cuotas</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-4 bg-bg-base rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${(Number(scheduleSummary.paidInstallments) / Number(scheduleSummary.totalInstallments)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-text-secondary">
                    {scheduleSummary.paidInstallments} de {scheduleSummary.totalInstallments} cuotas pagadas
                  </span>
                </div>
              </div>

              {/* Amortization Schedule Table */}
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
                <h3 className="font-medium mb-6">Calendario de Amortización</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-text-secondary border-b border-border-subtle">
                      <tr>
                        <th className="pb-3 font-medium">#</th>
                        <th className="pb-3 font-medium">Fecha Vencimiento</th>
                        <th className="pb-3 font-medium">Saldo Inicial</th>
                        <th className="pb-3 font-medium">Cuota</th>
                        <th className="pb-3 font-medium">Capital</th>
                        <th className="pb-3 font-medium">Interés</th>
                        <th className="pb-3 font-medium">Saldo Final</th>
                        <th className="pb-3 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {schedule.map((entry: any, i: number) => (
                        <tr key={i} className="hover:bg-hover-bg transition-colors">
                          <td className="py-4 font-medium">{entry.installmentNumber || i + 1}</td>
                          <td className="py-4">{entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : 'N/A'}</td>
                          <td className="py-4">${Number(entry.openingBalance || 0).toLocaleString()}</td>
                          <td className="py-4 font-medium">${Number(entry.scheduledPayment || 0).toLocaleString()}</td>
                          <td className="py-4 text-text-secondary">${Number(entry.principalComponent || 0).toLocaleString()}</td>
                          <td className="py-4 text-emerald-600">${Number(entry.interestComponent || 0).toLocaleString()}</td>
                          <td className="py-4">${Number(entry.remainingBalance || 0).toLocaleString()}</td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded text-xs ${entry.status === 'paid' ? getChipClassName('success') : getChipClassName('warning')}`}>
                              {entry.status === 'paid' ? 'Pagado' : 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Empty State */}
          {!scheduleLoan && !isScheduleLoading && (
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-12 text-center">
              <CalendarClock size={48} className="mx-auto text-text-secondary mb-4" />
              <h3 className="text-lg font-medium mb-2">Sin datos del calendario</h3>
              <p className="text-text-secondary">Ingrese un ID de préstamo y haga clic en "Ver Calendario" para ver el calendario de pagos.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
