import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useTranslation } from '../i18n';
import { formatCurrency as formatLocaleCurrency, formatDate as formatLocaleDate, formatNumber } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { exportAssociateFinancialSummary, useAssociateDetails } from '../services/associateService';
import {
  getAssociateInterestRateValue,
  getAssociateInterestTypeValue,
} from '../lib/associateInterest';
import { parseFormattedPositiveMoneyInput } from '../lib/moneyInput';
import { toast } from '../lib/toast';
import { getPaymentMethodLabel } from '../constants/paymentTypes';
import ContributionModal from './ContributionModal';
import InstallmentsModal from './InstallmentsModal';
import { AssociateDetailToolbar, type AssociateMoneyActionType } from './associateDetails/AssociateDetailToolbar';
import AssociateModuleNavigation from './associates/AssociateModuleNavigation';
import { useSessionStore } from '../store/sessionStore';
import { PERMISSION } from '../constants/permissionNames';
import { useResolvedPermissionNames } from '../services/permissionsService';
import {
  ActionButton,
  DataTableSurface,
  EmptyState,
  FormField,
  InsightStrip,
  ModalShell,
  CurrencyInput,
  OperationalSelect,
  PageHeader,
  PageShell,
  SectionSurface,
  AppInput,
} from './shared/Surfaces';
import {
  AppTable,
  RowActionsWithOverflow,
  TableActionsCell,
  TableActionsHeader,
  TableSectionIntro,
  TABLE_EMBEDDED_SHELL_CLASS,
} from './shared/tables';

type TabType = 'overview' | 'installments' | 'calendar';

const DETAILS_PAGE_SIZE_OPTIONS: number[] = [10, 20, 50];

const formatAssociateCurrency = (value: unknown) => formatLocaleCurrency(value);

const formatSignedCurrency = (value: unknown, type?: string, status?: string) => {
  const numericValue = Number(value || 0);
  const prefix = type === 'contribution'
    ? '+'
    : (['distribution', 'capitalReturn', 'installment', 'interest_payment'].includes(String(type)) ? '-' : (status === 'paid' ? '✓ ' : ''));
  return `${prefix}${formatAssociateCurrency(numericValue)}`;
};

const formatAssociateDate = (value: unknown) => formatLocaleDate(value) || '-';

const getInstallmentStatusPresentation = (installment: any) => {
  const normalizedStatus = String(installment?.status || '').toLowerCase();
  if (normalizedStatus === 'paid') {
    return {
      label: tTerm('schedule.status.paid'),
      className: 'bg-emerald-100 text-emerald-700',
    };
  }
  if (normalizedStatus === 'overdue') {
    return {
      label: tTerm('schedule.status.overdue'),
      className: 'bg-red-100 text-red-700',
    };
  }
  if (normalizedStatus === 'pending') {
    return {
      label: tTerm('schedule.status.pending'),
      className: 'bg-amber-100 text-amber-700',
    };
  }

  return {
    label: tTerm('schedule.status.pending'),
    className: 'bg-amber-100 text-amber-700',
  };
};

const getDebtStatusLabel = (status?: string) => {
  switch (String(status || '').toLowerCase()) {
    case 'overdue':
      return tTerm('associateDetails.debtStatus.overdue');
    case 'pending':
      return tTerm('associateDetails.debtStatus.pending');
    default:
      return tTerm('associateDetails.debtStatus.current');
  }
};

const getPaymentHistoryLabel = (entry: any) => {
  const paymentType = String(entry?.paymentType || '').toLowerCase();
  if (paymentType === 'capital_return' || entry?.distributionType === 'capital_return') {
    return tTerm('associateDetails.paymentHistory.capitalReturn');
  }
  if (paymentType === 'manual') {
    return tTerm('associateDetails.paymentHistory.manualProfitability');
  }
  if (entry?.installmentNumber) {
    return tTerm('associateDetails.paymentHistory.installmentLabel', { number: entry.installmentNumber });
  }
  if (entry?.type === 'interest_payment' || entry?.paymentType === 'interest_payment') {
    return tTerm('associateDetails.calendar.eventType.installment');
  }
  if (entry?.type === 'distribution') {
    return tTerm('associateDetails.calendar.eventType.distribution');
  }
  if (entry?.type === 'contribution') {
    return tTerm('associateDetails.calendar.eventType.contribution');
  }
  if (typeof entry?.displayType === 'string' && entry.displayType.trim()) {
    return entry.displayType.trim();
  }
  return tTerm('common.notAvailable');
};

const getCalendarEventBadgeClass = (event: any) => {
  if (event?.type === 'contribution') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (event?.type === 'installment' || event?.type === 'interest_payment') {
    return 'bg-amber-100 text-amber-700';
  }
  if (event?.type === 'distribution') {
    if (event?.distributionKind === 'capital-return') {
      return 'bg-blue-100 text-blue-700';
    }
    if (event?.distributionKind === 'reinvestment') {
      return 'bg-violet-100 text-violet-700';
    }
    return 'bg-sky-100 text-sky-700';
  }
  return 'bg-slate-100 text-slate-700';
};

const getCalendarEventTypeLabel = (event: any) => {
  if (event?.type === 'contribution') return tTerm('associateDetails.calendar.eventType.contribution');
  if (event?.type === 'distribution') return tTerm('associateDetails.calendar.eventType.distribution');
  if (event?.type === 'installment' || event?.type === 'interest_payment') return tTerm('associateDetails.calendar.eventType.installment');
  return tTerm('common.notAvailable');
};

const formatAlertDayCount = (value: unknown) => {
  const days = Number(value || 0);
  return formatNumber(days, { maximumFractionDigits: 0 });
};

const buildCompactOperationalSummary = (items: Array<{ label: string; value: string; helper?: string }>) => (
  items
    .filter((item) => item.value.trim().length > 0)
    .map((item) => `${item.label}: ${item.value}${item.helper ? ` (${item.helper})` : ''}`)
    .join(' · ')
);

const normalizeNumericValue = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const resolveMoneyFallback = (...values: unknown[]) => {
  for (const value of values) {
    const numericValue = normalizeNumericValue(value);
    if (numericValue !== null) {
      return numericValue;
    }
  }

  return 0;
};

