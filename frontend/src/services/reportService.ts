import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';
import { downloadBlob } from './blobDownload';
import type {
  PaymentCalendarOverviewResponse,
  PaymentScheduleResponse,
  PayoutsReportFilters,
  PayoutsReportResponse,
} from '../types/reportSimulation';
import { tTerm } from '../i18n/terminology';
import type {
  CreditHistoryMonthlyFilters,
  CustomerProfitabilityFilters,
  DailyCashFlowFilters,
  AnnualCashFlowFilters,
  MonthlyCashFlowFilters,
  OperatingExpenseListParams,
  PaymentCalendarOverviewFilters,
} from './queryKeys';

type ReportContextualType = 'credits' | 'payouts' | 'profitability';
type ReportContextualFormat = 'xlsx' | 'pdf';
type ReportContextualFilters = {
  fromDate?: string;
  toDate?: string;
  customerId?: number;
  loanId?: number;
  financialProductId?: string;
  status?: string;
  paymentType?: string;
  employeeId?: string | number;
  format?: ReportContextualFormat;
};

export type CreditHistoryFinancialProductOption = {
  id: string;
  name: string;
};

export type OperatingExpenseStatus = 'completed' | 'annulled';

export type OperatingExpense = {
  id: number;
  amount: number | string;
  expenseDate: string;
  category: string;
  description: string;
  status: OperatingExpenseStatus;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
  annulmentReason?: string | null;
  createdBy?: { id?: number; name?: string; email?: string } | null;
  annulledBy?: { id?: number; name?: string; email?: string } | null;
};

export type OperatingExpensePayload = {
  amount: number;
  expenseDate: string;
  category: string;
  description: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
};

export type OperatingExpenseFilters = Pick<OperatingExpenseListParams, 'fromDate' | 'toDate' | 'status' | 'employeeId'>;
export type OperatingExpenseExportFormat = 'xlsx' | 'pdf';

export type CreditHistoryMonthlyReport = {
  summary?: Record<string, unknown>;
  months?: Array<Record<string, unknown>>;
  credits?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
};

const toArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value : [];

const toNumber = (value: unknown): number => {
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.-]/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toMonthLabel = (value: unknown, fallbackIndex: number): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return `${tTerm('reports.chart.disbursementRecovery.monthFallbackPrefix')} ${fallbackIndex + 1}`;
};

const pickMonthlyAmount = (entry: Record<string, unknown>, candidates: string[]): number => {
  for (const candidate of candidates) {
    if (candidate in entry) {
      return toNumber(entry[candidate]);
    }
  }

  return 0;
};

const normalizeMonthlyPerformance = (value: unknown) => {
  const rows = toArray<Record<string, unknown>>(value);

  return rows.map((entry, index) => {
    const month = toMonthLabel(entry.month ?? entry.label ?? entry.period, index);

    const disbursed = pickMonthlyAmount(entry, [
      'disbursed',
      'totalDisbursed',
      'disbursement',
      'loanAmount',
      'principal',
    ]);

    const recovered = pickMonthlyAmount(entry, [
      'recovered',
      'totalRecovered',
      'recovery',
      'collected',
      'totalCollected',
      'earnings',
      'totalEarnings',
      'value',
    ]);

    return {
      month,
      disbursed,
      recovered,
    };
  });
};

