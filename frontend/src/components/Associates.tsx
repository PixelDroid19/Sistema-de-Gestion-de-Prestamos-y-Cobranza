import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Eye, Edit, Trash2, Download } from 'lucide-react';
import { useAssociates } from '../services/associateService';
import { usePaginationStore } from '../store/paginationStore';
import { toast } from '../lib/toast';
import { exportAssociatesExcel } from '../services/reportService';
import { tTerm } from '../i18n/terminology';
import TableShell from './shared/TableShell';
import { confirmDanger } from '../lib/confirmModal';

export default function Associates({ setCurrentView }: { setCurrentView: (v: string) => void }) {
  const { page, setPage, pageSize, setPageSize } = usePaginationStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: associatesData, isLoading, isError, updateAssociate, deleteAssociate, restoreAssociate } = useAssociates({
    page,
    pageSize,
    search: searchTerm || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExportAssociatesExcel = async () => {
    try {
      setIsExporting(true);
      await exportAssociatesExcel();
      toast.success({ description: tTerm('associates.toast.export.success') });
    } catch (error) {
      toast.error({ description: tTerm('associates.toast.export.error') });
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const associates = Array.isArray(associatesData?.data?.associates)
    ? associatesData.data.associates
    : Array.isArray(associatesData?.data)
      ? associatesData.data
      : [];
  const pagination = associatesData?.data?.pagination ?? associatesData?.pagination ?? associatesData?.meta;

  const getAssociateName = (associate: any) => {
    if (typeof associate?.name === 'string' && associate.name.trim()) {
      return associate.name.trim();
    }

    return [associate?.firstName, associate?.lastName].filter(Boolean).join(' ').trim() || 'Socio sin nombre';
  };

  const getAssociateInitials = (associate: any) => {
    return getAssociateName(associate)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part.charAt(0).toUpperCase())
      .join('');
  };

  const getStatusLabel = (status: string) => (status === 'active' ? 'Activo' : 'Inactivo');

  const getStatusClasses = (status: string) => (status === 'active'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-100 text-slate-600');

  const handleDelete = async (associate: any) => {
    const associateId = Number(associate?.id);
    if (!Number.isFinite(associateId)) return;

    const confirmed = await confirmDanger({
      title: 'Eliminar socio',
      message: `¿Está seguro de eliminar a ${getAssociateName(associate)}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await deleteAssociate.mutateAsync(associateId);
      toast.success({ description: 'Socio eliminado correctamente' });
    } catch (error) {
      console.error('[associates] deleteAssociate failed', error);
      toast.apiErrorSafe(error, { domain: 'associates' });
    }
  };

  const handleToggleStatus = async (associate: any) => {
    const associateId = Number(associate?.id);
    if (!Number.isFinite(associateId)) return;

    const currentStatus = associate?.status === 'active' ? 'active' : 'inactive';
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

    const confirmed = await confirmDanger({
      title: nextStatus === 'inactive' ? 'Desactivar socio' : 'Reactivar socio',
      message: nextStatus === 'inactive'
        ? `¿Desea desactivar a ${getAssociateName(associate)}?`
        : `¿Desea reactivar a ${getAssociateName(associate)}?`,
      confirmLabel: nextStatus === 'inactive' ? 'Desactivar' : 'Reactivar',
    });
    if (!confirmed) return;

    try {
      if (nextStatus === 'active') {
        await restoreAssociate.mutateAsync(associateId);
      } else {
        await updateAssociate.mutateAsync({ id: associateId, status: nextStatus });
      }
      toast.success({
        description: nextStatus === 'inactive'
          ? 'Socio desactivado correctamente'
          : 'Socio reactivado correctamente',
      });
    } catch (error) {
      console.error('[associates] updateAssociate status failed', error);
      toast.apiErrorSafe(error, { domain: 'associates' });
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">{tTerm('associates.module.title')}</h2>
          <p className="text-sm text-text-secondary mt-1">{tTerm('associates.module.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportAssociatesExcel}
            disabled={isExporting}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download size={16} /> {isExporting ? 'Exportando...' : tTerm('associates.cta.exportExcel')}
          </button>
          <button onClick={() => setCurrentView('associates-new')} className="flex items-center gap-2 bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus size={16} /> {tTerm('associates.cta.new')}
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-white p-4 shadow-sm dark:bg-bg-surface">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input 
                type="text" 
                placeholder="Buscar por nombre, correo o teléfono..." 
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                className="bg-bg-base text-sm text-text-primary rounded-lg pl-10 pr-4 py-2 w-72 focus:outline-none focus:ring-1 focus:ring-border-strong border border-border-subtle"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>

        <TableShell
          isLoading={isLoading}
          isError={isError}
          hasData={associates.length > 0}
          loadingContent={<div className="py-4 text-center text-text-secondary">Cargando socios...</div>}
          errorContent={<div className="py-4 text-center text-red-500">Error al cargar socios.</div>}
          emptyContent={<div className="py-4 text-center text-text-secondary">No hay socios registrados.</div>}
          recordsLabel="socios"
          pagination={pagination ? {
            page,
            pageSize,
            totalItems: pagination?.totalItems ?? pagination?.total ?? 0,
            totalPages: pagination?.totalPages ?? 1,
            onPrev: () => setPage(page - 1),
            onNext: () => setPage(page + 1),
            onPageSizeChange: (nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            },
          } : undefined}
        >
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="pb-3 font-medium">ID</th>
                <th className="pb-3 font-medium">Nombre del Socio</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Participación</th>
                <th className="pb-3 font-medium">Préstamos Relacionados</th>
                <th className="pb-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {associates.map((associate: any) => (
                <tr key={associate.id} className="hover:bg-hover-bg transition-colors">
                  <td className="py-4 text-text-secondary font-mono">{String(associate.id).substring(0, 8)}</td>
                  <td className="py-4 font-medium flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                      {getAssociateInitials(associate)}
                    </div>
                    {getAssociateName(associate)}
                  </td>
                  <td className="py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(associate.status)}`}>
                      {getStatusLabel(associate.status)}
                    </span>
                  </td>
                  <td className="py-4 text-text-secondary">
                    {associate.participationPercentage ? `${associate.participationPercentage}%` : 'Sin definir'}
                  </td>
                  <td className="py-4">{associate.loanCount ?? associate.relatedLoans?.length ?? 0}</td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentView(`associates/${associate.id}`)} className="p-1.5 text-text-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Ver detalles"><Eye size={16} /></button>
                      <button
                        onClick={() => setCurrentView(`associates/${associate.id}/edit`)}
                        className="p-1.5 text-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(associate)}
                        className="p-1.5 text-text-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                        title={associate.status === 'active' ? 'Desactivar' : 'Reactivar'}
                      >
                        <MoreVertical size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(associate)}
                        className="p-1.5 text-text-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </div>
    </div>
  );
}
