import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export const useLoans = (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
  const queryClient = useQueryClient();

  const getLoans = useQuery({
    queryKey: ['loans.list', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/loans', { params });
      return data;
    },
  });

  const createLoan = useMutation({
    mutationFn: async (loanData: any) => {
      const { data } = await apiClient.post('/loans', loanData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans.list'] });
    },
  });

  const simulateLoan = useMutation({
    mutationFn: async (simulationData: any) => {
      const { data } = await apiClient.post('/loans/simulations', simulationData);
      return data;
    },
  });

  const updateLoanStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const { data } = await apiClient.patch(`/loans/${id}/status`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans.list'] });
    },
  });

  const deleteLoan = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.delete(`/loans/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans.list'] });
    },
  });

  return {
    data: getLoans.data,
    isLoading: getLoans.isLoading,
    isError: getLoans.isError,
    createLoan,
    simulateLoan,
    updateLoanStatus,
    deleteLoan,
  };
};

export const useLoanDetails = (loanId: number) => {
  const queryClient = useQueryClient();
  const asOfDate = new Date().toISOString().slice(0, 10);

  const getCalendar = useQuery({
    queryKey: ['loans.calendar', loanId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/loans/${loanId}/calendar`);
      return data;
    },
    enabled: !!loanId,
  });

  const getAlerts = useQuery({
    queryKey: ['loans.alerts', loanId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/loans/${loanId}/alerts`);
      return data;
    },
    enabled: !!loanId,
  });

  const getPromises = useQuery({
    queryKey: ['loans.promises', loanId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/loans/${loanId}/promises`);
      return data;
    },
    enabled: !!loanId,
  });

  const createPromise = useMutation({
    mutationFn: async (promiseData: any) => {
      const { data } = await apiClient.post(`/loans/${loanId}/promises`, promiseData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans.promises', loanId] });
    },
  });

  const createFollowUp = useMutation({
    mutationFn: async (followUpData: any) => {
      const { data } = await apiClient.post(`/loans/${loanId}/follow-ups`, followUpData);
      return data;
    },
  });

  const getPayoffQuote = useQuery({
    queryKey: ['loans.payoffQuote', loanId, asOfDate],
    queryFn: async () => {
      const { data } = await apiClient.get(`/loans/${loanId}/payoff-quote`, {
        params: { asOfDate },
      });
      return data;
    },
    enabled: !!loanId,
  });

  const executePayoff = useMutation({
    mutationFn: async (payoffData: any) => {
      const { data } = await apiClient.post(`/loans/${loanId}/payoff-executions`, payoffData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans.list'] });
      queryClient.invalidateQueries({ queryKey: ['loans.calendar', loanId] });
    },
  });

  return {
    calendar: getCalendar.data?.data?.calendar?.entries ?? [],
    calendarSnapshot: getCalendar.data?.data?.calendar?.snapshot,
    alerts: getAlerts.data?.data?.alerts,
    promises: getPromises.data?.data?.promises,
    payoffQuote: getPayoffQuote.data?.data?.payoffQuote,
    isLoading: getCalendar.isLoading || getAlerts.isLoading || getPromises.isLoading || getPayoffQuote.isLoading,
    createPromise,
    createFollowUp,
    executePayoff,
  };
};

export const useLoanById = (loanId: number) => {
  return useQuery({
    queryKey: ['loans.detail', loanId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/loans/${loanId}`);
      return data;
    },
    enabled: !!loanId,
  });
};

export interface LoanStatistics {
  counts: {
    totalCredits: number;
    activeCredits: number;
    paidCredits: number;
    overdueCredits: number;
  };
  amounts: {
    totalLoanAmount: number;
    totalCollected: number;
    totalPending: number;
    totalOverdue: number;
  };
  averages: {
    averageLoanAmount: number;
    averageTerm: number;
    collectionRate: number;
  };
}

export const useLoanStatistics = () => {
  return useQuery({
    queryKey: ['loans.statistics'],
    queryFn: async () => {
      const { data } = await apiClient.get('/loans/statistics');
      return data;
    },
  });
};

export interface DuePayment {
  creditId: number;
  customerName: string;
  installmentNumber: number;
  amountDue: number;
  dueDate: string;
  daysOverdue: number;
}

export const useDuePayments = (date: string) => {
  return useQuery({
    queryKey: ['loans.duePayments', date],
    queryFn: async () => {
      const { data } = await apiClient.get('/loans/due-payments', { params: { date } });
      return data;
    },
    enabled: !!date,
  });
};

export interface LoanSearchFilters {
  status?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
}

export interface LoanSearchResult {
  loans: any[];
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export const useSearchLoans = (filters: LoanSearchFilters, page: number = 1, pageSize: number = 25) => {
  return useQuery({
    queryKey: ['loans.search', filters, page, pageSize],
    queryFn: async () => {
      const { data } = await apiClient.get('/loans/search', {
        params: { ...filters, page, pageSize },
      });
      return data;
    },
  });
};
