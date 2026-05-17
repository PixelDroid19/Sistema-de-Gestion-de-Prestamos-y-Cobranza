import React, { useMemo, useState } from 'react';
import { Plus, Search, MoreVertical, Eye, Edit, Trash2, Download, DollarSign, TrendingUp, Users, Percent } from 'lucide-react';
import {
  formatCurrency as formatCurrencyValue,
  formatNumber as formatNumberValue,
  formatPercent as formatPercentValue,
} from '../i18n/format';
import { useAssociates } from '../services/associateService';
import { usePaginationStore } from '../store/paginationStore';
import { toast } from '../lib/toast';
import { exportAssociatesExcel } from '../services/reportService';
import { tTerm } from '../i18n/terminology';
import TableShell from './shared/TableShell';
import { confirmDanger } from '../lib/confirmModal';
import { useSessionStore } from '../store/sessionStore';
import { ActionButton, FormField, InsightStrip, PageHeader, PageShell, SelectInput, TextInput, ToolbarSurface } from './shared/Surfaces';
import { HelpLabel } from './shared/HelpSupport';

const formatCurrency = (amount: number) => formatCurrencyValue(amount);

const formatPercent = (value: number) => formatPercentValue(value, { maximumFractionDigits: 2 });

export default function Associates({ setCurrentView }: { setCurrentView: (v: string) => void }) {
  const { user } = useSessionStore();
  const { page, setPage, pageSize, setPageSize } = usePaginationStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const permissionSet = new Set((user?.permissions || []).map((permission) => permission.toUpperCase()));
  const hasPermission = (permission: string) => user?.role === 'admin' || permissionSet.has('*') || permissionSet.has(permission);
  const canCreateAssociates = hasPermission('SOCIOS_CREATE');
  const canUpdateAssociates = hasPermission('SOCIOS_UPDATE');
  const canDeleteAssociates = hasPermission('SOCIOS_DELETE');
  const canExportAssociates = hasPermission('REPORTS_VIEW_ALL');
  const { data: associatesData, isLoading, isError, updateAssociate, deleteAssociate, restoreAssociate } = useAssociates({
    page,
    pageSize,
    search: searchTerm || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExportAssociatesExcel = async () => {
    if (!canExportAssociates) {
      toast.error({ description: 'No tiene permiso para exportar reportes de socios.' });
      return;
    }

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
  const summary = associatesData?.data?.summary;
  const associateStripMetrics = useMemo(() => {
    const visibleTotal = pagination?.totalItems ?? pagination?.total ?? associates.length;
    const activeCount = summary?.activeAssociates ?? associates.filter((associate: any) => associate.status === 'active').length;
    const totalContributed = Number(summary?.totalContributed ?? associates.reduce((total: number, associate: any) => (
      total + Number(associate.totalContributed || associate.capitalContributed || 0)
    ), 0));
    const monthlyInterestEstimate = Number(summary?.monthlyInterestEstimate ?? associates.reduce((total: number, associate: any) => {
      const capital = Number(associate.totalContributed || associate.capitalContributed || 0);
      const rate = Number(associate.interestRate || 0) / 100;
      return total + (associate.interestType === 'annual' ? (capital * rate) / 12 : capital * rate);
    }, 0));
    const participationAssigned = Number(summary?.participationAssigned ?? associates.reduce((total: number, associate: any) => (
      total + Number(associate.participationPercentage || 0)
    ), 0));

    return {
      activeCount,
      totalCount: Number(visibleTotal || 0),
      totalContributed,
      monthlyInterestEstimate,
      participationAssigned,
    };
  }, [associates, pagination?.total, pagination?.totalItems, summary]);

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

  const getStatusLabel = (status: string) => (status === 'active'
    ? tTerm('common.status.active')
    : tTerm('common.status.inactive'));

  const getStatusClasses = (status: string) => (status === 'active'
    ? 'bg-blue-50 text-blue-700'
    : 'bg-slate-100 text-slate-600');

  const getInterestLabel = (associate: any) => {
    const rate = Number(associate?.interestRate || 0);
    const type = associate?.interestType === 'annual'
      ? tTerm('common.interestType.annual')
      : tTerm('common.interestType.monthly');
    return `${formatNumberValue(rate, { maximumFractionDigits: 4 })}% ${type.toLowerCase()}`;
  };

  const handleDelete = async (associate: any) => {
    if (!canDeleteAssociates) {
      toast.apiErrorSafe(new Error('No tiene permiso para eliminar socios.'), { domain: 'associates' });
      return;
    }

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
    if (!canUpdateAssociates) {
      toast.apiErrorSafe(new Error('No tiene permiso para cambiar el estado de socios.'), { domain: 'associates' });
      return;
    }

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
        actions={(canExportAssociates || canCreateAssociates) ? (
        <>
          {canExportAssociates && (
            <ActionButton
              onClick={handleExportAssociatesExcel}
              disabled={isExporting}
              isLoading={isExporting}
              icon={<Download size={16} />}
            >
              {tTerm('associates.cta.exportExcel')}
            </ActionButton>
          )}
          {canCreateAssociates && (
            <ActionButton onClick={() => setCurrentView('associates-new')} icon={<Plus size={16} />} variant="primary">
              {tTerm('associates.cta.new')}
            </ActionButton>
          )}
        </>
        ) : undefined}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {(associateStripMetrics.totalCount > 0 || associateStripMetrics.totalContributed > 0) && (
          <InsightStrip
            aria-label="Resumen operativo de socios inversionistas"
            items={[
              {
                id: 'associate-capital',
                label: 'Capital aportado',
                value: formatCurrency(associateStripMetrics.totalContributed),
                helper: 'Aportes registrados',
                icon: <DollarSign size={18} />,
                accent: 'blue',
              },
              {
                id: 'associate-interest',
                label: 'Interés estimado',
                value: formatCurrency(associateStripMetrics.monthlyInterestEstimate),
                helper: 'Compromiso mensual aprox.',
                icon: <TrendingUp size={18} />,
                accent: 'emerald',
              },
              {
                id: 'associate-active',
                label: 'Socios activos',
                value: `${associateStripMetrics.activeCount} / ${associateStripMetrics.totalCount}`,
                helper: 'Habilitados / visibles',
                icon: <Users size={18} />,
                accent: 'slate',
              },
              {
                id: 'associate-participation',
                label: 'Participación',
                value: formatPercent(associateStripMetrics.participationAssigned),
                helper: associateStripMetrics.participationAssigned === 100
                  ? 'Distribución completa'
                  : 'Porcentaje configurado',
                icon: <Percent size={18} />,
                accent: associateStripMetrics.participationAssigned === 100 ? 'emerald' : 'amber',
              },
            ]}
          />
        )}

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
                <option value="active">{tTerm('common.status.active')}</option>
                <option value="inactive">{tTerm('common.status.inactive')}</option>
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
          <table className="min-w-[820px] w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="pb-3 font-medium">ID</th>
                <th className="pb-3 font-medium">Nombre del socio</th>
                <th className="pb-3 font-medium">
                  <HelpLabel label="Estado" text="Estado del socio dentro de la plataforma. Define si sigue habilitado para aportes, intereses, reportes y movimientos operativos." />
                </th>
                <th className="pb-3 font-medium">
                  <HelpLabel label="Participación" text="Porcentaje pactado para distribuir rentabilidad o movimientos proporcionales entre socios inversionistas." />
                </th>
                <th className="pb-3 font-medium">
                  <HelpLabel label="Interés pactado" text="Tasa mensual o anual que se reconoce al socio sobre su capital aportado." />
                </th>
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
                    {associate.participationPercentage ? formatPercent(associate.participationPercentage) : 'Sin definir'}
                  </td>
                  <td className="py-4 text-text-secondary">{getInterestLabel(associate)}</td>
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
                      {canUpdateAssociates && (
                        <>
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
                        </>
                      )}
                      {canDeleteAssociates && (
                        <ActionButton
                          onClick={() => handleDelete(associate)}
                          icon={<Trash2 size={16} />}
                          variant="danger"
                          className="h-9 w-9 !min-h-0 !p-0"
                          title="Eliminar"
                        >
                          <span className="sr-only">Eliminar</span>
                        </ActionButton>
                      )}
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
