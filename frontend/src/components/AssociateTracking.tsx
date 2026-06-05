import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle, Download, Eye, Search, Wallet } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { tTerm } from '../i18n/terminology';
import { formatCurrency, formatDate, formatNumber } from '../i18n/format';
import { exportAssociatesExcel, useAssociateTracking } from '../services/associateService';
import { useResolvedPermissionNames } from '../services/permissionsService';
import { PERMISSION } from '../constants/permissionNames';
import { toast } from '../lib/toast';
import { reportClientError } from '../lib/clientDiagnostics';
import {
  ActionButton,
  AppInput,
  EmptyState,
  FormField,
  InsightStrip,
  OperationalSelect,
  PageHeader,
  PageShell,
  SectionSurface,
  StatusChip,
  ToolbarSurface,
} from './shared/Surfaces';
import {
  AppTable,
  RowActionsWithOverflow,
  TableActionsCell,
  TableActionsHeader,
  TableStatusPill,
} from './shared/tables';

type AssociateTrackingProps = {
  setCurrentView: (view: string) => void;
};

const getAssociateName = (associate: any) => {
  if (typeof associate?.name === 'string' && associate.name.trim()) {
    return associate.name.trim();
  }

  return [associate?.firstName, associate?.lastName].filter(Boolean).join(' ').trim() || tTerm('associates.fallback.name');
};

const getInterestLabel = (associate: any) => {
  const rate = Number(associate?.interestRate || 0);
  const type = associate?.interestType === 'annual'
    ? tTerm('common.interestType.annual').toLowerCase()
    : tTerm('common.interestType.monthly').toLowerCase();
  return tTerm('associateTracking.table.rateValue', {
    rate: formatNumber(rate, { maximumFractionDigits: 4 }),
    type,
  });
};

const getDebtStatusLabel = (status: string) => {
  if (status === 'overdue') return tTerm('associateTracking.status.overdue');
  if (status === 'pending') return tTerm('associateTracking.status.pending');
  return tTerm('associateTracking.status.current');
};

const getDebtStatusClassName = (status: string) => {
  if (status === 'overdue') return 'bg-red-100 text-red-700';
  if (status === 'pending') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
};

const getInstallmentStatusClassName = (status: string) => {
  if (status === 'overdue') return 'bg-red-100 text-red-700';
  if (status === 'paid') return 'bg-emerald-100 text-emerald-700';
  return 'bg-amber-100 text-amber-700';
};

const getInstallmentStatusLabel = (status: string) => {
  if (status === 'overdue') return tTerm('schedule.status.overdue');
  if (status === 'paid') return tTerm('schedule.status.paid');
  return tTerm('schedule.status.pending');
};

const getContributionStatusLabel = (status: unknown) => {
  switch (String(status || 'completed').toLowerCase()) {
    case 'pending':
      return tTerm('common.status.pending');
    case 'annulled':
      return tTerm('common.status.annulled');
    case 'manual_hold':
      return tTerm('common.status.manualHold');
    case 'completed':
      return tTerm('common.status.completed');
    default:
      return tTerm('common.status.unknown');
  }
};

const hasValidDateValue = (value: unknown) => {
  if (!value) {
    return false;
  }

  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp);
};

const hasRenderableAssociateRow = (row: any) => {
  const associateId = Number(row?.associate?.id);
  const associateName = getAssociateName(row?.associate);
  return Number.isFinite(associateId) && Boolean(associateName);
};

const hasRenderableObligationRow = (row: any) => {
  const associateId = Number(row?.associateId);
  const installmentNumber = Number(row?.installmentNumber);
  const amount = Number(row?.amount || 0);
  return (
    Number.isFinite(associateId)
    && Number.isFinite(installmentNumber)
    && installmentNumber > 0
    && amount > 0
    && Boolean(row?.associateName)
    && hasValidDateValue(row?.dueDate)
  );
};