export const useReports = () => {
  const getDashboardMetrics = useQuery({
    queryKey: queryKeys.reports.dashboard,
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/dashboard');
      return data;
    },
  });

  const getOutstandingReport = useQuery({
    queryKey: queryKeys.reports.outstanding,
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/outstanding');
      return data;
    },
  });

  const getRecoveredReport = useQuery({
    queryKey: queryKeys.reports.recovered,
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/recovered');
      return data;
    },
  });

  const getRecoveryReport = useQuery({
    queryKey: queryKeys.reports.recovery,
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/recovery');
      return data;
    },
  });

  const getLoanProfitability = useQuery({
    queryKey: queryKeys.reports.profitabilityLoans,
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/profitability/loans');
      return data;
    },
  });

  return {
    dashboardData: (() => {
      const data = getDashboardMetrics.data?.data;
      return normalizeDashboardData(data);
    })(),
    outstandingData: getOutstandingReport.data,
    recoveredData: getRecoveredReport.data,
    recoveryData: getRecoveryReport.data,
    loanProfitabilityData: getLoanProfitability.data,
    monthlyPerformance: normalizeMonthlyPerformance(
      getDashboardMetrics.data?.data?.monthlyPerformance
      ?? getRecoveryReport.data?.data?.monthlyPerformance,
    ),
    statusBreakdown: (() => {
      const backendStatuses = toArray<{ status: string; count: number }>(getOutstandingReport.data?.data?.byStatus);
      if (backendStatuses.length > 0) return backendStatuses;
      const loans = toArray<any>(getOutstandingReport.data?.data?.loans);
      const counts = loans.reduce<Record<string, number>>((acc, loan) => {
        const key = String(loan?.status || 'unknown');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return Object.entries(counts).map(([status, count]) => ({ status, count }));
    })(),
    overdueLoans: toArray<any>(
      getOutstandingReport.data?.data?.items
      ?? getOutstandingReport.data?.data?.overdueLoans
      ?? getOutstandingReport.data?.data?.loans,
    ).map((loan) => {
      const dueDate = loan?.nextInstallment?.dueDate ? new Date(loan.nextInstallment.dueDate) : null;
      const now = new Date();
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysOverdue = dueDate && dueDate.getTime() < now.getTime()
        ? Math.floor((now.getTime() - dueDate.getTime()) / msPerDay)
        : 0;

      return {
        ...loan,
        daysOverdue,
        overdueAmount: toNumber(loan.overdueAmount ?? loan.outstandingAmount),
        remainingCapital: toNumber(loan.remainingCapital ?? loan.outstandingAmount),
      };
    }),
    isLoading:
      getDashboardMetrics.isLoading ||
      getOutstandingReport.isLoading ||
      getRecoveryReport.isLoading,
    isError:
      getDashboardMetrics.isError ||
      getOutstandingReport.isError ||
      getRecoveryReport.isError,
    error:
      getDashboardMetrics.error ||
      getOutstandingReport.error ||
      getRecoveryReport.error,
  };
};

const normalizeCustomerProfitabilityItems = (value: unknown) => {
  const payload = (value as { data?: { items?: unknown; customers?: unknown } })?.data ?? value;
  const items = toArray<any>(
    (payload as { items?: unknown })?.items
    ?? (payload as { customers?: unknown })?.customers,
  );

  return items.map((item) => ({
    ...item,
    totalLoans: item.totalLoans ?? item.loanCount ?? 0,
    activeLoanCount: toNumber(item.activeLoanCount),
    closedLoanCount: toNumber(item.closedLoanCount),
    overdueLoanCount: toNumber(item.overdueLoanCount),
    defaultedLoanCount: toNumber(item.defaultedLoanCount),
    paymentCount: toNumber(item.paymentCount),
    outstandingBalance: toNumber(item.outstandingBalance),
    lateFeesCollected: toNumber(item.lateFeesCollected ?? item.penaltyCollected),
    paymentBehavior: item.paymentBehavior ?? 'current',
    riskLevel: item.riskLevel ?? 'low',
    isDelinquent: Boolean(item.isDelinquent),
  }));
};

export const useCustomerProfitability = (filters: CustomerProfitabilityFilters = {}) => {
  const queryFilters = useMemo(() => ({
    ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
    ...(filters.toDate ? { toDate: filters.toDate } : {}),
    ...(filters.page ? { page: filters.page } : {}),
    ...(filters.pageSize ? { pageSize: filters.pageSize } : {}),
  }), [filters.fromDate, filters.page, filters.pageSize, filters.toDate]);

  const query = useQuery({
    queryKey: queryKeys.reports.profitabilityCustomers(queryFilters),
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/profitability/customers', {
        params: queryFilters,
      });
      return data;
    },
  });

  return {
    items: normalizeCustomerProfitabilityItems(query.data),
    customerAnalytics: (query.data as any)?.summary?.customerAnalytics ?? null,
    summary: (query.data as any)?.summary ?? null,
    pagination: (query.data as any)?.data?.pagination ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
};

