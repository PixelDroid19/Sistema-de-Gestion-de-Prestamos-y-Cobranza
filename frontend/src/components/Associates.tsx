import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, MoreVertical, Eye, Edit, Download, DollarSign, TrendingUp, Users, Percent, History, CalendarClock, Power, PowerOff } from 'lucide-react';
import {
  formatCurrency as formatCurrencyValue,
  formatNumber as formatNumberValue,
  formatPercent as formatPercentValue,
} from '../i18n/format';
import { useAssociates } from '../services/associateService';
import { usePaginationStore } from '../store/paginationStore';
import { toast } from '../lib/toast';
import { reportClientError } from '../lib/clientDiagnostics';
import { exportAssociatesExcel } from '../services/reportService';
import { tTerm } from '../i18n/terminology';
import TableShell from './shared/TableShell';
import { confirmDanger } from '../lib/confirmModal';
import { useSessionStore } from '../store/sessionStore';
import { PERMISSION } from '../constants/permissionNames';
import { useResolvedPermissionNames } from '../services/permissionsService';
import { ActionButton, FormField, IconActionButton, InsightStrip, ModalShell, PageHeader, PageShell, SelectInput, TextInput, ToolbarSurface } from './shared/Surfaces';
import { HelpLabel } from './shared/HelpSupport';
import NewAssociate from './NewAssociate';

const formatCurrency = (amount: number) => formatCurrencyValue(amount);

const formatPercent = (value: number) => formatPercentValue(value, { maximumFractionDigits: 2 });

type AssociateActionMenuState = {
  associate: any;
  top: number;
  right: number;
} | null;

