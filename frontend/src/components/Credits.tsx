import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Calculator,
  Filter,
  Eye,
  Calendar as CalendarIcon,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  TrendingUp,
  DollarSign,
  Users,
  AlertTriangle,
  CreditCard,
} from 'lucide-react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../i18n';
import { formatCurrency as formatCurrencyValue, formatDate as formatLocaleDate, formatPercent } from '../i18n/format';
import { useLoans, useLoanStatistics, useSearchLoans } from '../services/loanService';
import { usePaginationStore } from '../store/paginationStore';
import { apiClient } from '../api/client';

import { toast } from '../lib/toast';
import { downloadCreditReport, exportCreditsExcel } from '../services/reportService';
import { useSessionStore } from '../store/sessionStore';
import { useOperationalActions } from './hooks/useOperationalActions';
import { invalidateAfterDelete, invalidateAfterReport } from '../services/operationalInvalidation';
import { tTerm } from '../i18n/terminology';
import { getChipClassName, type ChipTone } from '../constants/uiChips';
import { resolveOperationalGuard } from '../services/operationalGuards';
import {
  ActionButton,
  CheckboxInput,
  DataTableSurface,
  EmptyState,
  FormField,
  IconActionButton,
  InsightStrip,
  ModalShell,
  PageHeader,
  PageShell,
  SectionSurface,
  SelectInput,
  TextInput,
  ToolbarSurface,
  ViewTabs,
} from './shared/Surfaces';
import { ExplainedChip, HelpLabel } from './shared/HelpSupport';

