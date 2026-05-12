import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Eye, Edit, Trash2, Download } from 'lucide-react';
import { useAssociates } from '../services/associateService';
import { usePaginationStore } from '../store/paginationStore';
import { toast } from '../lib/toast';
import { exportAssociatesExcel } from '../services/reportService';
import { tTerm } from '../i18n/terminology';
import TableShell from './shared/TableShell';
import { confirmDanger } from '../lib/confirmModal';
import { ActionButton, FormField, PageHeader, PageShell, SelectInput, TextInput, ToolbarSurface } from './shared/Surfaces';
import { HelpLabel } from './shared/HelpSupport';

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
    ? 'bg-blue-50 text-blue-700'
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
    <PageShell className="h-full" data-tour="associates-page">
      <PageHeader
        title={tTerm('associates.module.title')}
        subtitle={tTerm('associates.module.subtitle')}
        guideKey="associates"
        tourId="associates-header"
        actions={(
        <>
          <ActionButton
            onClick={handleExportAssociatesExcel}
            disabled={isExporting}
            isLoading={isExporting}
            icon={<Download size={16} />}
          >
            {tTerm('associates.cta.exportExcel')}
          </ActionButton>
          <ActionButton onClick={() => setCurrentView('associates-new')} icon={<Plus size={16} />} variant="primary">
            {tTerm('associates.cta.new')}
          </ActionButton>
        </>
        )}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <ToolbarSurface data-tour="associates-search">
          <div className="grid gap-3 md:grid-cols-[minmax(18rem,1fr)_14rem]">
            <FormField label="Buscar socio" className="md:max-w-xl">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <TextInput
                  type="text"
                  placeholder="Buscar por nombre, correo o teléfono…"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </FormField>
            <FormField label="Estado" tooltip="Filtra socios activos o inactivos dentro de la operación.">
              <SelectInput
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </SelectInput>
            </FormField>
          </div>
        </ToolbarSurface>

        <TableShell
          data-tour="associates-table"
          isLoading={isLoading}
          isError={isError}
          hasData={associates.length > 0}
          loadingContent={<div className="py-4 text-center text-text-secondary">Cargando socios…</div>}
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
          className="data-table-surface"
        >
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="pb-3 font-medium">ID</th>
                <th className="pb-3 font-medium">Nombre del socio</th>
                <th className="pb-3 font-medium">
                  <HelpLabel label="Estado" text="Estado del socio dentro de la plataforma. Define si sigue habilitado para vínculos, reportes y participación operativa." />
                </th>
                <th className="pb-3 font-medium">
                  <HelpLabel label="Participación" text="Porcentaje o reparto con el que el socio participa en los créditos relacionados." />
                </th>
                <th className="pb-3 font-medium">Créditos relacionados</th>
                <th className="pb-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {associates.map((associate: any) => (
                <tr key={associate.id} className="hover:bg-hover-bg transition-colors">
                  <td className="py-4 text-text-secondary font-mono">{String(associate.id).substring(0, 8)}</td>
                  <td className="py-4 font-medium flex items-center gap-3">
                    <div className="size-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
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
                      <ActionButton
                        onClick={() => setCurrentView(`associates/${associate.id}`)}
                        icon={<Eye size={16} />}
                        variant="ghost"
                        className="h-9 w-9 !min-h-0 !p-0"
                        title="Ver detalles"
                      >
                        <span className="sr-only">Ver detalles</span>
                      </ActionButton>
                      <ActionButton
                        onClick={() => setCurrentView(`associates/${associate.id}/edit`)}
                        icon={<Edit size={16} />}
                        variant="ghost"
                        className="h-9 w-9 !min-h-0 !p-0"
                        title="Editar"
                      >
                        <span className="sr-only">Editar</span>
                      </ActionButton>
                      <ActionButton
                        onClick={() => handleToggleStatus(associate)}
                        icon={<MoreVertical size={16} />}
                        variant="ghost"
                        className="h-9 w-9 !min-h-0 !p-0"
                        title={associate.status === 'active' ? 'Desactivar' : 'Reactivar'}
                      >
                        <span className="sr-only">{associate.status === 'active' ? 'Desactivar' : 'Reactivar'}</span>
                      </ActionButton>
                      <ActionButton
                        onClick={() => handleDelete(associate)}
                        icon={<Trash2 size={16} />}
                        variant="danger"
                        className="h-9 w-9 !min-h-0 !p-0"
                        title="Eliminar"
                      >
                        <span className="sr-only">Eliminar</span>
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </div>
    </PageShell>
  );
}
