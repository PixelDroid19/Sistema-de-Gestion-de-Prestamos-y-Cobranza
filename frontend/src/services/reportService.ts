import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';
import { downloadBlob } from './blobDownload';
import type { PaymentScheduleResponse, PayoutsReportFilters, PayoutsReportResponse } from '../types/reportSimulation';
import { tTerm } from '../i18n/terminology';
import type {
  CreditHistoryMonthlyFilters,
  CustomerProfitabilityFilters,
  DailyCashFlowFilters,
  MonthlyCashFlowFilters,
  OperatingExpenseListParams,
} from './queryKeys';

type ReportContextualType = 'credits' | 'payouts' | 'profitability' | 'associates';
type ReportContextualFormat = 'xlsx' | 'pdf';
type ReportContextualFilters = {
  fromDate?: string;
  toDate?: string;
  customerId?: number;
  loanId?: number;
  associateId?: number;
  status?: string;
  paymentType?: string;
  format?: ReportContextualFormat;
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

export type OperatingExpenseFilters = Pick<OperatingExpenseListParams, 'fromDate' | 'toDate' | 'status'>;
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
    lateFeesCollected: toNumber(item.lateFeesCollected ?? item.penaltyCollected),
  }));
};

export const useCustomerProfitability = (filters: CustomerProfitabilityFilters = {}) => {
  const queryFilters = useMemo(() => ({
    ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
    ...(filters.toDate ? { toDate: filters.toDate } : {}),
  }), [filters.fromDate, filters.toDate]);

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
        totalInterestGenerated: toNumber(data.metrics.totalInterestGenerated ?? data.summary?.totalInterestGenerated),
        totalInterestPaid: toNumber(data.metrics.totalInterestPaid ?? data.summary?.totalInterestPaid),
      },
    };
  }

  return {
    ...data,
    metrics: {
      totalActiveLoans: toNumber(data.summary?.activeLoans),
      totalDisbursed: toNumber(data.summary?.totalPortfolioAmount),
      totalRecovered: toNumber(data.summary?.totalRecoveredAmount),
      totalInterestGenerated: toNumber(data.summary?.totalInterestGenerated),
      totalInterestPaid: toNumber(data.summary?.totalInterestPaid),
      arrearsRate: 0,
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

// Combined hook for financial analytics dashboard
export const useFinancialAnalytics = (year?: number) => {
  const creditEarnings = useCreditEarnings();
  const interestEarnings = useInterestEarnings(year);
  const monthlyEarnings = useMonthlyEarnings(year);
  const monthlyInterest = useMonthlyInterest(year);
  const performanceAnalysis = usePerformanceAnalysis(year);
  const executiveDashboard = useExecutiveDashboard();
  const comprehensiveAnalytics = useComprehensiveAnalytics(year);
  const comparativeAnalysis = useComparativeAnalysis(year);
  const forecastAnalysis = useForecastAnalysis(year);
  const nextMonthProjection = useNextMonthProjection();

  return {
    creditEarnings,
    interestEarnings,
    monthlyEarnings,
    monthlyInterest,
    performanceAnalysis,
    executiveDashboard,
    comprehensiveAnalytics,
    comparativeAnalysis,
    forecastAnalysis,
    nextMonthProjection,
    isLoading:
      creditEarnings.isLoading ||
      interestEarnings.isLoading ||
      monthlyEarnings.isLoading ||
      monthlyInterest.isLoading ||
      performanceAnalysis.isLoading ||
      executiveDashboard.isLoading ||
      comprehensiveAnalytics.isLoading ||
      comparativeAnalysis.isLoading ||
      forecastAnalysis.isLoading ||
      nextMonthProjection.isLoading,
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

export const exportAssociatesExcel = async (
  filters: Pick<ReportContextualFilters, 'status'> = {},
): Promise<void> => {
  await downloadBlobWithParams({
    url: '/reports/associates/excel',
    fileName: 'associates-export.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    params: {
      status: filters.status,
    },
  });
};

export const exportDashboardSummary = async (): Promise<void> => {
  await downloadBlob({
    url: '/reports/dashboard/excel',
    fileName: 'dashboard-report.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
        status: filters.status,
      },
    });
    return;
  }

  if (type === 'profitability') {
    await downloadBlobWithParams({
      url: '/reports/profitability/customers/export',
      fileName: `rentabilidad_clientes_${suffix}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      params: {
        fromDate,
        toDate,
      },
    });
    return;
  }

  if (type === 'associates') {
    const extension = format === 'pdf' ? 'pdf' : 'xlsx';
    const mimeType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    await downloadBlobWithParams({
      url: '/reports/associates/export',
      fileName: `socios_inversionistas_${suffix}.${extension}`,
      mimeType,
      params: {
        format,
        fromDate,
        toDate,
        associateId: filters.associateId,
        status: filters.status,
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
    },
  });
};