const locales = {
  es,
  en: enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const getLoanStatusTone = (status?: string): ChipTone => {
  switch (String(status || '').toLowerCase()) {
    case 'active':
    case 'approved':
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'overdue':
    case 'defaulted':
    case 'rejected':
      return 'danger';
    case 'closed':
    case 'cancelled':
      return 'neutral';
    default:
      return 'info';
  }
};

const getStatusColumnHelp = () => tTerm('credits.help.statusColumn');
const getRecoveryColumnHelp = () => tTerm('credits.help.recoveryColumn');

type VisiblePortfolioStatistics = {
  totalAmount: number;
  totalCollected: number;
  totalOverdue: number;
  totalCredits: number;
  activeCredits: number;
};

const getLoanStatusDescription = (status?: string) => {
  switch (String(status || '').toLowerCase()) {
    case 'pending':
      return tTerm('credits.status.description.pending');
    case 'approved':
      return tTerm('credits.status.description.approved');
    case 'active':
      return tTerm('credits.status.description.active');
    case 'overdue':
      return tTerm('credits.status.description.overdue');
    case 'defaulted':
      return tTerm('credits.status.description.defaulted');
    case 'paid':
      return tTerm('credits.status.description.paid');
    case 'closed':
      return tTerm('credits.status.description.closed');
    case 'cancelled':
      return tTerm('credits.status.description.cancelled');
    case 'rejected':
      return tTerm('credits.status.description.rejected');
    default:
      return status ? tTerm('credits.status.description.default', { status }) : tTerm('credits.status.description.missing');
  }
};

const getRecoveryStatusDescription = (credit: any) => {
  const normalizedRecoveryStatus = String(credit?.recoveryStatus || '').toLowerCase();
  const normalizedLoanStatus = String(credit?.status || '').toLowerCase();

  if (normalizedRecoveryStatus === 'overdue' || normalizedLoanStatus === 'defaulted') {
    return tTerm('credits.recovery.description.overdue');
  }
  if (normalizedRecoveryStatus === 'pending') {
    return tTerm('credits.recovery.description.pending');
  }
  if (normalizedRecoveryStatus === 'recovered') {
    return tTerm('credits.recovery.description.recovered');
  }
  if (normalizedRecoveryStatus === 'active') {
    return tTerm('credits.recovery.description.active');
  }
  if (normalizedLoanStatus === 'closed' || normalizedLoanStatus === 'paid') {
    return tTerm('credits.recovery.description.closed');
  }
  return tTerm('credits.recovery.description.current');
};

interface InstallmentEvent {
  id: string;
  loanId: number;
  title: string;
  start: Date;
  end: Date;
  type: 'paid' | 'pending' | 'overdue';
  clientName: string;
  installmentNumber: number;
  totalInstallments: number;
  amountToPay: number;
  interest: number;
  amortizedCapital: number;
  remainingCapital: number;
  arrears: number;
  payableAmount: number;
  daysOverdue: number;
  canPay: boolean;
  disabledReason: string | null;
  isNextPayable: boolean;
  status: string;
  loanStatus: string;
}

interface CalendarOverviewSummary {
  totalLoans: number;
  totalEntries: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  dueTodayCount: number;
  actionableCount: number;
  totalPayableAmount: number;
  totalLateFeeAmount: number;
}

interface CalendarOverviewAgendaItem {
  loanId: number;
  customerName: string;
  totalInstallments: number;
  installmentNumber: number;
  dueDate: string;
  status: string;
  payableAmount: number;
  scheduledPayment: number;
  lateFeeDue: number;
  daysOverdue: number;
  canPay: boolean;
  isNextPayable: boolean;
  disabledReason?: string | null;
}

interface CalendarOverviewEntry extends CalendarOverviewAgendaItem {
  loanStatus: string;
  principalComponent: number;
  interestComponent: number;
  remainingBalance: number;
  outstandingAmount: number;
}

interface CalendarOverviewResponse {
  asOfDate: string;
  summary: CalendarOverviewSummary;
  agenda: CalendarOverviewAgendaItem[];
  nextAction: CalendarOverviewAgendaItem | null;
  entries: CalendarOverviewEntry[];
}

/**
 * Credits page displays the loan portfolio with filtering, search,
 * calendar view, and simulation capabilities. Provides actions for
 * payment registration, promises, follow-ups, and installment annulment
 * via operational guards delegated to the backend credit domain.
 */
export default function Credits({ setCurrentView }: { setCurrentView?: (v: string) => void }) {
  const { locale } = useTranslation();
  const [activeTab, setActiveTab] = useState('list');
  const [selectedEvent, setSelectedEvent] = useState<InstallmentEvent | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const calendarAsOfDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const initialCalendarView = useMemo(() => (
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'agenda' : 'month'
  ), []);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCreditIds, setSelectedCreditIds] = useState<number[]>([]);
  const [appliedFilters, setAppliedFilters] = useState({
    status: '',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
    search: '',
  });
  const { user } = useSessionStore();
  const isAdmin = user?.role === 'admin';
  const grantedPermissions = useMemo(
    () => new Set((user?.permissions || []).map((permission: string) => String(permission).toUpperCase())),
    [user?.permissions],
  );
  const canReadPortfolioStatistics = isAdmin
    || grantedPermissions.has('*')
    || grantedPermissions.has('DASHBOARD_VIEW_ALL');
  const searchPlaceholder = isAdmin ? tTerm('credits.search.placeholder.admin') : tTerm('credits.search.placeholder.employee');
  // Statistics hook
  const { data: statisticsData } = useLoanStatistics({ enabled: canReadPortfolioStatistics });

  // Query client for refetching
  const queryClient = useQueryClient();
  const { executeGuardedAction } = useOperationalActions(queryClient);

  const updateActiveTab = (nextTab: string) => {
    setActiveTab(nextTab);

    if (typeof window === 'undefined') {
      return;
    }

    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  };

  const handleExportCreditsExcel = async () => {
    try {
      setIsExporting(true);
      await exportCreditsExcel();
      toast.success({ description: tTerm('credits.toast.export.success') });
    } catch {
      toast.error({ description: tTerm('credits.toast.export.error') });
    } finally {
      setIsExporting(false);
    }
  };

  const { page, setPage, pageSize, setPageSize } = usePaginationStore();

  const hasAppliedServerFilters = Boolean(
    appliedFilters.search
    || appliedFilters.status
    || appliedFilters.minAmount
    || appliedFilters.maxAmount
    || appliedFilters.startDate
    || appliedFilters.endDate
  );

  const parsedSearchFilters = {
    status: appliedFilters.status || undefined,
    minAmount: appliedFilters.minAmount ? Number(appliedFilters.minAmount) : undefined,
    maxAmount: appliedFilters.maxAmount ? Number(appliedFilters.maxAmount) : undefined,
    startDate: appliedFilters.startDate || undefined,
    endDate: appliedFilters.endDate || undefined,
    search: appliedFilters.search || undefined,
  };

  const {
    data: searchedLoansData,
    isLoading: isSearchLoading,
    isError: isSearchError,
  } = useSearchLoans(parsedSearchFilters, page, pageSize);

  const {
    data: defaultLoansData,
    isLoading: isDefaultLoading,
    isError: isDefaultError,
    deleteLoan,
  } = useLoans({
    page,
    pageSize,
  });

  const loansData = hasAppliedServerFilters ? searchedLoansData : defaultLoansData;
  const isLoading = hasAppliedServerFilters ? isSearchLoading : isDefaultLoading;
  const isError = hasAppliedServerFilters ? isSearchError : isDefaultError;

  const applyFilters = () => {
    setAppliedFilters({
      status: filters.status,
      minAmount: filters.minAmount,
      maxAmount: filters.maxAmount,
      startDate: filters.startDate,
      endDate: filters.endDate,
      search: searchQuery.trim(),
    });
    setPage(1);
  };

  useEffect(() => {
    const normalizedSearch = deferredSearchQuery.trim();
    if (appliedFilters.search === normalizedSearch) {
      return;
    }

    setAppliedFilters((current) => ({
      ...current,
      search: normalizedSearch,
    }));
    setPage(1);
  }, [appliedFilters.search, deferredSearchQuery, setPage]);

  const creditsList = Array.isArray(loansData?.data?.loans)
    ? loansData.data.loans
    : Array.isArray(loansData?.data)
      ? loansData.data
      : [];

  useEffect(() => {
    const visibleLoanIds = new Set(
      creditsList
        .map((loan: any) => Number(loan?.id))
        .filter((loanId: number): loanId is number => Number.isFinite(loanId)),
    );

    setSelectedCreditIds((current) => {
      const nextSelection = current.filter((loanId) => visibleLoanIds.has(loanId));
      const didSelectionChange = nextSelection.length !== current.length
        || nextSelection.some((loanId, index) => loanId !== current[index]);

      return didSelectionChange ? nextSelection : current;
    });
  }, [creditsList]);

  const calendarLoanIds = useMemo<number[]>(
    () => creditsList
      .map((loan: any) => Number(loan?.id))
      .filter((loanId: number): loanId is number => Number.isFinite(loanId))
      .slice(0, 25),
    [creditsList],
  );

  const emptyCalendarOverview = useMemo<CalendarOverviewResponse>(() => ({
    asOfDate: calendarAsOfDate,
    summary: {
      totalLoans: 0,
      totalEntries: 0,
      paidCount: 0,
      pendingCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      actionableCount: 0,
      totalPayableAmount: 0,
      totalLateFeeAmount: 0,
    },
    agenda: [],
    nextAction: null,
    entries: [],
  }), [calendarAsOfDate]);

  const { data: calendarOverview = emptyCalendarOverview, isLoading: isCalendarLoading } = useQuery<CalendarOverviewResponse>({
    queryKey: ['credits.calendar.overview', calendarLoanIds, calendarAsOfDate],
    enabled: activeTab === 'calendar' && calendarLoanIds.length > 0,
    queryFn: async () => {
      const { data } = await apiClient.get('/loans/calendar/overview', {
        params: {
          loanIds: calendarLoanIds.join(','),
          asOfDate: calendarAsOfDate,
        },
      });

      return data?.data?.calendar ?? emptyCalendarOverview;
    },
  });

  const handleDeleteCredit = async (credit: any) => {
    await executeGuardedAction({
      action: 'credit.delete',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status },
      confirmationMessage: `¿Eliminar el crédito #${credit?.id} de ${getCreditLabel(credit)}? Esta acción no se puede deshacer.`,
      run: async () => {
        await deleteLoan.mutateAsync(Number(credit.id));
      },
      onSuccess: async () => {
        await invalidateAfterDelete(queryClient, {
          loanId: Number(credit.id),
          loansParams: { page, pageSize },
        });
      },
      successMessage: 'Crédito eliminado correctamente',
    });
  };

  const handleDownloadReport = async (credit: any) => {
    await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status },
      run: async () => {
        await downloadCreditReport(Number(credit.id));
      },
      onSuccess: async () => {
        await invalidateAfterReport(queryClient, { loanId: Number(credit.id), loansParams: { page, pageSize } });
      },
      successMessage: 'Reporte descargado',
    });
  };

  const handleNavigatePayouts = async (credit: any) => {
    await executeGuardedAction({
      action: 'credit.payouts.navigate',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status },
      run: async () => {
        setCurrentView?.('payouts');
      },
    });
  };

  const toggleSelectedCredit = (creditId: number) => {
    setSelectedCreditIds((prev) => {
      if (prev.includes(creditId)) {
        return prev.filter((id) => id !== creditId);
      }
      return [...prev, creditId];
    });
  };

  const handleToggleSelectAllVisible = () => {
    const visibleIds = creditsList.map((credit: any) => Number(credit?.id)).filter((id: number) => Number.isFinite(id));
    const allSelected = visibleIds.length > 0 && visibleIds.every((id: number) => selectedCreditIds.includes(id));
    setSelectedCreditIds(allSelected ? [] : visibleIds);
  };

  const handleDownloadSelectedReports = async () => {
    if (selectedCreditIds.length === 0) return;

    for (const creditId of selectedCreditIds) {
      await executeGuardedAction({
        action: 'credit.report.download',
        context: { role: user?.role, permissions: user?.permissions },
        run: async () => {
          await downloadCreditReport(creditId);
        },
      });
    }

    toast.success({ description: `Se procesaron ${selectedCreditIds.length} reportes seleccionados.` });
  };

   const pagination = loansData?.data?.pagination || loansData?.pagination || loansData?.meta;

  const toNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseDueDate = (value: unknown): Date | null => {
    if (!value) return null;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const calendarEvents = useMemo<InstallmentEvent[]>(() => {
    const events = calendarOverview.entries
      .map((entry, index): InstallmentEvent | null => {
        const dueDate = parseDueDate(entry?.dueDate);
        if (!dueDate) return null;

        const rawStatus = String(entry?.status || '').toLowerCase();
        const isPaid = rawStatus === 'paid' || rawStatus === 'settled';
        const isOverdue = rawStatus === 'overdue' || rawStatus === 'defaulted';

        return {
          id: `${entry.loanId}-${entry.installmentNumber ?? index}`,
          loanId: entry.loanId,
          title: entry.totalInstallments > 0
            ? tTerm('credits.calendar.event.titleOf', {
              number: entry.installmentNumber,
              total: entry.totalInstallments,
              customer: entry.customerName,
            })
            : tTerm('credits.calendar.event.title', {
              number: entry.installmentNumber,
              customer: entry.customerName,
            }),
          start: dueDate,
          end: new Date(dueDate.getTime() + 60 * 60 * 1000),
          type: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
          clientName: entry.customerName,
          installmentNumber: Number(entry.installmentNumber) || index + 1,
          totalInstallments: Number(entry.totalInstallments) || 0,
          amountToPay: toNumber(entry.scheduledPayment),
          interest: toNumber(entry.interestComponent),
          amortizedCapital: toNumber(entry.principalComponent),
          remainingCapital: toNumber(entry.remainingBalance),
          arrears: toNumber(entry.lateFeeDue),
          payableAmount: toNumber(entry.payableAmount),
          daysOverdue: toNumber(entry.daysOverdue),
          canPay: Boolean(entry.canPay),
          disabledReason: entry.disabledReason || null,
          isNextPayable: Boolean(entry.isNextPayable),
          status: rawStatus,
          loanStatus: String(entry.loanStatus || ''),
        };
      })
      .filter((event): event is InstallmentEvent => event !== null);

    return events.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [calendarOverview.entries]);

  const getCreditLabel = (credit: any) => {
    let name = credit?.Customer?.name || credit?.customerName || '';
    if (name) {
      name = name.replace(/(qa|seed|test|dev)\s*/ig, '').trim();
    }
    return name || (credit?.customerId ? tTerm('credits.label.customerFallback', { id: credit.customerId }) : tTerm('credits.label.customerMissing'));
  };

  const getLoanStatusLabel = (status: string) => {
    const normalizedStatus = String(status || '').toLowerCase();
    if (normalizedStatus === 'active') return tTerm('common.status.active');
    if (normalizedStatus === 'pending') return tTerm('schedule.status.pending');
    if (normalizedStatus === 'approved') return tTerm('credits.status.approved');
    if (normalizedStatus === 'overdue') return tTerm('schedule.status.overdue');
    if (normalizedStatus === 'defaulted') return tTerm('credits.status.defaulted');
    if (normalizedStatus === 'paid') return tTerm('schedule.status.paid');
    if (normalizedStatus === 'closed') return tTerm('common.status.closed');
    if (normalizedStatus === 'cancelled') return tTerm('credits.status.cancelled');
    if (normalizedStatus === 'rejected') return tTerm('credits.status.rejected');
    return status;
  };

  const getRecoveryStatusLabel = (credit: any) => {
    if (credit?.recoveryStatus === 'overdue' || credit?.status === 'defaulted') return tTerm('credits.recovery.overdue');
    if (credit?.recoveryStatus === 'pending') return tTerm('credits.recovery.pending');
    if (credit?.recoveryStatus === 'recovered') return tTerm('credits.recovery.recovered');
    if (credit?.recoveryStatus === 'active') return tTerm('credits.recovery.active');
    if (credit?.recoveryStatus) return credit.recoveryStatus;
    return tTerm('credits.recovery.current');
  };

  const eventStyleGetter = (event: InstallmentEvent) => {
    let backgroundColor = '#3b82f6'; // pending (blue)
    if (event.type === 'paid') backgroundColor = '#10b981'; // emerald
    if (event.type === 'overdue') backgroundColor = '#ef4444'; // red

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        padding: '2px 4px',
        fontSize: '0.75rem',
        fontWeight: 500
      }
    };
  };

  const formatCurrency = (value: number) => {
    return formatCurrencyValue(value);
  };

  const getCalendarStatusLabel = (status: string) => {
    switch (String(status || '').toLowerCase()) {
      case 'paid':
        return tTerm('credits.modal.status.paid');
      case 'overdue':
        return tTerm('credits.modal.status.overdue');
      case 'partial':
        return tTerm('credits.calendar.status.partial');
      case 'annulled':
        return tTerm('schedule.status.annulled');
      default:
        return tTerm('schedule.status.pending');
    }
  };

  const getCalendarStatusTone = (status: string): ChipTone => {
    switch (String(status || '').toLowerCase()) {
      case 'paid':
        return 'success';
      case 'overdue':
        return 'danger';
      case 'partial':
        return 'warning';
      case 'annulled':
        return 'neutral';
      default:
        return 'info';
    }
  };

  const calendarSummaryItems = useMemo(() => [
    {
      id: 'actionable',
      label: tTerm('credits.stats.calendar.actionable.label'),
      value: String(calendarOverview.summary.actionableCount),
      helper: calendarOverview.summary.actionableCount === 1
        ? tTerm('credits.stats.calendar.actionable.helper.one')
        : tTerm('credits.stats.calendar.actionable.helper.other', { count: calendarOverview.summary.actionableCount }),
      accent: 'blue' as const,
      icon: <DollarSign aria-hidden="true" />,
    },
    {
      id: 'overdue',
      label: tTerm('credits.stats.calendar.overdue.label'),
      value: String(calendarOverview.summary.overdueCount),
      helper: calendarOverview.summary.overdueCount === 1
        ? tTerm('credits.stats.calendar.overdue.helper.one')
        : tTerm('credits.stats.calendar.overdue.helper.other', { count: calendarOverview.summary.overdueCount }),
      accent: 'rose' as const,
      icon: <AlertTriangle aria-hidden="true" />,
    },
    {
      id: 'due-today',
      label: tTerm('credits.stats.calendar.dueToday.label'),
      value: String(calendarOverview.summary.dueTodayCount),
      helper: calendarOverview.summary.dueTodayCount === 1
        ? tTerm('credits.stats.calendar.dueToday.helper.one')
        : tTerm('credits.stats.calendar.dueToday.helper.other', { count: calendarOverview.summary.dueTodayCount }),
      accent: 'teal' as const,
      icon: <CalendarIcon aria-hidden="true" />,
    },
    {
      id: 'amount',
      label: tTerm('credits.stats.calendar.amount.label'),
      value: formatCurrency(calendarOverview.summary.totalPayableAmount),
      helper: calendarOverview.summary.totalLateFeeAmount > 0
        ? tTerm('credits.stats.calendar.amount.helper.withLateFee', { amount: formatCurrency(calendarOverview.summary.totalLateFeeAmount) })
        : tTerm('credits.stats.calendar.amount.helper.withoutLateFee'),
      accent: 'amber' as const,
      icon: <TrendingUp aria-hidden="true" />,
    },
  ], [
    calendarOverview.summary.actionableCount,
    calendarOverview.summary.dueTodayCount,
    calendarOverview.summary.overdueCount,
    calendarOverview.summary.totalLateFeeAmount,
    calendarOverview.summary.totalPayableAmount,
    locale,
  ]);
  const visiblePortfolioStatistics = useMemo(() => {
    return (creditsList as any[]).reduce<VisiblePortfolioStatistics>((totals, credit: any) => {
      const amount = Number(credit?.amount ?? credit?.loanAmount ?? credit?.principal ?? 0);
      const principalOutstanding = Number(credit?.principalOutstanding ?? credit?.outstandingPrincipal ?? credit?.balance ?? 0);
      const totalOutstanding = Number(credit?.outstandingBalance ?? credit?.remainingBalance ?? principalOutstanding ?? 0);
      const overdue = Number(credit?.overdueAmount ?? credit?.lateFeeOutstanding ?? 0);
      const status = String(credit?.status || '').toLowerCase();

      totals.totalAmount += Number.isFinite(amount) ? amount : 0;
      totals.totalCollected += Math.max(0, (Number.isFinite(amount) ? amount : 0) - (Number.isFinite(totalOutstanding) ? totalOutstanding : 0));
      totals.totalOverdue += Number.isFinite(overdue) ? overdue : 0;
      totals.totalCredits += 1;
      if (['active', 'approved', 'pending', 'overdue'].includes(status)) {
        totals.activeCredits += 1;
      }
      return totals;
    }, {
      totalAmount: 0,
      totalCollected: 0,
      totalOverdue: 0,
      totalCredits: 0,
      activeCredits: 0,
    });
  }, [creditsList]);
  const statistics = statisticsData?.data?.statistics ?? null;
  const statisticsAmounts = statistics?.amounts ?? {};
  const statisticsCounts = statistics?.counts ?? {};
  const displayedStatistics = canReadPortfolioStatistics && statistics
    ? {
      totalAmount: Number(statisticsAmounts.totalLoanAmount ?? statistics.totalDisbursed ?? 0),
      totalCollected: Number(statisticsAmounts.totalCollected ?? statistics.totalRecovered ?? 0),
      totalOverdue: Number(statisticsAmounts.totalOverdue ?? statistics.overdueAmount ?? 0),
      activeCredits: Number(statisticsCounts.activeCredits ?? statistics.totalActiveLoans ?? 0),
      totalCredits: Number(statisticsCounts.totalCredits ?? statistics.totalLoans ?? 0),
      helper: tTerm('credits.stats.portfolio.globalHelper'),
    }
    : {
      ...visiblePortfolioStatistics,
      helper: tTerm('credits.stats.portfolio.visibleHelper'),
    };
  const calendarMessages = useMemo(() => ({
    next: tTerm('credits.calendar.nav.next'),
    previous: tTerm('credits.calendar.nav.previous'),
    today: tTerm('credits.calendar.nav.today'),
    month: tTerm('credits.calendar.nav.month'),
    week: tTerm('credits.calendar.nav.week'),
    day: tTerm('credits.calendar.nav.day'),
    agenda: tTerm('credits.calendar.nav.agenda'),
    date: tTerm('credits.calendar.nav.date'),
    time: tTerm('credits.calendar.nav.time'),
    event: tTerm('credits.calendar.nav.event'),
  }), [locale]);

  return (
    <PageShell data-tour="credits-page" className="h-full">
      <PageHeader
        title={<span data-tour="credits-page-title">{tTerm('credits.module.title')}</span>}
        subtitle={tTerm('credits.module.subtitle')}
        guideKey="credits"
        tourId="credits-header"
        actions={(
          <>
          {isAdmin && (
            <ActionButton
              onClick={handleExportCreditsExcel}
              disabled={isExporting}
              data-tour="credits-export"
              icon={<Download size={16} />}
            >
              {isExporting ? tTerm('credits.cta.exporting') : tTerm('credits.cta.exportExcel')}
            </ActionButton>
          )}
          {isAdmin && (
            <ActionButton
              onClick={() => setCurrentView?.('credit-calculator')}
              data-tour="credits-preview"
              icon={<Calculator size={16} />}
            >
              {tTerm('credits.cta.preview')}
            </ActionButton>
          )}
          {isAdmin && (
            <ActionButton
              onClick={() => setCurrentView?.('credits-new')}
              data-tour="credits-new"
              variant="primary"
              icon={<Plus size={16} />}
            >
              {tTerm('credits.cta.new')}
            </ActionButton>
          )}
          </>
        )}
      />

      <ViewTabs
        data-tour="credits-tabs"
        activeTab={activeTab}
        onChange={updateActiveTab}
        tabs={[
          {
            id: 'list',
            label: tTerm('credits.tab.list.label'),
            title: tTerm('credits.tab.list.title'),
            icon: CreditCard,
          },
          {
            id: 'calendar',
            label: tTerm('credits.tab.calendar.label'),
            title: tTerm('credits.tab.calendar.title'),
            icon: CalendarIcon,
          },
        ]}
      />

      {activeTab === 'list' && (
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* Statistics Widget */}
          {creditsList.length > 0 && (
            <InsightStrip
              aria-label={displayedStatistics.helper}
              items={[
                {
                  id: 'capital-total',
                  label: tTerm('credits.stats.portfolio.totalCapital.label'),
                  value: formatCurrency(displayedStatistics.totalAmount),
                  helper: tTerm('credits.stats.portfolio.totalCapital.helper'),
                  icon: <DollarSign size={18} />,
                  accent: 'blue',
                },
                {
                  id: 'total-cobrado',
                  label: tTerm('credits.stats.portfolio.totalCollected.label'),
                  value: formatCurrency(displayedStatistics.totalCollected),
                  helper: tTerm('credits.stats.portfolio.totalCollected.helper'),
                  icon: <TrendingUp size={18} />,
                  accent: 'emerald',
                },
                {
                  id: 'mora-pendiente',
                  label: tTerm('credits.stats.portfolio.totalOverdue.label'),
                  value: formatCurrency(displayedStatistics.totalOverdue),
                  helper: tTerm('credits.stats.portfolio.totalOverdue.helper'),
                  icon: <AlertTriangle size={18} />,
                  accent: displayedStatistics.totalOverdue > 0 ? 'amber' : 'slate',
                },
                {
                  id: 'creditos-activos',
                  label: tTerm('credits.stats.portfolio.activeCredits.label'),
                  value: `${displayedStatistics.activeCredits} / ${displayedStatistics.totalCredits}`,
                  helper: tTerm('credits.stats.portfolio.activeCredits.helper'),
                  icon: <Users size={18} />,
                  accent: 'slate',
                },
              ]}
            />
          )}

          <ToolbarSurface>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <TextInput
                  type="text"
                  data-tour="credits-search"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyFilters();
                    }
                  }}
                  className="pl-10"
                />
              </div>
              <ActionButton
                onClick={() => setShowFilters(!showFilters)}
                data-tour="credits-filters"
                variant={showFilters ? 'primary' : 'secondary'}
                icon={<Filter size={16} />}
              >
                {tTerm('credits.filter.toggle')}
              </ActionButton>
            </div>
            <div className="text-sm font-medium text-text-secondary">
              {tTerm('credits.summary.total', { count: pagination?.totalItems ?? creditsList.length })}
            </div>
          </ToolbarSurface>

          {selectedCreditIds.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-500/30 dark:bg-blue-500/10 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-text-secondary">
                {selectedCreditIds.length === 1
                  ? tTerm('credits.bulk.selected.one', { count: selectedCreditIds.length })
                  : tTerm('credits.bulk.selected.other', { count: selectedCreditIds.length })}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton
                  onClick={handleDownloadSelectedReports}
                  className="!min-h-0 !px-3 !py-1.5"
                >
                  {tTerm('credits.bulk.downloadReports')}
                </ActionButton>
                <ActionButton
                  onClick={() => setSelectedCreditIds([])}
                  className="!min-h-0 !px-3 !py-1.5"
                >
                  {tTerm('credits.bulk.clearSelection')}
                </ActionButton>
              </div>
            </div>
          )}

          {/* Filter Panel */}
          {showFilters && (
            <SectionSurface bodyClassName="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <FormField label={tTerm('credits.filter.status')}>
                  <SelectInput
                    id="credits-filter-status"
                    value={filters.status}
                    onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="">{tTerm('credits.filter.all')}</option>
                    <option value="active">{tTerm('common.status.active')}</option>
                    <option value="pending">{tTerm('schedule.status.pending')}</option>
                    <option value="approved">{tTerm('credits.status.approved')}</option>
                    <option value="overdue">{tTerm('schedule.status.overdue')}</option>
                    <option value="defaulted">{tTerm('credits.status.defaulted')}</option>
                    <option value="paid">{tTerm('schedule.status.paid')}</option>
                    <option value="closed">{tTerm('common.status.closed')}</option>
                    <option value="cancelled">{tTerm('credits.status.cancelled')}</option>
                  </SelectInput>
                </FormField>
                <FormField label={tTerm('credits.filter.minAmount')}>
                  <TextInput
                    id="credits-filter-min-amount"
                    type="number"
                    value={filters.minAmount}
                    onChange={(e) => setFilters((prev) => ({ ...prev, minAmount: e.target.value }))}
                    placeholder="0"
                  />
                </FormField>
                <FormField label={tTerm('credits.filter.maxAmount')}>
                  <TextInput
                    id="credits-filter-max-amount"
                    type="number"
                    value={filters.maxAmount}
                    onChange={(e) => setFilters((prev) => ({ ...prev, maxAmount: e.target.value }))}
                    placeholder={tTerm('credits.filter.noLimit')}
                  />
                </FormField>
                <FormField label={tTerm('credits.filter.startDate')}>
                  <TextInput
                    id="credits-filter-start-date"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </FormField>
                <FormField label={tTerm('credits.filter.endDate')}>
                  <TextInput
                    id="credits-filter-end-date"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </FormField>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <ActionButton
                  onClick={() => {
                    setFilters({ status: '', minAmount: '', maxAmount: '', startDate: '', endDate: '' });
                    setSearchQuery('');
                    setAppliedFilters({ status: '', minAmount: '', maxAmount: '', startDate: '', endDate: '', search: '' });
                    setPage(1);
                  }}
                  variant="ghost"
                >
                  {tTerm('credits.filter.clear')}
                </ActionButton>
                <ActionButton
                  onClick={applyFilters}
                  variant="primary"
                >
                  {tTerm('credits.filter.apply')}
                </ActionButton>
              </div>
            </SectionSurface>
          )}

          <div className="space-y-3 md:hidden">
            {isLoading ? (
              <EmptyState title={tTerm('credits.empty.loading')} compact />
            ) : isError ? (
              <EmptyState title={tTerm('credits.empty.error')} compact />
            ) : creditsList.length === 0 ? (
              <EmptyState title={tTerm('credits.empty.none')} compact />
            ) : (
              creditsList.map((credit: any) => {
                const principalOutstanding = Number(credit.principalOutstanding) || 0;
                const interestOutstanding = Number(credit.interestOutstanding) || 0;
                const outstandingAmount = principalOutstanding + interestOutstanding;
                const viewGuard = resolveOperationalGuard('credit.view', { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status });

                return (
                  <article key={`mobile-credit-${credit.id}`} className="rounded-xl border border-border-subtle bg-white px-4 py-4 shadow-sm dark:bg-bg-surface">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary">{getCreditLabel(credit)}</p>
                        <p className="mt-1 text-xs text-text-secondary">{tTerm('credits.card.number', { id: credit.id })}</p>
                      </div>
                      <ExplainedChip
                        label={getLoanStatusLabel(credit.status)}
                        description={getLoanStatusDescription(credit.status)}
                        className={`inline-flex rounded-md px-2 py-1 text-xs ${getChipClassName(getLoanStatusTone(credit.status))}`}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('credits.card.capital')}</p>
                        <p className="mt-1 font-semibold text-text-primary">{formatCurrency(credit.amount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('credits.card.installment')}</p>
                        <p className="mt-1 font-semibold text-text-primary">{credit.installmentAmount ? formatCurrency(credit.installmentAmount) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('credits.card.balance')}</p>
                        <p className="mt-1 font-semibold text-text-primary">{outstandingAmount > 0 ? formatCurrency(outstandingAmount) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                          <HelpLabel label={tTerm('credits.table.recovery')} text={getRecoveryColumnHelp()} />
                        </p>
                        <div className="mt-1">
                          <ExplainedChip
                            label={getRecoveryStatusLabel(credit)}
                            description={getRecoveryStatusDescription(credit)}
                            className={`inline-flex rounded-md px-2 py-1 text-xs ${getChipClassName(
                              credit.recoveryStatus === 'overdue' || credit.status === 'defaulted' ? 'danger' : 'success',
                            )}`}
                          />
                        </div>
                      </div>
                    </div>

                    {viewGuard.visible && (
                      <ActionButton
                        type="button"
                        onClick={() => setCurrentView?.(`credits/${credit.id}`)}
                        disabled={!viewGuard.executable}
                        className="mt-4"
                        fullWidth
                        icon={<Eye size={16} />}
                        title={viewGuard.executable ? tTerm('credits.card.open') : (viewGuard.reason || tTerm('credits.action.unavailable'))}
                      >
                        {tTerm('credits.card.viewDetail')}
                      </ActionButton>
                    )}
                  </article>
                );
              })
            )}
          </div>

          <DataTableSurface className="hidden md:block">
            <table data-tour="credits-list-table" className="min-w-[760px] w-full text-left text-sm 2xl:min-w-[1100px]">
              <thead className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="w-10 px-3 py-3 font-semibold">
                    <CheckboxInput
                      type="checkbox"
                      aria-label={tTerm('credits.table.selectAllVisible')}
                      checked={creditsList.length > 0 && creditsList.every((credit: any) => selectedCreditIds.includes(Number(credit?.id)))}
                      onChange={handleToggleSelectAllVisible}
                    />
                  </th>
                  <th className="hidden px-3 py-3 font-semibold 2xl:table-cell">{tTerm('credits.table.id')}</th>
                  <th className="min-w-[150px] px-3 py-3 font-semibold">{tTerm('credits.table.customer')}</th>
                  <th className="px-3 py-3 text-right font-semibold">{tTerm('credits.table.capital')}</th>
                  <th className="hidden px-3 py-3 text-right font-semibold 2xl:table-cell">{tTerm('credits.table.rate')}</th>
                  <th className="px-3 py-3 text-right font-semibold">{tTerm('credits.table.installment')}</th>
                  <th className="px-3 py-3 text-right font-semibold">{tTerm('credits.table.balance')}</th>
                  <th className="hidden px-3 py-3 text-right font-semibold 2xl:table-cell">{tTerm('credits.table.delinquency')}</th>
                  <th className="px-3 py-3 font-semibold">
                    <HelpLabel label={tTerm('credits.filter.status')} text={getStatusColumnHelp()} />
                  </th>
                  <th className="px-3 py-3 font-semibold">
                    <HelpLabel label={tTerm('credits.table.recovery')} text={getRecoveryColumnHelp()} />
                  </th>
                  <th className="hidden px-3 py-3 font-semibold 2xl:table-cell">{tTerm('credits.table.start')}</th>
                  <th className="px-3 py-3 text-right font-semibold">{tTerm('credits.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {isLoading ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-text-secondary">{tTerm('credits.table.loading')}</td></tr>
                ) : isError ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-red-600">{tTerm('credits.table.error')}</td></tr>
                ) : creditsList.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-text-secondary">{tTerm('credits.table.none')}</td></tr>
                ) : (
                  creditsList.map((credit: any, index: number) => {
                    // Calculate outstanding amount (principalOutstanding + interestOutstanding)
                    const principalOutstanding = Number(credit.principalOutstanding) || 0;
                    const interestOutstanding = Number(credit.interestOutstanding) || 0;
                    const outstandingAmount = principalOutstanding + interestOutstanding;

                    // Calculate delinquency percentage based on status
                    const isDelinquent = credit.status === 'defaulted' || credit.status === 'overdue' || credit.recoveryStatus === 'overdue';
                    const totalAmount = Number(credit.amount) || 0;
                    const delinquencyPercentage = totalAmount > 0 && isDelinquent
                      ? (outstandingAmount / totalAmount) * 100
                      : 0;

                    // Format creation date
                    const creationDate = credit.createdAt
                      ? formatLocaleDate(credit.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : '-';

                    return (
                      <tr key={credit.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-hover-bg/60">
                        <td className="px-3 py-4" {...(index === 0 ? { 'data-tour': 'credits-row-actions' } : {})}>
                          <CheckboxInput
                            type="checkbox"
                            aria-label={tTerm('credits.table.selectOne', { id: credit.id })}
                            checked={selectedCreditIds.includes(Number(credit.id))}
                            onChange={() => toggleSelectedCredit(Number(credit.id))}
                          />
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-4 font-mono text-text-secondary 2xl:table-cell">{String(credit.id).substring(0, 8)}</td>
                        <td className="px-3 py-4 font-medium text-text-primary">
                          <span className="block max-w-[180px] truncate" title={getCreditLabel(credit)}>
                            {getCreditLabel(credit)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-right font-medium text-text-primary">{formatCurrency(credit.amount)}</td>
                        <td className="hidden whitespace-nowrap px-3 py-4 text-right text-text-secondary 2xl:table-cell">
                          {credit.interestRate ? formatPercent(credit.interestRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-right text-text-secondary">
                          {credit.installmentAmount ? formatCurrency(credit.installmentAmount) : '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-right">
                          {outstandingAmount > 0 ? (
                            <span className={isDelinquent ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                              {formatCurrency(outstandingAmount)}
                            </span>
                          ) : (
                            <span className="text-text-secondary">-</span>
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-4 text-right 2xl:table-cell">
                          {delinquencyPercentage > 0 ? (
                            <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
                              delinquencyPercentage > 50
                                ? 'border border-red-200 bg-red-100 text-red-900 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-200'
                                : delinquencyPercentage > 25
                                  ? 'border border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200'
                                  : 'border border-yellow-200 bg-yellow-100 text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-500/20 dark:text-yellow-200'
                            }`}>
                              {formatPercent(delinquencyPercentage, { minimumFractionDigits: delinquencyPercentage > 0 ? 1 : 0, maximumFractionDigits: 1 })}
                            </span>
                          ) : (
                            <span className="text-text-secondary">{formatPercent(0)}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4">
                          <ExplainedChip
                            label={getLoanStatusLabel(credit.status)}
                            description={getLoanStatusDescription(credit.status)}
                            className={`inline-flex rounded-md px-2 py-1 text-xs ${getChipClassName(getLoanStatusTone(credit.status))}`}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-4">
                          <ExplainedChip
                            label={getRecoveryStatusLabel(credit)}
                            description={getRecoveryStatusDescription(credit)}
                            className={`inline-flex rounded-md px-2 py-1 text-xs ${getChipClassName(
                              credit.recoveryStatus === 'overdue' || credit.status === 'defaulted' ? 'danger' : 'success',
                            )}`}
                          />
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-4 text-xs text-text-secondary 2xl:table-cell">{creationDate}</td>
                        <td className="px-3 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {(() => {
                              const viewGuard = resolveOperationalGuard('credit.view', { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status });
                              const paymentGuard = resolveOperationalGuard('installment.pay', { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status });
                              const promiseGuard = resolveOperationalGuard('installment.promise', { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status });
                              const followUpGuard = resolveOperationalGuard('installment.followUp', { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status });
                              const annulGuard = resolveOperationalGuard('installment.annul', { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status });

                              const getActionTitle = (guard: { executable: boolean; reason?: string }, actionKey: string) => {
                                if (!guard.executable) return guard.reason || tTerm('credits.action.unavailable' as any);
                                const keyMap: Record<string, any> = {
                                  'credit.view': 'credits.action.viewDetails',
                                  'installment.pay': 'credits.action.registerPayment',
                                  'installment.promise': 'credits.action.createPromise',
                                  'installment.followUp': 'credits.action.createFollowUp',
                                  'installment.annul': 'credits.action.annulInstallment',
                                };
                                return tTerm(keyMap[actionKey] as any);
                              };

                              return (
                                <>
                                  {viewGuard.visible && (
                                    <IconActionButton
                                      onClick={() => setCurrentView?.(`credits/${credit.id}`)}
                                      disabled={!viewGuard.executable}
                                      label={getActionTitle(viewGuard, 'credit.view')}
                                      icon={<Eye size={16} />}
                                    />
                                  )}
                                  {paymentGuard.visible && (
                                    <IconActionButton
                                      onClick={() => setCurrentView?.(`credits/${credit.id}`)}
                                      disabled={!paymentGuard.executable}
                                      label={getActionTitle(paymentGuard, 'installment.pay')}
                                      icon={<DollarSign size={16} />}
                                    />
                                  )}
                                  {promiseGuard.visible && (
                                    <IconActionButton
                                      onClick={() => setCurrentView?.(`credits/${credit.id}`)}
                                      disabled={!promiseGuard.executable}
                                      label={getActionTitle(promiseGuard, 'installment.promise')}
                                      icon={<Clock size={16} />}
                                    />
                                  )}
                                  {followUpGuard.visible && (
                                    <IconActionButton
                                      onClick={() => setCurrentView?.(`credits/${credit.id}`)}
                                      disabled={!followUpGuard.executable}
                                      label={getActionTitle(followUpGuard, 'installment.followUp')}
                                      icon={<CalendarIcon size={16} />}
                                    />
                                  )}
                                  {annulGuard.visible && (
                                    <IconActionButton
                                      onClick={() => setCurrentView?.(`credits/${credit.id}`)}
                                      disabled={!annulGuard.executable}
                                      label={getActionTitle(annulGuard, 'installment.annul')}
                                      icon={<X size={16} />}
                                      variant="danger"
                                    />
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </DataTableSurface>

          {/* Pagination Controls */}
          {loansData && (
            <div className="flex flex-col gap-3 rounded-xl bg-white px-4 py-3 text-sm text-text-secondary shadow-sm ring-1 ring-border-subtle dark:bg-bg-surface lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                {tTerm('credits.pagination.summary', {
                  from: ((page - 1) * pageSize) + 1,
                  to: Math.min(page * pageSize, pagination?.totalItems ?? pagination?.total ?? 0),
                  total: pagination?.totalItems ?? pagination?.total ?? 0,
                })}
                <label className="flex items-center gap-2">
                  <span>{tTerm('credits.pagination.rowsPerPage')}</span>
                  <SelectInput
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                    className="!min-h-0 !py-1"
                  >
                    {[10, 25, 50, 100].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </SelectInput>
                </label>
              </div>
              <div className="flex gap-2">
                <ActionButton
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="!min-h-0 !px-3 !py-1"
                >
                  {tTerm('credits.pagination.previous')}
                </ActionButton>
                <ActionButton
                  disabled={page === (pagination?.totalPages || 1)}
                  onClick={() => setPage(page + 1)}
                  className="!min-h-0 !px-3 !py-1"
                >
                  {tTerm('credits.pagination.next')}
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="relative flex flex-1 flex-col gap-4 min-w-0">
          <SectionSurface
            className="min-h-[660px]"
            title={tTerm('credits.calendar.title')}
            subtitle={tTerm('credits.calendar.subtitle')}
            actions={(
              <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-slate-400 dark:bg-slate-500" />
                  {tTerm('credits.calendar.legend.paid')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-blue-500" />
                  {tTerm('credits.calendar.legend.pending')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-red-500" />
                  {tTerm('credits.calendar.legend.overdue')}
                </div>
              </div>
            )}
          >
            {isCalendarLoading ? (
              <div className="flex h-full min-h-[560px] items-center justify-center text-text-secondary">
                {tTerm('credits.calendar.loading')}
              </div>
            ) : (
              <Calendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                defaultView={initialCalendarView}
                style={{ height: 620 }}
                messages={calendarMessages}
                culture={locale}
                eventPropGetter={eventStyleGetter}
                components={{
                  event: ({ event }: { event: InstallmentEvent }) => (
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 text-left focus:outline-none focus:ring-2 focus:ring-white/80"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        setSelectedEvent(event);
                      }}
                    >
                      <span className="truncate font-semibold">{event.title}</span>
                      <span className="truncate opacity-90">{formatCurrency(event.amountToPay)}</span>
                      {event.arrears > 0 && (
                        <span className="truncate font-bold text-red-100">
                          {tTerm('credits.calendar.event.lateFee', { amount: formatCurrency(event.arrears) })}
                        </span>
                      )}
                    </button>
                  ),
                }}
                onSelectEvent={(event) => setSelectedEvent(event as InstallmentEvent)}
                className="dark:text-text-primary"
              />
            )}

            {!isCalendarLoading && calendarEvents.length === 0 && (
              <div className="mt-4 rounded-xl border border-dashed border-border-subtle bg-bg-base p-4 text-sm text-text-secondary">
                {tTerm('credits.calendar.empty')}
              </div>
            )}
          </SectionSurface>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <SectionSurface>
                <div>
                  <h4 className="text-base font-semibold text-text-primary">{tTerm('credits.agenda.title')}</h4>
                  <p className="mt-1 text-sm text-text-secondary">
                    {tTerm('credits.agenda.subtitle')}
                  </p>
                </div>
                <InsightStrip items={calendarSummaryItems} className="calendar-summary-strip mt-4" />
              </SectionSurface>

              <SectionSurface as="section">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-text-primary">{tTerm('credits.agenda.nextAction')}</h4>
                    <p className="mt-1 text-sm text-text-secondary">
                      {tTerm('credits.agenda.subtitle')}
                    </p>
                  </div>
                  <span className="rounded-full bg-bg-base px-3 py-1 text-xs font-semibold text-text-secondary">
                    {tTerm('credits.agenda.count', { count: calendarOverview.agenda.length })}
                  </span>
                </div>

                {calendarOverview.nextAction && (
                  <div className="mt-4 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">{tTerm('credits.agenda.nextAction')}</div>
                    <div className="mt-2 text-base font-semibold text-text-primary">{calendarOverview.nextAction.customerName}</div>
                    <p className="mt-1 text-sm text-text-secondary">
                      {calendarOverview.nextAction.totalInstallments > 0
                        ? tTerm('credits.agenda.installmentOf', {
                          number: calendarOverview.nextAction.installmentNumber,
                          total: calendarOverview.nextAction.totalInstallments,
                        })
                        : tTerm('credits.agenda.installment', { number: calendarOverview.nextAction.installmentNumber })}
                      {' · '}
                      {formatLocaleDate(parseDueDate(calendarOverview.nextAction.dueDate) || new Date(), { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                    </p>
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {calendarOverview.agenda.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-base p-4 text-sm text-text-secondary">
                      {tTerm('credits.agenda.empty')}
                    </div>
                  )}

                  {calendarOverview.agenda.map((item) => (
                    <div key={`${item.loanId}-${item.installmentNumber}`} className="rounded-2xl border border-border-subtle bg-bg-base p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-text-primary">{item.customerName}</div>
                          <div className="mt-1 text-sm text-text-secondary">
                            {item.totalInstallments > 0
                              ? tTerm('credits.agenda.loanInstallmentOf', {
                                loanId: item.loanId,
                                number: item.installmentNumber,
                                total: item.totalInstallments,
                              })
                              : tTerm('credits.agenda.loanInstallment', { loanId: item.loanId, number: item.installmentNumber })}
                          </div>
                        </div>
                        <span className={getChipClassName(getCalendarStatusTone(item.status))}>
                          {getCalendarStatusLabel(item.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{tTerm('credits.agenda.dueDate')}</div>
                          <div className="mt-1 text-sm font-medium text-text-primary">
                            {formatLocaleDate(parseDueDate(item.dueDate) || new Date(), { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                          </div>
                          {item.daysOverdue > 0 && (
                            <div className="mt-1 text-sm font-medium text-rose-600">{tTerm('credits.agenda.daysOverdue', { count: item.daysOverdue })}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{tTerm('credits.agenda.suggestedCollection')}</div>
                          <div className="mt-1 text-sm font-semibold text-text-primary">{formatCurrency(item.payableAmount)}</div>
                          {item.lateFeeDue > 0 && (
                            <div className="mt-1 text-sm text-amber-700">{tTerm('credits.agenda.includesLateFee', { amount: formatCurrency(item.lateFeeDue) })}</div>
                          )}
                        </div>
                      </div>

                      {item.disabledReason && !item.canPay && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          {item.disabledReason}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <ActionButton
                          type="button"
                          onClick={() => setCurrentView?.(`credits/${item.loanId}`)}
                        >
                          {tTerm('credits.action.viewLoan')}
                        </ActionButton>
                        {item.canPay && (
                          <ActionButton
                            type="button"
                            onClick={() => setCurrentView?.(`credits/${item.loanId}`)}
                            variant="primary"
                          >
                            {tTerm('creditDetails.cta.recordPayment')}
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionSurface>
          </div>

          {/* Modal de Detalles del Evento */}
          {selectedEvent && (
            <ModalShell
              title={tTerm('credits.modal.title')}
              subtitle={selectedEvent.clientName}
              footer={(
                <>
                  <ActionButton onClick={() => setSelectedEvent(null)} fullWidth>
                    {tTerm('credits.modal.close')}
                  </ActionButton>
                  {selectedEvent.type !== 'paid' && selectedEvent.canPay && (
                    <ActionButton
                      onClick={() => {
                        setSelectedEvent(null);
                        setCurrentView?.(`credits/${selectedEvent.loanId}`);
                      }}
                      variant="primary"
                      fullWidth
                    >
                      {tTerm('creditDetails.cta.recordPayment')}
                    </ActionButton>
                  )}
                </>
              )}
            >
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`p-3 rounded-full ${
                      selectedEvent.type === 'paid' ? 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300' :
                      selectedEvent.type === 'overdue' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
                      'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                    }`}>
                      {selectedEvent.type === 'paid' ? <CheckCircle2 size={24} /> :
                       selectedEvent.type === 'overdue' ? <AlertCircle size={24} /> :
                       <Clock size={24} />}
                    </div>
                    <div>
                      <div className="text-sm text-text-secondary">{tTerm('credits.modal.status')}</div>
                      <div className="font-semibold text-lg">
                        {selectedEvent.type === 'paid' ? tTerm('credits.modal.status.paid') :
                         selectedEvent.type === 'overdue' ? tTerm('credits.modal.status.overdue') : tTerm('credits.modal.status.pending')}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-bg-base p-3 rounded-xl border border-border-subtle">
                        <div className="text-xs text-text-secondary mb-1">{tTerm('credits.modal.installmentNumber')}</div>
                        <div className="font-semibold">{tTerm('credits.modal.installmentOf', { number: selectedEvent.installmentNumber, total: selectedEvent.totalInstallments })}</div>
                      </div>
                      <div className="bg-bg-base p-3 rounded-xl border border-border-subtle">
                        <div className="text-xs text-text-secondary mb-1">{tTerm('credits.modal.dueDate')}</div>
                        <div className="font-semibold">{formatLocaleDate(selectedEvent.start, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</div>
                      </div>
                    </div>

                    <div className="bg-bg-base rounded-xl border border-border-subtle overflow-hidden">
                      <div className="p-3 border-b border-border-subtle flex justify-between items-center bg-hover-bg/50">
                        <span className="text-sm font-medium">{tTerm('credits.modal.suggestedCollection')}</span>
                        <span className="font-bold text-lg">{formatCurrency(selectedEvent.payableAmount || selectedEvent.amountToPay)}</span>
                      </div>
                      <div className="p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">{tTerm('credits.modal.interest')}</span>
                          <span>{formatCurrency(selectedEvent.interest)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">{tTerm('credits.modal.amortizedPrincipal')}</span>
                          <span>{formatCurrency(selectedEvent.amortizedCapital)}</span>
                        </div>
                        {selectedEvent.arrears > 0 && (
                          <div className="flex justify-between text-red-600 dark:text-red-400 font-medium pt-2 border-t border-border-subtle mt-2">
                            <span>{tTerm('credits.modal.accumulatedLateFee')}</span>
                            <span>{formatCurrency(selectedEvent.arrears)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-bg-base p-3 rounded-xl border border-border-subtle flex justify-between items-center">
                      <span className="text-sm font-medium text-text-secondary">{tTerm('credits.modal.remainingPrincipal')}</span>
                      <span className="font-semibold">{formatCurrency(selectedEvent.remainingCapital)}</span>
                    </div>

                    {selectedEvent.disabledReason && !selectedEvent.canPay && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {selectedEvent.disabledReason}
                      </div>
                    )}
                  </div>
                </div>
            </ModalShell>
          )}
        </div>
      )}

    </PageShell>
  );
}
