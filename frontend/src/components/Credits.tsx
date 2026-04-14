import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Plus, Search, MoreVertical, Calculator, Filter, Eye, Edit, Trash2, Calendar as CalendarIcon, X, AlertCircle, CheckCircle2, Clock, FileText, Check, Download, TrendingUp, DollarSign, Users, AlertTriangle, Save } from 'lucide-react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLoans, useLoanStatistics, useSearchLoans } from '../services/loanService';
import { usePaginationStore } from '../store/paginationStore';
import { apiClient } from '../api/client';
import { SimulationResult } from '../types/simulation';
import DAGWorkbench from './DAGWorkbench';
import { toast } from '../lib/toast';
import { downloadCreditReport, exportCreditsExcel } from '../services/reportService';
import { useSessionStore } from '../store/sessionStore';
import { useOperationalActions } from './hooks/useOperationalActions';
import { invalidateAfterDelete, invalidateAfterReport } from '../services/operationalInvalidation';
import { tTerm } from '../i18n/terminology';
import { queryKeys } from '../services/queryKeys';
import { LOAN_STATUS_LABELS } from '../constants/loanStates';
import { getChipClassName } from '../constants/uiChips';
import { resolveOperationalGuard } from '../services/operationalGuards';

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
  typeof window !== 'undefined' && window.location.hash === '#workbench'
    ? 'workbench'
    : 'list'
);

