import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Calculator, Filter, Eye, Calendar as CalendarIcon, X, AlertCircle, CheckCircle2, Clock, Download, TrendingUp, DollarSign, Users, AlertTriangle } from 'lucide-react';
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
import { queryKeys } from '../services/queryKeys';
import { dagService } from '../services/dagService';
import { LOAN_STATUS_LABELS } from '../constants/loanStates';
import { getChipClassName, type ChipTone } from '../constants/uiChips';
import { resolveOperationalGuard } from '../services/operationalGuards';
import CreditSimulationWorkspace from './shared/CreditSimulationWorkspace';
import { DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT, useActiveCreditSimulation } from './hooks/useActiveCreditSimulation';

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
}

const getInitialCreditsTab = () => (
  typeof window !== 'undefined' && window.location.hash === '#formulas'
    ? 'formulas'
    : 'list'
);

/**
 * Credits page displays the loan portfolio with filtering, search,
 * calendar view, and simulation capabilities. Provides actions for
 * payment registration, promises, follow-ups, and installment annulment
 * via operational guards that delegate to the backend DAG engine.
 */
export default function Credits({ setCurrentView }: { setCurrentView?: (v: string) => void }) {
  const [activeTab, setActiveTab] = useState(getInitialCreditsTab);
  const [selectedEvent, setSelectedEvent] = useState<InstallmentEvent | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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
  const {
    data: formulasScopesData,
    isLoading: isLoadingWorkbenchAvailability,
    isError: isWorkbenchAvailabilityError,
  } = useQuery({
    queryKey: queryKeys.loans.workbenchScopes,
    queryFn: () => dagService.listScopes(),
    enabled: isAdmin,
    retry: false,
  });
  const isFormulasAvailable = isAdmin && (formulasScopesData?.data?.scopes?.length || 0) > 0;
  const hasResolvedWorkbenchAvailability = !isAdmin || (!isLoadingWorkbenchAvailability && (isFormulasAvailable || isWorkbenchAvailabilityError));

  // Statistics hook
  const { data: statisticsData } = useLoanStatistics({ enabled: isAdmin });

  // Query client for refetching
  const queryClient = useQueryClient();
  const { executeGuardedAction } = useOperationalActions(queryClient);

  useEffect(() => {
    if (hasResolvedWorkbenchAvailability && !isFormulasAvailable && activeTab === 'formulas') {
      setActiveTab('list');
    }
  }, [activeTab, hasResolvedWorkbenchAvailability, isFormulasAvailable]);

  useEffect(() => {
    if (typeof window === 'undefined' || !hasResolvedWorkbenchAvailability) {
      return;
    }

    const nextTab = window.location.hash === '#formulas' && isFormulasAvailable
      ? 'formulas'
      : 'list';

    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
  }, [hasResolvedWorkbenchAvailability, isFormulasAvailable]);

  const updateActiveTab = (nextTab: string) => {
    if (nextTab === 'formulas' && !isFormulasAvailable) {
      setActiveTab('list');
      return;
    }

    setActiveTab(nextTab);

    if (typeof window === 'undefined') {
      return;
    }

    if (nextTab === 'formulas') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#formulas`);
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

  const {
    input: simulationInput,
    result: simulationResult,
    error: simulationError,
    fieldErrors: simulationFieldErrors,
    isSimulating,
    isResultStale,
    setInput: setSimulationInput,
    simulate: runSimulation,
  } = useActiveCreditSimulation({
    initialInput: DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
    autoRun: activeTab === 'simulation',
  });

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

  const { data: rawCalendarEvents, isLoading: isCalendarLoading } = useQuery({
    queryKey: ['credits.calendar.events', calendarLoanIds],
    enabled: activeTab === 'calendar' && calendarLoanIds.length > 0,
    queryFn: async () => {
      const requests = await Promise.allSettled(
        calendarLoanIds.map(async (loanId) => {
          const { data } = await apiClient.get(`/loans/${loanId}/calendar`);
          const entries = Array.isArray(data?.data?.calendar?.entries) ? data.data.calendar.entries : [];
          return {
            loanId,
            entries,
          };
        }),
      );

      return requests
        .filter((request): request is PromiseFulfilledResult<{ loanId: number; entries: any[] }> => request.status === 'fulfilled')
        .map((request) => request.value);
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
    const now = new Date();
    const loansById = new Map(
      creditsList.map((loan: any) => [Number(loan?.id), loan]),
    );

    const events = (rawCalendarEvents ?? []).flatMap(({ loanId, entries }) => {
      const loan: any = loansById.get(loanId);
      let customerName = loan?.Customer?.name || loan?.customerName || '';
      if (customerName) {
        customerName = customerName.replace(/(qa|seed|test|dev)\s*/ig, '').trim();
      }
      const normalizedCustomerName = customerName || (loan?.customerId ? `Cliente #${loan.customerId}` : `Crédito #${loanId}`);
      const totalInstallments = Number(loan?.termMonths) || Number(loan?.totalInstallments) || 0;

      return entries
        .map((entry: any, index: number): InstallmentEvent | null => {
          const dueDate = parseDueDate(entry?.dueDate || entry?.paymentDate || entry?.date);
          if (!dueDate) return null;

          const rawStatus = String(entry?.status || '').toLowerCase();
          const hasLateFee = toNumber(entry?.lateFeeDue ?? entry?.lateFee ?? entry?.arrears) > 0;
          const isPaid = rawStatus === 'paid' || rawStatus === 'settled';
          const isOverdue = !isPaid && (rawStatus === 'overdue' || rawStatus === 'defaulted' || (dueDate.getTime() < now.getTime() && hasLateFee));

          return {
            id: `${loanId}-${entry?.installmentNumber ?? index}`,
            loanId,
            title: `Cuota ${entry?.installmentNumber ?? index + 1}${totalInstallments > 0 ? `/${totalInstallments}` : ''} - ${normalizedCustomerName}`,
            start: dueDate,
            end: new Date(dueDate.getTime() + 60 * 60 * 1000),
            type: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
            clientName: normalizedCustomerName,
            installmentNumber: Number(entry?.installmentNumber) || index + 1,
            totalInstallments: totalInstallments || Number(entry?.totalInstallments) || 0,
            amountToPay: toNumber(entry?.scheduledPayment ?? entry?.amount ?? entry?.paymentAmount),
            interest: toNumber(entry?.interestComponent ?? entry?.interest),
            amortizedCapital: toNumber(entry?.principalComponent ?? entry?.principalPaid),
            remainingCapital: toNumber(entry?.remainingBalance ?? entry?.outstandingPrincipal),
            arrears: toNumber(entry?.lateFeeDue ?? entry?.lateFee ?? entry?.arrears),
          };
        })
        .filter((event): event is InstallmentEvent => event !== null);
    });

    return events.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [creditsList, rawCalendarEvents]);

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

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold">{tTerm('credits.module.title')}</h2>
          <p className="text-sm text-text-secondary mt-1">{tTerm('credits.module.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isAdmin && (
            <button
              onClick={handleExportCreditsExcel}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <Download size={16} /> {isExporting ? 'Exportando...' : tTerm('credits.cta.exportExcel')}
            </button>
          )}
          <button onClick={() => updateActiveTab('simulation')} className="flex items-center justify-center gap-2 rounded-lg border border-border-strong bg-bg-surface px-4 py-2 text-sm font-semibold text-text-primary hover:bg-hover-bg">
            <Calculator size={16} /> Previsualizar crédito
          </button>
          {isAdmin && (
            <button
              onClick={() => setCurrentView?.('credits-new')}
              className="flex items-center justify-center gap-2 rounded-lg bg-text-primary px-4 py-2 text-sm font-semibold text-bg-base hover:opacity-90"
            >
              <Plus size={16} /> {tTerm('credits.cta.new')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 overflow-x-auto border-b border-border-subtle">
        <button
          onClick={() => updateActiveTab('list')}
          className={`whitespace-nowrap pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'list' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          title="Creditos vigentes con saldo o cuotas pendientes"
        >
          Creditos vigentes
        </button>
        <button
          onClick={() => updateActiveTab('calendar')}
          className={`flex items-center gap-2 whitespace-nowrap pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'calendar' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          title="Calendario de cuotas pagadas, pendientes y vencidas"
        >
          <CalendarIcon size={16} /> Calendario
        </button>
        <button
          onClick={() => updateActiveTab('simulation')}
          className={`whitespace-nowrap pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'simulation' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          title="Previsualiza cuota, interes total y cronograma estimado"
        >
          Previsualizar
        </button>
        {isFormulasAvailable && (
          <button
            onClick={() => updateActiveTab('formulas')}
            className={`flex items-center gap-2 whitespace-nowrap pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'formulas' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            title="Editor de la fórmula operativa que gobierna créditos nuevos"
          >
            <Calculator size={16} /> Fórmulas
          </button>
        )}
      </div>

      {activeTab === 'list' && (
        <div className="bg-bg-surface rounded-2xl border border-border-subtle p-4 sm:p-5 flex-1 flex flex-col gap-6 min-w-0">
          {/* Statistics Widget */}
          {statisticsData?.data?.statistics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
                  <span className="rounded-lg bg-blue-100 p-1 text-blue-900 dark:bg-blue-500/20 dark:text-blue-100"><DollarSign size={14} /></span> Total préstamos
                </div>
                <div className="text-2xl font-bold text-text-primary">
                  {formatCurrency(statisticsData.data.statistics.amounts.totalLoanAmount)}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
                  <span className="rounded-lg bg-emerald-100 p-1 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100"><TrendingUp size={14} /></span> Cobrado
                </div>
                <div className="text-2xl font-bold text-text-primary">
                  {formatCurrency(statisticsData.data.statistics.amounts.totalCollected)}
                </div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
                  <span className="rounded-lg bg-amber-100 p-1 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100"><AlertTriangle size={14} /></span> Mora
                </div>
                <div className="text-2xl font-bold text-text-primary">
                  {formatCurrency(statisticsData.data.statistics.amounts.totalOverdue)}
                </div>
              </div>
              <div className="rounded-xl border border-border-subtle bg-white p-4 shadow-sm dark:bg-bg-base">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
                  <span className="rounded-lg bg-hover-bg p-1 text-text-primary"><Users size={14} /></span> Créditos activos
                </div>
                <div className="text-2xl font-bold text-text-primary">
                  {statisticsData.data.statistics.counts.activeCredits} / {statisticsData.data.statistics.counts.totalCredits}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Buscar por cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyFilters();
                    }
                  }}
                  className="w-full rounded-lg border border-border-subtle bg-bg-base py-2 pl-10 pr-4 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-strong"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${showFilters ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30' : 'bg-bg-base border border-border-subtle text-text-secondary hover:text-text-primary'}`}
              >
                <Filter size={16} /> Filtrar
              </button>
            </div>
            <div className="text-sm font-medium text-text-secondary">
              Total: {pagination?.totalItems ?? creditsList.length} créditos
            </div>
          </div>

          {selectedCreditIds.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-base px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-text-secondary">{selectedCreditIds.length} crédito(s) seleccionado(s)</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownloadSelectedReports}
                  className="px-3 py-1 rounded border border-border-subtle hover:bg-hover-bg"
                >
                  Descargar reportes
                </button>
                <button
                  onClick={() => setSelectedCreditIds([])}
                  className="px-3 py-1 rounded border border-border-subtle hover:bg-hover-bg"
                >
                  Limpiar selección
                </button>
              </div>
            </div>
          )}

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-bg-base rounded-xl border border-border-subtle p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Estado</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-strong"
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
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-strong"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Monto Máximo</label>
                  <input
                    type="number"
                    value={filters.maxAmount}
                    onChange={(e) => setFilters({...filters, maxAmount: e.target.value})}
                    placeholder="Sin límite"
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-strong"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-strong"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-border-strong"
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

          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="min-w-[760px] w-full text-left text-sm 2xl:min-w-[1100px]">
              <thead className="border-b border-border-subtle bg-bg-base text-xs uppercase tracking-wide text-text-secondary">
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
                  creditsList.map((credit: any) => {
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
                      <tr key={credit.id} className="hover:bg-hover-bg transition-colors">
                        <td className="px-3 py-4">
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
            <div className="mt-4 flex flex-col gap-3 text-sm text-text-secondary lg:flex-row lg:items-center lg:justify-between">
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
        <div className="bg-bg-surface rounded-2xl p-5 flex-1 flex flex-col min-h-[600px] relative">
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Pagadas
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div> Pendientes
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <div className="w-3 h-3 rounded-full bg-red-500"></div> En Mora
            </div>
          </div>
          <div className="flex-1">
            {isCalendarLoading ? (
              <div className="h-full flex items-center justify-center text-text-secondary">Cargando calendario de créditos...</div>
            ) : (
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              messages={{
                next: "Sig",
                previous: "Ant",
                today: "Hoy",
                month: "Mes",
                week: "Semana",
                day: "Día"
              }}
              culture='es'
              eventPropGetter={eventStyleGetter}
              components={{
                event: CustomEvent
              }}
              onSelectEvent={(event) => setSelectedEvent(event as InstallmentEvent)}
              className="dark:text-text-primary"
            />
            )}
          </div>

          {!isCalendarLoading && calendarEvents.length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-border-subtle bg-bg-base p-4 text-sm text-text-secondary">
              No hay cuotas para mostrar en el calendario con los créditos cargados.
            </div>
          )}

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
                        <span className="text-sm font-medium">Cuota a Pagar</span>
                        <span className="font-bold text-lg">{formatCurrency(selectedEvent.amountToPay)}</span>
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
                  </div>
                </div>

                <div className="p-5 border-t border-border-subtle bg-bg-base flex gap-3">
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="flex-1 px-4 py-2 border border-border-strong rounded-lg text-sm font-medium hover:bg-hover-bg transition-colors"
                  >
                    Cerrar
                  </button>
                  {selectedEvent.type !== 'paid' && (
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

      <div className={activeTab === 'simulation' ? '' : 'hidden'}>
        <CreditSimulationWorkspace
          title="Previsualizar crédito"
          description="Usa la fórmula activa que crea créditos nuevos. Ajusta capital, tasa, plazo y política de mora para revisar cuota, costo financiero y cronograma antes de originar."
          modeLabel="Fórmula activa"
          actionLabel="Calcular"
          input={simulationInput}
          result={simulationResult}
          isSimulating={isSimulating}
          error={simulationError}
          fieldErrors={simulationFieldErrors}
          isResultStale={isResultStale}
          onInputChange={setSimulationInput}
          onSimulate={runSimulation}
          showScenarioTools
          helperText="Esta previsualización ejecuta la fórmula activa en producción. Si editas la fórmula en el Editor, compara aquí contra la versión activa antes de publicar cambios."
          resultBadge={simulationResult?.graphVersionId != null ? `Fórmula v${simulationResult.graphVersionId}` : null}
          emptyTitle="Listo para proyectar un crédito"
          emptyDescription="Completa los parámetros y ejecuta el cálculo para revisar cuota estimada, interés total y cronograma mensual."
        />
      </div>

    </div>
  );
}