const resolveUserLabel = (...values: unknown[]) => {
  for (const value of values) {
    if (!value) {
      continue;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) {
        return normalized;
      }
      continue;
    }

    if (typeof value === 'object') {
      const userValue = value as { name?: string; email?: string };
      const candidate = userValue.name || userValue.email;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return '-';
};

const toUtcDateOnly = (value: unknown) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(String(value));
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return Date.UTC(
    parsedDate.getUTCFullYear(),
    parsedDate.getUTCMonth(),
    parsedDate.getUTCDate(),
  );
};

const diffCalendarDaysUtc = (left: unknown, right: unknown) => {
  const leftUtc = toUtcDateOnly(left);
  const rightUtc = toUtcDateOnly(right);
  if (leftUtc === null || rightUtc === null) {
    return null;
  }

  return Math.round((leftUtc - rightUtc) / (24 * 60 * 60 * 1000));
};

const normalizeAssociatePaymentHistoryEntry = (entry: any) => ({
  ...entry,
  paymentType: entry?.paymentType ?? entry?.type ?? null,
  distributionType: entry?.distributionType ?? entry?.movementType ?? null,
  displayType: entry?.displayType ?? entry?.label ?? null,
  installmentNumber: entry?.installmentNumber ?? null,
  amount: resolveMoneyFallback(entry?.amount, entry?.value, entry?.totalAmount),
  dueDate: entry?.dueDate ?? entry?.scheduledDate ?? null,
  paidAt: entry?.paidAt ?? entry?.distributionDate ?? entry?.paymentDate ?? entry?.date ?? null,
  paymentMethod: entry?.paymentMethod ?? entry?.method ?? null,
  paidByUser: entry?.paidByUser ?? entry?.createdBy ?? null,
  paidBy: entry?.paidBy ?? entry?.responsible ?? null,
  responsibleUser: entry?.responsibleUser ?? entry?.createdBy ?? entry?.paidBy ?? null,
});

const getAssociatePaymentMethodLabel = (value: unknown) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return getPaymentMethodLabel(value);
  }

  const catalogLabel = getPaymentMethodLabel(rawValue);
  return catalogLabel === tTerm('payment.method.unknown') ? rawValue : catalogLabel;
};

const normalizeAssociateAlertEntry = (alert: any, installmentsByNumber: Map<number, any>, asOfDate: Date) => {
  const normalizedType = String(alert?.type || '').toLowerCase();
  if (!['overdue', 'upcoming'].includes(normalizedType)) {
    return null;
  }

  const installmentNumber = normalizeNumericValue(alert?.installmentNumber);
  const relatedInstallment = installmentNumber !== null
    ? installmentsByNumber.get(installmentNumber)
    : null;
  const dueDate = alert?.dueDate ?? relatedInstallment?.dueDate ?? null;
  const amount = resolveMoneyFallback(alert?.amount, relatedInstallment?.amount);
  const dayDelta = diffCalendarDaysUtc(dueDate, asOfDate);

  if (!dueDate || dayDelta === null) {
    return null;
  }

  if (normalizedType === 'overdue') {
    const explicitDaysOverdue = normalizeNumericValue(alert?.daysOverdue);
    if (explicitDaysOverdue === null && dayDelta > 0) {
      return null;
    }

    return {
      ...alert,
      type: 'overdue',
      installmentNumber,
      amount,
      dueDate,
      daysUntilDue: null,
      daysOverdue: explicitDaysOverdue ?? Math.abs(dayDelta),
    };
  }

  const explicitDaysUntilDue = normalizeNumericValue(alert?.daysUntilDue);
  if (explicitDaysUntilDue === null && dayDelta < 0) {
    return null;
  }

  return {
    ...alert,
    type: 'upcoming',
    installmentNumber,
    amount,
    dueDate,
    daysUntilDue: explicitDaysUntilDue ?? Math.max(dayDelta, 0),
    daysOverdue: null,
  };
};

const buildFallbackAssociateAlerts = (installments: any[], asOfDate: Date) => installments
  .map((installment) => {
    const dueDate = installment?.dueDate;
    const dayDelta = diffCalendarDaysUtc(dueDate, asOfDate);
    if (!dueDate || dayDelta === null) {
      return null;
    }

    const normalizedStatus = String(installment?.status || '').toLowerCase();
    if (['paid', 'completed'].includes(normalizedStatus)) {
      return null;
    }

    if (normalizedStatus === 'overdue' || dayDelta < 0) {
      return {
        type: 'overdue',
        installmentNumber: normalizeNumericValue(installment?.installmentNumber),
        amount: resolveMoneyFallback(installment?.amount),
        dueDate,
        daysUntilDue: null,
        daysOverdue: Math.abs(dayDelta),
      };
    }

    if (normalizedStatus === 'pending') {
      return {
        type: 'upcoming',
        installmentNumber: normalizeNumericValue(installment?.installmentNumber),
        amount: resolveMoneyFallback(installment?.amount),
        dueDate,
        daysUntilDue: Math.max(dayDelta, 0),
        daysOverdue: null,
      };
    }

    return null;
  })
  .filter(Boolean);

const resolveInterestDebtValue = (detailsSummary: any, associate: any) => {
  if (detailsSummary?.interestDebt !== undefined && detailsSummary?.interestDebt !== null) {
    return resolveMoneyFallback(detailsSummary.interestDebt);
  }

  if (detailsSummary?.pendingInterest !== undefined && detailsSummary?.pendingInterest !== null) {
    return resolveMoneyFallback(detailsSummary.pendingInterest);
  }

  if (detailsSummary?.interestPending !== undefined || detailsSummary?.interestOverdue !== undefined) {
    return resolveMoneyFallback(detailsSummary?.interestPending) + resolveMoneyFallback(detailsSummary?.interestOverdue);
  }

  if (associate?.pendingInterest !== undefined || associate?.interestPending !== undefined || associate?.interestOverdue !== undefined) {
    return resolveMoneyFallback(associate?.pendingInterest, associate?.interestPending) + resolveMoneyFallback(associate?.interestOverdue);
  }

  return 0;
};

const sumInstallmentAmountsByStatus = (rows: any[], statuses: string[]) => rows.reduce((total, row) => {
  const normalizedStatus = String(row?.status || '').toLowerCase();
  if (!statuses.includes(normalizedStatus)) return total;
  return total + Number(row?.amount || 0);
}, 0);

