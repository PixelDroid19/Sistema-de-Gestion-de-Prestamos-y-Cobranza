import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CalendarClock, CheckCircle, Download, Eye, ListChecks, Search, Users, Wallet } from 'lucide-react';
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
  DataTableSurface,
  EmptyState,
  FormField,
  InsightStrip,
  ModalShell,
  OperationalSelect,
  PageHeader,
  PageShell,
  SectionSurface,
  StatusChip,
  ToolbarSurface,
  ViewTabs,
} from './shared/Surfaces';
import {
  AppTable,
  type OperationalTableMode,
  RowActionsWithOverflow,
  TABLE_EMBEDDED_SHELL_CLASS,
  TableActionsCell,
  TableActionsHeader,
  TableSectionIntro,
  TableStatusPill,
} from './shared/tables';

type AssociateTrackingProps = {
  setCurrentView: (view: string) => void;
};

type AssociateTrackingTab = 'obligations' | 'associates' | 'activity';

const TRACKING_PAGE_SIZE_OPTIONS = [5, 10, 25];

type TrackingTableSectionProps = {
  title: string;
  subtitle: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
} & Pick<
  OperationalTableMode,
  | 'isLoading'
  | 'isError'
  | 'hasData'
  | 'loadingContent'
  | 'errorContent'
  | 'emptyContent'
  | 'pagination'
  | 'recordsLabel'
  | 'tableClassName'
  | 'minWidthClassName'
>;

function TrackingTableSection({
  title,
  subtitle,
  aside,
  className = '',
  children,
  isLoading,
  isError,
  hasData,
  loadingContent,
  errorContent,
  emptyContent,
  pagination,
  recordsLabel,
  tableClassName,
  minWidthClassName,
}: TrackingTableSectionProps) {
  return (
    <DataTableSurface className={className}>
      <TableSectionIntro embedded title={title} description={subtitle} aside={aside} />
      <AppTable
        variant="operational"
        className={`associate-tracking-table-shell ${TABLE_EMBEDDED_SHELL_CLASS}`}
        surfaceClassName={TABLE_EMBEDDED_SHELL_CLASS}
        statePresentation="shell"
        isLoading={isLoading}
        isError={isError}
        hasData={hasData}
        loadingContent={loadingContent}
        errorContent={errorContent}
        emptyContent={emptyContent}
        pagination={pagination}
        recordsLabel={recordsLabel}
        tableClassName={tableClassName}
        minWidthClassName={minWidthClassName ?? 'min-w-0 w-full'}
      >
        {children}
      </AppTable>
    </DataTableSurface>
  );
}

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

const getAssociateContactSummary = (associate: any) => {
  const summary = [associate?.email, associate?.phone]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(' · ');

  return summary || tTerm('associates.table.contactPending');
};

const getDebtStatusLabel = (status: string) => {
  if (status === 'overdue') return tTerm('associateTracking.status.overdue');
  if (status === 'pending') return tTerm('associateTracking.status.pending');
  return tTerm('associateTracking.status.current');
};

const getInstallmentStatusClassName = (status: string) => {
  if (status === 'overdue') return 'bg-red-100 text-red-700';
  if (status === 'paid') return 'bg-emerald-100 text-emerald-700';
  return 'bg-amber-100 text-amber-700';
};