const hasRenderableMoneyHistoryRow = (row: any, dateField: string) => {
  const associateId = Number(row?.associateId);
  const amount = Number(row?.amount || 0);
  const associateName = String(row?.associateName || '').trim();
  return (
    Number.isFinite(associateId)
    && amount > 0
    && associateName.length > 0
    && hasValidDateValue(row?.[dateField])
  );
};

const getRecentActivityToneClassName = (type: 'payment' | 'contribution' | 'capital_return') => {
  if (type === 'payment') return 'bg-emerald-100 text-emerald-700';
  if (type === 'capital_return') return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
};

const renderCountChip = (label: string, count: number, tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger' = 'neutral') => (
  <StatusChip tone={tone} size="sm">
    {label} {formatNumber(count, { maximumFractionDigits: 0 })}
  </StatusChip>
);

export default function AssociateTracking({ setCurrentView }: AssociateTrackingProps) {
  const { user } = useSessionStore();
  const resolvedPermissions = useResolvedPermissionNames(user);
  const permissionSet = useMemo(
    () => new Set(resolvedPermissions.map((permission) => permission.toUpperCase())),
    [resolvedPermissions],
  );
  const canExportAssociates = user?.role === 'admin'
    || permissionSet.has('*')
    || permissionSet.has(PERMISSION.SOCIOS_VIEW_ALL);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isExporting, setIsExporting] = useState(false);
  const trackingFilters = useMemo(() => ({
    ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
    ...(statusFilter === 'all' ? {} : { status: statusFilter }),
  }), [searchTerm, statusFilter]);
  const { data, isLoading, isError } = useAssociateTracking(trackingFilters);
  const tracking = data?.data?.tracking ?? {};
  const summary = tracking.summary ?? {};
  const associates = (Array.isArray(tracking.associates) ? tracking.associates : []).filter(hasRenderableAssociateRow);
  const obligations = (Array.isArray(tracking.obligations) ? tracking.obligations : []).filter(hasRenderableObligationRow);
  const recentPayments = (Array.isArray(tracking.recentPayments) ? tracking.recentPayments : [])
    .filter((payment: any) => payment?.paymentType !== 'capital_return' && payment?.distributionType !== 'capital_return')
    .filter((payment: any) => hasRenderableMoneyHistoryRow(payment, 'paidAt'));
  const recentContributions = (Array.isArray(tracking.recentContributions) ? tracking.recentContributions : [])
    .filter((contribution: any) => hasRenderableMoneyHistoryRow(contribution, 'contributionDate'));
  const recentCapitalReturns = (Array.isArray(tracking.recentCapitalReturns) ? tracking.recentCapitalReturns : [])
    .filter((capitalReturn: any) => hasRenderableMoneyHistoryRow(capitalReturn, 'distributionDate'));
  const recentActivityCount = recentPayments.length + recentCapitalReturns.length + recentContributions.length;
  const overdueObligationsCount = obligations.filter((obligation: any) => obligation.status === 'overdue').length;
  const pendingObligationsCount = obligations.filter((obligation: any) => obligation.status === 'pending').length;
  const nextObligation = obligations[0] ?? null;
  const recentActivity = useMemo(() => (
    [
      ...recentPayments.map((payment: any) => ({
        id: `payment-${payment.id}`,
        type: 'payment' as const,
        label: tTerm('associateTracking.activity.type.payment'),
        detail: payment.displayType || tTerm('associateTracking.activity.detail.payment'),
        associateId: Number(payment.associateId),
        associateName: payment.associateName || tTerm('associates.fallback.name'),
        date: payment.paidAt,
        amount: Number(payment.amount || 0),
        responsible: payment.paidByUser?.name || payment.paidByUser?.email || tTerm('common.notAvailable'),
      })),
      ...recentCapitalReturns.map((capitalReturn: any) => ({
        id: `capital-return-${capitalReturn.id}`,
        type: 'capital_return' as const,
        label: tTerm('associateTracking.activity.type.capitalReturn'),
        detail: tTerm('associateTracking.activity.detail.capitalReturn'),
        associateId: Number(capitalReturn.associateId),
        associateName: capitalReturn.associateName || tTerm('associates.fallback.name'),
        date: capitalReturn.distributionDate,
        amount: Number(capitalReturn.amount || 0),
        responsible: capitalReturn.createdBy?.name || capitalReturn.createdBy?.email || tTerm('common.notAvailable'),
      })),
      ...recentContributions.map((contribution: any) => ({
        id: `contribution-${contribution.id}`,
        type: 'contribution' as const,
        label: tTerm('associateTracking.activity.type.contribution'),
        detail: getContributionStatusLabel(contribution.status),
        associateId: Number(contribution.associateId),
        associateName: contribution.associateName || tTerm('associates.fallback.name'),
        date: contribution.contributionDate,
        amount: Number(contribution.amount || 0),
        responsible: contribution.createdBy?.name || contribution.createdBy?.email || tTerm('common.notAvailable'),
      })),
    ]
      .sort((left, right) => new Date(String(right.date)).getTime() - new Date(String(left.date)).getTime())
      .slice(0, 8)
  ), [recentCapitalReturns, recentContributions, recentPayments]);
  const hasRecentActivity = recentActivity.length > 0;

  const renderTableState = ({
    emptyTitle,
    emptyDescription,
  }: {
    emptyTitle: string;
    emptyDescription: string;
  }) => {
    if (isLoading) {
      return <div className="associate-tracking-state">{tTerm('associateTracking.state.loading')}</div>;
    }

    if (isError) {
      return <div className="associate-tracking-state associate-tracking-state--error">{tTerm('associateTracking.state.error')}</div>;
    }

    return (
      <EmptyState
        compact
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  };

  const handleExport = async () => {
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
      reportClientError('associateTracking.export', error);
    } finally {
      setIsExporting(false);
    }
  };

  const openAssociate = (associateId: unknown, section?: 'installments' | 'history') => {
    const id = Number(associateId);
    if (!Number.isFinite(id)) return;
    if (section) {
      sessionStorage.setItem(`associate-detail-initial-tab:${id}`, section === 'installments' ? 'installments' : 'overview');
    }
    setCurrentView(`associates/${id}`);
  };

  return (
    <PageShell data-tour="associate-tracking-page">
      <PageHeader
        className="associate-tracking-header"
        title={tTerm('associateTracking.title')}
        subtitle={tTerm('associateTracking.subtitle')}
        guideKey="associates"
        actions={(
          <ActionButton
            variant="secondary"
            icon={<Download size={16} />}
            disabled={isExporting || !canExportAssociates}
            title={canExportAssociates ? tTerm('associateTracking.cta.export') : tTerm('associates.toast.export.permissionDenied')}
            onClick={handleExport}
          >
            {isExporting ? tTerm('credits.cta.exporting') : tTerm('associateTracking.cta.export')}
          </ActionButton>
        )}
      />

      {isLoading || isError ? (
        <div className={`associate-tracking-state associate-tracking-summary-state ${isError ? 'associate-tracking-state--error' : ''}`}>
          {tTerm(isError ? 'associateTracking.state.error' : 'associateTracking.state.loading')}
        </div>
      ) : (
        <InsightStrip
          className="associate-tracking-summary-strip"
          aria-label={tTerm('associateTracking.summary.aria')}
          items={[
            {
              id: 'capital',
              label: tTerm('associateTracking.summary.currentCapital'),
              value: formatCurrency(summary.totalCapital ?? 0),
              helper: tTerm('associateTracking.summary.currentCapitalHelper', {
                returned: formatCurrency(summary.totalCapitalReturned ?? 0),
              }),
              icon: <Wallet size={24} />,
              accent: 'blue',
            },
            {
              id: 'payable',
              label: tTerm('associateTracking.summary.payable'),
              value: formatCurrency(summary.totalPayable ?? 0),
              helper: tTerm('associateTracking.summary.payableHelper'),
              icon: <AlertTriangle size={24} />,
              accent: Number(summary.interestOverdue || 0) > 0 ? 'rose' : 'amber',
            },
            {
              id: 'paid',
              label: tTerm('associateTracking.summary.paid'),
              value: formatCurrency(summary.interestPaid ?? 0),
              helper: tTerm('associateTracking.summary.paidHelper'),
              icon: <CheckCircle size={24} />,
              accent: 'emerald',
            },
            {
              id: 'next-due',
              label: tTerm('associateTracking.summary.nextDue'),
              value: nextObligation?.dueDate
                ? formatDate(nextObligation.dueDate)
                : tTerm('associateTracking.summary.nextDueEmpty'),
              helper: tTerm('associateTracking.summary.nextDueHelper', {
                overdue: formatNumber(overdueObligationsCount, { maximumFractionDigits: 0 }),
                pending: formatNumber(pendingObligationsCount, { maximumFractionDigits: 0 }),
              }),
              icon: <CalendarClock size={24} />,
              accent: 'slate',
            },
          ]}
        />
      )}

      <ToolbarSurface className="associate-tracking-toolbar">
        <FormField
          label={tTerm('associateTracking.filters.search')}
          className="associate-tracking-toolbar__field associate-tracking-toolbar__field--search"
        >
          <AppInput
            id="associate-tracking-search"
            value={searchTerm}
            icon={<Search size={18} />}
            placeholder={tTerm('associates.search.placeholder')}
            shellClassName="associate-tracking-toolbar__input-shell"
            onValueChange={(value) => setSearchTerm(value)}
          />
        </FormField>
        <FormField
          label={tTerm('associates.filter.status')}
          className="associate-tracking-toolbar__field associate-tracking-toolbar__field--status"
        >
          <OperationalSelect
            id="associate-tracking-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="active">{tTerm('common.status.active')}</option>
            <option value="inactive">{tTerm('common.status.inactive')}</option>
            <option value="all">{tTerm('associates.filter.allStatuses')}</option>
          </OperationalSelect>
        </FormField>
        <div className="associate-tracking-toolbar__summary" aria-label={tTerm('associateTracking.filters.summaryAria')}>
          {renderCountChip(
            tTerm('associateTracking.metrics.associatesShort'),
            associates.length,
          )}
          {renderCountChip(
            tTerm('associateTracking.metrics.obligationsShort'),
            obligations.length,
            obligations.length > 0 ? 'warning' : 'success',
          )}
          {renderCountChip(
            tTerm('associateTracking.metrics.activityShort'),
            recentActivityCount,
            hasRecentActivity ? 'info' : 'neutral',
          )}
        </div>
      </ToolbarSurface>

      <div className="associate-tracking-content-grid">
        <SectionSurface
          title={tTerm('associateTracking.obligations.title')}
          subtitle={tTerm('associateTracking.obligations.subtitle')}
          bodyClassName="associate-tracking-section-body"
          className="associate-tracking-content-grid__full"
          actions={(
            <div className="associate-tracking-section-actions">
              {renderCountChip(
                tTerm('associateTracking.metrics.overdueShort'),
                overdueObligationsCount,
                overdueObligationsCount > 0 ? 'danger' : 'neutral',
              )}
              {renderCountChip(
                tTerm('associateTracking.metrics.upcomingShort'),
                pendingObligationsCount,
                pendingObligationsCount > 0 ? 'warning' : 'neutral',
              )}
            </div>
          )}
        >
          {obligations.length === 0
            ? renderTableState({
              emptyTitle: tTerm('associateTracking.obligations.empty.title'),
              emptyDescription: tTerm('associateTracking.obligations.empty.description'),
            })
            : (
              <AppTable
                variant="operational"
                surfaceClassName="associate-tracking-inline-table"
                minWidthClassName="min-w-[760px]"
                hasData
                recordsLabel={tTerm('associateTracking.obligations.recordsLabel')}
              >
                <thead>
                  <tr>
                    <th>{tTerm('associateTracking.table.associate')}</th>
                    <th>{tTerm('associateTracking.table.dueDate')}</th>
                    <th>{tTerm('associateTracking.table.amount')}</th>
                    <th>{tTerm('associateTracking.table.rate')}</th>
                    <th>{tTerm('associateTracking.table.status')}</th>
                    <TableActionsHeader>{tTerm('associates.table.actions')}</TableActionsHeader>
                  </tr>
                </thead>
                <tbody>
                  {obligations.map((obligation: any) => (
                    <tr key={`obligation-${obligation.id}`}>
                      <td>
                        <p className="font-semibold text-text-primary">{obligation.associateName || tTerm('associates.fallback.name')}</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {tTerm('associateTracking.table.installmentNumber', { number: obligation.installmentNumber })}
                        </p>
                      </td>
                      <td>{formatDate(obligation.dueDate) || tTerm('common.notAvailable')}</td>
                      <td className="font-semibold">{formatCurrency(obligation.amount)}</td>
                      <td>
                        {tTerm('associateTracking.table.rateValue', {
                          rate: formatNumber(Number(obligation.interestRate || 0), { maximumFractionDigits: 4 }),
                          type: obligation.interestType === 'annual'
                            ? tTerm('common.interestType.annual').toLowerCase()
                            : tTerm('common.interestType.monthly').toLowerCase(),
                        })}
                      </td>
                      <td>
                        <TableStatusPill className={getInstallmentStatusClassName(obligation.status)}>
                          {getInstallmentStatusLabel(obligation.status)}
                        </TableStatusPill>
                      </td>
                      <TableActionsCell>
                        <RowActionsWithOverflow
                          variant="icon"
                          ariaLabel={tTerm('associates.table.actions')}
                          items={[
                            {
                              id: 'details',
                              label: tTerm('associateTracking.actions.viewSchedule'),
                              icon: <Eye size={16} />,
                              onClick: () => openAssociate(obligation.associateId, 'installments'),
                            },
                          ]}
                        />
                      </TableActionsCell>
                    </tr>
                  ))}
                </tbody>
              </AppTable>
            )}
        </SectionSurface>

        <SectionSurface
          title={tTerm('associateTracking.associates.title')}
          subtitle={tTerm('associateTracking.associates.subtitle')}
          bodyClassName="associate-tracking-section-body"
          actions={renderCountChip(tTerm('associateTracking.metrics.associatesShort'), associates.length)}
        >
          {associates.length === 0
            ? renderTableState({
              emptyTitle: tTerm('associateTracking.associates.empty.title'),
              emptyDescription: tTerm('associateTracking.associates.empty.description'),
            })
            : (
              <AppTable
                variant="operational"
                surfaceClassName="associate-tracking-inline-table"
                minWidthClassName="min-w-[760px]"
                hasData
                recordsLabel={tTerm('associates.table.recordsLabel')}
              >
                <thead>
                  <tr>
                    <th>{tTerm('associateTracking.table.associate')}</th>
                    <th>{tTerm('associateTracking.table.currentCapital')}</th>
                    <th>{tTerm('associateTracking.table.termsAndBalance')}</th>
                    <th>{tTerm('associateTracking.table.nextDue')}</th>
                    <th>{tTerm('associateTracking.table.status')}</th>
                    <TableActionsHeader>{tTerm('associates.table.actions')}</TableActionsHeader>
                  </tr>
                </thead>
                <tbody>
                  {associates.map((row: any) => {
                    const associate = row.associate ?? {};
                    return (
                      <tr key={`associate-${associate.id}`}>
                        <td>
                          <p className="font-semibold text-text-primary">{getAssociateName(associate)}</p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {[associate.email, associate.phone].filter(Boolean).join(' · ') || tTerm('associates.table.contactPending')}
                          </p>
                        </td>
                        <td>
                          <p className="font-semibold text-text-primary">{formatCurrency(row.currentCapital)}</p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {tTerm('associateTracking.table.currentCapitalDetail', {
                              contributed: formatCurrency(row.totalContributed),
                              returned: formatCurrency(row.totalCapitalReturned),
                            })}
                          </p>
                        </td>
                        <td>
                          <p className="font-semibold text-text-primary">{getInterestLabel(associate)}</p>
                          <p className={`mt-1 text-sm ${Number(row.interestOverdue || 0) > 0 ? 'font-semibold text-red-600' : 'text-text-secondary'}`}>
                            {tTerm('associateTracking.table.pendingDetail', {
                              pending: formatCurrency(Number(row.interestPending || 0) + Number(row.interestOverdue || 0)),
                              paid: formatCurrency(row.interestPaid),
                            })}
                          </p>
                        </td>
                        <td>
                          <p className="font-semibold text-text-primary">{formatDate(row.nextPaymentDate) || tTerm('common.notAvailable')}</p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {tTerm('associateTracking.table.installmentsDetail', {
                              pending: formatNumber(row.pendingInstallments || 0, { maximumFractionDigits: 0 }),
                              overdue: formatNumber(row.overdueInstallments || 0, { maximumFractionDigits: 0 }),
                            })}
                          </p>
                        </td>
                        <td>
                          <TableStatusPill className={getDebtStatusClassName(row.debtStatus)}>
                            {getDebtStatusLabel(row.debtStatus)}
                          </TableStatusPill>
                        </td>
                        <TableActionsCell>
                          <RowActionsWithOverflow
                            variant="icon"
                            ariaLabel={tTerm('associates.table.actions')}
                            items={[
                              {
                                id: 'details',
                                label: tTerm('associates.actions.view'),
                                icon: <Eye size={16} />,
                                onClick: () => openAssociate(associate.id),
                              },
                              {
                                id: 'schedule',
                                label: tTerm('associateTracking.actions.viewSchedule'),
                                icon: <CalendarClock size={16} />,
                                onClick: () => openAssociate(associate.id, 'installments'),
                              },
                            ]}
                          />
                        </TableActionsCell>
                      </tr>
                    );
                  })}
                </tbody>
              </AppTable>
            )}
        </SectionSurface>

        <SectionSurface
          title={tTerm('associateTracking.activity.title')}
          subtitle={tTerm('associateTracking.activity.subtitle')}
          bodyClassName="associate-tracking-section-body"
          actions={renderCountChip(
            tTerm('associateTracking.metrics.activityShort'),
            recentActivityCount,
            hasRecentActivity ? 'info' : 'neutral',
          )}
        >
          {!hasRecentActivity ? (
            <EmptyState
              compact
              title={tTerm('associateTracking.activity.empty.title')}
              description={tTerm('associateTracking.activity.empty.description')}
            />
          ) : (
            <AppTable
              variant="operational"
              surfaceClassName="associate-tracking-inline-table"
              minWidthClassName="min-w-[760px]"
              hasData
              recordsLabel={tTerm('associateTracking.activity.recordsLabel')}
            >
              <thead>
                <tr>
                  <th>{tTerm('associateTracking.table.movement')}</th>
                  <th>{tTerm('associateTracking.table.associate')}</th>
                  <th>{tTerm('associateTracking.table.realPaymentDate')}</th>
                  <th>{tTerm('associateTracking.table.amount')}</th>
                  <th>{tTerm('associateTracking.table.responsibleUser')}</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((activity) => (
                  <tr key={activity.id}>
                    <td>
                      <TableStatusPill className={getRecentActivityToneClassName(activity.type)}>
                        {activity.label}
                      </TableStatusPill>
                      <p className="mt-1 text-sm text-text-secondary">{activity.detail}</p>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="font-semibold text-left text-text-primary hover:text-brand-primary"
                        onClick={() => openAssociate(activity.associateId)}
                      >
                        {activity.associateName}
                      </button>
                    </td>
                    <td>{formatDate(activity.date) || tTerm('common.notAvailable')}</td>
                    <td className="font-semibold">{formatCurrency(activity.amount)}</td>
                    <td>{activity.responsible}</td>
                  </tr>
                ))}
              </tbody>
            </AppTable>
          )}
        </SectionSurface>
      </div>

    </PageShell>
  );
}