export default function Associates({ setCurrentView }: { setCurrentView: (v: string) => void }) {
  const { user } = useSessionStore();
  const resolvedPermissions = useResolvedPermissionNames(user);
  const { page, setPage, pageSize, setPageSize } = usePaginationStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const permissionSet = new Set(resolvedPermissions.map((permission) => permission.toUpperCase()));
  const hasPermission = (permission: string) => user?.role === 'admin' || permissionSet.has('*') || permissionSet.has(permission);
  const canCreateAssociates = hasPermission(PERMISSION.SOCIOS_CREATE);
  const canUpdateAssociates = hasPermission(PERMISSION.SOCIOS_UPDATE);
  const canExportAssociates = hasPermission(PERMISSION.REPORTS_VIEW_ALL);
  const { data: associatesData, isLoading, isError, updateAssociate, restoreAssociate } = useAssociates({
    page,
    pageSize,
    search: searchTerm || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [editingAssociateId, setEditingAssociateId] = useState<number | null>(null);
  const [actionMenu, setActionMenu] = useState<AssociateActionMenuState>(null);

  useEffect(() => {
    if (!actionMenu) return undefined;

    const closeMenu = () => setActionMenu(null);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);

    return () => {
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [actionMenu]);

  const handleExportAssociatesExcel = async () => {
    if (!canExportAssociates) {
      toast.error({ description: tTerm('associates.toast.export.permissionDenied') });
      return;
    }

    try {
      setIsExporting(true);
      await exportAssociatesExcel({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      toast.success({ description: tTerm('associates.toast.export.success') });
    } catch (error) {
      toast.error({ description: tTerm('associates.toast.export.error') });
      reportClientError('associates.export', error);
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

    return [associate?.firstName, associate?.lastName].filter(Boolean).join(' ').trim() || tTerm('associates.fallback.name');
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

  const handleToggleStatus = async (associate: any) => {
    setActionMenu(null);
    if (!canUpdateAssociates) {
      toast.apiErrorSafe(new Error(tTerm('associates.toast.status.permissionDenied')), { domain: 'associates' });
      return;
    }

    const associateId = Number(associate?.id);
    if (!Number.isFinite(associateId)) return;

    const currentStatus = associate?.status === 'active' ? 'active' : 'inactive';
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

    const confirmed = await confirmDanger({
      title: nextStatus === 'inactive'
        ? tTerm('associates.confirm.deactivate.title')
        : tTerm('associates.confirm.reactivate.title'),
      message: nextStatus === 'inactive'
        ? tTerm('associates.confirm.deactivate.message', { name: getAssociateName(associate) })
        : tTerm('associates.confirm.reactivate.message', { name: getAssociateName(associate) }),
      confirmLabel: nextStatus === 'inactive'
        ? tTerm('associates.confirm.deactivate.confirm')
        : tTerm('associates.confirm.reactivate.confirm'),
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
          ? tTerm('associates.toast.status.deactivated')
          : tTerm('associates.toast.status.reactivated'),
      });
    } catch (error) {
      reportClientError('associates.statusUpdate', error);
      toast.apiErrorSafe(error, { domain: 'associates' });
    }
  };

  const toggleActionMenu = (associate: any, event: React.MouseEvent<HTMLButtonElement>) => {
    const associateId = Number(associate?.id);
    if (!Number.isFinite(associateId)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nextPosition = {
      top: Math.min(rect.bottom + 8, window.innerHeight - 280),
      right: Math.max(16, window.innerWidth - rect.right),
    };

    setActionMenu((current) => {
      if (Number(current?.associate?.id) === associateId) {
        return null;
      }

      return {
        associate,
        ...nextPosition,
      };
    });
  };

  const openAssociateDetails = (associate: any, section?: 'history' | 'installments') => {
    const associateId = Number(associate?.id);
    if (!Number.isFinite(associateId)) return;
    if (section) {
      sessionStorage.setItem(`associate-detail-initial-tab:${associateId}`, section === 'installments' ? 'installments' : 'overview');
    }
    setActionMenu(null);
    setCurrentView(`associates/${associateId}`);
  };

  const openEditModal = (associate: any) => {
    const associateId = Number(associate?.id);
    if (!Number.isFinite(associateId)) return;
    setActionMenu(null);
    setEditingAssociateId(associateId);
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
            aria-label={tTerm('associates.summary.aria')}
            items={[
              {
                id: 'associate-capital',
                label: tTerm('associates.summary.capital'),
                value: formatCurrency(associateStripMetrics.totalContributed),
                helper: tTerm('associates.summary.capitalHelper'),
                icon: <DollarSign size={18} />,
                accent: 'blue',
              },
              {
                id: 'associate-interest',
                label: tTerm('associates.summary.estimatedInterest'),
                value: formatCurrency(associateStripMetrics.monthlyInterestEstimate),
                helper: tTerm('associates.summary.estimatedInterestHelper'),
                icon: <TrendingUp size={18} />,
                accent: 'emerald',
              },
              {
                id: 'associate-active',
                label: tTerm('associates.summary.active'),
                value: `${associateStripMetrics.activeCount} / ${associateStripMetrics.totalCount}`,
                helper: tTerm('associates.summary.activeHelper'),
                icon: <Users size={18} />,
                accent: 'slate',
              },
              {
                id: 'associate-participation',
                label: tTerm('associates.summary.participation'),
                value: formatPercent(associateStripMetrics.participationAssigned),
                helper: associateStripMetrics.participationAssigned === 100
                  ? tTerm('associates.summary.participationComplete')
                  : tTerm('associates.summary.participationConfigured'),
                icon: <Percent size={18} />,
                accent: associateStripMetrics.participationAssigned === 100 ? 'emerald' : 'amber',
              },
            ]}
          />
        )}

        <ToolbarSurface data-tour="associates-search">
          <div className="grid items-start gap-3 lg:grid-cols-[minmax(18rem,26rem)_14rem]">
            <FormField label={tTerm('associates.search.label')}>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <TextInput
                  type="text"
                  placeholder={tTerm('associates.search.placeholder')}
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </FormField>
            <FormField label={tTerm('associates.filter.status')} tooltip={tTerm('associates.filter.statusTooltip')}>
              <SelectInput
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">{tTerm('associates.filter.allStatuses')}</option>
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
          loadingContent={<div className="py-4 text-center text-text-secondary">{tTerm('associates.state.loading')}</div>}
          errorContent={<div className="py-4 text-center text-red-500">{tTerm('associates.state.error')}</div>}
          emptyContent={<div className="py-4 text-center text-text-secondary">{tTerm('associates.state.empty')}</div>}
          recordsLabel={tTerm('associates.table.recordsLabel')}
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
                <th className="pb-3 font-medium">{tTerm('associates.table.name')}</th>
                <th className="pb-3 font-medium">
                  <HelpLabel label={tTerm('associates.table.status')} text={tTerm('associates.table.statusHelp')} />
                </th>
                <th className="pb-3 font-medium">
                  <HelpLabel label={tTerm('associates.table.participation')} text={tTerm('associates.table.participationHelp')} />
                </th>
                <th className="pb-3 font-medium">
                  <HelpLabel label={tTerm('associates.table.interest')} text={tTerm('associates.table.interestHelp')} />
                </th>
                <th className="pb-3 text-center font-medium">{tTerm('associates.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {associates.map((associate: any) => (
                <tr key={associate.id} className="hover:bg-hover-bg transition-colors">
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
                    {associate.participationPercentage ? formatPercent(associate.participationPercentage) : tTerm('common.notAvailable')}
                  </td>
                  <td className="py-4 text-text-secondary">{getInterestLabel(associate)}</td>
                  <td className="py-4">
                    <div className="flex items-center justify-center gap-2">
                      <IconActionButton
                        onClick={() => openAssociateDetails(associate)}
                        icon={<Eye size={16} />}
                        label={tTerm('associates.actions.view')}
                        variant="ghost"
                      />
                      {canUpdateAssociates && (
                        <>
                          <IconActionButton
                            onClick={() => openEditModal(associate)}
                            icon={<Edit size={16} />}
                            label={tTerm('associates.actions.edit')}
                            variant="ghost"
                          />
                          <IconActionButton
                            onClick={(event) => toggleActionMenu(associate, event)}
                            icon={<MoreVertical size={16} />}
                            label={tTerm('associates.actions.more')}
                            variant="ghost"
                            className={Number(actionMenu?.associate?.id) === Number(associate.id) ? 'bg-hover-bg' : ''}
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </div>
      {editingAssociateId !== null && (
        <ModalShell
          title={tTerm('associates.editModal.title')}
          subtitle={tTerm('associates.editModal.subtitle')}
          maxWidthClassName="max-w-3xl"
          onClose={() => setEditingAssociateId(null)}
        >
          <NewAssociate
            associateIdOverride={editingAssociateId}
            embedded
            onBack={() => setEditingAssociateId(null)}
          />
        </ModalShell>
      )}
      {canUpdateAssociates && actionMenu && (
        <div
          className="fixed z-50 w-72 overflow-hidden rounded-lg border border-border-subtle bg-bg-surface text-left shadow-xl"
          style={{ top: actionMenu.top, right: actionMenu.right }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-text-primary hover:bg-hover-bg"
            onClick={() => openAssociateDetails(actionMenu.associate, 'history')}
          >
            <History size={16} className="text-text-secondary" />
            <span>{tTerm('associates.actions.interestHistory')}</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-text-primary hover:bg-hover-bg"
            onClick={() => openAssociateDetails(actionMenu.associate, 'installments')}
          >
            <CalendarClock size={16} className="text-text-secondary" />
            <span>{tTerm('associates.actions.interestSchedule')}</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-text-primary hover:bg-hover-bg"
            onClick={() => openEditModal(actionMenu.associate)}
          >
            <Edit size={16} className="text-text-secondary" />
            <span>{tTerm('associates.actions.editTerms')}</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 border-t border-border-subtle px-4 py-3 text-sm font-medium text-text-primary hover:bg-hover-bg"
            onClick={() => handleToggleStatus(actionMenu.associate)}
          >
            {actionMenu.associate.status === 'active'
              ? <PowerOff size={16} className="text-red-500" />
              : <Power size={16} className="text-emerald-600" />}
            <span>{actionMenu.associate.status === 'active' ? tTerm('associates.actions.deactivate') : tTerm('associates.actions.reactivate')}</span>
          </button>
        </div>
      )}
    </PageShell>
  );
}
