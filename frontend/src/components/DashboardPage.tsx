import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Activity, GitBranch, Plus, Loader2, Power, PowerOff, Trash2, History } from 'lucide-react';
import dagService from '../services/dagService';
import { queryKeys } from '../services/queryKeys';
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
  const totalVersions = graphs.reduce((sum: number, g: any) => sum + (g.version || 0), 0);

  const stats = [
    { label: 'Formulas Activas', value: activeCount, icon: <FileText size={18} />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Versiones Totales', value: totalVersions, icon: <GitBranch size={18} />, color: 'bg-purple-50 text-purple-600' },
    { label: 'Grafos Totales', value: graphs.length, icon: <Activity size={18} />, color: 'bg-green-50 text-green-600' },
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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Panel de Formulas</h1>
        <button
          onClick={() => navigate('/formulas/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
        >
          <Plus size={16} />
          Nueva Formula
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 p-4 rounded-xl border border-border-subtle bg-bg-surface">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
              {stat.icon}
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-text-primary">{stat.value}</span>
              <span className="text-sm text-text-secondary">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Formulas</h2>
        <div className="overflow-hidden rounded-xl border border-border-subtle">
          <table className="w-full text-sm">
            <thead className="bg-bg-surface border-b border-border-subtle">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Scope</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Version</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Usos</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Actualizado</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {graphsLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <Loader2 className="animate-spin mx-auto text-brand-primary" size={24} />
                  </td>
                </tr>
              ) : graphs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                    No hay formulas. Crea la primera para empezar.
                  </td>
                </tr>
              ) : (
                graphs.map((formula: any) => (
                  <tr key={formula.id} className="hover:bg-hover-bg/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{formula.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{formula.scopeKey}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          formula.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : formula.status === 'archived'
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {formula.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">v{formula.version}</td>
                    <td className="px-4 py-3 text-text-secondary">{formula.usageCount ?? 0}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formula.updatedAt ? new Date(formula.updatedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/formulas/${formula.id}`)}
                          className="px-2 py-1 rounded text-xs font-medium text-brand-primary hover:bg-brand-primary/10 transition-colors"
                        >
                          Editar
                        </button>
                        {formula.status !== 'active' && (
                          <button
                            onClick={() => handleActivate(formula.id)}
                            disabled={updateStatusMutation.isPending}
                            className="p-1.5 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors disabled:opacity-30"
                            title="Activar"
                          >
                            <Power size={14} />
                          </button>
                        )}
                        {formula.status === 'active' && (
                          <button
                            onClick={() => handleDeactivate(formula.id)}
                            disabled={updateStatusMutation.isPending}
                            className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-30"
                            title="Desactivar"
                          >
                            <PowerOff size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/audit/${formula.id}`)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
                          title="Historial"
                        >
                          <History size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(formula.id, formula.name)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
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
