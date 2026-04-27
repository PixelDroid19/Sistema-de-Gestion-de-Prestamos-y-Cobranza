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
  CircleHelp,
} from 'lucide-react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLoans, useLoanStatistics, useSearchLoans } from '../services/loanService';
import { usePaginationStore } from '../store/paginationStore';
import { apiClient } from '../api/client';

import { toast } from '../lib/toast';
import { downloadCreditReport, exportCreditsExcel } from '../services/reportService';
import { useSessionStore } from '../store/sessionStore';
import { useOperationalActions } from './hooks/useOperationalActions';
import { invalidateAfterDelete, invalidateAfterReport } from '../services/operationalInvalidation';
import { tTerm } from '../i18n/terminology';
import { LOAN_STATUS_LABELS } from '../constants/loanStates';
import { getChipClassName, type ChipTone } from '../constants/uiChips';
import { resolveOperationalGuard } from '../services/operationalGuards';
import { startCreditsTour } from '../lib/creditGuidedTours';

const locales = {
  'es': es,
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
 * via operational guards that delegate to the backend DAG engine.
 */
export default function Credits({ setCurrentView }: { setCurrentView?: (v: string) => void }) {
  const [activeTab, setActiveTab] = useState('list');
  const [selectedEvent, setSelectedEvent] = useState<InstallmentEvent | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const calendarAsOfDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
  // Statistics hook
  const { data: statisticsData } = useLoanStatistics({ enabled: isAdmin });

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
          title: `Cuota ${entry.installmentNumber}${entry.totalInstallments > 0 ? `/${entry.totalInstallments}` : ''} - ${entry.customerName}`,
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
    return name || (credit?.customerId ? `Cliente #${credit.customerId}` : 'Sin cliente');
  };

  const getLoanStatusLabel = (status: string) => {
    return LOAN_STATUS_LABELS[status as keyof typeof LOAN_STATUS_LABELS] || status;
  };

  const getRecoveryStatusLabel = (credit: any) => {
    if (credit?.recoveryStatus === 'overdue' || credit?.status === 'defaulted') return 'En Mora';
    if (credit?.recoveryStatus === 'pending') return 'En Curso';
    if (credit?.recoveryStatus === 'recovered') return 'Recuperado';
    if (credit?.recoveryStatus === 'active') return 'Activo';
    if (credit?.recoveryStatus) return credit.recoveryStatus;
    return 'Al Día';
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

  const CustomEvent = ({ event }: { event: InstallmentEvent }) => (
    <div className="flex flex-col gap-0.5">
      <span className="font-semibold truncate">{event.title}</span>
      <span className="truncate opacity-90">
        ${event.amountToPay.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
      </span>
      {event.arrears > 0 && (
        <span className="truncate font-bold text-red-100">
          + Mora: ${event.arrears.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
        </span>
      )}
    </div>
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getCalendarStatusLabel = (status: string) => {
    switch (String(status || '').toLowerCase()) {
      case 'paid':
        return 'Pagada';
      case 'overdue':
        return 'En mora';
      case 'partial':
        return 'Parcial';
      case 'annulled':
        return 'Anulada';
      default:
        return 'Pendiente';
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

  const calendarSummaryCards = [
    {
      label: 'Cobros accionables',
      value: String(calendarOverview.summary.actionableCount),
      helper: calendarOverview.summary.actionableCount === 1 ? '1 crédito listo para gestión' : `${calendarOverview.summary.actionableCount} créditos listos para gestión`,
      tone: 'border-emerald-200 bg-emerald-50/70',
      icon: DollarSign,
    },
    {
      label: 'En mora',
      value: String(calendarOverview.summary.overdueCount),
      helper: calendarOverview.summary.overdueCount === 1 ? '1 cuota con atraso' : `${calendarOverview.summary.overdueCount} cuotas con atraso`,
      tone: 'border-rose-200 bg-rose-50/70',
      icon: AlertTriangle,
    },
    {
      label: 'Vencen hoy',
      value: String(calendarOverview.summary.dueTodayCount),
      helper: calendarOverview.summary.dueTodayCount === 1 ? '1 cuota vence hoy' : `${calendarOverview.summary.dueTodayCount} cuotas vencen hoy`,
      tone: 'border-blue-200 bg-blue-50/70',
      icon: CalendarIcon,
    },
    {
      label: 'Monto a cobrar',
      value: formatCurrency(calendarOverview.summary.totalPayableAmount),
      helper: calendarOverview.summary.totalLateFeeAmount > 0
        ? `Incluye ${formatCurrency(calendarOverview.summary.totalLateFeeAmount)} de mora`
        : 'Sin mora acumulada en las cuotas visibles',
      tone: 'border-amber-200 bg-amber-50/70',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="flex h-full flex-col gap-6" data-tour="credits-page">
      <section className="shrink-0 border-b border-border-subtle pb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary" data-tour="credits-page-title">
              {tTerm('credits.module.title')}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">{tTerm('credits.module.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => startCreditsTour()}
            className="flex items-center justify-center gap-2 rounded-lg border border-border-subtle bg-white px-3.5 py-2 text-sm font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary dark:bg-bg-base"
          >
            <CircleHelp size={16} /> Guía rápida
          </button>
          {isAdmin && (
            <button
              onClick={handleExportCreditsExcel}
              disabled={isExporting}
              data-tour="credits-export"
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <Download size={16} /> {isExporting ? 'Exportando...' : tTerm('credits.cta.exportExcel')}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setCurrentView?.('credit-calculator')}
              data-tour="credits-preview"
              className="flex items-center justify-center gap-2 rounded-lg border border-border-strong bg-white px-3.5 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-hover-bg dark:bg-bg-base"
            >
              <Calculator size={16} /> Previsualizar crédito
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setCurrentView?.('credits-new')}
              data-tour="credits-new"
              className="flex items-center justify-center gap-2 rounded-lg bg-text-primary px-4 py-2 text-sm font-semibold text-bg-base hover:opacity-90"
            >
              <Plus size={16} /> {tTerm('credits.cta.new')}
            </button>
          )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="border-b border-border-subtle" data-tour="credits-tabs">
        <div className="flex gap-6 overflow-x-auto">
          {[
            {
              id: 'list',
              label: 'Créditos vigentes',
              title: 'Créditos con saldo o cuotas pendientes',
              icon: CreditCard,
            },
            {
              id: 'calendar',
              label: 'Calendario',
              title: 'Calendario de cuotas pagadas, pendientes y vencidas',
              icon: CalendarIcon,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => updateActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
                title={tab.title}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* Statistics Widget */}
          {statisticsData?.data?.statistics && (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border-subtle border-l-4 border-l-blue-500 bg-white px-4 py-4 shadow-sm dark:bg-bg-surface">
                  <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                    <DollarSign size={14} className="text-blue-600" /> Total préstamos
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    {formatCurrency(statisticsData.data.statistics.amounts.totalLoanAmount)}
                  </div>
                </div>
                <div className="rounded-xl border border-border-subtle border-l-4 border-l-emerald-500 bg-white px-4 py-4 shadow-sm dark:bg-bg-surface">
                  <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                    <TrendingUp size={14} className="text-emerald-600" /> Cobrado
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    {formatCurrency(statisticsData.data.statistics.amounts.totalCollected)}
                  </div>
                </div>
                <div className="rounded-xl border border-border-subtle border-l-4 border-l-amber-500 bg-white px-4 py-4 shadow-sm dark:bg-bg-surface">
                  <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                    <AlertTriangle size={14} className="text-amber-600" /> Mora
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    {formatCurrency(statisticsData.data.statistics.amounts.totalOverdue)}
                  </div>
                </div>
                <div className="rounded-xl border border-border-subtle border-l-4 border-l-teal-600 bg-white px-4 py-4 shadow-sm dark:bg-bg-surface">
                  <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                    <Users size={14} className="text-brand-primary" /> Créditos activos
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    {statisticsData.data.statistics.counts.activeCredits} / {statisticsData.data.statistics.counts.totalCredits}
                  </div>
                </div>
            </section>
          )}

          <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-white p-3 shadow-sm dark:bg-bg-surface lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  data-tour="credits-search"
                  placeholder="Buscar por cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyFilters();
                    }
                  }}
                  className="w-full rounded-lg border border-border-subtle bg-white py-2 pl-10 pr-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 dark:bg-bg-base"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                data-tour="credits-filters"
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${showFilters ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-200' : 'border-border-subtle bg-white text-text-secondary hover:border-border-strong hover:text-text-primary dark:bg-bg-base'}`}
              >
                <Filter size={16} /> Filtrar
              </button>
            </div>
            <div className="text-sm font-medium text-text-secondary">
              Total: {pagination?.totalItems ?? creditsList.length} créditos
            </div>
          </div>

          {selectedCreditIds.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-500/30 dark:bg-blue-500/10 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-text-secondary">{selectedCreditIds.length} crédito(s) seleccionado(s)</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownloadSelectedReports}
                  className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:bg-bg-base dark:text-blue-200"
                >
                  Descargar reportes
                </button>
                <button
                  onClick={() => setSelectedCreditIds([])}
                  className="rounded-lg border border-border-subtle bg-white px-3 py-1.5 font-semibold hover:bg-hover-bg dark:bg-bg-base"
                >
                  Limpiar selección
                </button>
              </div>
            </div>
          )}

          {/* Filter Panel */}
          {showFilters && (
            <div className="rounded-xl border border-border-subtle bg-white p-4 shadow-sm dark:bg-bg-surface">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Estado</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 dark:bg-bg-base"
                  >
                    <option value="">Todos</option>
                    <option value="active">Activo</option>
                    <option value="pending">Pendiente</option>
                    <option value="approved">Aprobado</option>
                    <option value="overdue">Vencido</option>
                    <option value="defaulted">En Mora</option>
                    <option value="paid">Pagado</option>
                    <option value="closed">Cerrado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Monto Mínimo</label>
                  <input
                    type="number"
                    value={filters.minAmount}
                    onChange={(e) => setFilters({...filters, minAmount: e.target.value})}
                    placeholder="0"
                    className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 dark:bg-bg-base"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Monto Máximo</label>
                  <input
                    type="number"
                    value={filters.maxAmount}
                    onChange={(e) => setFilters({...filters, maxAmount: e.target.value})}
                    placeholder="Sin límite"
                    className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 dark:bg-bg-base"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                    className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 dark:bg-bg-base"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                    className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 dark:bg-bg-base"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setFilters({ status: '', minAmount: '', maxAmount: '', startDate: '', endDate: '' });
                    setSearchQuery('');
                    setAppliedFilters({ status: '', minAmount: '', maxAmount: '', startDate: '', endDate: '', search: '' });
                    setPage(1);
                  }}
                  className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
                >
                  Limpiar
                </button>
                <button
                  onClick={applyFilters}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3 md:hidden">
            {isLoading ? (
              <div className="rounded-xl border border-border-subtle bg-white py-8 text-center text-sm text-text-secondary dark:bg-bg-surface">Cargando créditos...</div>
            ) : isError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 py-8 text-center text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">Error al cargar créditos.</div>
            ) : creditsList.length === 0 ? (
              <div className="rounded-xl border border-border-subtle bg-white py-8 text-center text-sm text-text-secondary dark:bg-bg-surface">No hay créditos registrados.</div>
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
                        <p className="mt-1 text-xs text-text-secondary">Crédito #{credit.id}</p>
                      </div>
                      <span className={`shrink-0 rounded-md px-2 py-1 text-xs ${getChipClassName(getLoanStatusTone(credit.status))}`}>
                        {getLoanStatusLabel(credit.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Capital</p>
                        <p className="mt-1 font-semibold text-text-primary">{formatCurrency(credit.amount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Cuota</p>
                        <p className="mt-1 font-semibold text-text-primary">{credit.installmentAmount ? formatCurrency(credit.installmentAmount) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Saldo</p>
                        <p className="mt-1 font-semibold text-text-primary">{outstandingAmount > 0 ? formatCurrency(outstandingAmount) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Situación</p>
                        <span className={`mt-1 inline-flex rounded-md px-2 py-1 text-xs ${credit.recoveryStatus === 'overdue' || credit.status === 'defaulted' ? getChipClassName('danger') : getChipClassName('success')}`}>
                          {getRecoveryStatusLabel(credit)}
                        </span>
                      </div>
                    </div>

                    {viewGuard.visible && (
                      <button
                        type="button"
                        onClick={() => setCurrentView?.(`credits/${credit.id}`)}
                        disabled={!viewGuard.executable}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-white px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50 dark:bg-bg-base"
                        title={viewGuard.executable ? 'Abrir crédito' : (viewGuard.reason || 'Acción no disponible')}
                      >
                        <Eye size={16} /> Ver detalle
                      </button>
                    )}
                  </article>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-border-subtle bg-white shadow-sm dark:bg-bg-surface md:block">
            <table data-tour="credits-list-table" className="min-w-[760px] w-full text-left text-sm 2xl:min-w-[1100px]">
              <thead className="border-b border-border-subtle bg-slate-50 text-xs uppercase tracking-wide text-text-secondary dark:bg-bg-base">
                <tr>
                  <th className="w-10 px-3 py-3 font-semibold">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos los créditos visibles"
                      checked={creditsList.length > 0 && creditsList.every((credit: any) => selectedCreditIds.includes(Number(credit?.id)))}
                      onChange={handleToggleSelectAllVisible}
                    />
                  </th>
                  <th className="hidden px-3 py-3 font-semibold 2xl:table-cell">ID</th>
                  <th className="min-w-[150px] px-3 py-3 font-semibold">Cliente</th>
                  <th className="px-3 py-3 text-right font-semibold">Capital</th>
                  <th className="hidden px-3 py-3 text-right font-semibold 2xl:table-cell">Tasa</th>
                  <th className="px-3 py-3 text-right font-semibold">Cuota</th>
                  <th className="px-3 py-3 text-right font-semibold">Saldo</th>
                  <th className="hidden px-3 py-3 text-right font-semibold 2xl:table-cell">Mora</th>
                  <th className="px-3 py-3 font-semibold">Estado</th>
                  <th className="px-3 py-3 font-semibold">Situación</th>
                  <th className="hidden px-3 py-3 font-semibold 2xl:table-cell">Inicio</th>
                  <th className="px-3 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {isLoading ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-text-secondary">Cargando créditos...</td></tr>
                ) : isError ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-red-600">Error al cargar créditos.</td></tr>
                ) : creditsList.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-text-secondary">No hay créditos registrados.</td></tr>
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
                      ? format(new Date(credit.createdAt), "dd/MM/yyyy", { locale: es })
                      : '-';

                    return (
                      <tr key={credit.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-hover-bg/60">
                        <td className="px-3 py-4" {...(index === 0 ? { 'data-tour': 'credits-row-actions' } : {})}>
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar crédito ${credit.id}`}
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
                          {credit.interestRate ? `${Number(credit.interestRate).toFixed(2)}%` : '-'}
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
                              {delinquencyPercentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-text-secondary">0%</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4">
                          <span className={`inline-flex rounded-md px-2 py-1 text-xs ${getChipClassName(getLoanStatusTone(credit.status))}`}>
                            {getLoanStatusLabel(credit.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4">
                            <span className={`inline-flex rounded-md px-2 py-1 text-xs ${credit.recoveryStatus === 'overdue' || credit.status === 'defaulted' ? getChipClassName('danger') : getChipClassName('success')}`}>
                             {getRecoveryStatusLabel(credit)}
                            </span>
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
                                    <button
                                      onClick={() => setCurrentView?.(`credits/${credit.id}`)}
                                      disabled={!viewGuard.executable}
                                      className="p-1.5 text-text-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={getActionTitle(viewGuard, 'credit.view')}
                                    >
                                      <Eye size={16} />
                                    </button>
                                  )}
                                  {paymentGuard.visible && (
                                    <button
                                      onClick={() => setCurrentView?.(`credits/${credit.id}`)}
                                      disabled={!paymentGuard.executable}
                                      className="p-1.5 text-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={getActionTitle(paymentGuard, 'installment.pay')}
                                    >
                                      <DollarSign size={16} />
                                    </button>
                                  )}
                                  {promiseGuard.visible && (
                                    <button
                                      onClick={() => setCurrentView?.(`credits/${credit.id}`)}
                                      disabled={!promiseGuard.executable}
                                      className="p-1.5 text-text-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={getActionTitle(promiseGuard, 'installment.promise')}
                                    >
                                      <Clock size={16} />
                                    </button>
                                  )}
                                  {followUpGuard.visible && (
                                    <button
                                      onClick={() => setCurrentView?.(`credits/${credit.id}`)}
                                      disabled={!followUpGuard.executable}
                                      className="p-1.5 text-text-secondary hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={getActionTitle(followUpGuard, 'installment.followUp')}
                                    >
                                      <CalendarIcon size={16} />
                                    </button>
                                  )}
                                  {annulGuard.visible && (
                                    <button
                                      onClick={() => setCurrentView?.(`credits/${credit.id}`)}
                                      disabled={!annulGuard.executable}
                                      className="p-1.5 text-text-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={getActionTitle(annulGuard, 'installment.annul')}
                                    >
                                      <X size={16} />
                                    </button>
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
          </div>

          {/* Pagination Controls */}
          {loansData && (
            <div className="flex flex-col gap-3 rounded-xl bg-white px-4 py-3 text-sm text-text-secondary shadow-sm ring-1 ring-border-subtle dark:bg-bg-surface lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, pagination?.totalItems ?? pagination?.total ?? 0)} de {pagination?.totalItems ?? pagination?.total ?? 0} créditos
                <label className="flex items-center gap-2">
                  <span>Filas por página</span>
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                    className="bg-bg-base border border-border-subtle rounded px-2 py-1 text-text-primary"
                  >
                    {[10, 25, 50, 100].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 border border-border-subtle rounded hover:bg-hover-bg disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  disabled={page === (pagination?.totalPages || 1)}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 border border-border-subtle rounded hover:bg-hover-bg disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="relative flex flex-1 flex-col gap-5 min-w-0">
          <section className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <h3 className="text-lg font-semibold text-text-primary">Agenda operativa</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Úsala para ver qué cuotas debes cobrar hoy, qué créditos están en mora y cuál es la siguiente gestión sugerida por crédito.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  Pagadas
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  Pendientes
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  En mora
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {calendarSummaryCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className={`rounded-2xl border p-4 ${card.tone}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{card.label}</span>
                      <span className="rounded-xl bg-white/80 p-2 text-text-primary shadow-sm">
                        <Icon size={16} aria-hidden="true" />
                      </span>
                    </div>
                    <div className="mt-4 text-2xl font-semibold text-text-primary">{card.value}</div>
                    <p className="mt-1 text-sm text-text-secondary">{card.helper}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid flex-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
            <section className="rounded-2xl border border-border-subtle bg-bg-surface p-4 sm:p-5 min-h-[640px]">
              {isCalendarLoading ? (
                <div className="flex h-full min-h-[520px] items-center justify-center text-text-secondary">
                  Cargando calendario de créditos...
                </div>
              ) : (
                <Calendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: '100%' }}
                  messages={{
                    next: 'Sig',
                    previous: 'Ant',
                    today: 'Hoy',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Día',
                    agenda: 'Agenda',
                  }}
                  culture="es"
                  eventPropGetter={eventStyleGetter}
                  components={{
                    event: CustomEvent,
                  }}
                  onSelectEvent={(event) => setSelectedEvent(event as InstallmentEvent)}
                  className="dark:text-text-primary"
                />
              )}

              {!isCalendarLoading && calendarEvents.length === 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-border-subtle bg-bg-base p-4 text-sm text-text-secondary">
                  No hay cuotas para mostrar con los créditos visibles en esta página.
                </div>
              )}
            </section>

            <aside className="rounded-2xl border border-border-subtle bg-bg-surface p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-text-primary">Próximas acciones</h4>
                  <p className="mt-1 text-sm text-text-secondary">
                    Una fila por crédito. Si está lista para pago, entra directo al detalle operativo.
                  </p>
                </div>
                <span className="rounded-full bg-bg-base px-3 py-1 text-xs font-semibold text-text-secondary">
                  {calendarOverview.agenda.length} créditos
                </span>
              </div>

              {calendarOverview.nextAction && (
                <div className="mt-4 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">Siguiente acción sugerida</div>
                  <div className="mt-2 text-base font-semibold text-text-primary">{calendarOverview.nextAction.customerName}</div>
                  <p className="mt-1 text-sm text-text-secondary">
                    Cuota {calendarOverview.nextAction.installmentNumber}
                    {calendarOverview.nextAction.totalInstallments > 0 ? ` de ${calendarOverview.nextAction.totalInstallments}` : ''}
                    {' · '}
                    {format(parseDueDate(calendarOverview.nextAction.dueDate) || new Date(), "d 'de' MMM", { locale: es })}
                  </p>
                </div>
              )}

              <div className="mt-4 space-y-3">
                {calendarOverview.agenda.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-base p-4 text-sm text-text-secondary">
                    No hay cobros accionables con los créditos visibles en esta página.
                  </div>
                )}

                {calendarOverview.agenda.map((item) => (
                  <div key={`${item.loanId}-${item.installmentNumber}`} className="rounded-2xl border border-border-subtle bg-bg-base p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-text-primary">{item.customerName}</div>
                        <div className="mt-1 text-sm text-text-secondary">
                          Crédito #{item.loanId} · Cuota {item.installmentNumber}
                          {item.totalInstallments > 0 ? ` de ${item.totalInstallments}` : ''}
                        </div>
                      </div>
                      <span className={getChipClassName(getCalendarStatusTone(item.status))}>
                        {getCalendarStatusLabel(item.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Vencimiento</div>
                        <div className="mt-1 text-sm font-medium text-text-primary">
                          {format(parseDueDate(item.dueDate) || new Date(), "d 'de' MMMM", { locale: es })}
                        </div>
                        {item.daysOverdue > 0 && (
                          <div className="mt-1 text-sm font-medium text-rose-600">{item.daysOverdue} días de atraso</div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Cobro sugerido</div>
                        <div className="mt-1 text-sm font-semibold text-text-primary">{formatCurrency(item.payableAmount)}</div>
                        {item.lateFeeDue > 0 && (
                          <div className="mt-1 text-sm text-amber-700">Incluye mora por {formatCurrency(item.lateFeeDue)}</div>
                        )}
                      </div>
                    </div>

                    {item.disabledReason && !item.canPay && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {item.disabledReason}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentView?.(`credits/${item.loanId}`)}
                        className="rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm font-semibold text-text-primary hover:bg-hover-bg"
                      >
                        Ver crédito
                      </button>
                      {item.canPay && (
                        <button
                          type="button"
                          onClick={() => setCurrentView?.(`credits/${item.loanId}`)}
                          className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                        >
                          Registrar pago
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          {/* Modal de Detalles del Evento */}
          {selectedEvent && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl p-4">
              <div className="bg-bg-surface w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border-subtle flex flex-col">
                <div className="p-5 border-b border-border-subtle flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">Detalle de Cuota</h3>
                    <p className="text-sm text-text-secondary">{selectedEvent.clientName}</p>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-5 flex-1 overflow-y-auto">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`p-3 rounded-full ${
                      selectedEvent.type === 'paid' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' :
                      selectedEvent.type === 'overdue' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
                      'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                    }`}>
                      {selectedEvent.type === 'paid' ? <CheckCircle2 size={24} /> :
                       selectedEvent.type === 'overdue' ? <AlertCircle size={24} /> :
                       <Clock size={24} />}
                    </div>
                    <div>
                      <div className="text-sm text-text-secondary">Estado</div>
                      <div className="font-semibold text-lg">
                        {selectedEvent.type === 'paid' ? 'Pagada' :
                         selectedEvent.type === 'overdue' ? 'En Mora' : 'Pendiente'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-bg-base p-3 rounded-xl border border-border-subtle">
                        <div className="text-xs text-text-secondary mb-1">Número de Cuota</div>
                        <div className="font-semibold">{selectedEvent.installmentNumber} de {selectedEvent.totalInstallments}</div>
                      </div>
                      <div className="bg-bg-base p-3 rounded-xl border border-border-subtle">
                        <div className="text-xs text-text-secondary mb-1">Fecha de Vencimiento</div>
                        <div className="font-semibold">{format(selectedEvent.start, "d 'de' MMMM, yyyy", { locale: es })}</div>
                      </div>
                    </div>

                    <div className="bg-bg-base rounded-xl border border-border-subtle overflow-hidden">
                      <div className="p-3 border-b border-border-subtle flex justify-between items-center bg-hover-bg/50">
                        <span className="text-sm font-medium">Cobro sugerido</span>
                        <span className="font-bold text-lg">{formatCurrency(selectedEvent.payableAmount || selectedEvent.amountToPay)}</span>
                      </div>
                      <div className="p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Interés</span>
                          <span>{formatCurrency(selectedEvent.interest)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Capital Amortizado</span>
                          <span>{formatCurrency(selectedEvent.amortizedCapital)}</span>
                        </div>
                        {selectedEvent.arrears > 0 && (
                          <div className="flex justify-between text-red-600 dark:text-red-400 font-medium pt-2 border-t border-border-subtle mt-2">
                            <span>Mora Acumulada</span>
                            <span>{formatCurrency(selectedEvent.arrears)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-bg-base p-3 rounded-xl border border-border-subtle flex justify-between items-center">
                      <span className="text-sm font-medium text-text-secondary">Capital Vivo (Restante)</span>
                      <span className="font-semibold">{formatCurrency(selectedEvent.remainingCapital)}</span>
                    </div>

                    {selectedEvent.disabledReason && !selectedEvent.canPay && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {selectedEvent.disabledReason}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 border-t border-border-subtle bg-bg-base flex gap-3">
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="flex-1 px-4 py-2 border border-border-strong rounded-lg text-sm font-medium hover:bg-hover-bg transition-colors"
                  >
                    Cerrar
                  </button>
                  {selectedEvent.type !== 'paid' && selectedEvent.canPay && (
                    <button
                      onClick={() => {
                        setSelectedEvent(null);
                        setCurrentView?.(`credits/${selectedEvent.loanId}`);
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Registrar Pago
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