const normalizeDashboardData = (data: any) => {
  if (!data) return data;
  if (data.metrics) {
    return {
      ...data,
      metrics: {
        ...data.metrics,
        totalCustomers: toNumber(data.metrics.totalCustomers ?? data.summary?.totalCustomers),
        totalFinalizedLoans: toNumber(data.metrics.totalFinalizedLoans ?? data.metrics.finalizedLoans ?? data.summary?.finalizedLoans ?? data.summary?.recoveredLoans),
        totalOverdueLoans: toNumber(data.metrics.totalOverdueLoans ?? data.metrics.overdueLoans ?? data.summary?.overdueLoans ?? data.summary?.delinquentLoans),
        totalPendingInstallments: toNumber(data.metrics.totalPendingInstallments ?? data.metrics.pendingInstallments ?? data.summary?.pendingInstallments),
        totalOverdueInstallments: toNumber(data.metrics.totalOverdueInstallments ?? data.metrics.overdueInstallments ?? data.summary?.overdueInstallments),
        totalInterestGenerated: toNumber(data.metrics.totalInterestGenerated ?? data.summary?.totalInterestGenerated),
        totalInterestPaid: toNumber(data.metrics.totalInterestPaid ?? data.summary?.totalInterestPaid),
        totalInterestPending: toNumber(data.metrics.totalInterestPending ?? data.summary?.totalInterestPending),
        totalRecovered: toNumber(data.metrics.totalRecovered ?? data.summary?.totalRecoveredAmount),
        totalCurrentLent: toNumber(data.metrics.totalCurrentLent ?? data.summary?.totalOutstandingPrincipal),
        totalPendingCollection: toNumber(data.metrics.totalPendingCollection ?? data.summary?.totalOutstandingAmount),
        recoveryRate: toNumber(data.metrics.recoveryRate ?? data.summary?.recoveryRate),
        arrearsRate: toNumber(data.metrics.arrearsRate ?? data.summary?.arrearsRate),
        totalAssociatePayments: toNumber(data.metrics.totalAssociatePayments ?? data.summary?.totalAssociatePayments),
        availableCash: toNumber(data.metrics.availableCash ?? data.summary?.availableCash),
        periodProfit: toNumber(data.metrics.periodProfit ?? data.summary?.periodProfit),
        periodLoss: toNumber(data.metrics.periodLoss ?? data.summary?.periodLoss),
      },
    };
  }

  return {
    ...data,
    metrics: {
      totalCustomers: toNumber(data.summary?.totalCustomers),
      totalActiveLoans: toNumber(data.summary?.activeLoans),
      totalFinalizedLoans: toNumber(data.summary?.finalizedLoans ?? data.summary?.recoveredLoans),
      totalOverdueLoans: toNumber(data.summary?.overdueLoans ?? data.summary?.delinquentLoans),
      totalDisbursed: toNumber(data.summary?.totalPortfolioAmount),
      totalRecovered: toNumber(data.summary?.totalRecoveredAmount),
      totalCurrentLent: toNumber(data.summary?.totalOutstandingPrincipal),
      totalPendingCollection: toNumber(data.summary?.totalOutstandingAmount),
      totalInterestGenerated: toNumber(data.summary?.totalInterestGenerated),
      totalInterestPaid: toNumber(data.summary?.totalInterestPaid),
      totalInterestPending: toNumber(data.summary?.totalInterestPending),
      totalAssociatePayments: toNumber(data.summary?.totalAssociatePayments),
      totalPendingInstallments: toNumber(data.summary?.pendingInstallments),
      totalOverdueInstallments: toNumber(data.summary?.overdueInstallments),
      availableCash: toNumber(data.summary?.availableCash),
      periodProfit: toNumber(data.summary?.periodProfit),
      periodLoss: toNumber(data.summary?.periodLoss),
      recoveryRate: toNumber(data.summary?.recoveryRate),
      arrearsRate: toNumber(data.summary?.arrearsRate),
    },
  };
};

