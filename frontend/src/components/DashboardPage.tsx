import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Activity, GitBranch, Plus, Loader2, Power, PowerOff, Trash2, History, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import dagService from '../services/dagService';
import { queryKeys } from '../services/queryKeys';
import { getScopeLabel } from '../types/dag';
import { toast } from '../lib/toast';
import { confirm as confirmModal } from '../lib/confirmModal';

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: graphsData, isLoading: graphsLoading } = useQuery({
    queryKey: queryKeys.dag.graphs('credit-simulation'),
    queryFn: () => dagService.listGraphs('credit-simulation'),
  });

  const graphs = graphsData?.data?.graphs ?? [];
  const activeCount = graphs.filter((g: any) => g.status === 'active').length;
  const draftCount = graphs.filter((g: any) => g.status === 'inactive').length;
  const totalVersions = graphs.reduce((sum: number, g: any) => sum + (g.version || 0), 0);

  const stats = [
    { label: 'Total Formulas', value: graphs.length, icon: <FileText size={18} />, color: 'bg-blue-50 text-blue-600', trend: '+3 this month', trendUp: true },
    { label: 'Active Formulas', value: activeCount, icon: <Activity size={18} />, color: 'bg-emerald-50 text-emerald-600', trend: 'Currently live', trendUp: true },
    { label: 'Draft Formulas', value: draftCount, icon: <Clock size={18} />, color: 'bg-amber-50 text-amber-600', trend: 'Pending approval', trendUp: false },
  ];

  const updateStatusMutation = useMutation({
    mutationFn: ({ graphId, status }: { graphId: number; status: 'active' | 'inactive' }) =>
      dagService.updateGraphStatus(graphId, status),
    onSuccess: (_, vars) => {
      toast.success({ description: vars.status === 'active' ? 'Formula activada' : 'Formula desactivada' });
      queryClient.invalidateQueries({ queryKey: queryKeys.dag.graphs('credit-simulation') });
    },
    onError: (err: any) => {
      toast.error({ description: err.message || 'Error al actualizar estado' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (graphId: number) => dagService.deleteGraph(graphId),
    onSuccess: () => {
      toast.success({ description: 'Formula eliminada' });
      queryClient.invalidateQueries({ queryKey: queryKeys.dag.graphs('credit-simulation') });
    },
    onError: (err: any) => {
      toast.error({ description: err.message || 'Error al eliminar formula' });
    },
  });

  const handleActivate = (graphId: number) => {
    updateStatusMutation.mutate({ graphId, status: 'active' });
  };

  const handleDeactivate = (graphId: number) => {
    updateStatusMutation.mutate({ graphId, status: 'inactive' });
  };

  const handleDelete = async (graphId: number, name: string) => {
    const confirmed = await confirmModal({
      title: 'Eliminar Formula',
      message: `Seguro que queres eliminar "${name}"? Esta accion no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      confirmVariant: 'danger',
    });
    if (!confirmed) return;
    deleteMutation.mutate(graphId);
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-text-primary">Dashboard Overview</h2>
          <p className="text-text-secondary mt-1 text-sm">Monitor and manage active credit calculation models.</p>
        </div>
        <button
          onClick={() => navigate('/formulas/new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors shadow-sm"
        >
          <Plus size={16} />
          New Formula
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-wide">{stat.label}</span>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
            <div className="text-3xl font-bold text-text-primary mb-1 font-mono tracking-tight">{stat.value}</div>
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              {stat.trendUp ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-amber-500" />}
              {stat.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle flex justify-between items-center bg-bg-surface/50">
          <h3 className="text-lg font-bold text-text-primary">Active Formulas</h3>
          <button
            onClick={() => navigate('/formulas')}
            className="text-sm text-brand-primary font-medium hover:underline flex items-center gap-1"
          >
            View All <GitBranch size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-surface border-b border-border-subtle text-[11px] font-bold text-text-secondary uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 w-1/2">Formula Name</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Version</th>
                <th className="px-5 py-3 text-right">Last Edited</th>
                <th className="px-5 py-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {graphsLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center">
                    <Loader2 className="animate-spin mx-auto text-brand-primary" size={24} />
                  </td>
                </tr>
              ) : graphs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-text-secondary">
                    No hay formulas. Crea la primera para empezar.
                  </td>
                </tr>
              ) : (
                graphs.map((formula: any) => (
                  <tr key={formula.id} className="hover:bg-hover-bg/50 transition-colors group">
                    <td className="px-5 py-3 font-medium text-text-primary">{formula.name}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-2 text-xs ${
                        formula.status === 'active' ? 'text-emerald-700' : 'text-amber-700'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          formula.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}></span>
                        {formula.status === 'active' ? 'Active' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-text-secondary font-mono text-xs">v{formula.version}</td>
                    <td className="px-5 py-3 text-right text-text-secondary">
                      {formula.updatedAt ? new Date(formula.updatedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/formulas/${formula.id}`)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-brand-primary hover:bg-hover-bg transition-colors opacity-0 group-hover:opacity-100"
                          title="Editar"
                        >
                          <FileText size={14} />
                        </button>
                        {formula.status !== 'active' && (
                          <button
                            onClick={() => handleActivate(formula.id)}
                            disabled={updateStatusMutation.isPending}
                            className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-30 opacity-0 group-hover:opacity-100"
                            title="Activar"
                          >
                            <Power size={14} />
                          </button>
                        )}
                        {formula.status === 'active' && (
                          <button
                            onClick={() => handleDeactivate(formula.id)}
                            disabled={updateStatusMutation.isPending}
                            className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-30 opacity-0 group-hover:opacity-100"
                            title="Desactivar"
                          >
                            <PowerOff size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/audit/${formula.id}`)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-brand-primary hover:bg-hover-bg transition-colors opacity-0 group-hover:opacity-100"
                          title="Historial"
                        >
                          <History size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(formula.id, formula.name)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 opacity-0 group-hover:opacity-100"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