const normalizeAssociateInstallmentsData = (value: any) => {
  const rows = Array.isArray(value)
    ? value
    : (Array.isArray(value?.installments) ? value.installments : []);
  const totals = value && !Array.isArray(value) && value.totals
    ? value.totals
    : {};

  return {
    installments: rows,
    totals: {
      totalPending: totals.totalPending ?? sumInstallmentAmountsByStatus(rows, ['pending']),
      totalPaid: totals.totalPaid ?? sumInstallmentAmountsByStatus(rows, ['paid']),
      totalOverdue: totals.totalOverdue ?? sumInstallmentAmountsByStatus(rows, ['overdue']),
    },
    alerts: Array.isArray(value?.alerts) ? value.alerts : [],
  };
};

const normalizeAssociateCalendarData = (value: any) => {
  const events = Array.isArray(value)
    ? value
    : (Array.isArray(value?.events) ? value.events : []);
  const summary = value && !Array.isArray(value) && value.summary
    ? value.summary
    : {};

  return {
    events,
    summary: {
      contributionCount: summary.contributionCount ?? events.filter((event: any) => event?.type === 'contribution').length,
      distributionCount: summary.distributionCount ?? events.filter((event: any) => event?.type === 'distribution').length,
      installmentCount: summary.installmentCount ?? events.filter((event: any) => event?.type === 'installment' || event?.type === 'interest_payment').length,
      pendingInstallments: summary.pendingInstallments ?? events.filter((event: any) => String(event?.status || '').toLowerCase() === 'pending').length,
    },
  };
};

const getTodayDateInputValue = () => {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
};