const getDebtStatusClassName = (status: string) => {
  if (status === 'overdue') return 'bg-red-100 text-red-700';
  if (status === 'current') return 'bg-emerald-100 text-emerald-700';
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

const getRecentPaymentDetail = (payment: any) => {
  const paymentType = String(payment?.paymentType || '').toLowerCase();
  if (paymentType === 'capital_return' || payment?.distributionType === 'capital_return') {
    return tTerm('associateDetails.paymentHistory.capitalReturn');
  }
  if (paymentType === 'manual') {
    return payment?.distributionType === 'proportional'
      ? tTerm('associateDetails.paymentHistory.proportionalProfitability')
      : tTerm('associateDetails.paymentHistory.manualProfitability');
  }
  if (payment?.installmentNumber) {
    return tTerm('associateDetails.paymentHistory.installmentLabel', { number: payment.installmentNumber });
  }
  return tTerm('associateTracking.activity.detail.payment');
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

const getCurrentCapitalDetail = (row: any) => {
  const currentCapital = Number(row?.currentCapital || 0);
  const totalContributed = Number(row?.totalContributed || 0);
  const totalCapitalReturned = Number(row?.totalCapitalReturned || 0);
  const detailParts: string[] = [];

  if (totalContributed > currentCapital || totalCapitalReturned > 0) {
    detailParts.push(tTerm('associateTracking.table.contributedShort', {
      amount: formatCurrency(totalContributed),
    }));
  }

  if (totalCapitalReturned > 0) {
    detailParts.push(tTerm('associateTracking.table.returnedShort', {
      amount: formatCurrency(totalCapitalReturned),
    }));
  }

  return detailParts.join(' · ');
};

const getPendingBalanceDetail = (pending: unknown, paid: unknown) => {
  const pendingBalance = Number(pending || 0);
  const paidBalance = Number(paid || 0);
  const detailParts: string[] = [];

  if (pendingBalance > 0) {
    detailParts.push(tTerm('associateTracking.table.pendingShort', {
      amount: formatCurrency(pendingBalance),
    }));
  }

  if (paidBalance > 0) {
    detailParts.push(tTerm('associateTracking.table.paidShort', {
      amount: formatCurrency(paidBalance),
    }));
  }

  return detailParts.join(' · ');
};

const getInstallmentQueueDetail = (pending: unknown, overdue: unknown) => {
  const pendingCount = Number(pending || 0);
  const overdueCount = Number(overdue || 0);
  const detailParts: string[] = [];

  if (pendingCount > 0) {
    detailParts.push(tTerm(
      pendingCount === 1 ? 'associateTracking.table.pendingOne' : 'associateTracking.table.pendingMany',
      { pending: formatNumber(pendingCount, { maximumFractionDigits: 0 }) },
    ));
  }

  if (overdueCount > 0) {
    detailParts.push(tTerm(
      overdueCount === 1 ? 'associateTracking.table.overdueOne' : 'associateTracking.table.overdueMany',
      { overdue: formatNumber(overdueCount, { maximumFractionDigits: 0 }) },
    ));
  }

  return detailParts.join(' · ');
};

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
  const [activeTab, setActiveTab] = useState<AssociateTrackingTab>('obligations');
  const [selectedAssociateId, setSelectedAssociateId] = useState<number | null>(null);
  const [obligationPage, setObligationPage] = useState(1);
  const [obligationPageSize, setObligationPageSize] = useState(TRACKING_PAGE_SIZE_OPTIONS[0]);
  const [associatePage, setAssociatePage] = useState(1);
  const [associatePageSize, setAssociatePageSize] = useState(TRACKING_PAGE_SIZE_OPTIONS[0]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(TRACKING_PAGE_SIZE_OPTIONS[0]);
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
        detail: getRecentPaymentDetail(payment),
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
  ), [recentCapitalReturns, recentContributions, recentPayments]);
  const hasRecentActivity = recentActivity.length > 0;
  const selectedAssociateRow = selectedAssociateId == null
    ? null
    : associates.find((row: any) => Number(row?.associate?.id) === selectedAssociateId) ?? null;
  const selectedAssociate = selectedAssociateRow?.associate ?? null;
  const selectedAssociateName = selectedAssociate ? getAssociateName(selectedAssociate) : '';
  const selectedAssociateObligations = selectedAssociateId == null
    ? []
    : obligations.filter((obligation: any) => Number(obligation.associateId) === selectedAssociateId);
  const obligationTotalPages = Math.max(1, Math.ceil(obligations.length / obligationPageSize));
  const currentObligationPage = Math.min(obligationPage, obligationTotalPages);
  const paginatedObligations = useMemo(() => {
    const startIndex = (currentObligationPage - 1) * obligationPageSize;
    return obligations.slice(startIndex, startIndex + obligationPageSize);
  }, [currentObligationPage, obligationPageSize, obligations]);
  const obligationPagination = obligations.length > 0
    ? {
      page: currentObligationPage,
      pageSize: obligationPageSize,
      totalItems: obligations.length,
      totalPages: obligationTotalPages,
      onPrev: () => setObligationPage((page) => Math.max(1, page - 1)),
      onNext: () => setObligationPage((page) => Math.min(obligationTotalPages, page + 1)),
      onPageSizeChange: (pageSize: number) => {
        setObligationPageSize(pageSize);
        setObligationPage(1);
      },
      pageSizeOptions: TRACKING_PAGE_SIZE_OPTIONS,
    }
    : undefined;
  const associateTotalPages = Math.max(1, Math.ceil(associates.length / associatePageSize));
  const currentAssociatePage = Math.min(associatePage, associateTotalPages);
  const paginatedAssociates = useMemo(() => {
    const startIndex = (currentAssociatePage - 1) * associatePageSize;
    return associates.slice(startIndex, startIndex + associatePageSize);
  }, [associates, associatePageSize, currentAssociatePage]);
  const associatePagination = associates.length > 0
    ? {
      page: currentAssociatePage,
      pageSize: associatePageSize,
      totalItems: associates.length,
      totalPages: associateTotalPages,
      onPrev: () => setAssociatePage((page) => Math.max(1, page - 1)),
      onNext: () => setAssociatePage((page) => Math.min(associateTotalPages, page + 1)),
      onPageSizeChange: (pageSize: number) => {
        setAssociatePageSize(pageSize);
        setAssociatePage(1);
      },
      pageSizeOptions: TRACKING_PAGE_SIZE_OPTIONS,
    }
    : undefined;
  const activityTotalPages = Math.max(1, Math.ceil(recentActivity.length / activityPageSize));
  const currentActivityPage = Math.min(activityPage, activityTotalPages);
  const paginatedRecentActivity = useMemo(() => {
    const startIndex = (currentActivityPage - 1) * activityPageSize;
    return recentActivity.slice(startIndex, startIndex + activityPageSize);
  }, [activityPageSize, currentActivityPage, recentActivity]);
  const activityPagination = recentActivity.length > 0
    ? {
      page: currentActivityPage,
      pageSize: activityPageSize,
      totalItems: recentActivity.length,
      totalPages: activityTotalPages,
      onPrev: () => setActivityPage((page) => Math.max(1, page - 1)),
      onNext: () => setActivityPage((page) => Math.min(activityTotalPages, page + 1)),
      onPageSizeChange: (pageSize: number) => {
        setActivityPageSize(pageSize);
        setActivityPage(1);
      },
      pageSizeOptions: TRACKING_PAGE_SIZE_OPTIONS,
    }
    : undefined;

  useEffect(() => {
    setObligationPage(1);
    setAssociatePage(1);
    setActivityPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    if (obligationPage > obligationTotalPages) {
      setObligationPage(obligationTotalPages);
    }
  }, [obligationPage, obligationTotalPages]);

  useEffect(() => {
    if (associatePage > associateTotalPages) {
      setAssociatePage(associateTotalPages);
    }
  }, [associatePage, associateTotalPages]);

  useEffect(() => {
    if (activityPage > activityTotalPages) {
      setActivityPage(activityTotalPages);
    }
  }, [activityPage, activityTotalPages]);

  const loadingState = <div className="associate-tracking-state">{tTerm('associateTracking.state.loading')}</div>;
  const errorState = (
    <div className="associate-tracking-state associate-tracking-state--error">
      {tTerm('associateTracking.state.error')}
    </div>
  );

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

  const openAssociateSummary = (associateId: unknown) => {
    const id = Number(associateId);
    if (!Number.isFinite(id)) return;
    setSelectedAssociateId(id);
  };

  const closeAssociateSummary = () => setSelectedAssociateId(null);

  const tabs = [
    {
      id: 'obligations',
      label: tTerm('associateTracking.tabs.obligations'),
      count: obligations.length,
      icon: ListChecks,
    },
    {
      id: 'associates',
      label: tTerm('associateTracking.tabs.associates'),
      count: associates.length,
      icon: Users,
    },
    {
      id: 'activity',
      label: tTerm('associateTracking.tabs.activity'),
      count: recentActivityCount,
      icon: Activity,
    },
  ];

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
      </ToolbarSurface>

      <ViewTabs
        className="associate-tracking-tabs"
        tabs={tabs}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as AssociateTrackingTab)}
        ariaLabel={tTerm('associateTracking.tabs.aria')}
      />

      <div className="associate-tracking-content-grid" role="tabpanel">
        {activeTab === 'obligations' && (
        <TrackingTableSection
          className="associate-tracking-content-grid__full"
          title={tTerm('associateTracking.obligations.title')}
          subtitle={tTerm('associateTracking.obligations.subtitle')}
          aside={(
            <>
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
            </>
          )}
          isLoading={isLoading}
          isError={isError}
          hasData={obligations.length > 0}
          loadingContent={loadingState}
          errorContent={errorState}
          emptyContent={(
            <EmptyState
              compact
              title={tTerm('associateTracking.obligations.empty.title')}
              description={tTerm('associateTracking.obligations.empty.description')}
            />
          )}
          recordsLabel={tTerm('associateTracking.obligations.recordsLabel')}
          pagination={obligationPagination}
          tableClassName="associate-tracking-table associate-tracking-table--obligations w-full min-w-0 text-sm text-left"
        >
          <thead>
            <tr>
              <th>{tTerm('associateTracking.table.associate')}</th>
              <th>{tTerm('associateTracking.table.dueDateShort')}</th>
              <th>{tTerm('associateTracking.table.amount')}</th>
              <th>{tTerm('associateTracking.table.rate')}</th>
              <th>{tTerm('associateTracking.table.status')}</th>
              <TableActionsHeader>{tTerm('associates.table.actions')}</TableActionsHeader>
            </tr>
          </thead>
          <tbody>
            {paginatedObligations.map((obligation: any) => (
              <tr key={`obligation-${obligation.id}`}>
                <td>
                  <div className="associate-tracking-row-stack">
                    <p className="associate-tracking-row-title">{obligation.associateName || tTerm('associates.fallback.name')}</p>
                    <p className="associate-tracking-row-meta">
                      {tTerm('associateTracking.table.installmentNumber', { number: obligation.installmentNumber })}
                    </p>
                  </div>
                </td>
                <td>
                  <p className="associate-tracking-cell-primary">{formatDate(obligation.dueDate) || tTerm('common.notAvailable')}</p>
                </td>
                <td>
                  <p className="associate-tracking-cell-primary">{formatCurrency(obligation.amount)}</p>
                </td>
                <td>
                  <p className="associate-tracking-row-detail">
                    {tTerm('associateTracking.table.rateValue', {
                      rate: formatNumber(Number(obligation.interestRate || 0), { maximumFractionDigits: 4 }),
                      type: obligation.interestType === 'annual'
                        ? tTerm('common.interestType.annual').toLowerCase()
                        : tTerm('common.interestType.monthly').toLowerCase(),
                    })}
                  </p>
                </td>
                <td>
                  <TableStatusPill className={getInstallmentStatusClassName(obligation.status)}>
                    {getInstallmentStatusLabel(obligation.status)}
                  </TableStatusPill>
                </td>
                <TableActionsCell>
                  <RowActionsWithOverflow
                    variant="icon"
                    maxInline={2}
                    ariaLabel={tTerm('associates.table.actions')}
                    items={[
                      {
                        id: 'summary',
                        label: tTerm('associateTracking.actions.quickSummary'),
                        icon: <Eye size={16} />,
                        onClick: () => openAssociateSummary(obligation.associateId),
                      },
                      {
                        id: 'details',
                        label: tTerm('associateTracking.actions.viewSchedule'),
                        icon: <CalendarClock size={16} />,
                        onClick: () => openAssociate(obligation.associateId, 'installments'),
                      },
                    ]}
                  />
                </TableActionsCell>
              </tr>
            ))}
          </tbody>
        </TrackingTableSection>
        )}

        {activeTab === 'associates' && (
        <TrackingTableSection
          className="associate-tracking-content-grid__full"
          title={tTerm('associateTracking.associates.title')}
          subtitle={tTerm('associateTracking.associates.subtitle')}
          aside={renderCountChip(tTerm('associateTracking.metrics.associatesShort'), associates.length)}
          isLoading={isLoading}
          isError={isError}
          hasData={associates.length > 0}
          loadingContent={loadingState}
          errorContent={errorState}
          emptyContent={(
            <EmptyState
              compact
              title={tTerm('associateTracking.associates.empty.title')}
              description={tTerm('associateTracking.associates.empty.description')}
            />
          )}
          recordsLabel={tTerm('associates.table.recordsLabel')}
          pagination={associatePagination}
          tableClassName="associate-tracking-table associate-tracking-table--associates w-full min-w-0 text-sm text-left"
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
            {paginatedAssociates.map((row: any) => {
              const associate = row.associate ?? {};
              const pendingBalance = Number(row.interestPending || 0) + Number(row.interestOverdue || 0);
              const paidBalance = Number(row.interestPaid || 0);
              const hasOverdueBalance = Number(row.interestOverdue || 0) > 0;
              const nextDueLabel = formatDate(row.nextPaymentDate) || tTerm('common.notAvailable');
              const capitalDetail = getCurrentCapitalDetail(row);
              const pendingBalanceDetail = getPendingBalanceDetail(pendingBalance, paidBalance);
              const queueDetail = getInstallmentQueueDetail(row.pendingInstallments, row.overdueInstallments);
              const financialSummaryClassName = hasOverdueBalance
                ? 'associate-tracking-row-detail associate-tracking-row-detail--danger'
                : 'associate-tracking-row-detail';
              const queueDetailClassName = row.debtStatus === 'overdue'
                ? 'associate-tracking-row-detail associate-tracking-row-detail--danger'
                : row.debtStatus === 'current'
                  ? 'associate-tracking-row-detail associate-tracking-row-detail--success'
                  : 'associate-tracking-row-detail';

              return (
                <tr key={`associate-${associate.id}`}>
                  <td>
                    <div className="associate-tracking-row-stack">
                      <p className="associate-tracking-row-title" title={getAssociateName(associate)}>{getAssociateName(associate)}</p>
                      <p className="associate-tracking-row-meta" title={getAssociateContactSummary(associate)}>
                        {getAssociateContactSummary(associate)}
                      </p>
                    </div>
                  </td>
                  <td>
                    <div className="associate-tracking-row-stack">
                      <p className="associate-tracking-cell-primary">{formatCurrency(row.currentCapital)}</p>
                      {capitalDetail ? (
                        <p className="associate-tracking-row-detail" title={capitalDetail}>
                          {capitalDetail}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className="associate-tracking-row-stack">
                      <p className="associate-tracking-cell-primary">{getInterestLabel(associate)}</p>
                      <p className={financialSummaryClassName} title={pendingBalanceDetail || undefined}>
                        {pendingBalanceDetail || tTerm('associateTracking.status.current')}
                      </p>
                    </div>
                  </td>
                  <td>
                    <div className="associate-tracking-row-stack">
                      <p className="associate-tracking-cell-primary" title={nextDueLabel}>{nextDueLabel}</p>
                      <p className={queueDetailClassName} title={queueDetail || undefined}>
                        {queueDetail || tTerm('associateTracking.status.current')}
                      </p>
                    </div>
                  </td>
                  <td>
                    <TableStatusPill className={getDebtStatusClassName(row.debtStatus)}>
                      {getDebtStatusLabel(row.debtStatus)}
                    </TableStatusPill>
                  </td>
                  <TableActionsCell>
                    <RowActionsWithOverflow
                      variant="icon"
                      maxInline={0}
                      ariaLabel={tTerm('associates.table.actions')}
                      items={[
                        {
                          id: 'details',
                          label: tTerm('associateTracking.actions.quickSummary'),
                          icon: <Eye size={16} />,
                          onClick: () => openAssociateSummary(associate.id),
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
        </TrackingTableSection>
        )}

        {activeTab === 'activity' && (
        <TrackingTableSection
          className="associate-tracking-content-grid__full"
          title={tTerm('associateTracking.activity.title')}
          subtitle={tTerm('associateTracking.activity.subtitle')}
          aside={renderCountChip(
            tTerm('associateTracking.metrics.activityShort'),
            recentActivityCount,
            hasRecentActivity ? 'info' : 'neutral',
          )}
          isLoading={isLoading}
          isError={isError}
          hasData={hasRecentActivity}
          loadingContent={loadingState}
          errorContent={errorState}
          emptyContent={(
            <EmptyState
              compact
              title={tTerm('associateTracking.activity.empty.title')}
              description={tTerm('associateTracking.activity.empty.description')}
            />
          )}
          recordsLabel={tTerm('associateTracking.activity.recordsLabel')}
          pagination={activityPagination}
          tableClassName="associate-tracking-table associate-tracking-table--activity w-full min-w-0 text-sm text-left"
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
            {paginatedRecentActivity.map((activity) => (
              <tr key={activity.id}>
                <td>
                  <div className="associate-tracking-row-stack">
                    <TableStatusPill className={getRecentActivityToneClassName(activity.type)}>
                      {activity.label}
                    </TableStatusPill>
                    <p className="associate-tracking-row-detail">{activity.detail}</p>
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    className="associate-tracking-row-title text-left hover:text-brand-primary"
                    onClick={() => openAssociate(activity.associateId)}
                  >
                    {activity.associateName}
                  </button>
                </td>
                <td>
                  <p className="associate-tracking-cell-primary">{formatDate(activity.date) || tTerm('common.notAvailable')}</p>
                </td>
                <td>
                  <p className="associate-tracking-cell-primary">{formatCurrency(activity.amount)}</p>
                </td>
                <td>
                  <p className="associate-tracking-row-detail">{activity.responsible}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </TrackingTableSection>
        )}
      </div>

      {selectedAssociateRow && selectedAssociate && (
        <ModalShell
          title={tTerm('associateTracking.modal.title', { name: selectedAssociateName })}
          subtitle={tTerm('associateTracking.modal.subtitle')}
          maxWidthClassName="max-w-3xl"
          onClose={closeAssociateSummary}
          footer={(
            <>
              <ActionButton variant="secondary" onClick={closeAssociateSummary}>
                {tTerm('associateTracking.modal.close')}
              </ActionButton>
              <ActionButton
                variant="primary"
                icon={<CalendarClock size={16} />}
                onClick={() => {
                  closeAssociateSummary();
                  openAssociate(selectedAssociate.id, 'installments');
                }}
              >
                {tTerm('associateTracking.modal.openDetail')}
              </ActionButton>
            </>
          )}
        >
          <div className="associate-tracking-modal">
            <InsightStrip
              className="associate-tracking-modal__metrics"
              aria-label={tTerm('associateTracking.modal.metricsAria')}
              items={[
                {
                  id: 'modal-capital',
                  label: tTerm('associateTracking.table.currentCapital'),
                  value: formatCurrency(selectedAssociateRow.currentCapital),
                  helper: tTerm('associateTracking.table.currentCapitalDetail', {
                    contributed: formatCurrency(selectedAssociateRow.totalContributed),
                    returned: formatCurrency(selectedAssociateRow.totalCapitalReturned),
                  }),
                  icon: <Wallet size={18} />,
                  accent: 'blue',
                },
                {
                  id: 'modal-payable',
                  label: tTerm('associateTracking.table.pending'),
                  value: formatCurrency(Number(selectedAssociateRow.interestPending || 0) + Number(selectedAssociateRow.interestOverdue || 0)),
                  helper: tTerm('associateTracking.table.pendingDetail', {
                    pending: formatCurrency(Number(selectedAssociateRow.interestPending || 0) + Number(selectedAssociateRow.interestOverdue || 0)),
                    paid: formatCurrency(selectedAssociateRow.interestPaid),
                  }),
                  icon: <AlertTriangle size={18} />,
                  accent: Number(selectedAssociateRow.interestOverdue || 0) > 0 ? 'rose' : 'amber',
                },
                {
                  id: 'modal-next',
                  label: tTerm('associateTracking.table.nextDue'),
                  value: formatDate(selectedAssociateRow.nextPaymentDate) || tTerm('common.notAvailable'),
                  helper: tTerm('associateTracking.table.installmentsDetail', {
                    pending: formatNumber(selectedAssociateRow.pendingInstallments || 0, { maximumFractionDigits: 0 }),
                    overdue: formatNumber(selectedAssociateRow.overdueInstallments || 0, { maximumFractionDigits: 0 }),
                  }),
                  icon: <CalendarClock size={18} />,
                  accent: selectedAssociateRow.debtStatus === 'overdue' ? 'rose' : 'slate',
                },
              ]}
            />

            <div className="associate-tracking-modal__grid">
              <SectionSurface
                title={tTerm('associateTracking.modal.profileTitle')}
                subtitle={selectedAssociate.email || selectedAssociate.phone || tTerm('associates.table.contactPending')}
              >
                <dl className="associate-tracking-modal__facts">
                  <div>
                    <dt>{tTerm('associateTracking.table.rate')}</dt>
                    <dd>{getInterestLabel(selectedAssociate)}</dd>
                  </div>
                  <div>
                    <dt>{tTerm('associateTracking.table.status')}</dt>
                    <dd>{getDebtStatusLabel(selectedAssociateRow.debtStatus)}</dd>
                  </div>
                </dl>
              </SectionSurface>

              <SectionSurface
                title={tTerm('associateTracking.modal.obligationsTitle')}
                subtitle={tTerm('associateTracking.modal.obligationsSubtitle')}
              >
                {selectedAssociateObligations.length === 0 ? (
                  <EmptyState
                    compact
                    title={tTerm('associateTracking.obligations.empty.title')}
                    description={tTerm('associateTracking.obligations.empty.description')}
                  />
                ) : (
                  <div className="associate-tracking-modal__obligations">
                    {selectedAssociateObligations.slice(0, 3).map((obligation: any) => (
                      <div key={`selected-obligation-${obligation.id}`} className="associate-tracking-modal__obligation">
                        <div>
                          <p className="font-semibold text-text-primary">
                            {tTerm('associateTracking.table.installmentNumber', { number: obligation.installmentNumber })}
                          </p>
                          <p className="text-sm text-text-secondary">{formatDate(obligation.dueDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-text-primary">{formatCurrency(obligation.amount)}</p>
                          <TableStatusPill className={getInstallmentStatusClassName(obligation.status)}>
                            {getInstallmentStatusLabel(obligation.status)}
                          </TableStatusPill>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionSurface>
            </div>
          </div>
        </ModalShell>
      )}

    </PageShell>
  );
}
