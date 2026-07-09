import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useTranslation } from '../i18n';
import { formatCurrency as formatLocaleCurrency, formatDate as formatLocaleDate, formatNumber } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { exportAssociateFinancialSummary, useAssociateDetails } from '../services/associateService';
import { useActivePaymentMethods } from '../services/configService';
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
import AppCalendar, { toCalendarDayKey, type CalendarEvent, type CalendarEventTone } from './shared/AppCalendar';
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
    : (['distribution', 'capitalReturn', 'installment'].includes(String(type)) ? '-' : (status === 'paid' ? '✓ ' : ''));
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
  if (paymentType === 'capital_return') {
    return tTerm('associateDetails.paymentHistory.capitalReturn');
  }
  if (paymentType === 'manual') {
    return tTerm('associateDetails.paymentHistory.manualProfitability');
  }
  if (paymentType === 'scheduled' && entry?.installmentNumber) {
    return tTerm('associateDetails.paymentHistory.installmentLabel', { number: entry.installmentNumber });
  }
  return tTerm('common.notAvailable');
};

const getCalendarEventBadgeClass = (event: any) => {
  if (event?.type === 'contribution') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (event?.type === 'installment') {
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
  if (event?.type === 'distribution') {
    if (event?.distributionKind === 'capital-return') {
      return tTerm('associateDetails.paymentHistory.capitalReturn');
    }
    if (event?.distributionKind === 'reinvestment') {
      return tTerm('associateDetails.calendar.eventType.reinvestment');
    }
    return tTerm('associateDetails.calendar.eventType.distribution');
  }
  if (event?.type === 'installment') return tTerm('associateDetails.calendar.eventType.installment');
  return tTerm('common.notAvailable');
};

const getCalendarEventTone = (event: any): CalendarEventTone => {
  if (event?.type === 'contribution') return 'success';
  if (event?.type === 'installment') {
    const status = String(event?.status || '').toLowerCase();
    if (status === 'paid') return 'success';
    if (status === 'overdue') return 'danger';
    return 'warning';
  }
  if (event?.type === 'distribution') {
    if (event?.distributionKind === 'capital-return') {
      return 'info';
    }
    if (event?.distributionKind === 'reinvestment') {
      return 'neutral';
    }
    return 'info';
  }
  return 'neutral';
};

const parseAssociateCalendarDate = (value: unknown): Date | null => {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
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

const resolveUserLabel = (value: unknown) => {
  if (value && typeof value === 'object') {
    const userValue = value as { name?: string; email?: string };
    const candidate = userValue.name || userValue.email;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '-';
};

const getAssociatePaymentMethodLabel = (value: unknown) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return getPaymentMethodLabel(value);
  }

  const catalogLabel = getPaymentMethodLabel(rawValue);
  return catalogLabel === tTerm('payment.method.unknown') ? rawValue : catalogLabel;
};

const normalizeAssociateInstallmentsData = (value: any) => {
  return {
    installments: Array.isArray(value?.installments) ? value.installments : [],
    totals: {
      totalPending: Number(value?.totals?.totalPending || 0),
      totalPaid: Number(value?.totals?.totalPaid || 0),
      totalOverdue: Number(value?.totals?.totalOverdue || 0),
    },
    alerts: Array.isArray(value?.alerts) ? value.alerts : [],
  };
};

const normalizeAssociateCalendarData = (value: any) => {
  const events = Array.isArray(value?.events) ? value.events : [];

  return {
    events,
    summary: {
      contributionCount: Number(value?.summary?.contributionCount || 0),
      distributionCount: Number(value?.summary?.distributionCount || 0),
      installmentCount: Number(value?.summary?.installmentCount || 0),
      pendingInstallments: Number(value?.summary?.pendingInstallments || 0),
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
  const isBackofficeUser = user?.role === 'admin' || user?.role === 'employee';
  const { paymentMethods: configuredPaymentMethods } = useActivePaymentMethods({ enabled: isBackofficeUser });
  const paymentMethodOptions = useMemo(() => {
    const active = configuredPaymentMethods
      .filter((method: any) => method?.isActive !== false)
      .map((method: any) => ({
        value: String(method?.key ?? method?.type ?? '').trim().toLowerCase(),
        label: String(method?.label ?? method?.name ?? '').trim() || tTerm('settings.paymentMethods.methodUnnamed'),
      }))
      .filter((method) => method.value);
    return active;
  }, [configuredPaymentMethods]);
  const defaultPaymentMethod = paymentMethodOptions[0]?.value || '';

  const [calendarFilters, setCalendarFilters] = useState({ startDate: '', endDate: '' });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);
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
    createManualProfitabilityPayment,
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
    paymentMethod: '',
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

  const detailsSummary = details?.summary ?? {};
  const paymentHistory = Array.isArray(details?.paymentHistory) ? details.paymentHistory : [];
  const installmentsData = normalizeAssociateInstallmentsData(installments);
  const calendarData = normalizeAssociateCalendarData(calendar);
  const calendarEvents = calendarData.events;
  const appCalendarEvents = useMemo<CalendarEvent[]>(() => (
    calendarEvents
      .map((event: any, index: number) => {
        const date = parseAssociateCalendarDate(event?.date);
        if (!date) return null;
        const amount = Number(event?.amount || 0);
        return {
          id: String(event?.id ?? `${event?.type || 'event'}-${index}-${event?.date}`),
          date,
          title: getCalendarEventTypeLabel(event),
          meta: amount > 0 ? formatAssociateCurrency(amount) : undefined,
          tone: getCalendarEventTone(event),
        } satisfies CalendarEvent;
      })
      .filter(Boolean) as CalendarEvent[]
  ), [calendarEvents]);
  const calendarInitialDate = useMemo(() => {
    const firstEventDate = appCalendarEvents[0]?.date;
    return firstEventDate ?? new Date();
  }, [appCalendarEvents]);
  const visibleCalendarEvents = useMemo(() => {
    if (!selectedCalendarDay) {
      return calendarEvents;
    }
    return calendarEvents.filter((event: any) => {
      const date = parseAssociateCalendarDate(event?.date);
      return date ? toCalendarDayKey(date) === selectedCalendarDay : false;
    });
  }, [calendarEvents, selectedCalendarDay]);

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

  const calendarTotalPages = Math.max(1, Math.ceil(visibleCalendarEvents.length / calendarPageSize));
  const currentCalendarPage = Math.min(calendarPage, calendarTotalPages);
  const paginatedCalendarEvents = useMemo(() => {
    const startIndex = (currentCalendarPage - 1) * calendarPageSize;
    return visibleCalendarEvents.slice(startIndex, startIndex + calendarPageSize);
  }, [visibleCalendarEvents, calendarPageSize, currentCalendarPage]);
  const calendarPagination = visibleCalendarEvents.length > 0
    ? {
      page: currentCalendarPage,
      pageSize: calendarPageSize,
      totalItems: visibleCalendarEvents.length,
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

  const totalContributions = Number(detailsSummary.totalContributed || 0);
  const currentCapital = Number(detailsSummary.currentCapital || 0);
  const totalCapitalReturned = Number(detailsSummary.totalCapitalReturned || 0);
  const totalInterestPaid = Number(detailsSummary.totalInterestPaid || 0);
  const interestDebt = Number(detailsSummary.interestDebt || 0);
  const nextInterestPaymentDate = detailsSummary.nextInterestPaymentDate || null;
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

  const associatePaymentAlerts = installmentsData.alerts;

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
        await createManualProfitabilityPayment.mutateAsync({
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
      paymentMethod: '',
    });
    setInstallmentPaymentForm({
      paymentDate: getTodayDateInputValue(),
      paymentMethod: defaultPaymentMethod,
    });
  };

  const handleClosePayInstallmentModal = () => {
    setPayingInstallmentNumber(null);
    setInstallmentPaymentErrors({
      paymentDate: '',
      paymentMethod: '',
    });
    setInstallmentPaymentForm({
      paymentDate: getTodayDateInputValue(),
      paymentMethod: defaultPaymentMethod,
    });
  };

  const handlePayInstallment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (payInstallment.isPending) {
      return;
    }

    const paymentDate = installmentPaymentForm.paymentDate.trim();
    const paymentMethod = installmentPaymentForm.paymentMethod.trim();
    const nextErrors = {
      paymentDate: paymentDate ? '' : tTerm('associateDetails.installmentPayment.validation.paymentDateRequired'),
      paymentMethod: paymentMethod ? '' : tTerm('associateTracking.payment.validation.paymentMethodRequired'),
    };

    setInstallmentPaymentErrors(nextErrors);
    if (nextErrors.paymentDate || nextErrors.paymentMethod || payingInstallmentNumber === null) {
      return;
    }

    try {
      await payInstallment.mutateAsync({
        installmentNumber: payingInstallmentNumber,
        paymentDate,
        paymentMethod,
      });
      handleClosePayInstallmentModal();
      toast.success({ title: tTerm('associateDetails.toast.installmentPaid') });
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'associates' });
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <InsightStrip
        className="associate-detail-summary-strip"
        aria-label={tTerm('associateDetails.overview.ariaLabel')}
        items={[
          {
            id: 'current-capital',
            label: tTerm('associateDetails.overview.metric.currentCapital'),
            value: formatAssociateCurrency(currentCapital),
            helper: tTerm('associateDetails.overview.metric.currentCapitalHelper', {
              contributed: formatAssociateCurrency(totalContributions),
              returned: formatAssociateCurrency(totalCapitalReturned),
            }),
            accent: 'teal',
          },
          {
            id: 'contributions',
            label: tTerm('associateDetails.overview.metric.contributions'),
            value: formatAssociateCurrency(totalContributions),
            accent: 'blue',
          },
          {
            id: 'interest-paid',
            label: tTerm('associateDetails.overview.metric.interestPaid'),
            value: formatAssociateCurrency(totalInterestPaid),
            accent: 'emerald',
          },
          {
            id: 'interest-pending',
            label: tTerm('associateDetails.overview.metric.debt'),
            value: formatAssociateCurrency(interestDebt),
            helper: interestDebt > 0
              ? tTerm('associateDetails.overview.metric.debtHelper.pending')
              : tTerm('associateDetails.overview.metric.debtHelper.none'),
            accent: interestDebt > 0 ? 'amber' : 'slate',
          },
          {
            id: 'capital-returned',
            label: tTerm('associateDetails.overview.metric.capitalReturned'),
            value: formatAssociateCurrency(totalCapitalReturned),
            accent: 'rose',
          },
          {
            id: 'next-payment',
            label: tTerm('associateDetails.overview.metric.nextPayment'),
            value: nextInterestPaymentDate
              ? formatAssociateDate(nextInterestPaymentDate)
              : tTerm('associateDetails.overview.metric.nextPayment.none'),
            helper: tTerm('associateDetails.overview.metric.nextPaymentHelper'),
            accent: 'slate',
          },
        ]}
      />

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
                  <td>{formatAssociateDate(entry.dueDate)}</td>
                  <td>
                    <div className="report-record-stack">
                      <p className="report-record-stack__title">{formatAssociateDate(entry.paidAt)}</p>
                      <p className="report-record-stack__meta">
                        {[
                          getAssociatePaymentMethodLabel(entry.paymentMethod),
                          resolveUserLabel(entry.paidByUser),
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
      <SectionSurface
        title={tTerm('associateDetails.calendar.title')}
        subtitle={tTerm('associateDetails.calendar.description')}
        bodyClassName="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={tTerm('associateDetails.calendar.filter.from')} htmlFor="associate-calendar-start-date">
            <AppInput
              id="associate-calendar-start-date"
              variant="date"
              value={calendarFilters.startDate}
              onValueChange={(v) => updateCalendarFilter('startDate', v)}
            />
          </FormField>
          <FormField label={tTerm('associateDetails.calendar.filter.to')} htmlFor="associate-calendar-end-date">
            <AppInput
              id="associate-calendar-end-date"
              variant="date"
              value={calendarFilters.endDate}
              onValueChange={(v) => updateCalendarFilter('endDate', v)}
            />
          </FormField>
        </div>

        <p className="text-xs leading-5 text-text-secondary">
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

        <div className="associate-detail-calendar-grid" data-testid="associate-detail-calendar">
          <AppCalendar
            events={appCalendarEvents}
            initialDate={calendarInitialDate}
            selectedDate={selectedCalendarDay}
            onSelectDate={(dayKey) => {
              setSelectedCalendarDay((current) => (current === dayKey ? null : dayKey));
              setCalendarPage(1);
            }}
            maxVisiblePerDay={2}
            className="associate-detail-calendar-month"
          />
        </div>
      </SectionSurface>

      <DataTableSurface>
        <TableSectionIntro
          embedded
          title={selectedCalendarDay
            ? tTerm('associateDetails.calendar.dayEvents.title', { date: formatAssociateDate(selectedCalendarDay) })
            : tTerm('associateDetails.calendar.listTitle')}
          description={selectedCalendarDay
            ? tTerm('associateDetails.calendar.dayEvents.description')
            : tTerm('associateDetails.calendar.listDescription')}
          aside={selectedCalendarDay ? (
            <ActionButton
              variant="ghost"
              onClick={() => {
                setSelectedCalendarDay(null);
                setCalendarPage(1);
              }}
            >
              {tTerm('associateDetails.calendar.clearDay')}
            </ActionButton>
          ) : undefined}
        />
        <AppTable variant="operational"
          hasData={visibleCalendarEvents.length > 0}
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
                <tr key={`${event.type}-${event.id ?? 'no-id'}-${event.date}-${event.amount}-${event.notes ?? ''}`}>
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
                invalid={Boolean(installmentPaymentErrors.paymentDate)}
                onValueChange={(v) => {
                  setInstallmentPaymentForm((prev) => ({ ...prev, paymentDate: v }));
                  if (installmentPaymentErrors.paymentDate) {
                    setInstallmentPaymentErrors((prev) => ({ ...prev, paymentDate: '' }));
                  }
                }}
              />
            </FormField>
            <FormField
              label={tTerm('associateDetails.installmentPayment.field.paymentMethod')}
              error={installmentPaymentErrors.paymentMethod}
            >
              <OperationalSelect
                id="associate-detail-payment-method"
                value={installmentPaymentForm.paymentMethod}
                aria-invalid={Boolean(installmentPaymentErrors.paymentMethod)}
                onChange={(event) => {
                  setInstallmentPaymentForm((prev) => ({ ...prev, paymentMethod: event.target.value }));
                  if (installmentPaymentErrors.paymentMethod) {
                    setInstallmentPaymentErrors((prev) => ({ ...prev, paymentMethod: '' }));
                  }
                }}
              >
                {paymentMethodOptions.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </OperationalSelect>
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
