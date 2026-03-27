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
