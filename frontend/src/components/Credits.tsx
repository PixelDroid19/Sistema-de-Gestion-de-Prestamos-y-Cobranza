import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Calculator,
  Download,
  CreditCard,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../i18n';
import { formatCurrency as formatCurrencyValue } from '../i18n/format';
import { useLoans, useLoanStatistics, useSearchLoans } from '../services/loanService';
import { usePaginationStore } from '../store/paginationStore';
import { apiClient } from '../api/client';

import { toast } from '../lib/toast';
import { downloadCreditReport, exportCreditsExcel } from '../services/reportService';
import { useSessionStore } from '../store/sessionStore';
import { useOperationalActions } from './hooks/useOperationalActions';
import { invalidateAfterDelete, invalidateAfterReport } from '../services/operationalInvalidation';
import { tTerm } from '../i18n/terminology';
import { PERMISSION } from '../constants/permissionNames';
import { getLocalDateInputValue } from '../lib/dateInput';
import { normalizeVisibleName } from '../lib/displayNames';
import {
  ActionButton,
  PageHeader,
  PageShell,
  ViewTabs,
} from './shared/Surfaces';
import {
  type CalendarOverviewResponse,
  type InstallmentEvent,
  type VisiblePortfolioStatistics,
  toNumber,
  parseDueDate,
} from './credits/creditsHelpers';
import CreditsListView from './credits/CreditsListView';
import CreditsCalendarView from './credits/CreditsCalendarView';

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
  const calendarAsOfDate = useMemo(() => getLocalDateInputValue(), []);
  const [calendarFilters, setCalendarFilters] = useState({
    search: '',
    status: '',
    startDate: '',
    endDate: '',
  });
  const updateCalendarFilters = (
    updater: typeof calendarFilters | ((current: typeof calendarFilters) => typeof calendarFilters),
  ) => {
    setCalendarFilters((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (next.startDate && next.endDate && next.startDate > next.endDate) {
        return current;
      }
      return next;
    });
  };

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
    || grantedPermissions.has(PERMISSION.DASHBOARD_VIEW_ALL);
  const searchPlaceholder = isAdmin ? tTerm('credits.search.placeholder.admin') : tTerm('credits.search.placeholder.employee');

  // Statistics hook
  const { data: statisticsData } = useLoanStatistics({ enabled: canReadPortfolioStatistics });

  // Query client for refetching
  const queryClient = useQueryClient();
  const { executeGuardedAction } = useOperationalActions(queryClient);

  const updateActiveTab = (nextTab: string) => {
    setActiveTab(nextTab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  };

  const navigateToView = (view: string) => {
    setCurrentView?.(view);
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
  } = useLoans({ page, pageSize });

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
    if (appliedFilters.search === normalizedSearch) return;

    setAppliedFilters((current) => ({ ...current, search: normalizedSearch }));
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

  // ─── Calendar data ────────────────────────────────────────────────────────

  const emptyCalendarOverview = useMemo<CalendarOverviewResponse>(() => ({
    asOfDate: calendarAsOfDate,
    summary: {
      totalLoans: 0, totalEntries: 0, paidCount: 0, pendingCount: 0,
      overdueCount: 0, dueTodayCount: 0, actionableCount: 0,
      totalPayableAmount: 0, totalLateFeeAmount: 0,
    },
    agenda: [],
    nextAction: null,
    entries: [],
  }), [calendarAsOfDate]);

  const { data: calendarOverview = emptyCalendarOverview, isLoading: isCalendarLoading } = useQuery<CalendarOverviewResponse>({
    queryKey: ['credits.calendar.overview', calendarAsOfDate, calendarFilters],
    enabled: activeTab === 'calendar',
    queryFn: async () => {
      const { data } = await apiClient.get('/loans/calendar/overview', {
        params: {
          asOfDate: calendarAsOfDate,
          search: calendarFilters.search || undefined,
          status: calendarFilters.status || undefined,
          startDate: calendarFilters.startDate || undefined,
          endDate: calendarFilters.endDate || undefined,
          limit: 150,
        },
      });
      return data?.data?.calendar ?? emptyCalendarOverview;
    },
  });

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

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleDeleteCredit = async (credit: any) => {
    await executeGuardedAction({
      action: 'credit.delete',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status },
      confirmationMessage: `¿Cancelar el crédito #${credit?.id} de ${getCreditLabelInline(credit)}? El registro quedará en el historial operativo.`,
      run: async () => { await deleteLoan.mutateAsync(Number(credit.id)); },
      onSuccess: async () => {
        await invalidateAfterDelete(queryClient, { loanId: Number(credit.id), loansParams: { page, pageSize } });
      },
      successMessage: 'Crédito cancelado correctamente',
    });
  };

  const handleDownloadReport = async (credit: any) => {
    await executeGuardedAction({
      action: 'credit.report.download',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status },
      run: async () => { await downloadCreditReport(Number(credit.id)); },
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
      run: async () => { navigateToView('payouts'); },
    });
  };

  const toggleSelectedCredit = (creditId: number) => {
    setSelectedCreditIds((prev) =>
      prev.includes(creditId) ? prev.filter((id) => id !== creditId) : [...prev, creditId],
    );
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
        run: async () => { await downloadCreditReport(creditId); },
      });
    }
    toast.success({ description: `Se procesaron ${selectedCreditIds.length} reportes seleccionados.` });
  };

  const handleClearFilters = () => {
    setFilters({ status: '', minAmount: '', maxAmount: '', startDate: '', endDate: '' });
    setSearchQuery('');
    setAppliedFilters({ status: '', minAmount: '', maxAmount: '', startDate: '', endDate: '', search: '' });
    setPage(1);
  };

  // ─── Computed statistics ──────────────────────────────────────────────────

  const pagination = loansData?.data?.pagination || loansData?.pagination || loansData?.meta;

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
    }, { totalAmount: 0, totalCollected: 0, totalOverdue: 0, totalCredits: 0, activeCredits: 0 });
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

  // ─── Inline helper (uses no closure over component state) ─────────────────

  const getCreditLabelInline = (credit: any) => {
    const name = normalizeVisibleName(credit?.Customer?.name || credit?.customerName || '');
    return name || (credit?.customerId ? tTerm('credits.label.customerFallback', { id: credit.customerId }) : tTerm('credits.label.customerMissing'));
  };

  // ─── Render ───────────────────────────────────────────────────────────────

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
                onClick={() => navigateToView('credit-calculator')}
                data-tour="credits-preview"
                icon={<Calculator size={16} />}
              >
                {tTerm('credits.cta.preview')}
              </ActionButton>
            )}
            {isAdmin && (
              <ActionButton
                onClick={() => navigateToView('credits-new')}
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
        <CreditsListView
          creditsList={creditsList}
          displayedStatistics={displayedStatistics}
          pagination={pagination}
          isLoading={isLoading}
          isError={isError}
          filters={filters}
          showFilters={showFilters}
          searchQuery={searchQuery}
          searchPlaceholder={searchPlaceholder}
          onFiltersChange={setFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          onSearchChange={setSearchQuery}
          onApplyFilters={applyFilters}
          onClearFilters={handleClearFilters}
          selectedCreditIds={selectedCreditIds}
          onToggleSelect={toggleSelectedCredit}
          onToggleSelectAll={handleToggleSelectAllVisible}
          onDownloadSelected={handleDownloadSelectedReports}
          onClearSelection={() => setSelectedCreditIds([])}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onViewCredit={(credit: any) => navigateToView(`credits/${credit.id}`)}
          user={user}
        />
      )}

      {activeTab === 'calendar' && (
        <CreditsCalendarView
          calendarEvents={calendarEvents}
          calendarOverview={calendarOverview}
          isCalendarLoading={isCalendarLoading}
          selectedEvent={selectedEvent}
          onSelectEvent={setSelectedEvent}
          onViewCredit={(loanId: number) => navigateToView(`credits/${loanId}`)}
          filters={calendarFilters}
          onFiltersChange={updateCalendarFilters}
          onClearFilters={() => updateCalendarFilters({ search: '', status: '', startDate: '', endDate: '' })}
        />
      )}
    </PageShell>
  );
}
