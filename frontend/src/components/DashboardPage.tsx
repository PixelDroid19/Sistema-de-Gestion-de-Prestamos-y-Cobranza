import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Activity, GitBranch, Plus, Loader2, Power, PowerOff, Trash2,
  History, TrendingUp, TrendingDown, AlertCircle,
} from 'lucide-react';
import dagService from '../services/dagService';
import { queryKeys } from '../services/queryKeys';
import { toast } from '../lib/toast';
import { confirm as confirmModal } from '../lib/confirmModal';
import TableShell from './shared/TableShell';

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
  const lockedCount = graphs.filter((g: any) => Number(g.usageCount || 0) > 0 || g.isLocked).length;

  const stats = [
    {
      label: 'Total formulas',
      shortLabel: 'Total',
      value: graphs.length,
      icon: <FileText size={18} />,
      iconClassName: 'bg-teal-100 text-teal-900 dark:bg-teal-500/20 dark:text-teal-100',
      trend: 'Versiones registradas',
      trendUp: true,
    },
    {
      label: 'Version activa',
      shortLabel: 'Activa',
      value: activeGraph ? `v${activeGraph.version}` : '—',
      icon: <Activity size={18} />,
      iconClassName: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100',
      trend: activeGraph ? 'En uso para nuevos creditos' : 'Sin version activa',
      trendUp: true,
    },
    {
      label: 'Borradores',
      shortLabel: 'Borradores',
      value: draftCount,
      icon: <AlertCircle size={18} />,
      iconClassName: 'bg-amber-100 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100',
      trend: 'Pendientes de activar',
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
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-bg-base p-3 sm:gap-5 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Dashboard de formulas
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-text-secondary sm:text-sm sm:leading-6">
            Gestiona la formula activa que calcula creditos nuevos. Las versiones usadas quedan congeladas para trazabilidad.
          </p>
        </div>
        <button
          onClick={() => navigate('/formulas/new')}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary/90 sm:w-auto sm:rounded-xl sm:py-2.5"
        >
          <Plus size={16} />
          Nueva formula
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="min-w-0 rounded-xl border border-border-subtle bg-bg-surface p-2.5 shadow-sm sm:rounded-2xl sm:p-5"
          >
            <div className="mb-1.5 flex items-start justify-between gap-1.5 sm:mb-3 sm:gap-2">
              <span className="hidden min-w-0 break-words text-[11px] font-bold uppercase leading-4 tracking-wider text-text-secondary sm:inline">
                {stat.label}
              </span>
              <span className="min-w-0 break-words text-[9px] font-bold uppercase leading-3 tracking-wider text-text-secondary sm:hidden">
                {stat.shortLabel}
              </span>
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl ${stat.iconClassName}`}
              >
                {stat.icon}
              </div>
            </div>
            <div
              className="font-mono text-xl font-bold tracking-tight text-text-primary sm:mb-1 sm:text-3xl"
            >
              {stat.value}
            </div>
            <div className="hidden items-center gap-1 text-xs text-text-secondary sm:flex">
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

      {lockedCount > 0 && (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs leading-5 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 sm:px-4 sm:py-3 sm:text-sm sm:leading-6"
        >
          <span className="sm:hidden">
            {lockedCount} version{lockedCount === 1 ? '' : 'es'} bloqueada{lockedCount === 1 ? '' : 's'} por creditos existentes. Los cambios se guardan como nueva version.
          </span>
          <span className="hidden sm:inline">
            {lockedCount} version{lockedCount === 1 ? '' : 'es'} ya tienen creditos asociados. No se pueden eliminar ni modificar en sitio; cualquier cambio debe guardarse como nueva version.
          </span>
        </div>
      )}

      {/* Table */}
      <div
        className="min-w-0 overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-sm"
      >
        <div
          className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-surface px-4 py-3 sm:px-5 sm:py-4"
        >
          <h3 className="text-base font-bold text-text-primary sm:text-lg">Formulas de credito</h3>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/formulas/variables')}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:underline"
            >
              Variables <GitBranch size={16} />
            </button>
          </div>
        </div>
        <TableShell
          isLoading={graphsLoading}
          isError={false}
          hasData={graphs.length > 0}
          recordsLabel="formulas"
          loadingContent={<div className="px-4 py-8 text-center"><Loader2 className="mx-auto animate-spin text-brand-primary" size={24} /></div>}
          errorContent={<div className="px-4 py-8 text-center text-red-600">No se pudieron cargar las formulas.</div>}
          emptyContent={<div className="px-4 py-8 text-center text-text-secondary">No hay formulas. Crea la primera para empezar.</div>}
        >
          <div className="divide-y divide-border-subtle md:hidden">
            {graphs.map((formula: any) => {
              const formulaUsageCount = Number(formula.usageCount || 0);
              const isFormulaLocked = Boolean(formula.isLocked || formulaUsageCount > 0);
              return (
                <article key={formula.id} className="space-y-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-text-primary">{formula.name}</h4>
                      <p className="mt-1 text-xs text-text-secondary">v{formula.version} · {formula.updatedAt ? new Date(formula.updatedAt).toLocaleDateString() : '-'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${formula.status === 'active' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950'}`}>
                      {formula.status === 'active' ? 'Activa' : 'Borrador'}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-secondary">
                    {formulaUsageCount} crédito(s){isFormulaLocked ? ' · bloqueada' : ' · sin uso'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => navigate(`/formulas/${formula.id}`)} className="rounded-lg border border-border-subtle px-3 py-2 text-sm font-semibold text-text-primary">
                      {isFormulaLocked ? 'Abrir copia' : 'Abrir'}
                    </button>
                    <button
                      onClick={() => formula.status === 'active' ? handleDeactivate(formula.id) : handleActivate(formula.id)}
                      disabled={updateStatusMutation.isPending}
                      className="rounded-lg border border-border-subtle px-3 py-2 text-sm font-semibold text-brand-primary disabled:opacity-50"
                    >
                      {formula.status === 'active' ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => navigate(`/audit/${formula.id}`)} className="rounded-lg border border-border-subtle px-3 py-2 text-sm font-semibold text-text-secondary">
                      Historial
                    </button>
                    <button
                      onClick={() => handleDelete(formula.id, formula.name)}
                      disabled={deleteMutation.isPending || isFormulaLocked}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[760px] w-full text-left text-sm xl:min-w-[920px]">
            <thead
              className="border-b border-border-subtle bg-bg-base text-xs uppercase tracking-wide text-text-secondary"
            >
              <tr>
                <th className="min-w-[180px] px-3 py-3 font-semibold">Nombre</th>
                <th className="px-3 py-3 font-semibold">Estado</th>
                <th className="px-3 py-3 text-right font-semibold">Creditos</th>
                <th className="px-3 py-3 text-right font-semibold">Version</th>
                <th className="hidden px-3 py-3 text-right font-semibold xl:table-cell">Ultimo cambio</th>
                <th className="px-3 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {graphsLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Loader2 className="mx-auto animate-spin text-brand-primary" size={24} />
                  </td>
                </tr>
              ) : graphs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                    No hay formulas. Crea la primera para empezar.
                  </td>
                </tr>
              ) : (
                graphs.map((formula: any) => {
                  const formulaUsageCount = Number(formula.usageCount || 0);
                  const isFormulaLocked = Boolean(formula.isLocked || formulaUsageCount > 0);
                  return (
                    <tr
                      key={formula.id}
                      className="group transition-colors hover:bg-hover-bg/60"
                    >
                    <td className="px-3 py-4 font-semibold text-text-primary">
                      <span className="block max-w-[220px] truncate" title={formula.name}>{formula.name}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          formula.status === 'active'
                            ? 'border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-100'
                            : 'border-amber-200 bg-amber-100 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-100'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${formula.status === 'active' ? 'bg-emerald-700 dark:bg-emerald-300' : 'bg-amber-700 dark:bg-amber-300'}`}
                        />
                        {formula.status === 'active' ? 'Activa' : 'Borrador'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right">
                      <span
                        className={`inline-flex items-center justify-end gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          isFormulaLocked
                            ? 'border-amber-200 bg-amber-100 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-100'
                            : 'border-slate-200 bg-slate-100 text-slate-900 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-100'
                        }`}
                      >
                        {formulaUsageCount}
                        {isFormulaLocked ? ' bloqueada' : ' sin uso'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-xs text-text-secondary">
                      v{formula.version}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-4 text-right text-text-secondary xl:table-cell">
                      {formula.updatedAt ? new Date(formula.updatedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/formulas/${formula.id}`)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-text-secondary transition-colors hover:bg-hover-bg hover:text-brand-primary"
                          title="Editar"
                        >
                          <FileText size={14} />
                          <span>{isFormulaLocked ? 'Abrir copia' : 'Abrir'}</span>
                        </button>
                        {formula.status !== 'active' && (
                          <button
                            onClick={() => handleActivate(formula.id)}
                            disabled={updateStatusMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 disabled:text-slate-500 disabled:opacity-60 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                            title="Activar"
                          >
                            <Power size={14} />
                            <span>Activar</span>
                          </button>
                        )}
                        {formula.status === 'active' && (
                          <button
                            onClick={() => handleDeactivate(formula.id)}
                            disabled={updateStatusMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-orange-800 transition-colors hover:bg-orange-50 disabled:text-slate-500 disabled:opacity-60 dark:text-orange-200 dark:hover:bg-orange-500/10"
                            title="Desactivar"
                          >
                            <PowerOff size={14} />
                            <span>Desactivar</span>
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/audit/${formula.id}`)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-text-secondary transition-colors hover:bg-hover-bg hover:text-brand-primary"
                          title="Historial"
                        >
                          <History size={14} />
                          <span>Historial</span>
                        </button>
                        <button
                          onClick={() => handleDelete(formula.id, formula.name)}
                          disabled={deleteMutation.isPending || isFormulaLocked}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:text-slate-500 disabled:opacity-60 dark:text-red-200 dark:hover:bg-red-500/10"
                          title={isFormulaLocked ? 'No se puede eliminar: tiene creditos asociados' : 'Eliminar'}
                        >
                          <Trash2 size={14} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </TableShell>
      </div>
    </div>
  );
}
