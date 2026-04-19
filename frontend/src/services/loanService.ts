import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';
import {
  invalidateAfterDelete,
  invalidateAfterPayment,
  invalidateAfterPromiseOrFollowUp,
} from './operationalInvalidation';

// Payment method options
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'check', label: 'Cheque' },
  { value: 'other', label: 'Otro' },
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number]['value'];

// Capital payment strategy
export const CAPITAL_STRATEGIES = [
  { value: 'reduce_term', label: 'Reducir plazo' },
  { value: 'reduce_payment', label: 'Reducir cuota' },
] as const;

export type CapitalStrategy = typeof CAPITAL_STRATEGIES[number]['value'];

export const useLoans = (
  params?: { page?: number; pageSize?: number; search?: string; status?: string },
  options?: { enabled?: boolean },
) => {
  const queryClient = useQueryClient();

  const getLoans = useQuery({
    queryKey: queryKeys.loans.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/loans', { params });
      return data;
    },
    enabled: options?.enabled ?? true,
  });

  const createLoan = useMutation({
    mutationFn: async (loanData: any) => {
      const { data } = await apiClient.post('/loans', loanData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.listRoot });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.listRoot });
    },
  });

  const deleteLoan = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.delete(`/loans/${id}`);
      return data;
    },
    onSuccess: () => {
      invalidateAfterDelete(queryClient, { loansParams: params });
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

type LoanDetailsQueryOptions = {
  includeAlerts?: boolean;
  includePromises?: boolean;
  includePayoffQuote?: boolean;
};

export const useLoanDetails = (loanId: number, options: LoanDetailsQueryOptions = {}) => {
  const queryClient = useQueryClient();
  const asOfDate = new Date().toISOString().slice(0, 10);

  const getCalendar = useQuery({
    queryKey: queryKeys.loans.calendar(loanId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/loans/${loanId}/calendar`);
      return data;
    },
    enabled: !!loanId,
  });

  const getAlerts = useQuery({
    queryKey: queryKeys.loans.alerts(loanId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/loans/${loanId}/alerts`);
      return data;
    },
    enabled: Boolean(loanId) && (options.includeAlerts ?? true),
  });

  const getPromises = useQuery({
    queryKey: queryKeys.loans.promises(loanId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/loans/${loanId}/promises`);
      return data;
    },
    enabled: Boolean(loanId) && (options.includePromises ?? true),
  });

  const createPromise = useMutation({
    mutationFn: async (promiseData: any) => {
      const { data } = await apiClient.post(`/loans/${loanId}/promises`, promiseData);
      return data;
    },
    onSuccess: () => {
      invalidateAfterPromiseOrFollowUp(queryClient, { loanId });
    },
  });

  const createFollowUp = useMutation({
    mutationFn: async (followUpData: any) => {
      const { data } = await apiClient.post(`/loans/${loanId}/follow-ups`, followUpData);
      return data;
    },
    onSuccess: () => {
      invalidateAfterPromiseOrFollowUp(queryClient, { loanId });
    },
  });

  const getPayoffQuote = useQuery({
    queryKey: queryKeys.loans.payoffQuote(loanId, asOfDate),
    queryFn: async () => {
      const { data } = await apiClient.get(`/loans/${loanId}/payoff-quote`, {
        params: { asOfDate },
      });
      return data;
    },
    enabled: Boolean(loanId) && (options.includePayoffQuote ?? true),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const executePayoff = useMutation({
    mutationFn: async (payoffData: any) => {
      const { data } = await apiClient.post(`/loans/${loanId}/payoff-executions`, payoffData);
      return data;
    },
    onSuccess: () => {
      invalidateAfterPayment(queryClient, { loanId });
    },
  });

  const recordPayment = useMutation({
    mutationFn: async (paymentData: { paymentAmount: number; paymentDate: string; paymentMethod?: string; installmentNumber?: number }) => {
      const { data } = await apiClient.post(`/loans/payments/process`, {
        loanId,
        ...paymentData,
      });
      return data;
    },
    onSuccess: () => {
      invalidateAfterPayment(queryClient, { loanId });
    },
  });

  const annulInstallment = useMutation({
    mutationFn: async ({ installmentNumber, reason }: { installmentNumber: number; reason?: string }) => {
      const { data } = await apiClient.post(`/loans/${loanId}/installments/${installmentNumber}/annul`, {
        reason,
      });
      return data;
    },
    onSuccess: () => {
      invalidateAfterPayment(queryClient, { loanId });
    },
  });

  const updatePaymentMethod = useMutation({
    mutationFn: async ({ paymentId, paymentMethod }: { paymentId: number; paymentMethod: string }) => {
      const { data } = await apiClient.patch(`/loans/${loanId}/payments/${paymentId}`, {
        paymentMethod,
      });
      return data;
    },
    onSuccess: () => {
      invalidateAfterPayment(queryClient, { loanId });
    },
  });

  const recordCapitalPayment = useMutation({
    mutationFn: async (paymentData: { amount: number; paymentDate?: string; strategy?: CapitalStrategy }) => {
      const { data } = await apiClient.post(`/payments/capital`, {
        loanId,
        ...paymentData,
      });
      return data;
    },
    onSuccess: () => {
      invalidateAfterPayment(queryClient, { loanId });
    },
  });

  const updateLateFeeRate = useMutation({
    mutationFn: async (lateFeeRate: number) => {
      const { data } = await apiClient.patch(`/loans/${loanId}/late-fee-rate`, { lateFeeRate });
      return data;
    },
    onSuccess: () => {
      invalidateAfterPayment(queryClient, { loanId });
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
    recordPayment,
    annulInstallment,
    updatePaymentMethod,
    recordCapitalPayment,
    updateLateFeeRate,
  };
};

export const useLoanById = (loanId: number) => {
  return useQuery({
    queryKey: queryKeys.loans.detail(loanId),
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

export const useLoanStatistics = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.loans.statistics,
    queryFn: async () => {
      const { data } = await apiClient.get('/loans/statistics');
      return data;
    },
    enabled: options?.enabled ?? true,
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
    queryKey: queryKeys.loans.duePayments(date),
    queryFn: async () => {
      const { data } = await apiClient.get('/loans/due-payments', { params: { date } });
      return data;
    },
    enabled: !!date,
  });
};

export interface LoanSearchFilters {
  search?: string;
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
