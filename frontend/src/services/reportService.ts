import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

const toArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value : [];

export const useReports = () => {
  const getDashboardMetrics = useQuery({
    queryKey: ['reports.dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/dashboard');
      return data;
    },
  });

  const getOutstandingReport = useQuery({
    queryKey: ['reports.outstanding'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/outstanding');
      return data;
    },
  });

  const getRecoveredReport = useQuery({
    queryKey: ['reports.recovered'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/recovered');
      return data;
    },
  });

  const getRecoveryReport = useQuery({
    queryKey: ['reports.recovery'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/recovery');
      return data;
    },
  });

  const getCustomerProfitability = useQuery({
    queryKey: ['reports.profitability.customers'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/profitability/customers');
      return data;
    },
  });

  const getLoanProfitability = useQuery({
    queryKey: ['reports.profitability.loans'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/profitability/loans');
      return data;
    },
  });

  return {
    dashboardData: getDashboardMetrics.data?.data,
    outstandingData: getOutstandingReport.data,
    recoveredData: getRecoveredReport.data,
    recoveryData: getRecoveryReport.data,
    customerProfitabilityData: getCustomerProfitability.data,
    loanProfitabilityData: getLoanProfitability.data,
    monthlyPerformance: toArray(getDashboardMetrics.data?.data?.monthlyPerformance),
    statusBreakdown: toArray(getOutstandingReport.data?.data?.byStatus),
    overdueLoans: toArray(getOutstandingReport.data?.data?.items ?? getOutstandingReport.data?.data?.overdueLoans),
    profitabilityItems: toArray(getCustomerProfitability.data?.data?.items),
    isLoading:
      getDashboardMetrics.isLoading ||
      getOutstandingReport.isLoading ||
      getRecoveryReport.isLoading ||
      getCustomerProfitability.isLoading,
    isError:
      getDashboardMetrics.isError ||
      getOutstandingReport.isError ||
      getRecoveryReport.isError ||
      getCustomerProfitability.isError,
    error:
      getDashboardMetrics.error ||
      getOutstandingReport.error ||
      getRecoveryReport.error ||
      getCustomerProfitability.error,
  };
};

export const useCustomerReports = (customerId: number) => {
  const getCustomerHistory = useQuery({
    queryKey: ['reports.customerHistory', customerId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/reports/customer-history/${customerId}`);
      return data;
    },
    enabled: !!customerId,
  });

  const getCustomerCreditProfile = useQuery({
    queryKey: ['reports.customerCreditProfile', customerId],
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
    queryKey: ['reports.creditHistory', loanId],
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
    queryKey: ['reports.creditEarnings'],
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
    queryKey: ['reports.interestEarnings', year],
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
    queryKey: ['reports.monthlyEarnings', year],
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

export const useMonthlyInterest = (year?: number) => {
  const getMonthlyInterest = useQuery({
    queryKey: ['reports.monthlyInterest', year],
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
    queryKey: ['reports.performanceAnalysis', year],
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
    queryKey: ['reports.executiveDashboard'],
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
    queryKey: ['reports.comprehensiveAnalytics', year],
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
    queryKey: ['reports.comparativeAnalysis', year],
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
    queryKey: ['reports.forecastAnalysis', year],
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
    queryKey: ['reports.nextMonthProjection'],
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

// === Export Functions ===

export const exportCreditsExcel = async (): Promise<void> => {
  const response = await apiClient.get('/reports/credits/excel', {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'credits-export.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const exportAssociatesExcel = async (): Promise<void> => {
  const response = await apiClient.get('/reports/associates/excel', {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'associates-export.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
