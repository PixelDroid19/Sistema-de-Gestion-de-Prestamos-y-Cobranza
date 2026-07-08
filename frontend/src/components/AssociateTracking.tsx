import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Download, Eye, Search } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { tTerm } from '../i18n/terminology';
import { formatCurrency, formatDate, formatNumber } from '../i18n/format';
import { exportAssociatesExcel, useAssociateDetails, useAssociateTracking } from '../services/associateService';
import { useResolvedPermissionNames } from '../services/permissionsService';
import { PERMISSION } from '../constants/permissionNames';
import { toast } from '../lib/toast';
import { reportClientError } from '../lib/clientDiagnostics';
import { getLocalDateInputValue } from '../lib/dateInput';
import {
  getAssociateInterestRateValue,
  getAssociateInterestTypeValue,
} from '../lib/associateInterest';
import {
  ActionButton,
  AppInput,
  DataTableSurface,
  EmptyState,
  FormField,
  ModalShell,
  OperationalSelect,
  PageHeader,
  PageShell,
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
import AssociateModuleNavigation from './associates/AssociateModuleNavigation';

type AssociateTrackingProps = {
  setCurrentView: (view: string) => void;
};

type AssociateTrackingTab = 'obligations' | 'activity';

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
  const rate = getAssociateInterestRateValue(associate);
  const interestType = getAssociateInterestTypeValue(associate);

  if (rate === null) {
    return tTerm('common.notSpecified');
  }

  if (!interestType) {
    return `${formatNumber(rate, { maximumFractionDigits: 4 })}%`;
  }

  const type = tTerm(
    interestType === 'annual'
      ? 'common.interestType.annual'
      : 'common.interestType.monthly',
  ).toLowerCase();

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
    return tTerm('associateDetails.paymentHistory.manualProfitability');
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

const normalizeAssociateTrackingRow = (row: any) => {
  if (row?.associate) {
    return row;
  }

  return {
    associate: row,
    currentCapital: row?.currentCapital ?? row?.totalContributed ?? 0,
    totalContributed: row?.totalContributed ?? row?.currentCapital ?? 0,
    totalCapitalReturned: row?.totalCapitalReturned ?? row?.capitalReturned ?? 0,
    interestPending: row?.interestPending ?? row?.pendingInterest ?? row?.interestDebt ?? 0,
    interestOverdue: row?.interestOverdue ?? row?.overdueInterest ?? 0,
    interestPaid: row?.interestPaid ?? row?.paidInterest ?? row?.totalInterestPaid ?? 0,
    nextPaymentDate: row?.nextPaymentDate ?? row?.nextInterestPaymentDate ?? row?.nextDueDate ?? null,
    debtStatus: row?.debtStatus ?? (Number(row?.interestPending ?? row?.pendingInterest ?? row?.interestDebt ?? 0) > 0 ? 'pending' : 'current'),
    pendingInstallments: row?.pendingInstallments ?? 0,
    overdueInstallments: row?.overdueInstallments ?? 0,
  };
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

const getObligationRowKey = (obligation: any, prefix = 'obligation') => [
  prefix,
  obligation?.id ?? 'no-id',
  obligation?.associateId ?? 'no-associate',
  obligation?.installmentNumber ?? 'no-installment',
  obligation?.dueDate ?? 'no-date',
].map((part) => String(part).replace(/\s+/g, '-')).join('-');

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

const hasRenderableRecentActivityRow = (row: any) => {
  const associateId = Number(row?.associateId);
  const amount = Number(row?.amount || 0);
  const associateName = String(row?.associateName || '').trim();

  return (
    Number.isFinite(associateId)
    && amount > 0
    && associateName.length > 0
    && hasValidDateValue(row?.date)
  );
};

const getRecentActivityToneClassName = (type: 'payment' | 'contribution' | 'capital_return') => {
  if (type === 'payment') return 'bg-emerald-100 text-emerald-700';
  if (type === 'capital_return') return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
};

const normalizeRecentActivityItem = (activity: any) => {
  const normalizedType = activity?.type === 'capital_return'
    ? 'capital_return'
    : activity?.type === 'contribution'
      ? 'contribution'
      : 'payment';

  const label = typeof activity?.label === 'string' && activity.label.trim().length > 0
    ? activity.label.trim()
    : normalizedType === 'capital_return'
      ? tTerm('associateTracking.activity.type.capitalReturn')
      : normalizedType === 'contribution'
        ? tTerm('associateTracking.activity.type.contribution')
        : tTerm('associateTracking.activity.type.payment');

  const detail = typeof activity?.detail === 'string' && activity.detail.trim().length > 0
    ? activity.detail.trim()
    : normalizedType === 'capital_return'
      ? tTerm('associateTracking.activity.detail.capitalReturn')
      : normalizedType === 'contribution'
        ? getContributionStatusLabel(activity?.status)
        : getRecentPaymentDetail(activity);

  return {
    id: String(activity?.id ?? `${normalizedType}-${activity?.associateId ?? 'unknown'}`),
    type: normalizedType as 'payment' | 'contribution' | 'capital_return',
    label,
    detail,
    associateId: Number(activity?.associateId),
    associateName: String(activity?.associateName || '').trim() || tTerm('associates.fallback.name'),
    date: activity?.date ?? activity?.paidAt ?? activity?.contributionDate ?? activity?.distributionDate ?? null,
    amount: Number(activity?.amount || 0),
    responsible: String(
      activity?.responsible
      || activity?.paidByUser?.name
      || activity?.paidByUser?.email
      || activity?.createdBy?.name
      || activity?.createdBy?.email
      || tTerm('common.notAvailable'),
    ),
  };
};

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

const toSummaryNumber = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const resolveSummaryMetric = (summaryValue: unknown, fallbackValue: unknown) => {
  const primary = toSummaryNumber(summaryValue);
  const fallback = toSummaryNumber(fallbackValue);
  return primary === 0 && fallback > 0 ? fallback : primary;
};

const normalizeSearchValue = (value: unknown) => String(value || '').trim().toLowerCase();

const normalizeStatusValue = (value: unknown) => String(value || '').trim().toLowerCase();

const matchesAssociateStatusFilter = (statusFilter: string, values: unknown[]) => {
  if (statusFilter === 'all') {
    return true;
  }

  return values.some((value) => normalizeStatusValue(value) === statusFilter);
};

const getEarliestRenderableDate = (values: unknown[]) => values.reduce<string | null>((currentEarliest, value) => {
  if (!hasValidDateValue(value)) {
    return currentEarliest;
  }

  if (!currentEarliest) {
    return String(value);
  }

  return new Date(String(value)).getTime() < new Date(currentEarliest).getTime()
    ? String(value)
    : currentEarliest;
}, null);

const includesSearchTerm = (searchTerm: string, values: unknown[]) => {
  if (!searchTerm) {
    return true;
  }

  return values.some((value) => normalizeSearchValue(value).includes(searchTerm));
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<AssociateTrackingTab>('obligations');
  const [selectedAssociateId, setSelectedAssociateId] = useState<number | null>(null);
  const [paymentObligation, setPaymentObligation] = useState<any | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: getLocalDateInputValue(),
    paymentMethod: '',
  });
  const [paymentErrors, setPaymentErrors] = useState({
    paymentDate: '',
    paymentMethod: '',
  });
  const [obligationPage, setObligationPage] = useState(1);
  const [obligationPageSize, setObligationPageSize] = useState(TRACKING_PAGE_SIZE_OPTIONS[0]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(TRACKING_PAGE_SIZE_OPTIONS[0]);
  const trackingFilters = useMemo(() => ({
    ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
    ...(statusFilter === 'all' ? {} : { status: statusFilter }),
  }), [searchTerm, statusFilter]);
  const { data, isLoading, isError } = useAssociateTracking(trackingFilters);
  const selectedPaymentAssociateId = Number(paymentObligation?.associateId ?? 0);
  const { payInstallment } = useAssociateDetails(Number.isFinite(selectedPaymentAssociateId) ? selectedPaymentAssociateId : 0);
  const tracking = data?.data?.tracking ?? data?.data ?? data?.tracking ?? {};
  const summary = tracking.summary ?? {};
  const normalizedSearchTerm = normalizeSearchValue(searchTerm);
  const allAssociates = (Array.isArray(tracking.associates) ? tracking.associates : [])
    .map(normalizeAssociateTrackingRow)
    .filter(hasRenderableAssociateRow);
  const associates = useMemo(() => allAssociates.filter((row: any) => {
    const associate = row?.associate ?? {};
    return matchesAssociateStatusFilter(statusFilter, [
      associate?.status,
      row?.status,
    ]) && includesSearchTerm(normalizedSearchTerm, [
      getAssociateName(associate),
      associate?.email,
      associate?.phone,
    ]);
  }), [allAssociates, normalizedSearchTerm, statusFilter]);
  const derivedSummary = useMemo(() => associates.reduce((
    totals: {
      totalCapital: number;
      totalCapitalReturned: number;
      interestPending: number;
      interestOverdue: number;
      interestPaid: number;
    },
    row: any,
  ) => {
    totals.totalCapital += toSummaryNumber(row?.currentCapital ?? row?.totalContributed);
    totals.totalCapitalReturned += toSummaryNumber(row?.totalCapitalReturned ?? row?.capitalReturned);
    totals.interestPending += toSummaryNumber(row?.interestPending ?? row?.pendingInterest);
    totals.interestOverdue += toSummaryNumber(row?.interestOverdue ?? row?.overdueInterest);
    totals.interestPaid += toSummaryNumber(row?.interestPaid ?? row?.paidInterest ?? row?.totalInterestPaid);
    return totals;
  }, {
    totalCapital: 0,
    totalCapitalReturned: 0,
    interestPending: 0,
    interestOverdue: 0,
    interestPaid: 0,
  }), [associates]);
  const summaryTotalCapital = resolveSummaryMetric(summary.totalCapital ?? summary.totalContributed, derivedSummary.totalCapital);
  const summaryReturnedCapital = resolveSummaryMetric(summary.totalCapitalReturned, derivedSummary.totalCapitalReturned);
  const summaryInterestPending = resolveSummaryMetric(summary.interestPending ?? summary.pendingInterest, derivedSummary.interestPending);
  const summaryInterestOverdue = resolveSummaryMetric(summary.interestOverdue ?? summary.overdueInterest, derivedSummary.interestOverdue);
  const summaryTotalPayable = resolveSummaryMetric(
    summary.totalPayable ?? (summaryInterestPending + summaryInterestOverdue),
    derivedSummary.interestPending + derivedSummary.interestOverdue,
  );
  const summaryInterestPaid = resolveSummaryMetric(summary.interestPaid ?? summary.paidInterest, derivedSummary.interestPaid);
  const associateRowsById = new Map<number, any>(allAssociates.map((row: any) => [Number(row?.associate?.id), row]));
  const allObligations = (Array.isArray(tracking.obligations) ? tracking.obligations : [])
    .map((obligation: any) => {
      const associateRow = associateRowsById.get(Number(obligation?.associateId));
      const associate = associateRow?.associate;
      return {
        ...obligation,
        associateName: obligation?.associateName || (associate ? getAssociateName(associate) : ''),
        interestRate: obligation?.interestRate ?? associate?.interestRate,
        interestType: obligation?.interestType ?? associate?.interestType,
      };
    })
    .filter(hasRenderableObligationRow);
  const obligations = useMemo(() => allObligations.filter((obligation: any) => {
    const associateStatus = associateRowsById.get(Number(obligation?.associateId))?.associate?.status;
    return matchesAssociateStatusFilter(statusFilter, [associateStatus]) && includesSearchTerm(normalizedSearchTerm, [
      obligation.associateName,
      obligation.installmentNumber,
      obligation.dueDate,
    ]);
  }), [allObligations, associateRowsById, normalizedSearchTerm, statusFilter]);
  const recentPayments = (Array.isArray(tracking.recentPayments) ? tracking.recentPayments : [])
    .filter((payment: any) => payment?.paymentType !== 'capital_return' && payment?.distributionType !== 'capital_return')
    .filter((payment: any) => hasRenderableMoneyHistoryRow(payment, 'paidAt'));
  const recentContributions = (Array.isArray(tracking.recentContributions) ? tracking.recentContributions : [])
    .filter((contribution: any) => hasRenderableMoneyHistoryRow(contribution, 'contributionDate'));
  const recentCapitalReturns = (Array.isArray(tracking.recentCapitalReturns) ? tracking.recentCapitalReturns : [])
    .filter((capitalReturn: any) => hasRenderableMoneyHistoryRow(capitalReturn, 'distributionDate'));
  const recentActivityFromApi = (Array.isArray(tracking.recentActivity) ? tracking.recentActivity : [])
    .map(normalizeRecentActivityItem)
    .filter(hasRenderableRecentActivityRow);
  const derivedOverdueObligationsCount = associates.reduce(
    (total: number, row: any) => total + toSummaryNumber(row?.overdueInstallments),
    0,
  );
  const derivedPendingObligationsCount = associates.reduce(
    (total: number, row: any) => total + toSummaryNumber(row?.pendingInstallments),
    0,
  );
  const overdueObligationsCount = obligations.length > 0
    ? obligations.filter((obligation: any) => obligation.status === 'overdue').length
    : derivedOverdueObligationsCount;
  const pendingObligationsCount = obligations.length > 0
    ? obligations.filter((obligation: any) => obligation.status === 'pending').length
    : derivedPendingObligationsCount;
  const nextObligation = obligations.find((obligation: any) => obligation.status !== 'paid') ?? null;
  const allRecentActivity = useMemo(() => (
    recentActivityFromApi.length > 0
      ? recentActivityFromApi
      : [
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
  ), [recentActivityFromApi, recentCapitalReturns, recentContributions, recentPayments]);
  const recentActivity = useMemo(() => allRecentActivity.filter((activity: any) => {
    const associateStatus = associateRowsById.get(Number(activity?.associateId))?.associate?.status;
    return matchesAssociateStatusFilter(statusFilter, [associateStatus]) && includesSearchTerm(normalizedSearchTerm, [
      activity.associateName,
      activity.label,
      activity.detail,
      activity.responsible,
    ]);
  }), [allRecentActivity, associateRowsById, normalizedSearchTerm, statusFilter]);
  const recentActivityCount = recentActivity.length;
  const hasRecentActivity = recentActivity.length > 0;
  const nextDueDate = useMemo(() => {
    const dates = [
      ...(nextObligation?.dueDate ? [nextObligation.dueDate] : []),
      ...associates.map((row: any) => row.nextPaymentDate),
    ];

    return getEarliestRenderableDate(dates);
  }, [associates, nextObligation?.dueDate]);
  const preferredInitialTab = useMemo<AssociateTrackingTab>(() => {
    if (obligations.length > 0) return 'obligations';
    if (hasRecentActivity) return 'activity';
    return 'obligations';
  }, [hasRecentActivity, obligations.length]);
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
    setActivityPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const currentTabHasData = activeTab === 'obligations' ? obligations.length > 0 : recentActivity.length > 0;
    const preferredTabHasData = preferredInitialTab === 'obligations' ? obligations.length > 0 : recentActivity.length > 0;

    if (currentTabHasData || activeTab === preferredInitialTab || !preferredTabHasData) {
      return;
    }

    setActiveTab(preferredInitialTab);
  }, [activeTab, isLoading, obligations.length, preferredInitialTab, recentActivity.length]);

  useEffect(() => {
    if (obligationPage > obligationTotalPages) {
      setObligationPage(obligationTotalPages);
    }
  }, [obligationPage, obligationTotalPages]);

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
        search: searchTerm.trim() || undefined,
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

  const openPaymentModal = (obligation: any) => {
    setPaymentObligation(obligation);
    setPaymentForm({
      paymentDate: getLocalDateInputValue(),
      paymentMethod: '',
    });
    setPaymentErrors({
      paymentDate: '',
      paymentMethod: '',
    });
  };

  const closePaymentModal = () => {
    setPaymentObligation(null);
    setPaymentForm({
      paymentDate: getLocalDateInputValue(),
      paymentMethod: '',
    });
    setPaymentErrors({
      paymentDate: '',
      paymentMethod: '',
    });
  };

  const confirmPayment = async () => {
    const installmentNumber = Number(paymentObligation?.installmentNumber);
    const paymentDate = paymentForm.paymentDate.trim();
    const paymentMethod = paymentForm.paymentMethod.trim();
    const nextErrors = {
      paymentDate: paymentDate ? '' : tTerm('associateDetails.installmentPayment.validation.paymentDateRequired'),
      paymentMethod: paymentMethod ? '' : tTerm('associateTracking.payment.validation.paymentMethodRequired'),
    };

    setPaymentErrors(nextErrors);
    if (nextErrors.paymentDate || nextErrors.paymentMethod || !Number.isFinite(installmentNumber)) {
      return;
    }

    try {
      await payInstallment.mutateAsync({
        installmentNumber,
        paymentDate,
        paymentMethod,
      });
      closePaymentModal();
      toast.success({ title: tTerm('associateDetails.toast.installmentPaid') });
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'associates' });
    }
  };

  const trackingViews = [
    {
      id: 'obligations',
      label: tTerm('associateTracking.tabs.obligations'),
      count: obligations.length,
    },
    {
      id: 'activity',
      label: tTerm('associateTracking.tabs.activity'),
      count: recentActivityCount,
    },
  ];
  const obligationsHeaderSubtitle = `${tTerm('associateTracking.obligations.subtitle')} · ${tTerm('associateTracking.metrics.overdueShort')} ${formatNumber(overdueObligationsCount, { maximumFractionDigits: 0 })} · ${tTerm('associateTracking.metrics.upcomingShort')} ${formatNumber(pendingObligationsCount, { maximumFractionDigits: 0 })}`;
  return (
    <PageShell data-tour="associate-tracking-page">
      <PageHeader
        className="associate-tracking-header"
        title={tTerm('associateTracking.title')}
        subtitle={tTerm('associateTracking.subtitle')}
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

      <AssociateModuleNavigation
        activeSection="tracking"
        setCurrentView={setCurrentView}
      />

      {isLoading || isError ? (
        <div className={`associate-tracking-state associate-tracking-summary-state ${isError ? 'associate-tracking-state--error' : ''}`}>
          {tTerm(isError ? 'associateTracking.state.error' : 'associateTracking.state.loading')}
        </div>
      ) : (
        <dl className="associate-tracking-summary-grid" aria-label={tTerm('associateTracking.summary.aria')}>
          <div className="associate-tracking-summary-grid__item">
            <dt>{tTerm('associateTracking.summary.currentCapital')}</dt>
            <dd>{formatCurrency(summaryTotalCapital)}</dd>
          </div>
          <div className="associate-tracking-summary-grid__item">
            <dt>{tTerm('associateTracking.summary.payable')}</dt>
            <dd>{formatCurrency(summaryTotalPayable)}</dd>
          </div>
          <div className="associate-tracking-summary-grid__item">
            <dt>{tTerm('associateTracking.summary.paid')}</dt>
            <dd>{formatCurrency(summaryInterestPaid)}</dd>
          </div>
          <div className="associate-tracking-summary-grid__item">
            <dt>{tTerm('associateTracking.summary.nextDue')}</dt>
            <dd>{nextDueDate ? formatDate(nextDueDate) : tTerm('associateTracking.summary.nextDueEmpty')}</dd>
          </div>
        </dl>
      )}

      <ViewTabs
        tabs={trackingViews.map((view) => ({ id: view.id, label: view.label, count: formatNumber(view.count, { maximumFractionDigits: 0 }) }))}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as AssociateTrackingTab)}
        ariaLabel={tTerm('associateTracking.query.label')}
      />

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
            <option value="all">{tTerm('associates.filter.allStatuses')}</option>
            <option value="active">{tTerm('common.status.active')}</option>
            <option value="inactive">{tTerm('common.status.inactive')}</option>
          </OperationalSelect>
        </FormField>
      </ToolbarSurface>

      <div className="associate-tracking-content-grid" role="tabpanel">
        {activeTab === 'obligations' && (
        <TrackingTableSection
          className="associate-tracking-content-grid__full"
          title={tTerm('associateTracking.obligations.title')}
          subtitle={obligationsHeaderSubtitle}
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
              <tr key={getObligationRowKey(obligation)}>
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
                      ...(obligation.status === 'paid' ? [] : [{
                        id: 'pay',
                        label: tTerm('associateDetails.installments.cta.markAsPaid'),
                        icon: <CheckCircle2 size={16} />,
                        onClick: () => openPaymentModal(obligation),
                      }]),
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

        {activeTab === 'activity' && (
        <TrackingTableSection
          className="associate-tracking-content-grid__full"
          title={tTerm('associateTracking.activity.title')}
          subtitle={tTerm('associateTracking.activity.subtitle')}
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
              <th>{tTerm('associateTracking.table.registration')}</th>
              <th>{tTerm('associateTracking.table.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRecentActivity.map((activity: any) => (
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
                  <div className="associate-tracking-row-stack">
                    <p className="associate-tracking-cell-primary">{formatDate(activity.date) || tTerm('common.notAvailable')}</p>
                    <p className="associate-tracking-row-detail">{activity.responsible}</p>
                  </div>
                </td>
                <td>
                  <p className="associate-tracking-cell-primary">{formatCurrency(activity.amount)}</p>
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
            <div className="associate-tracking-modal__grid">
              <section className="associate-tracking-modal__section">
                <div className="associate-tracking-modal__section-header">
                  <h4>{tTerm('associateTracking.modal.profileTitle')}</h4>
                  <p>{selectedAssociate.email || selectedAssociate.phone || tTerm('associates.table.contactPending')}</p>
                </div>
                <dl className="associate-tracking-modal__facts">
                  <div>
                    <dt>{tTerm('associateTracking.table.currentCapital')}</dt>
                    <dd>{formatCurrency(selectedAssociateRow.currentCapital)}</dd>
                  </div>
                  <div>
                    <dt>{tTerm('associateTracking.table.pending')}</dt>
                    <dd>{formatCurrency(Number(selectedAssociateRow.interestPending || 0) + Number(selectedAssociateRow.interestOverdue || 0))}</dd>
                  </div>
                  <div>
                    <dt>{tTerm('associateTracking.table.rate')}</dt>
                    <dd>{getInterestLabel(selectedAssociate)}</dd>
                  </div>
                  <div>
                    <dt>{tTerm('associateTracking.table.nextDue')}</dt>
                    <dd>{formatDate(selectedAssociateRow.nextPaymentDate) || tTerm('common.notAvailable')}</dd>
                  </div>
                  <div>
                    <dt>{tTerm('associateTracking.table.status')}</dt>
                    <dd>{getDebtStatusLabel(selectedAssociateRow.debtStatus)}</dd>
                  </div>
                  <div>
                    <dt>{tTerm('associateTracking.table.installments')}</dt>
                    <dd>{getInstallmentQueueDetail(selectedAssociateRow.pendingInstallments, selectedAssociateRow.overdueInstallments) || tTerm('associateTracking.status.current')}</dd>
                  </div>
                </dl>
              </section>

              <section className="associate-tracking-modal__section">
                <div className="associate-tracking-modal__section-header">
                  <h4>{tTerm('associateTracking.modal.obligationsTitle')}</h4>
                  <p>{tTerm('associateTracking.modal.obligationsSubtitle')}</p>
                </div>
                {selectedAssociateObligations.length === 0 ? (
                  <EmptyState
                    compact
                    title={tTerm('associateTracking.obligations.empty.title')}
                    description={tTerm('associateTracking.obligations.empty.description')}
                  />
                ) : (
                  <div className="associate-tracking-modal__obligations">
                    {selectedAssociateObligations.slice(0, 3).map((obligation: any) => (
                      <div key={getObligationRowKey(obligation, 'selected-obligation')} className="associate-tracking-modal__obligation">
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
              </section>
            </div>
          </div>
        </ModalShell>
      )}

      {paymentObligation && (
        <ModalShell
          title={tTerm('associateDetails.installmentPayment.title')}
          subtitle={tTerm('associateDetails.installmentPayment.subtitle', {
            installmentNumber: paymentObligation.installmentNumber,
          })}
          maxWidthClassName="max-w-lg"
          onClose={closePaymentModal}
          footer={(
            <>
              <ActionButton variant="secondary" onClick={closePaymentModal}>
                {tTerm('common.cta.cancel')}
              </ActionButton>
              <ActionButton
                variant="primary"
                isLoading={payInstallment.isPending}
                loadingLabel={tTerm('associateDetails.installmentPayment.cta.submitting')}
                onClick={confirmPayment}
              >
                {tTerm('associateDetails.installmentPayment.cta.submit')}
              </ActionButton>
            </>
          )}
        >
          <div className="space-y-4">
            <FormField
              label={tTerm('associateDetails.installmentPayment.field.paymentDate')}
              error={paymentErrors.paymentDate}
            >
              <AppInput
                id="associate-tracking-payment-date"
                variant="date"
                value={paymentForm.paymentDate}
                invalid={Boolean(paymentErrors.paymentDate)}
                onValueChange={(value) => {
                  setPaymentForm((current) => ({ ...current, paymentDate: value }));
                  if (paymentErrors.paymentDate) {
                    setPaymentErrors((current) => ({ ...current, paymentDate: '' }));
                  }
                }}
              />
            </FormField>
            <FormField
              label={tTerm('associateDetails.installmentPayment.field.paymentMethod')}
              error={paymentErrors.paymentMethod}
            >
              <AppInput
                id="associate-tracking-payment-method"
                value={paymentForm.paymentMethod}
                invalid={Boolean(paymentErrors.paymentMethod)}
                placeholder={tTerm('associateDetails.installmentPayment.placeholder.paymentMethod')}
                onValueChange={(value) => {
                  setPaymentForm((current) => ({ ...current, paymentMethod: value }));
                  if (paymentErrors.paymentMethod) {
                    setPaymentErrors((current) => ({ ...current, paymentMethod: '' }));
                  }
                }}
              />
            </FormField>
          </div>
        </ModalShell>
      )}

    </PageShell>
  );
}
