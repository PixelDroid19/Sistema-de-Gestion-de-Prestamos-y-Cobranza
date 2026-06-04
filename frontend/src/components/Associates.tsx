import React, { useMemo, useState } from 'react';
import { Plus, Search, Eye, Edit, Download, DollarSign, TrendingUp, Users, Percent, History, CalendarClock, Power, PowerOff } from 'lucide-react';
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
import {
  AppTable,
  RowActionsWithOverflow,
  type RowActionOverflowItem,
  TableActionsCell,
  TableActionsHeader,
} from './shared/tables';
import { confirmDanger } from '../lib/confirmModal';
import { useSessionStore } from '../store/sessionStore';
import { PERMISSION } from '../constants/permissionNames';
import { useResolvedPermissionNames } from '../services/permissionsService';
import { ActionButton, AppInput, FormField, InsightStrip, ModalShell, OperationalSelect, PageHeader, PageShell, ToolbarSurface } from './shared/Surfaces';
import { HelpLabel } from './shared/HelpSupport';
import NewAssociate from './NewAssociate';

const formatCurrency = (amount: number) => formatCurrencyValue(amount);

const formatPercent = (value: number) => formatPercentValue(value, { maximumFractionDigits: 2 });

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
    const activeWithoutParticipationCount = associates.filter((associate: any) => (
      associate.status === 'active' && Number(associate.participationPercentage || 0) <= 0
    )).length;
    const participationPending = Math.max(0, 100 - participationAssigned);

    return {
      activeCount,
      activeWithoutParticipationCount,
      totalCount: Number(visibleTotal || 0),
      totalContributed,
      monthlyInterestEstimate,
      participationAssigned,
      participationPending,
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

  const getAssociateContactLine = (associate: any) => (
    [associate?.email, associate?.phone].filter((value) => typeof value === 'string' && value.trim().length > 0).join(' · ')
  );

  const getParticipationText = (associate: any) => {
    const participation = Number(associate?.participationPercentage || 0);
    return participation > 0 ? formatPercent(participation) : tTerm('associates.table.participationMissing');
  };

  const getParticipationHelper = (associate: any) => {
    const participation = Number(associate?.participationPercentage || 0);
    return participation > 0
      ? tTerm('associates.table.participationConfigured')
      : tTerm('associates.table.participationPending');
  };

  const getInterestScheduleLabel = (associate: any) => {
    const type = associate?.interestType === 'annual'
      ? tTerm('common.interestType.annual').toLowerCase()
      : tTerm('common.interestType.monthly').toLowerCase();
    const paymentDay = Number(associate?.interestPaymentDay || 0);

    if (paymentDay > 0) {
      return tTerm('associates.table.interestScheduleWithDay', {
        periodicity: type,
        day: formatNumberValue(paymentDay, { maximumFractionDigits: 0 }),
      });
    }

    return tTerm('associates.table.interestSchedule', { periodicity: type });
  };

  const handleToggleStatus = async (associate: any) => {
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

  const openAssociateDetails = (associate: any, section?: 'history' | 'installments') => {
    const associateId = Number(associate?.id);
    if (!Number.isFinite(associateId)) return;
    if (section) {
      sessionStorage.setItem(`associate-detail-initial-tab:${associateId}`, section === 'installments' ? 'installments' : 'overview');
    }
    setCurrentView(`associates/${associateId}`);
  };

  const openEditModal = (associate: any) => {
    const associateId = Number(associate?.id);
    if (!Number.isFinite(associateId)) return;
    setEditingAssociateId(associateId);
  };

  const buildAssociateRowActions = (associate: any): RowActionOverflowItem[] => {
    const items: RowActionOverflowItem[] = [
      {
        id: 'view',
        label: tTerm('associates.actions.view'),
        icon: <Eye size={16} />,
        onClick: () => openAssociateDetails(associate),
      },
    ];

    if (canUpdateAssociates) {
      items.push({
        id: 'edit',
        label: tTerm('associates.actions.edit'),
        icon: <Edit size={16} />,
        onClick: () => openEditModal(associate),
      });
      items.push({
        id: 'history',
        label: tTerm('associates.actions.interestHistory'),
        icon: <History size={16} />,
        onClick: () => openAssociateDetails(associate, 'history'),
      });
      items.push({
        id: 'schedule',
        label: tTerm('associates.actions.interestSchedule'),
        icon: <CalendarClock size={16} />,
        onClick: () => openAssociateDetails(associate, 'installments'),
      });
      items.push({
        id: 'status',
        label: associate.status === 'active'
          ? tTerm('associates.actions.deactivate')
          : tTerm('associates.actions.reactivate'),
        icon: associate.status === 'active'
          ? <PowerOff size={16} />
          : <Power size={16} />,
        onClick: () => { void handleToggleStatus(associate); },
        menuTone: associate.status === 'active' ? 'danger' : 'default',
      });
    }

    return items;
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
                helper: associateStripMetrics.activeWithoutParticipationCount > 0
                  ? tTerm(
                    associateStripMetrics.activeWithoutParticipationCount === 1
                      ? 'associates.summary.activePendingParticipation.one'
                      : 'associates.summary.activePendingParticipation.many',
                    { count: associateStripMetrics.activeWithoutParticipationCount },
                  )
                  : tTerm('associates.summary.activeHelper'),
                icon: <Users size={18} />,
                accent: associateStripMetrics.activeWithoutParticipationCount > 0 ? 'amber' : 'slate',
              },
              {
                id: 'associate-participation',
                label: tTerm('associates.summary.participation'),
                value: formatPercent(associateStripMetrics.participationAssigned),
                helper: associateStripMetrics.participationAssigned === 100
                  ? tTerm('associates.summary.participationComplete')
                  : tTerm('associates.summary.participationConfigured', {
                    pending: formatPercent(associateStripMetrics.participationPending),
                  }),
                icon: <Percent size={18} />,
                accent: associateStripMetrics.participationAssigned === 100 ? 'emerald' : 'amber',
              },
            ]}
          />
        )}

        <ToolbarSurface data-tour="associates-search">
          <div className="grid items-start gap-3 lg:grid-cols-[minmax(18rem,26rem)_14rem]">
            <FormField label={tTerm('associates.search.label')}>
              <AppInput
                variant="text"
                placeholder={tTerm('associates.search.placeholder')}
                value={searchTerm}
                onValueChange={(v, _detail, e) => {
                  setSearchTerm(v);
                  setPage(1);
                }}
                icon={<Search size={16} />}
              />
            </FormField>
            <FormField label={tTerm('associates.filter.status')} tooltip={tTerm('associates.filter.statusTooltip')}>
              <OperationalSelect
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">{tTerm('associates.filter.allStatuses')}</option>
                <option value="active">{tTerm('common.status.active')}</option>
                <option value="inactive">{tTerm('common.status.inactive')}</option>
              </OperationalSelect>
            </FormField>
          </div>
        </ToolbarSurface>

        <AppTable variant="operational"
          data-tour="associates-table"
          minWidthClassName="min-w-[820px]"
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
            <thead>
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
                <TableActionsHeader className="pb-3 font-medium">{tTerm('associates.table.actions')}</TableActionsHeader>
              </tr>
            </thead>
            <tbody>
              {associates.map((associate: any) => (
                <tr key={associate.id} className="hover:bg-hover-bg transition-colors">
                  <td className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                        {getAssociateInitials(associate)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary">{getAssociateName(associate)}</p>
                        <p className="mt-1 truncate text-sm text-text-secondary">
                          {getAssociateContactLine(associate) || tTerm('associates.table.contactPending')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(associate.status)}`}>
                      {getStatusLabel(associate.status)}
                    </span>
                  </td>
                  <td className="py-4">
                    <p className="font-medium text-text-primary">{getParticipationText(associate)}</p>
                    <p className="mt-1 text-sm text-text-secondary">{getParticipationHelper(associate)}</p>
                  </td>
                  <td className="py-4">
                    <p className="font-medium text-text-primary">{getInterestLabel(associate)}</p>
                    <p className="mt-1 text-sm text-text-secondary">{getInterestScheduleLabel(associate)}</p>
                  </td>
                  <TableActionsCell className="py-4">
                    <RowActionsWithOverflow
                      variant="icon"
                      align="center"
                      items={buildAssociateRowActions(associate)}
                      ariaLabel={tTerm('associates.table.actions')}
                    />
                  </TableActionsCell>
                </tr>
              ))}
            </tbody>
        </AppTable>
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
    </PageShell>
  );
}