export const useDashboardReport = () => {
  const getDashboardMetrics = useQuery({
    queryKey: queryKeys.reports.dashboard,
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/dashboard');
      return data;
    },
  });

  return {
    dashboardData: normalizeDashboardData(getDashboardMetrics.data?.data),
    isLoading: getDashboardMetrics.isLoading,
    isError: getDashboardMetrics.isError,
    error: getDashboardMetrics.error,
    refetch: getDashboardMetrics.refetch,
  };
};

export const useCustomerReports = (customerId: number) => {
  const getCustomerHistory = useQuery({
    queryKey: queryKeys.reports.customerHistory(customerId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/reports/customer-history/${customerId}`);
      return data;
    },
    enabled: !!customerId,
  });

  const getCustomerCreditProfile = useQuery({
    queryKey: queryKeys.reports.customerCreditProfile(customerId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/reports/customer-credit-profile/${customerId}`);
      return data;
    },
    enabled: !!customerId,
  });

  return {
    history: getCustomerHistory.data,
    creditProfile: getCustomerCreditProfile.data,
    isLoading: getCustomerHistory.isLoading || getCustomerCreditProfile.isLoading,
  };
};

export const useCreditReports = (loanId: number) => {
  const getCreditHistory = useQuery({
    queryKey: queryKeys.reports.creditHistory(loanId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/reports/credit-history/loan/${loanId}`);
      return data;
    },
    enabled: !!loanId,
  });

  return {
    history: getCreditHistory.data?.data?.history,
    isLoading: getCreditHistory.isLoading,
  };
};

// === Financial Analytics Hooks ===

export const useCreditEarnings = () => {
  const getCreditEarnings = useQuery({
    queryKey: queryKeys.reports.creditEarnings,
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/credit-earnings');
      return data;
    },
  });

  return {
    data: getCreditEarnings.data?.data,
    isLoading: getCreditEarnings.isLoading,
    isError: getCreditEarnings.isError,
    error: getCreditEarnings.error,
  };
};

export const useInterestEarnings = (year?: number) => {
  const getInterestEarnings = useQuery({
    queryKey: queryKeys.reports.interestEarnings(year),
    queryFn: async () => {
      const params = year ? { year } : {};
      const { data } = await apiClient.get('/reports/interest-earnings', { params });
      return data;
    },
  });

  return {
    data: getInterestEarnings.data?.data,
    isLoading: getInterestEarnings.isLoading,
    isError: getInterestEarnings.isError,
    error: getInterestEarnings.error,
  };
};

export const useMonthlyEarnings = (year?: number) => {
  const getMonthlyEarnings = useQuery({
    queryKey: queryKeys.reports.monthlyEarnings(year),
    queryFn: async () => {
      const params = year ? { year } : {};
      const { data } = await apiClient.get('/reports/monthly-earnings', { params });
      return data;
    },
  });

  return {
    data: getMonthlyEarnings.data?.data,
    isLoading: getMonthlyEarnings.isLoading,
    isError: getMonthlyEarnings.isError,
    error: getMonthlyEarnings.error,
  };
};

export const useMonthlyCashFlow = (year?: number, filters: MonthlyCashFlowFilters = {}) => {
  const getMonthlyCashFlow = useQuery({
    queryKey: queryKeys.reports.monthlyCashFlow(year, filters),
    queryFn: async () => {
      const params = { ...(year ? { year } : {}), ...filters };
      const { data } = await apiClient.get('/reports/cash-flow/monthly', { params });
      return data;
    },
  });

  return {
    data: getMonthlyCashFlow.data?.data,
    isLoading: getMonthlyCashFlow.isLoading,
    isError: getMonthlyCashFlow.isError,
    error: getMonthlyCashFlow.error,
  };
};

export const useDailyCashFlow = (filters: DailyCashFlowFilters = {}) => {
  const getDailyCashFlow = useQuery({
    queryKey: queryKeys.reports.dailyCashFlow(filters),
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/cash-flow/daily', { params: filters });
      return data;
    },
  });

  return {
    data: getDailyCashFlow.data?.data,
    isLoading: getDailyCashFlow.isLoading,
    isError: getDailyCashFlow.isError,
    error: getDailyCashFlow.error,
  };
};

export const useAnnualCashFlow = (filters: AnnualCashFlowFilters = {}) => {
  const getAnnualCashFlow = useQuery({
    queryKey: queryKeys.reports.annualCashFlow(filters),
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/cash-flow/annual', { params: filters });
      return data;
    },
  });

  return {
    data: getAnnualCashFlow.data?.data,
    isLoading: getAnnualCashFlow.isLoading,
    isError: getAnnualCashFlow.isError,
    error: getAnnualCashFlow.error,
  };
};

export const useCreditHistoryMonthly = (filters: CreditHistoryMonthlyFilters = {}) => {
  const getCreditHistoryMonthly = useQuery({
    queryKey: queryKeys.reports.creditHistoryMonthly(filters),
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/credit-history/monthly', { params: filters });
      return data;
    },
  });

  return {
    data: getCreditHistoryMonthly.data?.data as CreditHistoryMonthlyReport | undefined,
    isLoading: getCreditHistoryMonthly.isLoading,
    isError: getCreditHistoryMonthly.isError,
    error: getCreditHistoryMonthly.error,
  };
};

export const useCreditHistoryFinancialProducts = () => {
  const getCreditHistoryFinancialProducts = useQuery({
    queryKey: queryKeys.reports.creditHistoryFinancialProducts,
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/credit-history/financial-products');
      return data;
    },
  });

  return {
    financialProducts: toArray<CreditHistoryFinancialProductOption>(
      getCreditHistoryFinancialProducts.data?.data?.financialProducts,
    ),
    isLoading: getCreditHistoryFinancialProducts.isLoading,
    isError: getCreditHistoryFinancialProducts.isError,
    error: getCreditHistoryFinancialProducts.error,
  };
};

export const useMonthlyInterest = (year?: number) => {
  const getMonthlyInterest = useQuery({
    queryKey: queryKeys.reports.monthlyInterest(year),
    queryFn: async () => {
      const params = year ? { year } : {};
      const { data } = await apiClient.get('/reports/monthly-interest', { params });
      return data;
    },
  });

  return {
    data: getMonthlyInterest.data?.data,
    isLoading: getMonthlyInterest.isLoading,
    isError: getMonthlyInterest.isError,
    error: getMonthlyInterest.error,
  };
};

export const usePerformanceAnalysis = (year?: number) => {
  const getPerformanceAnalysis = useQuery({
    queryKey: queryKeys.reports.performanceAnalysis(year),
    queryFn: async () => {
      const params = year ? { year } : {};
      const { data } = await apiClient.get('/reports/performance-analysis', { params });
      return data;
    },
  });

  return {
    data: getPerformanceAnalysis.data?.data,
    isLoading: getPerformanceAnalysis.isLoading,
    isError: getPerformanceAnalysis.isError,
    error: getPerformanceAnalysis.error,
  };
};

export const useExecutiveDashboard = () => {
  const getExecutiveDashboard = useQuery({
    queryKey: queryKeys.reports.executiveDashboard,
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/executive-dashboard');
      return data;
    },
  });

  return {
    data: getExecutiveDashboard.data?.data,
    isLoading: getExecutiveDashboard.isLoading,
    isError: getExecutiveDashboard.isError,
    error: getExecutiveDashboard.error,
  };
};

export const useComprehensiveAnalytics = (year?: number) => {
  const getComprehensiveAnalytics = useQuery({
    queryKey: queryKeys.reports.comprehensiveAnalytics(year),
    queryFn: async () => {
      const params = year ? { year } : {};
      const { data } = await apiClient.get('/reports/comprehensive-analytics', { params });
      return data;
    },
  });

  return {
    data: getComprehensiveAnalytics.data?.data,
    isLoading: getComprehensiveAnalytics.isLoading,
    isError: getComprehensiveAnalytics.isError,
    error: getComprehensiveAnalytics.error,
  };
};

export const useComparativeAnalysis = (year?: number) => {
  const getComparativeAnalysis = useQuery({
    queryKey: queryKeys.reports.comparativeAnalysis(year),
    queryFn: async () => {
      const params = year ? { year } : {};
      const { data } = await apiClient.get('/reports/comparative-analysis', { params });
      return data;
    },
  });

  return {
    data: getComparativeAnalysis.data?.data,
    isLoading: getComparativeAnalysis.isLoading,
    isError: getComparativeAnalysis.isError,
    error: getComparativeAnalysis.error,
  };
};

export const useForecastAnalysis = (year?: number) => {
  const getForecastAnalysis = useQuery({
    queryKey: queryKeys.reports.forecastAnalysis(year),
    queryFn: async () => {
      const params = year ? { year } : {};
      const { data } = await apiClient.get('/reports/forecast-analysis', { params });
      return data;
    },
  });

  return {
    data: getForecastAnalysis.data?.data,
    isLoading: getForecastAnalysis.isLoading,
    isError: getForecastAnalysis.isError,
    error: getForecastAnalysis.error,
  };
};

export const useNextMonthProjection = () => {
  const getNextMonthProjection = useQuery({
    queryKey: queryKeys.reports.nextMonthProjection,
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/next-month-projection');
      return data;
    },
  });

  return {
    data: getNextMonthProjection.data?.data,
    isLoading: getNextMonthProjection.isLoading,
    isError: getNextMonthProjection.isError,
    error: getNextMonthProjection.error,
  };
};

// Combined hook for financial analytics dashboard.
// The six overlapping analytics endpoints are fetched as a single consolidated
// bundle (`/reports/financial-analytics`) in one round-trip; the earnings
// series keep their own queries since they feed other tabs too.
export const useFinancialAnalytics = (year?: number) => {
  const creditEarnings = useCreditEarnings();
  const interestEarnings = useInterestEarnings(year);
  const monthlyEarnings = useMonthlyEarnings(year);
  const monthlyInterest = useMonthlyInterest(year);

  const analyticsBundle = useQuery({
    queryKey: queryKeys.reports.financialAnalytics(year),
    queryFn: async () => {
      const params = year ? { year } : {};
      const { data } = await apiClient.get('/reports/financial-analytics', { params });
      return data;
    },
  });

  const bundle = analyticsBundle.data?.data;
  const section = (value: any) => ({
    data: value?.data,
    isLoading: analyticsBundle.isLoading,
    isError: analyticsBundle.isError,
    error: analyticsBundle.error,
  });

  return {
    creditEarnings,
    interestEarnings,
    monthlyEarnings,
    monthlyInterest,
    performanceAnalysis: section(bundle?.performanceAnalysis),
    executiveDashboard: section(bundle?.executiveDashboard),
    comprehensiveAnalytics: section(bundle?.comprehensiveAnalytics),
    comparativeAnalysis: section(bundle?.comparativeAnalysis),
    forecastAnalysis: section(bundle?.forecastAnalysis),
    nextMonthProjection: section(bundle?.nextMonthProjection),
    isLoading:
      creditEarnings.isLoading ||
      interestEarnings.isLoading ||
      monthlyEarnings.isLoading ||
      monthlyInterest.isLoading ||
      analyticsBundle.isLoading,
  };
};

export const usePayoutsReport = (filters: PayoutsReportFilters = {}, page = 1, pageSize = 20) => {
  const getPayouts = useQuery({
    queryKey: queryKeys.reports.payouts(filters, page, pageSize),
    queryFn: async () => {
      const params = {
        ...filters,
        page,
        pageSize,
      };
      const { data } = await apiClient.get('/reports/payouts', { params });
      return data as PayoutsReportResponse;
    },
  });

  return {
    data: getPayouts.data?.data,
    summary: getPayouts.data?.summary,
    payouts: getPayouts.data?.data?.payouts || [],
    pagination: getPayouts.data?.data?.pagination,
    isLoading: getPayouts.isLoading,
    isError: getPayouts.isError,
    error: getPayouts.error,
  };
};

export const usePaymentCalendarOverview = (
  filters: PaymentCalendarOverviewFilters = {},
  enabled = true,
) => {
  const getCalendarOverview = useQuery({
    queryKey: queryKeys.reports.paymentCalendarOverview(filters),
    queryFn: async () => {
      const { data } = await apiClient.get('/loans/calendar/overview', { params: filters });
      return data?.data?.calendar as PaymentCalendarOverviewResponse;
    },
    enabled,
  });

  return {
    data: getCalendarOverview.data,
    summary: getCalendarOverview.data?.summary,
    agenda: getCalendarOverview.data?.agenda || [],
    actionableEntries: getCalendarOverview.data?.actionableEntries || getCalendarOverview.data?.agenda || [],
    nextAction: getCalendarOverview.data?.nextAction || null,
    entries: getCalendarOverview.data?.entries || [],
    isLoading: getCalendarOverview.isLoading,
    isError: getCalendarOverview.isError,
    error: getCalendarOverview.error,
    refetch: getCalendarOverview.refetch,
  };
};

export const usePaymentSchedule = (loanId: number | null) => {
  const getSchedule = useQuery({
    queryKey: queryKeys.reports.paymentSchedule(loanId),
    queryFn: async () => {
      if (!loanId) throw new Error(tTerm('reports.export.invalidLoan'));
      const { data } = await apiClient.get(`/reports/payment-schedule/${loanId}`);
      return data as PaymentScheduleResponse;
    },
    enabled: !!loanId,
  });

  return {
    data: getSchedule.data?.data,
    loan: getSchedule.data?.data?.loan,
    summary: getSchedule.data?.data?.summary,
    schedule: getSchedule.data?.data?.schedule || [],
    isLoading: getSchedule.isLoading,
    isError: getSchedule.isError,
    error: getSchedule.error,
    refetch: getSchedule.refetch,
  };
};

export const useOperatingExpenses = (
  filters: OperatingExpenseFilters = {},
  page = 1,
  pageSize = 20,
  enabled = true,
) => {
  const params = {
    ...filters,
    page,
    pageSize,
  };

  const getOperatingExpenses = useQuery({
    queryKey: queryKeys.operatingExpenses.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/operating-expenses', { params });
      return data;
    },
    enabled,
  });

  return {
    data: getOperatingExpenses.data?.data,
    expenses: (getOperatingExpenses.data?.data?.expenses || []) as OperatingExpense[],
    pagination: getOperatingExpenses.data?.data?.pagination,
    isLoading: getOperatingExpenses.isLoading,
    isError: getOperatingExpenses.isError,
    error: getOperatingExpenses.error,
  };
};

export const createOperatingExpense = async (payload: OperatingExpensePayload) => {
  const { data } = await apiClient.post('/operating-expenses', payload);
  return data;
};

export const annulOperatingExpense = async (expenseId: number, reason: string) => {
  const { data } = await apiClient.post(`/operating-expenses/${expenseId}/annul`, { reason });
  return data;
};

// === Export Functions ===

export const exportFinancialAnalyticsReport = async (
  year: number,
  format: ReportContextualFormat = 'xlsx',
): Promise<void> => {
  const extension = format === 'pdf' ? 'pdf' : 'xlsx';
  const mimeType = format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  await downloadBlobWithParams({
    url: '/reports/analytics/export',
    fileName: `analitica_financiera_${year}.${extension}`,
    mimeType,
    params: { year, format },
  });
};

export const exportCreditsExcel = async (filters: ReportContextualFilters = {}): Promise<void> => {
  await downloadBlobWithParams({
    url: '/reports/credits/excel',
    fileName: 'credits-export.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    params: {
      startDate: filters.fromDate,
      endDate: filters.toDate,
      customerId: filters.customerId,
      loanId: filters.loanId,
    },
  });
};

export const exportCreditExcel = async (loanId: number): Promise<void> => {
  await downloadBlobWithParams({
    url: '/reports/credits/excel',
    fileName: `reporte-credito-${loanId}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    params: { loanId },
  });
};

export const downloadCreditReport = async (loanId: number): Promise<void> => {
  await downloadBlob({
    url: `/reports/credit-history/loan/${loanId}/export?format=pdf`,
    fileName: `credit-${loanId}-report.pdf`,
    mimeType: 'application/pdf',
  });
};

export const exportDashboardSummary = async (format: ReportContextualFormat = 'xlsx'): Promise<void> => {
  const extension = format === 'pdf' ? 'pdf' : 'xlsx';
  const mimeType = format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  await downloadBlob({
    url: format === 'pdf' ? '/reports/dashboard/pdf' : '/reports/dashboard/excel',
    fileName: `dashboard-report.${extension}`,
    mimeType,
  });
};

export const exportMonthlyCashFlowExcel = async (
  year?: number,
  filters: MonthlyCashFlowFilters = {},
): Promise<void> => {
  await downloadBlobWithParams({
    url: '/reports/cash-flow/monthly/excel',
    fileName: `flujo-caja-mensual-${year || new Date().getFullYear()}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    params: { year, ...filters },
  });
};

export const exportMonthlyCashFlowPdf = async (
  year?: number,
  filters: MonthlyCashFlowFilters = {},
): Promise<void> => {
  await downloadBlobWithParams({
    url: '/reports/cash-flow/monthly/pdf',
    fileName: `flujo-caja-mensual-${year || new Date().getFullYear()}.pdf`,
    mimeType: 'application/pdf',
    params: { year, ...filters },
  });
};

export const exportOperatingExpensesReport = async (
  format: OperatingExpenseExportFormat,
  filters: OperatingExpenseFilters = {},
): Promise<void> => {
  const fromDate = filters.fromDate || undefined;
  const toDate = filters.toDate || undefined;
  const suffix = `${fromDate || 'inicio'}_${toDate || 'hoy'}`;
  const extension = format === 'pdf' ? 'pdf' : 'xlsx';
  const mimeType = format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  await downloadBlobWithParams({
    url: '/reports/operating-expenses/export',
    fileName: `gastos_operativos_${suffix}.${extension}`,
    mimeType,
    params: {
      format,
      fromDate,
      toDate,
      status: filters.status,
      employeeId: filters.employeeId,
    },
  });
};

const downloadBlobWithParams = async ({
  url,
  fileName,
  mimeType,
  params,
}: {
  url: string;
  fileName: string;
  mimeType: string;
  params?: Record<string, string | number | boolean | null | undefined>;
}): Promise<void> => {
  const response = await apiClient.get(url, {
    responseType: 'blob',
    params,
  });

  const blob = new Blob([response.data], { type: mimeType });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
};

export const exportContextualReport = async (
  type: ReportContextualType,
  filters: ReportContextualFilters = {},
): Promise<void> => {
  const fromDate = filters.fromDate || undefined;
  const toDate = filters.toDate || undefined;
  const suffix = `${fromDate || 'inicio'}_${toDate || 'hoy'}`;
  const format: ReportContextualFormat = filters.format || 'xlsx';

  if (type === 'credits') {
    const extension = format === 'pdf' ? 'pdf' : 'xlsx';
    const mimeType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    await downloadBlobWithParams({
      url: '/reports/credit-history/monthly/export',
      fileName: `historial_creditos_${suffix}.${extension}`,
      mimeType,
      params: {
        format,
        startDate: fromDate,
        endDate: toDate,
        customerId: filters.customerId,
        loanId: filters.loanId,
        financialProductId: filters.financialProductId,
        status: filters.status,
      },
    });
    return;
  }

  if (type === 'profitability') {
    const extension = format === 'pdf' ? 'pdf' : 'xlsx';
    const mimeType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    await downloadBlobWithParams({
      url: '/reports/profitability/customers/export',
      fileName: `rentabilidad_clientes_${suffix}.${extension}`,
      mimeType,
      params: {
        format,
        fromDate,
        toDate,
      },
    });
    return;
  }

  const extension = format === 'pdf' ? 'pdf' : 'xlsx';
  const mimeType = format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  await downloadBlobWithParams({
    url: '/reports/payouts/export',
    fileName: `reporte_pagos_${suffix}.${extension}`,
    mimeType,
    params: {
      format,
      startDate: fromDate,
      endDate: toDate,
      customerId: filters.customerId,
      loanId: filters.loanId,
      status: filters.status,
      paymentType: filters.paymentType,
      employeeId: filters.employeeId,
    },
  });
};