export default function AssociateDetails() {
  useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const associateId = Number(id);
  const { user } = useSessionStore();
  const resolvedPermissions = useResolvedPermissionNames(user);
  const permissionSet = new Set(resolvedPermissions.map((permission) => permission.toUpperCase()));
  const hasPermission = (permission: string) => (
    user?.role === 'admin' || permissionSet.has('*') || permissionSet.has(permission)
  );
  const canManageAssociateMovements = hasPermission(PERMISSION.SOCIOS_UPDATE);

  const [calendarFilters, setCalendarFilters] = useState({ startDate: '', endDate: '' });
  const updateCalendarFilter = (key: 'startDate' | 'endDate', value: string) => {
    setCalendarFilters((current) => {
      const next = { ...current, [key]: value };
      if (next.startDate && next.endDate && next.startDate > next.endDate) {
        return current;
      }
      return next;
    });
  };

  const {
    details,
    installments,
    contributions,
    calendar,
    isLoading,
    createContribution,
    createDistribution,
    createCapitalReturn,
    createReinvestment,
    payInstallment,
  } = useAssociateDetails(associateId, calendarFilters);
  const associate = details?.associate ?? null;

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showModal, setShowModal] = useState<AssociateMoneyActionType | null>(null);
  const [contributionModalMode, setContributionModalMode] = useState<'history' | 'create' | null>(null);
  const [showInstallmentsModal, setShowInstallmentsModal] = useState(false);
  const [payingInstallmentNumber, setPayingInstallmentNumber] = useState<number | null>(null);
  const [installmentPaymentForm, setInstallmentPaymentForm] = useState({
    paymentDate: getTodayDateInputValue(),
    paymentMethod: '',
    notes: '',
  });
  const [actionAmounts, setActionAmounts] = useState<Record<AssociateMoneyActionType, string>>({
    distribution: '',
    capitalReturn: '',
    reinvestment: '',
  });
  const [actionErrors, setActionErrors] = useState<Record<AssociateMoneyActionType, string>>({
    distribution: '',
    capitalReturn: '',
    reinvestment: '',
  });
  const [actionDates, setActionDates] = useState<Record<AssociateMoneyActionType, string>>({
    distribution: getTodayDateInputValue(),
    capitalReturn: getTodayDateInputValue(),
    reinvestment: getTodayDateInputValue(),
  });
  const [actionNotes, setActionNotes] = useState<Record<AssociateMoneyActionType, string>>({
    distribution: '',
    capitalReturn: '',
    reinvestment: '',
  });
  const [installmentPaymentErrors, setInstallmentPaymentErrors] = useState({
    paymentDate: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExportingFinancialSummary, setIsExportingFinancialSummary] = useState(false);
  const [paymentHistoryPage, setPaymentHistoryPage] = useState(1);
  const [paymentHistoryPageSize, setPaymentHistoryPageSize] = useState<number>(DETAILS_PAGE_SIZE_OPTIONS[0]);
  const [installmentsPage, setInstallmentsPage] = useState(1);
  const [installmentsPageSize, setInstallmentsPageSize] = useState<number>(DETAILS_PAGE_SIZE_OPTIONS[0]);
  const [calendarPage, setCalendarPage] = useState(1);
  const [calendarPageSize, setCalendarPageSize] = useState<number>(DETAILS_PAGE_SIZE_OPTIONS[0]);

  useEffect(() => {
    if (!Number.isFinite(associateId)) return;
    const storageKey = `associate-detail-initial-tab:${associateId}`;
    const requestedTab = sessionStorage.getItem(storageKey) as TabType | null;
    if (requestedTab === 'overview' || requestedTab === 'installments' || requestedTab === 'calendar') {
      setActiveTab(requestedTab);
      sessionStorage.removeItem(storageKey);
    }
  }, [associateId]);

  const detailsSummary = {
    ...(details?.financials ?? {}),
    ...(details?.summary ?? {}),
  };
  const paymentHistory = (Array.isArray(details?.paymentHistory)
    ? details.paymentHistory
    : (Array.isArray(details?.payments)
      ? details.payments
      : (Array.isArray(details?.distributions) ? details.distributions : [])))
    .map(normalizeAssociatePaymentHistoryEntry);
  const installmentsData = normalizeAssociateInstallmentsData(installments);
  const calendarData = normalizeAssociateCalendarData(calendar);
  const calendarEvents = calendarData.events;

  const paymentHistoryTotalPages = Math.max(1, Math.ceil(paymentHistory.length / paymentHistoryPageSize));
  const currentPaymentHistoryPage = Math.min(paymentHistoryPage, paymentHistoryTotalPages);
  const paginatedPaymentHistory = useMemo(() => {
    const startIndex = (currentPaymentHistoryPage - 1) * paymentHistoryPageSize;
    return paymentHistory.slice(startIndex, startIndex + paymentHistoryPageSize);
  }, [currentPaymentHistoryPage, paymentHistory, paymentHistoryPageSize]);
  const paymentHistoryPagination = paymentHistory.length > 0
    ? {
      page: currentPaymentHistoryPage,
      pageSize: paymentHistoryPageSize,
      totalItems: paymentHistory.length,
      totalPages: paymentHistoryTotalPages,
      onPrev: () => setPaymentHistoryPage((page) => Math.max(1, page - 1)),
      onNext: () => setPaymentHistoryPage((page) => Math.min(paymentHistoryTotalPages, page + 1)),
      onPageSizeChange: (pageSize: number) => {
        setPaymentHistoryPageSize(pageSize);
        setPaymentHistoryPage(1);
      },
      pageSizeOptions: DETAILS_PAGE_SIZE_OPTIONS,
    }
    : undefined;

  const installmentsTotalPages = Math.max(1, Math.ceil(installmentsData.installments.length / installmentsPageSize));
  const currentInstallmentsPage = Math.min(installmentsPage, installmentsTotalPages);
  const paginatedInstallments = useMemo(() => {
    const startIndex = (currentInstallmentsPage - 1) * installmentsPageSize;
    return installmentsData.installments.slice(startIndex, startIndex + installmentsPageSize);
  }, [currentInstallmentsPage, installmentsData.installments, installmentsPageSize]);
  const installmentsPagination = installmentsData.installments.length > 0
    ? {
      page: currentInstallmentsPage,
      pageSize: installmentsPageSize,
      totalItems: installmentsData.installments.length,
      totalPages: installmentsTotalPages,
      onPrev: () => setInstallmentsPage((page) => Math.max(1, page - 1)),
      onNext: () => setInstallmentsPage((page) => Math.min(installmentsTotalPages, page + 1)),
      onPageSizeChange: (pageSize: number) => {
        setInstallmentsPageSize(pageSize);
        setInstallmentsPage(1);
      },
      pageSizeOptions: DETAILS_PAGE_SIZE_OPTIONS,
    }
    : undefined;

  const calendarTotalPages = Math.max(1, Math.ceil(calendarEvents.length / calendarPageSize));
  const currentCalendarPage = Math.min(calendarPage, calendarTotalPages);
  const paginatedCalendarEvents = useMemo(() => {
    const startIndex = (currentCalendarPage - 1) * calendarPageSize;
    return calendarEvents.slice(startIndex, startIndex + calendarPageSize);
  }, [calendarEvents, calendarPageSize, currentCalendarPage]);
  const calendarPagination = calendarEvents.length > 0
    ? {
      page: currentCalendarPage,
      pageSize: calendarPageSize,
      totalItems: calendarEvents.length,
      totalPages: calendarTotalPages,
      onPrev: () => setCalendarPage((page) => Math.max(1, page - 1)),
      onNext: () => setCalendarPage((page) => Math.min(calendarTotalPages, page + 1)),
      onPageSizeChange: (pageSize: number) => {
        setCalendarPageSize(pageSize);
        setCalendarPage(1);
      },
      pageSizeOptions: DETAILS_PAGE_SIZE_OPTIONS,
    }
    : undefined;

  if (isLoading) {
    return (
      <PageShell className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionSurface>
          <EmptyState title={tTerm('associateDetails.loading.title')} description={tTerm('associateDetails.loading.description')} compact />
        </SectionSurface>
      </PageShell>
    );
  }

  if (!associate && !details) {
    return (
      <PageShell className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionSurface>
          <EmptyState
            title={tTerm('associateDetails.error.title')}
            description={tTerm('associateDetails.error.description')}
            action={<ActionButton onClick={() => navigate('/associates')}>{tTerm('associateDetails.cta.backToAssociates')}</ActionButton>}
          />
        </SectionSurface>
      </PageShell>
    );
  }

  const associateName = (typeof associate?.name === 'string' && associate.name.trim())
    ? associate.name.trim()
    : [associate?.firstName, associate?.lastName].filter(Boolean).join(' ').trim() || tTerm('associateDetails.fallback.name');

  const totalContributions = resolveMoneyFallback(detailsSummary?.totalContributed, details?.totalContributions, associate?.totalContributed);
  const currentCapital = resolveMoneyFallback(detailsSummary?.currentCapital, associate?.currentCapital, totalContributions);
  const totalCapitalReturned = resolveMoneyFallback(detailsSummary?.totalCapitalReturned, detailsSummary?.capitalReturned, associate?.totalCapitalReturned);
  const totalInterestPaid = resolveMoneyFallback(
    detailsSummary?.totalInterestPaid,
    detailsSummary?.paidInterest,
    detailsSummary?.interestPaid,
    associate?.paidInterest,
    associate?.interestPaid,
  );
  const interestDebt = resolveInterestDebtValue(detailsSummary, associate);
  const nextInterestPaymentDate = detailsSummary?.nextInterestPaymentDate ?? detailsSummary?.nextPaymentDate ?? associate?.nextPaymentDate ?? null;
  const debtStatus = getDebtStatusLabel(detailsSummary?.debtStatus);
  const interestRate = getAssociateInterestRateValue(associate);
  const interestType = getAssociateInterestTypeValue(associate);
  const interestTypeLabel = interestType
    ? tTerm(interestType === 'annual' ? 'common.interestType.annual' : 'common.interestType.monthly').toLowerCase()
    : null;
  const interestRateLabel = interestRate !== null && interestTypeLabel
    ? tTerm('associateDetails.interestRateLabel', {
      rate: formatNumber(interestRate, { maximumFractionDigits: 4 }),
      interestType: interestTypeLabel,
    })
    : tTerm('common.notSpecified');

  const asOfDate = new Date();
  const installmentsByNumber = new Map<number, any>(
    installmentsData.installments
      .map((installment: any) => [normalizeNumericValue(installment?.installmentNumber), installment] as const)
      .filter((entry: readonly [number | null, any]): entry is readonly [number, any] => entry[0] !== null),
  );
  const normalizedAssociateAlerts = (Array.isArray(installmentsData.alerts) ? installmentsData.alerts : [])
    .map((alert: any) => normalizeAssociateAlertEntry(alert, installmentsByNumber, asOfDate))
    .filter(Boolean);
  const associatePaymentAlerts = normalizedAssociateAlerts.length > 0
    ? normalizedAssociateAlerts
    : buildFallbackAssociateAlerts(installmentsData.installments, asOfDate);

  const getAssociatePaymentAlertTitle = (alert: any) => {
    if (!Number.isFinite(Number(alert?.installmentNumber))) {
      return null;
    }

    const installmentNumber = Number(alert.installmentNumber);
    if (alert?.type === 'overdue') {
      return tTerm(Number(alert.daysOverdue) === 1
        ? 'associateDetails.alerts.item.overdue.one'
        : 'associateDetails.alerts.item.overdue.many', {
        installmentNumber,
        days: formatAlertDayCount(alert.daysOverdue),
      });
    }

    return tTerm(Number(alert?.daysUntilDue) === 1
      ? 'associateDetails.alerts.item.upcoming.one'
      : 'associateDetails.alerts.item.upcoming.many', {
      installmentNumber,
      days: formatAlertDayCount(alert?.daysUntilDue),
    });
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showModal) return;

    const rawAmount = String(actionAmounts[showModal] || '').trim();
    if (!rawAmount) {
      setActionErrors((current) => ({
        ...current,
        [showModal]: tTerm('associateDetails.modal.validation.amountRequired'),
      }));
      return;
    }

    const parsedAmount = parseFormattedPositiveMoneyInput(actionAmounts[showModal]);
    if (parsedAmount === null) {
      setActionErrors((current) => ({
        ...current,
        [showModal]: tTerm('associateDetails.modal.validation.amountInvalid'),
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      if (showModal === 'distribution') {
        await createDistribution.mutateAsync({
          amount: parsedAmount,
          distributionDate: actionDates.distribution,
          notes: actionNotes.distribution.trim() || undefined,
        });
      } else if (showModal === 'capitalReturn') {
        await createCapitalReturn.mutateAsync({
          amount: parsedAmount,
          capitalReturnDate: actionDates.capitalReturn,
          notes: actionNotes.capitalReturn.trim() || undefined,
        });
      } else if (showModal === 'reinvestment') {
        await createReinvestment.mutateAsync({
          amount: parsedAmount,
          reinvestmentDate: actionDates.reinvestment,
          notes: actionNotes.reinvestment.trim() || undefined,
        });
      }

      const completedAction = showModal;
      setShowModal(null);
      setActionAmounts((current) => ({ ...current, [completedAction]: '' }));
      setActionDates((current) => ({ ...current, [completedAction]: getTodayDateInputValue() }));
      setActionNotes((current) => ({ ...current, [completedAction]: '' }));
      toast.success({ title: tTerm('associateDetails.toast.action.success') });
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'associates' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeMoneyActionModal = () => {
    if (showModal) {
      const currentAction = showModal;
      setActionAmounts((current) => ({ ...current, [currentAction]: '' }));
      setActionErrors((current) => ({ ...current, [currentAction]: '' }));
      setActionDates((current) => ({ ...current, [currentAction]: getTodayDateInputValue() }));
      setActionNotes((current) => ({ ...current, [currentAction]: '' }));
    }
    setShowModal(null);
  };

  const openMoneyActionModal = (action: AssociateMoneyActionType) => {
    setActionErrors((current) => ({ ...current, [action]: '' }));
    setActionDates((current) => ({ ...current, [action]: getTodayDateInputValue() }));
    setActionNotes((current) => ({ ...current, [action]: '' }));
    setShowModal(action);
  };

  const handleExportFinancialSummary = async () => {
    if (!Number.isFinite(associateId) || isExportingFinancialSummary) {
      return;
    }

    try {
      setIsExportingFinancialSummary(true);
      await exportAssociateFinancialSummary(associateId);
      toast.success({ title: tTerm('associateDetails.toast.exportFinancialSummary.success') });
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'associates' });
    } finally {
      setIsExportingFinancialSummary(false);
    }
  };

  const handleOpenPayInstallmentModal = (installmentNumber: number) => {
    setPayingInstallmentNumber(installmentNumber);
    setInstallmentPaymentErrors({
      paymentDate: '',
    });
    setInstallmentPaymentForm({
      paymentDate: getTodayDateInputValue(),
      paymentMethod: '',
      notes: '',
    });
  };

  const handleClosePayInstallmentModal = () => {
    setPayingInstallmentNumber(null);
    setInstallmentPaymentErrors({
      paymentDate: '',
    });
    setInstallmentPaymentForm({
      paymentDate: getTodayDateInputValue(),
      paymentMethod: '',
      notes: '',
    });
  };

  const handlePayInstallment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (payInstallment.isPending) {
      return;
    }

    if (!installmentPaymentForm.paymentDate) {
      setInstallmentPaymentErrors({
        paymentDate: tTerm('associateDetails.installmentPayment.validation.paymentDateRequired'),
      });
      return;
    }

    if (payingInstallmentNumber === null) {
      return;
    }

    try {
      await payInstallment.mutateAsync({
        installmentNumber: payingInstallmentNumber,
        paymentDate: installmentPaymentForm.paymentDate,
        paymentMethod: installmentPaymentForm.paymentMethod.trim(),
        notes: installmentPaymentForm.notes.trim(),
      });
      handleClosePayInstallmentModal();
      toast.success({ title: tTerm('associateDetails.toast.installmentPaid') });
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'associates' });
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <p className="associate-detail-summary-line" aria-label={tTerm('associateDetails.overview.ariaLabel')}>
        {buildCompactOperationalSummary([
          {
            label: tTerm('associateDetails.overview.metric.currentCapital'),
            value: formatAssociateCurrency(currentCapital),
            helper: tTerm('associateDetails.overview.metric.currentCapitalHelper', {
              contributed: formatAssociateCurrency(totalContributions),
              returned: formatAssociateCurrency(totalCapitalReturned),
            }),
          },
          {
            label: tTerm('associateDetails.overview.metric.interestPaid'),
            value: formatAssociateCurrency(totalInterestPaid),
          },
          {
            label: tTerm('associateDetails.overview.metric.debt'),
            value: formatAssociateCurrency(interestDebt),
            helper: interestDebt > 0
              ? tTerm('associateDetails.overview.metric.debtHelper.pending')
              : tTerm('associateDetails.overview.metric.debtHelper.none'),
          },
          {
            label: tTerm('associateDetails.overview.metric.nextPayment'),
            value: nextInterestPaymentDate ? formatAssociateDate(nextInterestPaymentDate) : tTerm('associateDetails.overview.metric.nextPayment.none'),
            helper: tTerm('associateDetails.overview.metric.nextPaymentHelper'),
          },
        ])}
      </p>

      {associatePaymentAlerts.length > 0 && (
        <SectionSurface
          title={tTerm('associateDetails.alerts.title')}
          subtitle={tTerm('associateDetails.alerts.description')}
          bodyClassName="grid gap-2"
        >
          {associatePaymentAlerts.map((alert: any) => {
            const title = getAssociatePaymentAlertTitle(alert);
            if (!title) {
              return null;
            }

            return (
              <div
                key={`associate-payment-alert-${alert.type}-${alert.installmentNumber}-${alert.dueDate}`}
                className={`flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                  alert.type === 'overdue'
                    ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
                    : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs opacity-80">
                    {tTerm('associateDetails.alerts.item.detail', {
                      amount: formatAssociateCurrency(alert.amount),
                      date: formatAssociateDate(alert.dueDate),
                    })}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center rounded-full bg-bg-surface/80 px-2.5 py-1 text-xs font-semibold text-text-primary">
                  {alert.type === 'overdue' ? tTerm('schedule.status.overdue') : tTerm('schedule.status.pending')}
                </span>
              </div>
            );
          })}
        </SectionSurface>
      )}

    </div>
  );

  const renderInstallmentsTab = () => (
    <div className="space-y-4">
      <DataTableSurface>
        <TableSectionIntro
          embedded
          title={tTerm('associateDetails.installments.title')}
          description={tTerm('associateDetails.installments.description')}
          aside={(
            <p className="max-w-[28rem] text-xs leading-5 text-text-secondary">
              {buildCompactOperationalSummary([
                {
                  label: tTerm('associateDetails.installments.metric.pending'),
                  value: formatAssociateCurrency(installmentsData.totals.totalPending),
                },
                {
                  label: tTerm('associateDetails.installments.metric.paid'),
                  value: formatAssociateCurrency(installmentsData.totals.totalPaid),
                },
                {
                  label: tTerm('associateDetails.installments.metric.overdue'),
                  value: formatAssociateCurrency(installmentsData.totals.totalOverdue),
                },
                {
                  label: tTerm('associateDetails.installments.metric.count'),
                  value: formatNumber(installmentsData.installments.length),
                },
              ])}
            </p>
          )}
        />
        <AppTable variant="operational"
          hasData={installmentsData.installments.length > 0}
          emptyContent={<div className="py-4 text-center text-text-secondary">{tTerm('associateDetails.installments.empty')}</div>}
          recordsLabel={tTerm('associateDetails.installments.recordsLabel')}
          pagination={installmentsPagination}
          className={TABLE_EMBEDDED_SHELL_CLASS}
          surfaceClassName={TABLE_EMBEDDED_SHELL_CLASS}
        >
            <thead>
              <tr>
                <th className="font-medium">{tTerm('associateDetails.installments.header.number')}</th>
                <th className="font-medium">{tTerm('associateDetails.installments.header.amount')}</th>
                <th className="font-medium">{tTerm('associateDetails.installments.header.dueDate')}</th>
                <th className="font-medium">{tTerm('associateDetails.installments.header.status')}</th>
                <TableActionsHeader className="font-medium">{tTerm('associateDetails.installments.header.actions')}</TableActionsHeader>
              </tr>
            </thead>
            <tbody>
              {paginatedInstallments.map((inst: any) => {
                const status = getInstallmentStatusPresentation(inst);

                return (
                <tr key={`associate-installment-${inst.id}-${inst.installmentNumber}`}>
                  <td className="font-medium">{inst.installmentNumber}</td>
                  <td className="font-medium">{formatAssociateCurrency(inst.amount)}</td>
                  <td>{formatAssociateDate(inst.dueDate)}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <TableActionsCell>
                    {canManageAssociateMovements && ['pending', 'overdue'].includes(String(inst.status || '').toLowerCase()) ? (
                      <RowActionsWithOverflow
                        variant="icon"
                        align="center"
                        ariaLabel={tTerm('associateDetails.installments.header.actions')}
                        items={[
                          {
                            id: 'pay',
                            label: tTerm('associateDetails.installments.cta.markAsPaid'),
                            icon: <CheckCircle size={16} />,
                            onClick: () => handleOpenPayInstallmentModal(inst.installmentNumber),
                            disabled: payInstallment.isPending,
                          },
                        ]}
                      />
                    ) : null}
                  </TableActionsCell>
                </tr>
              );
              })}
            </tbody>
        </AppTable>
      </DataTableSurface>

      <DataTableSurface>
        <TableSectionIntro
          embedded
          title={tTerm('associateDetails.paymentHistory.title')}
          description={tTerm('associateDetails.paymentHistory.description')}
        />
        <AppTable variant="operational"
          hasData={paymentHistory.length > 0}
          emptyContent={<div className="py-4 text-center text-text-secondary">{tTerm('associateDetails.paymentHistory.empty')}</div>}
          recordsLabel={tTerm('associateDetails.paymentHistory.recordsLabel')}
          pagination={paymentHistoryPagination}
          className={TABLE_EMBEDDED_SHELL_CLASS}
          surfaceClassName={TABLE_EMBEDDED_SHELL_CLASS}
        >
            <thead>
              <tr>
                <th className="font-medium">{tTerm('associateDetails.paymentHistory.header.installment')}</th>
                <th className="font-medium">{tTerm('associateDetails.paymentHistory.header.amount')}</th>
                <th className="font-medium">{tTerm('associateDetails.paymentHistory.header.dueDate')}</th>
                <th className="font-medium">{tTerm('associateTracking.table.registration')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPaymentHistory.map((entry: any) => (
                <tr key={`associate-payment-history-${entry.id}-${entry.installmentNumber}`}>
                  <td>
                    <p className="font-medium text-text-primary">
                      {getPaymentHistoryLabel(entry)}
                    </p>
                  </td>
                  <td className="font-medium text-emerald-600">{formatAssociateCurrency(entry.amount)}</td>
                  <td>{formatAssociateDate(entry.dueDate ?? entry.paymentDate ?? entry.date)}</td>
                  <td>
                    <div className="report-record-stack">
                      <p className="report-record-stack__title">{formatAssociateDate(entry.paidAt ?? entry.paymentDate ?? entry.date)}</p>
                      <p className="report-record-stack__meta">
                        {[
                          getAssociatePaymentMethodLabel(entry.paymentMethod),
                          resolveUserLabel(entry.paidByUser, entry.paidBy, entry.responsibleUser, entry.createdBy),
                        ].filter((value) => value && value !== '-' && value !== tTerm('common.notAvailable')).join(' · ') || tTerm('common.notAvailable')}
                      </p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
        </AppTable>
      </DataTableSurface>
    </div>
  );

  const renderCalendarTab = () => (
    <div className="space-y-4">
      <DataTableSurface>
        <TableSectionIntro
          embedded
          title={tTerm('associateDetails.calendar.title')}
          description={tTerm('associateDetails.calendar.description')}
          aside={(
            <p className="max-w-[28rem] text-xs leading-5 text-text-secondary">
              {buildCompactOperationalSummary([
                {
                  label: tTerm('associateDetails.calendar.metric.contributions'),
                  value: formatNumber(calendarData.summary.contributionCount),
                },
                {
                  label: tTerm('associateDetails.calendar.metric.distributions'),
                  value: formatNumber(calendarData.summary.distributionCount),
                },
                {
                  label: tTerm('associateDetails.calendar.metric.installments'),
                  value: formatNumber(calendarData.summary.installmentCount),
                },
                {
                  label: tTerm('associateDetails.calendar.metric.pending'),
                  value: formatNumber(calendarData.summary.pendingInstallments),
                },
              ])}
            </p>
          )}
        />
        <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={tTerm('associateDetails.calendar.filter.from')} htmlFor="associate-calendar-start-date">
              <AppInput
                id="associate-calendar-start-date"
                variant="date"
                value={calendarFilters.startDate}
                onValueChange={(v, _d, e) => updateCalendarFilter('startDate', v)}
              />
            </FormField>
            <FormField label={tTerm('associateDetails.calendar.filter.to')} htmlFor="associate-calendar-end-date">
              <AppInput
                id="associate-calendar-end-date"
                variant="date"
                value={calendarFilters.endDate}
                onValueChange={(v, _d, e) => updateCalendarFilter('endDate', v)}
              />
            </FormField>
          </div>
        </div>
        <AppTable variant="operational"
          hasData={calendarEvents.length > 0}
          emptyContent={<div className="py-4 text-center text-text-secondary">{tTerm('associateDetails.calendar.empty')}</div>}
          recordsLabel={tTerm('associateDetails.calendar.recordsLabel')}
          pagination={calendarPagination}
          className={TABLE_EMBEDDED_SHELL_CLASS}
          surfaceClassName={TABLE_EMBEDDED_SHELL_CLASS}
        >
            <thead>
              <tr>
                <th className="font-medium">{tTerm('associateDetails.calendar.header.date')}</th>
                <th className="font-medium">{tTerm('associateDetails.calendar.header.type')}</th>
                <th className="font-medium">{tTerm('associateDetails.calendar.header.amount')}</th>
                <th className="font-medium">{tTerm('associateDetails.calendar.header.notes')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCalendarEvents.map((event: any) => (
                <tr key={`${event.type}-${event.id ?? 'no-id'}-${event.date}-${event.displayAmount ?? event.amount}-${event.notes ?? ''}`}>
                  <td>{formatAssociateDate(event.date)}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs ${getCalendarEventBadgeClass(event)}`}>
                      {getCalendarEventTypeLabel(event)}
                    </span>
                  </td>
                  <td className="font-medium">
                    {formatSignedCurrency(event.amount, event.type, event.status)}
                  </td>
                  <td className="text-text-secondary">{event.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
        </AppTable>
      </DataTableSurface>
    </div>
  );

  const detailViewOptions = [
    {
      id: 'overview',
      label: tTerm('associateDetails.tab.overview'),
    },
    {
      id: 'installments',
      label: tTerm('associateDetails.tab.installments'),
      count: installmentsData.installments.length,
    },
    {
      id: 'calendar',
      label: tTerm('associateDetails.tab.calendar'),
      count: calendarEvents.length,
    },
  ] satisfies Array<{ id: TabType; label: string; count?: number }>;

  return (
    <PageShell className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8" data-tour="associate-details-page">
      <PageHeader
        title={tTerm('associateDetails.header.title')}
        subtitle={tTerm('associateDetails.header.subtitle', {
          name: associateName,
          debtStatus,
          interestRate: interestRateLabel,
        })}
        guideKey="associate-details"
        tourId="associate-details-header"
        actions={(
          <ActionButton
            onClick={() => navigate('/associates')}
            aria-label={tTerm('associateDetails.cta.backToAssociates')}
            title={tTerm('associateDetails.cta.backToAssociates')}
            icon={<ArrowLeft size={16} />}
          >
            {tTerm('newAssociate.actions.back')}
          </ActionButton>
        )}
      />

      <AssociateModuleNavigation
        activeSection="registry"
        setCurrentView={(view) => navigate(`/${view}`)}
      />

      <AssociateDetailToolbar
        canManageMovements={canManageAssociateMovements}
        onOpenContributionHistory={() => setContributionModalMode('history')}
        onOpenInterestSchedule={() => setShowInstallmentsModal(true)}
        onExportFinancialSummary={handleExportFinancialSummary}
        isExportingFinancialSummary={isExportingFinancialSummary}
        onOpenCapitalContribution={() => setContributionModalMode('create')}
        onOpenInterestPayments={() => setActiveTab('installments')}
        onOpenMoneyAction={openMoneyActionModal}
      />

      <div className="associate-detail-query" data-tour="associate-details-tabs">
        <FormField label={tTerm('associateDetails.query.label')}>
          <OperationalSelect
            id="associate-detail-query"
            value={activeTab}
            aria-label={tTerm('associateDetails.query.label')}
            onChange={(event) => setActiveTab(event.target.value as TabType)}
          >
            {detailViewOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {typeof option.count === 'number'
                  ? `${option.label} (${formatNumber(option.count)})`
                  : option.label}
              </option>
            ))}
          </OperationalSelect>
        </FormField>
      </div>

      {/* Tab Content */}
      <div data-tour="associate-details-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'installments' && renderInstallmentsTab()}
        {activeTab === 'calendar' && renderCalendarTab()}
      </div>

      {showModal && (
        <ModalShell
          title={showModal === 'capitalReturn'
              ? tTerm('associateDetails.modal.title.capitalReturn')
            : showModal === 'distribution'
              ? tTerm('associateDetails.modal.title.distribution')
              : tTerm('associateDetails.modal.title.reinvestment')}
          onClose={closeMoneyActionModal}
        >
            <form noValidate onSubmit={handleAction} className="space-y-4">
              <FormField
                label={tTerm('associateDetails.modal.field.amount')}
                htmlFor={`associate-action-${showModal}-amount`}
                error={actionErrors[showModal]}
              >
                <CurrencyInput
                  key={showModal}
                  id={`associate-action-${showModal}-amount`}
                  aria-label={tTerm('associateDetails.modal.field.amount')}
                  value={actionAmounts[showModal]}
                  onValueChange={(value) => {
                    setActionAmounts((current) => ({ ...current, [showModal]: value }));
                    if (actionErrors[showModal]) {
                      setActionErrors((current) => ({ ...current, [showModal]: '' }));
                    }
                  }}
                  placeholder={tTerm('associateDetails.modal.placeholder.amount')}
                />
              </FormField>
              <FormField
                label={
                  showModal === 'capitalReturn'
                    ? tTerm('associateDetails.modal.field.capitalReturnDate')
                    : showModal === 'reinvestment'
                      ? tTerm('associateDetails.modal.field.reinvestmentDate')
                      : tTerm('associateDetails.modal.field.distributionDate')
                }
                htmlFor={`associate-action-${showModal}-date`}
              >
                <AppInput
                  id={`associate-action-${showModal}-date`}
                  variant="date"
                  value={actionDates[showModal]}
                  onValueChange={(value) => setActionDates((current) => ({ ...current, [showModal]: value }))}
                />
              </FormField>
              <FormField
                label={tTerm('associateDetails.modal.field.notes')}
                htmlFor={`associate-action-${showModal}-notes`}
              >
                <div className="operational-control operational-control--textarea">
                  <textarea
                    id={`associate-action-${showModal}-notes`}
                    value={actionNotes[showModal]}
                    onChange={(event) => setActionNotes((current) => ({ ...current, [showModal]: event.target.value }))}
                    rows={3}
                    placeholder={tTerm('associateDetails.modal.placeholder.notes')}
                    className="operational-control-textarea"
                  />
                </div>
              </FormField>
              <div className="flex gap-3 pt-4">
                <ActionButton
                  type="button"
                  onClick={closeMoneyActionModal}
                  fullWidth
                >
                  {tTerm('common.cta.cancel')}
                </ActionButton>
                <ActionButton
                  type="submit"
                  disabled={isSubmitting}
                  variant="primary"
                  fullWidth
                >
                  {isSubmitting ? tTerm('associateDetails.modal.submit.pending') : tTerm('common.cta.confirm')}
                </ActionButton>
              </div>
            </form>
        </ModalShell>
      )}

      {payingInstallmentNumber !== null && (
        <ModalShell
          title={tTerm('associateDetails.installmentPayment.title')}
          subtitle={tTerm('associateDetails.installmentPayment.subtitle', { installmentNumber: payingInstallmentNumber })}
          onClose={handleClosePayInstallmentModal}
        >
          <form noValidate onSubmit={handlePayInstallment} className="space-y-4">
            <FormField
              label={tTerm('associateDetails.installmentPayment.field.paymentDate')}
              error={installmentPaymentErrors.paymentDate}
            >
              <AppInput
                variant="date"
                value={installmentPaymentForm.paymentDate}
                onValueChange={(v, _d, e) => {
                  setInstallmentPaymentForm((prev) => ({ ...prev, paymentDate: v }));
                  if (installmentPaymentErrors.paymentDate) {
                    setInstallmentPaymentErrors({ paymentDate: '' });
                  }
                }}
              />
            </FormField>
            <FormField label={tTerm('associateDetails.installmentPayment.field.paymentMethod')}>
              <AppInput
                variant="text"
                value={installmentPaymentForm.paymentMethod}
                onValueChange={(v, _d, e) => setInstallmentPaymentForm((prev) => ({ ...prev, paymentMethod: v }))}
                placeholder={tTerm('associateDetails.installmentPayment.placeholder.paymentMethod')}
              />
            </FormField>
            <FormField label={tTerm('associateDetails.installmentPayment.field.notes')}>
              <div className="operational-control operational-control--textarea">
                <textarea
                  value={installmentPaymentForm.notes}
                  onChange={(event) => setInstallmentPaymentForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder={tTerm('associateDetails.installmentPayment.placeholder.notes')}
                  rows={3}
                  className="operational-control-textarea"
                />
              </div>
            </FormField>
            <div className="flex gap-3 pt-2">
              <ActionButton
                type="button"
                onClick={handleClosePayInstallmentModal}
                fullWidth
              >
                {tTerm('common.cta.cancel')}
              </ActionButton>
              <ActionButton
                type="submit"
                disabled={payInstallment.isPending}
                isLoading={payInstallment.isPending}
                variant="primary"
                fullWidth
              >
                {payInstallment.isPending
                  ? tTerm('associateDetails.installmentPayment.cta.submitting')
                  : tTerm('associateDetails.installmentPayment.cta.submit')}
              </ActionButton>
            </div>
          </form>
        </ModalShell>
      )}

      {contributionModalMode !== null && (
        <ContributionModal
          contributions={contributions ?? []}
          isLoading={false}
          initialAddFormOpen={contributionModalMode === 'create'}
          onAddContribution={async (data) => {
            await createContribution.mutateAsync(data);
          }}
          onClose={() => setContributionModalMode(null)}
          canAddContribution={canManageAssociateMovements}
        />
      )}

      {showInstallmentsModal && (
        <InstallmentsModal
          installments={installments}
          isLoading={false}
          onClose={() => setShowInstallmentsModal(false)}
        />
      )}
    </PageShell>
  );
}