// Función para obtener simulación del backend
const fetchSimulation = async (params: {
  amount: number;
  interestRate: number;
  termMonths: number;
}): Promise<SimulationResult> => {
  const { data } = await apiClient.post('/loans/simulations', params);
  return data.data.simulation;
};

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

  // Statistics hook
  const { data: statisticsData } = useLoanStatistics({ enabled: isAdmin });

  // Query client for refetching
  const queryClient = useQueryClient();
  const { executeGuardedAction } = useOperationalActions(queryClient);

  useEffect(() => {
    if (!isAdmin && activeTab === 'workbench') {
      setActiveTab('list');
    }
  }, [activeTab, isAdmin]);

  const updateActiveTab = (nextTab: string) => {
    if (nextTab === 'workbench' && !isAdmin) {
      setActiveTab('list');
      return;
    }

    setActiveTab(nextTab);

    if (typeof window === 'undefined') {
      return;
    }

    if (nextTab === 'workbench') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#workbench`);
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

  // Simulator states
  const [simParams, setSimParams] = useState({
    principal: 2000000,
    tna: 60,
    installments: 12
  });

  // Saved scenarios for comparison
  const [savedScenarios, setSavedScenarios] = useState<Array<{
    id: string;
    name: string;
    params: typeof simParams;
    results: typeof simResults;
    createdAt: Date;
  }>>([]);

  const [scenarioComparison, setScenarioComparison] = useState(false);
  const [scenarioName, setScenarioName] = useState('');

  const handleSaveScenario = () => {
    if (!simResults) return;
    const newScenario = {
      id: Date.now().toString(),
      name: scenarioName || `Escenario ${savedScenarios.length + 1}`,
      params: { ...simParams },
      results: simResults,
      createdAt: new Date(),
    };
    setSavedScenarios(prev => [...prev.slice(-2), newScenario]); // Keep max 3 scenarios
    setScenarioName('');
    toast.success({ description: 'Escenario guardado para comparación' });
  };

  const handleDeleteScenario = (id: string) => {
    setSavedScenarios(prev => prev.filter(s => s.id !== id));
  };

  // Transformar parámetros al formato que espera el API
  const apiParams = {
    amount: simParams.principal,
    interestRate: simParams.tna,
    termMonths: simParams.installments
  };

  // Simulator: obtener datos del backend
  const { data: simulationData, isLoading: isSimulating } = useQuery({
    queryKey: queryKeys.loans.simulation(apiParams),
    queryFn: () => fetchSimulation(apiParams),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Transformar respuesta del API al formato que usa la UI
  const simResults = simulationData ? {
    pmt: simulationData.summary.installmentAmount,
    totalInterest: simulationData.summary.totalInterest,
    totalPayment: simulationData.summary.totalPayable,
    profitPerMonth: simulationData.summary.totalInterest / Math.max(simParams.installments, 1),
    schedule: simulationData.schedule.map((row) => ({
      step: row.installmentNumber,
      pmt: row.scheduledPayment,
      interest: row.interestComponent,
      principalPayment: row.principalComponent,
      balance: row.remainingBalance
    }))
  } : null;

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
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">{tTerm('credits.module.title')}</h2>
          <p className="text-sm text-text-secondary mt-1">{tTerm('credits.module.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <button 
              onClick={handleExportCreditsExcel}
              disabled={isExporting}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              <Download size={16} /> {isExporting ? 'Exportando...' : tTerm('credits.cta.exportExcel')}
            </button>
          )}
          <button onClick={() => updateActiveTab('simulation')} className="flex items-center gap-2 bg-bg-surface border border-border-strong text-text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-hover-bg">
            <Calculator size={16} /> {tTerm('credits.cta.simulate')}
          </button>
          {isAdmin && (
            <button 
              onClick={() => setCurrentView?.('credits-new')}
              className="flex items-center gap-2 bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
            >
              <Plus size={16} /> {tTerm('credits.cta.new')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border-subtle">
        <button 
          onClick={() => updateActiveTab('list')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'list' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          title="Creditos vigentes con saldo o cuotas pendientes"
        >
          Creditos vigentes
        </button>
        <button 
          onClick={() => updateActiveTab('calendar')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'calendar' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          title="Calendario de cuotas pagadas, pendientes y vencidas"
        >
          <CalendarIcon size={16} /> Calendario
        </button>
        <button 
          onClick={() => updateActiveTab('simulation')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'simulation' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          title="Simula cuota, interes total y cronograma estimado"
        >
          Simulación
        </button>
        {isAdmin && (
          <button 
            onClick={() => updateActiveTab('workbench')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'workbench' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            title="Herramienta tecnica para flujos y escenarios DAG"
          >
            <Calculator size={16} /> Workbench DAG
          </button>
        )}
      </div>

      {activeTab === 'list' && (
        <div className="bg-bg-surface rounded-2xl p-5 flex-1 flex flex-col gap-6">
          {/* Statistics Widget */}
          {statisticsData?.data?.statistics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20">
                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 mb-1">
                  <DollarSign size={14} /> Total Préstamos
                </div>
                <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(statisticsData.data.statistics.amounts.totalLoanAmount)}
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 mb-1">
                  <TrendingUp size={14} /> Cobrado
                </div>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(statisticsData.data.statistics.amounts.totalCollected)}
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-xl border border-amber-100 dark:border-amber-500/20">
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 mb-1">
                  <AlertTriangle size={14} /> Mora
                </div>
                <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                  {formatCurrency(statisticsData.data.statistics.amounts.totalOverdue)}
                </div>
              </div>
              <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
                  <Users size={14} /> Créditos Activos
                </div>
                <div className="text-xl font-bold">
                  {statisticsData.data.statistics.counts.activeCredits} / {statisticsData.data.statistics.counts.totalCredits}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="flex gap-3">
              <div className="relative">
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
                  className="bg-bg-base text-sm text-text-primary rounded-lg pl-10 pr-4 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-border-strong border border-border-subtle"
                />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${showFilters ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30' : 'bg-bg-base border border-border-subtle text-text-secondary hover:text-text-primary'}`}
              >
                <Filter size={16} /> Filtrar
              </button>
            </div>
            <div className="text-sm text-text-secondary">
              Total: {pagination?.totalItems ?? creditsList.length} créditos
            </div>
          </div>

          {selectedCreditIds.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-sm">
              <span className="text-text-secondary">{selectedCreditIds.length} crédito(s) seleccionado(s)</span>
              <div className="flex items-center gap-2">
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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                    <option value="defaulted">En Mora</option>
                    <option value="closed">Cerrado</option>
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

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-text-secondary border-b border-border-subtle">
                <tr>
                  <th className="pb-3 font-medium w-10">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos los créditos visibles"
                      checked={creditsList.length > 0 && creditsList.every((credit: any) => selectedCreditIds.includes(Number(credit?.id)))}
                      onChange={handleToggleSelectAllVisible}
                    />
                  </th>
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Capital</th>
                  <th className="pb-3 font-medium">Tasa Anual</th>
                  <th className="pb-3 font-medium">Cuota Estimada</th>
                  <th className="pb-3 font-medium">Saldo Pendiente</th>
                  <th className="pb-3 font-medium">% Mora</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Situación</th>
                  <th className="pb-3 font-medium">Fecha Inicio</th>
                  <th className="pb-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {                isLoading ? (
                  <tr><td colSpan={11} className="py-4 text-center text-text-secondary">Cargando créditos...</td></tr>
                ) : isError ? (
                  <tr><td colSpan={11} className="py-4 text-center text-red-500">Error al cargar créditos.</td></tr>
                ) : creditsList.length === 0 ? (
                  <tr><td colSpan={11} className="py-4 text-center text-text-secondary">No hay créditos registrados.</td></tr>
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
                        <td className="py-4">
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar crédito ${credit.id}`}
                            checked={selectedCreditIds.includes(Number(credit.id))}
                            onChange={() => toggleSelectedCredit(Number(credit.id))}
                          />
                        </td>
                        <td className="py-4 text-text-secondary font-mono">{String(credit.id).substring(0, 8)}</td>
                        <td className="py-4 font-medium">{getCreditLabel(credit)}</td>
                        <td className="py-4">{formatCurrency(credit.amount)}</td>
                        <td className="py-4 text-text-secondary">
                          {credit.interestRate ? `${Number(credit.interestRate).toFixed(2)}%` : '-'}
                        </td>
                        <td className="py-4 text-text-secondary">
                          {credit.installmentAmount ? formatCurrency(credit.installmentAmount) : '-'}
                        </td>
                        <td className="py-4">
                          {outstandingAmount > 0 ? (
                            <span className={isDelinquent ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                              {formatCurrency(outstandingAmount)}
                            </span>
                          ) : (
                            <span className="text-text-secondary">-</span>
                          )}
                        </td>
                        <td className="py-4">
                          {delinquencyPercentage > 0 ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              delinquencyPercentage > 50 
                                ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300' 
                                : delinquencyPercentage > 25 
                                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                  : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                            }`}>
                              {delinquencyPercentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-text-secondary">0%</span>
                          )}
                        </td>
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded text-xs ${credit.status === 'active' ? getChipClassName('success') : credit.status === 'pending' ? getChipClassName('warning') : getChipClassName('info')}`}>
                            {getLoanStatusLabel(credit.status)}
                          </span>
                        </td>
                        <td className="py-4">
                            <span className={`px-2 py-1 rounded text-xs ${credit.recoveryStatus === 'overdue' || credit.status === 'defaulted' ? getChipClassName('danger') : getChipClassName('success')}`}>
                             {getRecoveryStatusLabel(credit)}
                            </span>
                          </td>
                        <td className="py-4 text-text-secondary text-xs">{creationDate}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-1.5">
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
            <div className="mt-4 flex justify-between items-center text-sm text-text-secondary">
              <div className="flex items-center gap-4">
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

      {activeTab === 'simulation' && (
        <div className="bg-bg-surface rounded-2xl p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Simulador de Crédito Avanzado</h3>
            {savedScenarios.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setScenarioComparison(!scenarioComparison)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    scenarioComparison
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                  }`}
                >
                  {scenarioComparison ? 'Ocultar Comparación' : 'Comparar Escenarios'}
                </button>
              </div>
            )}
          </div>

          {/* Scenario Comparison View */}
          {scenarioComparison && savedScenarios.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-6">
              <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-4 flex items-center gap-2">
                <TrendingUp size={18} />
                Comparación de Escenarios
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {/* Current simulation */}
                {simResults && (
                  <div className="bg-white dark:bg-bg-surface rounded-xl p-4 border-2 border-blue-300 dark:border-blue-500">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium text-sm">Simulación Actual</p>
                        <p className="text-xs text-text-secondary">Parámetros actuales</p>
                      </div>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded text-xs">Actual</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Monto:</span>
                        <span className="font-medium">{formatCurrency(simParams.principal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">TNA:</span>
                        <span className="font-medium">{simParams.tna}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Cuotas:</span>
                        <span className="font-medium">{simParams.installments}</span>
                      </div>
                      <div className="border-t border-border-subtle pt-2 mt-2">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Cuota:</span>
                          <span className="font-bold text-blue-600">{formatCurrency(simResults.pmt)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Total Interés:</span>
                          <span className="font-medium text-amber-600">{formatCurrency(simResults.totalInterest)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Saved scenarios */}
                {savedScenarios.map((scenario) => (
                  <div key={scenario.id} className="bg-white dark:bg-bg-surface rounded-xl p-4 border border-border-subtle">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium text-sm">{scenario.name}</p>
                        <p className="text-xs text-text-secondary">
                          {formatCurrency(scenario.params.principal)} · {scenario.params.tna}% · {scenario.params.installments} cuotas
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteScenario(scenario.id)}
                        className="text-text-secondary hover:text-red-500 p-1"
                        title="Eliminar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Monto:</span>
                        <span className="font-medium">{formatCurrency(scenario.params.principal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">TNA:</span>
                        <span className="font-medium">{scenario.params.tna}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Cuotas:</span>
                        <span className="font-medium">{scenario.params.installments}</span>
                      </div>
                      {scenario.results && (
                        <div className="border-t border-border-subtle pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Cuota:</span>
                            <span className="font-bold text-blue-600">{formatCurrency(scenario.results.pmt)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Total Interés:</span>
                            <span className="font-medium text-amber-600">{formatCurrency(scenario.results.totalInterest)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inputs */}
            <div className="col-span-1 bg-bg-base p-5 rounded-xl border border-border-subtle space-y-4 h-fit">
              <h4 className="font-medium text-text-primary mb-4 border-b border-border-subtle pb-2">Parámetros del Préstamo</h4>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Valor del préstamo</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                  <input
                    type="number"
                    value={simParams.principal}
                    onChange={(e) => setSimParams({...simParams, principal: Number(e.target.value)})}
                    className="w-full bg-bg-surface border border-border-strong rounded-lg pl-8 pr-4 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">TNA (%) - Tasa Nominal Anual</label>
                <div className="relative">
                  <input
                    type="number"
                    value={simParams.tna}
                    onChange={(e) => setSimParams({...simParams, tna: Number(e.target.value)})}
                    className="w-full bg-bg-surface border border-border-strong rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Frecuencia de Pago</label>
                <div className="rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-sm text-text-secondary">
                  El simulador operativo usa cronograma mensual para mantener paridad con el motor de cÃ¡lculo del backend.
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">N° Total de Cuotas</label>
                <input
                  type="number"
                  value={simParams.installments}
                  onChange={(e) => setSimParams({...simParams, installments: Number(e.target.value)})}
                  className="w-full bg-bg-surface border border-border-strong rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Save Scenario Section */}
              <div className="border-t border-border-subtle pt-4 mt-4">
                <h5 className="text-sm font-medium mb-3">Guardar Escenario</h5>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="Nombre del escenario..."
                    className="flex-1 bg-bg-surface border border-border-strong rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSaveScenario}
                    disabled={!simResults}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Guardar escenario para comparar"
                  >
                    <Save size={16} />
                  </button>
                </div>
                {savedScenarios.length > 0 && (
                  <p className="text-xs text-text-secondary mt-2">
                    {savedScenarios.length} escenario{savedScenarios.length > 1 ? 's' : ''} guardado{savedScenarios.length > 1 ? 's' : ''} · Máx. 3
                  </p>
                )}
              </div>
            </div>

            {/* Resumen & Tabla */}
            <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
              {/* Resumen Cards */}
              {isSimulating ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-bg-base p-4 rounded-xl border border-border-subtle animate-pulse">
                      <div className="h-3 bg-border-subtle rounded w-20 mb-2"></div>
                      <div className="h-6 bg-border-subtle rounded w-28"></div>
                    </div>
                  ))}
                </div>
              ) : simResults ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">Cuota a Pagar</div>
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(simResults.pmt)}</div>
                  </div>
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Suma de Cuotas</div>
                    <div className="text-lg font-semibold">{formatCurrency(simResults.totalPayment)}</div>
                  </div>
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Suma de Intereses</div>
                    <div className="text-lg font-semibold">{formatCurrency(simResults.totalInterest)}</div>
                  </div>
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Ganancia por Cuota</div>
                    <div className="text-lg font-semibold">{formatCurrency(simResults.profitPerMonth)}</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Cuota a Pagar</div>
                    <div className="text-lg font-semibold text-text-secondary">-</div>
                  </div>
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Suma de Cuotas</div>
                    <div className="text-lg font-semibold text-text-secondary">-</div>
                  </div>
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Suma de Intereses</div>
                    <div className="text-lg font-semibold text-text-secondary">-</div>
                  </div>
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Ganancia por Cuota</div>
                    <div className="text-lg font-semibold text-text-secondary">-</div>
                  </div>
                </div>
              )}

              {/* Tabla de Amortización */}
              <div className="bg-bg-base rounded-xl border border-border-subtle overflow-hidden flex-1">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="text-xs text-text-secondary bg-bg-surface sticky top-0 shadow-sm">
                      <tr>
                        <th className="py-3 px-4 text-center font-medium">N° Cuota</th>
                        <th className="py-3 px-4 font-medium">Cuota a Pagar</th>
                        <th className="py-3 px-4 font-medium">Interés</th>
                        <th className="py-3 px-4 font-medium">Capital Amort.</th>
                        <th className="py-3 px-4 font-medium">Capital Vivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      <tr className="bg-hover-bg/50">
                        <td className="py-2 px-4 text-center">0</td>
                        <td className="py-2 px-4">-</td>
                        <td className="py-2 px-4">-</td>
                        <td className="py-2 px-4">-</td>
                        <td className="py-2 px-4 font-semibold">{formatCurrency(simParams.principal)}</td>
                      </tr>
                      {isSimulating ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-text-secondary">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              Cargando simulación...
                            </div>
                          </td>
                        </tr>
                      ) : simResults && simResults.schedule.length > 0 ? (
                        simResults.schedule.map((row) => (
                          <tr key={row.step} className="hover:bg-hover-bg transition-colors">
                            <td className="py-2 px-4 text-center">{row.step}</td>
                            <td className="py-2 px-4 font-medium text-blue-600 dark:text-blue-400">{formatCurrency(row.pmt)}</td>
                            <td className="py-2 px-4 text-amber-600 dark:text-amber-400">{formatCurrency(row.interest)}</td>
                            <td className="py-2 px-4 text-emerald-600 dark:text-emerald-400">{formatCurrency(row.principalPayment)}</td>
                            <td className="py-2 px-4 font-medium">{formatCurrency(row.balance)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-text-secondary">
                            Ajusta los parámetros para ver la simulación
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'workbench' && (
        <div className="bg-bg-surface rounded-2xl flex-1 flex flex-col min-h-[800px] overflow-hidden -mx-4 sm:mx-0 shadow-lg border border-border-subtle">
          <DAGWorkbench />
        </div>
      )}

    </div>
  );
}
