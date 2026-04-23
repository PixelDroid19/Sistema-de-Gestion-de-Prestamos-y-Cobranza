import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Activity, GitBranch, Plus, Loader2, Power, PowerOff, Trash2,
  History, TrendingUp, TrendingDown, Clock, AlertCircle,
} from 'lucide-react';
import dagService from '../services/dagService';
import { queryKeys } from '../services/queryKeys';
import { toast } from '../lib/toast';
import { confirm as confirmModal } from '../lib/confirmModal';

// Material Design 3 color tokens mapped to Tailwind arbitrary values
const MD3 = {
  surface: '#f8f9ff',
  onSurface: '#0b1c30',
  onSurfaceVariant: '#5a6271',
  secondary: '#00668a',
  secondaryContainer: '#cce5f3',
  onSecondaryContainer: '#00344a',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onErrorContainer: '#410002',
  outline: '#c4c6cf',
  outlineVariant: '#dee1ea',
} as const;

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: graphsData, isLoading: graphsLoading } = useQuery({
    queryKey: queryKeys.dag.graphs('credit-simulation'),
    queryFn: () => dagService.listGraphs('credit-simulation'),
  });

  const graphs = graphsData?.data?.graphs ?? [];
  const activeGraph = graphs.find((g: any) => g.status === 'active');
  const draftCount = graphs.filter((g: any) => g.status === 'inactive').length;

  const stats = [
    {
      label: 'Total Formulas',
      value: graphs.length,
      icon: <FileText size={18} />,
      bg: `bg-[${MD3.secondaryContainer}]`,
      text: `text-[${MD3.onSecondaryContainer}]`,
      trend: '+3 this month',
      trendUp: true,
    },
    {
      label: 'Active Version',
      value: activeGraph ? `v${activeGraph.version}` : '—',
      icon: <Activity size={18} />,
      bg: `bg-[#e8f5e9]`,
      text: `text-[#1b5e20]`,
      trend: activeGraph ? 'Currently live' : 'No active version',
      trendUp: true,
    },
    {
      label: 'Pending Reviews',
      value: draftCount,
      icon: <AlertCircle size={18} />,
      bg: `bg-[#fff3e0]`,
      text: `text-[#e65100]`,
      trend: 'Needs approval',
      trendUp: false,
    },
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
    <div className="flex flex-col gap-6 p-6 lg:p-8 h-full overflow-y-auto" style={{ backgroundColor: MD3.surface }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: MD3.onSurface, fontFamily: "'Inter', sans-serif" }}>
            Dashboard Overview
          </h2>
          <p className="mt-1 text-sm" style={{ color: MD3.onSurfaceVariant }}>
            Monitor and manage active credit calculation models.
          </p>
        </div>
        <button
          onClick={() => navigate('/formulas/new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
          style={{ backgroundColor: MD3.secondary }}
        >
          <Plus size={16} />
          New Formula
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl p-5 shadow-sm border"
            style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant }}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: MD3.onSurfaceVariant }}>
                {stat.label}
              </span>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg} ${stat.text}`}
              >
                {stat.icon}
              </div>
            </div>
            <div
              className="text-3xl font-bold mb-1 font-mono tracking-tight"
              style={{ color: MD3.onSurface }}
            >
              {stat.value}
            </div>
            <div className="flex items-center gap-1 text-xs" style={{ color: MD3.onSurfaceVariant }}>
              {stat.trendUp ? (
                <TrendingUp size={14} className="text-emerald-600" />
              ) : (
                <TrendingDown size={14} className="text-amber-600" />
              )}
              {stat.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl shadow-sm border overflow-hidden"
        style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant }}
      >
        <div
          className="px-5 py-4 border-b flex justify-between items-center"
          style={{ borderColor: MD3.outlineVariant, backgroundColor: 'rgba(248,249,255,0.5)' }}
        >
          <h3 className="text-lg font-bold" style={{ color: MD3.onSurface }}>Active Formulas</h3>
          <button
            onClick={() => navigate('/formulas')}
            className="text-sm font-semibold hover:underline flex items-center gap-1"
            style={{ color: MD3.secondary }}
          >
            View All <GitBranch size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead
              className="border-b text-[11px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: 'rgba(248,249,255,0.5)', borderColor: MD3.outlineVariant, color: MD3.onSurfaceVariant }}
            >
              <tr>
                <th className="px-5 py-3 w-1/2">Formula Name</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Version</th>
                <th className="px-5 py-3 text-right">Last Edited</th>
                <th className="px-5 py-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: MD3.outlineVariant }}>
              {graphsLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center">
                    <Loader2 className="animate-spin mx-auto" size={24} style={{ color: MD3.secondary }} />
                  </td>
                </tr>
              ) : graphs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center" style={{ color: MD3.onSurfaceVariant }}>
                    No hay formulas. Crea la primera para empezar.
                  </td>
                </tr>
              ) : (
                graphs.map((formula: any) => (
                  <tr
                    key={formula.id}
                    className="hover:bg-[#f8f9ff]/60 transition-colors group"
                  >
                    <td className="px-5 py-3 font-semibold" style={{ color: MD3.onSurface }}>
                      {formula.name}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{
                          color: formula.status === 'active' ? '#1b5e20' : '#e65100',
                          backgroundColor: formula.status === 'active' ? '#e8f5e9' : '#fff3e0',
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: formula.status === 'active' ? '#2e7d32' : '#ef6c00',
                          }}
                        />
                        {formula.status === 'active' ? 'Active' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs" style={{ color: MD3.onSurfaceVariant }}>
                      v{formula.version}
                    </td>
                    <td className="px-5 py-3 text-right" style={{ color: MD3.onSurfaceVariant }}>
                      {formula.updatedAt ? new Date(formula.updatedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/formulas/${formula.id}`)}
                          className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          style={{ color: MD3.onSurfaceVariant }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = MD3.secondary;
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = MD3.surface;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = MD3.onSurfaceVariant;
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                          }}
                          title="Editar"
                        >
                          <FileText size={14} />
                        </button>
                        {formula.status !== 'active' && (
                          <button
                            onClick={() => handleActivate(formula.id)}
                            disabled={updateStatusMutation.isPending}
                            className="p-1.5 rounded-lg transition-colors disabled:opacity-30 opacity-0 group-hover:opacity-100"
                            style={{ color: '#2e7d32' }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e8f5e9';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                            }}
                            title="Activar"
                          >
                            <Power size={14} />
                          </button>
                        )}
                        {formula.status === 'active' && (
                          <button
                            onClick={() => handleDeactivate(formula.id)}
                            disabled={updateStatusMutation.isPending}
                            className="p-1.5 rounded-lg transition-colors disabled:opacity-30 opacity-0 group-hover:opacity-100"
                            style={{ color: '#e65100' }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fff3e0';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                            }}
                            title="Desactivar"
                          >
                            <PowerOff size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/audit/${formula.id}`)}
                          className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          style={{ color: MD3.onSurfaceVariant }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = MD3.secondary;
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = MD3.surface;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = MD3.onSurfaceVariant;
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                          }}
                          title="Historial"
                        >
                          <History size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(formula.id, formula.name)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg transition-colors disabled:opacity-30 opacity-0 group-hover:opacity-100"
                          style={{ color: MD3.error }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = MD3.errorContainer;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                          }}
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
