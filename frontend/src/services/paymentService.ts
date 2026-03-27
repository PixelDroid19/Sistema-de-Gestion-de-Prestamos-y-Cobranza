import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export const usePayments = (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
  const queryClient = useQueryClient();

  const getPayments = useQuery({
    queryKey: ['payments.list', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/payments', { params });
      return data;
    },
  });

  const createPayment = useMutation({
    mutationFn: async (paymentData: any) => {
      const { data } = await apiClient.post('/payments', paymentData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments.list'] });
      queryClient.invalidateQueries({ queryKey: ['loans.list'] });
    },
  });

  const createPartialPayment = useMutation({
    mutationFn: async (paymentData: any) => {
      const { data } = await apiClient.post('/payments/partial', paymentData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments.list'] });
      queryClient.invalidateQueries({ queryKey: ['loans.list'] });
    },
  });

  const createCapitalPayment = useMutation({
    mutationFn: async (paymentData: any) => {
      const { data } = await apiClient.post('/payments/capital', paymentData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments.list'] });
      queryClient.invalidateQueries({ queryKey: ['loans.list'] });
    },
  });

  const annulInstallment = useMutation({
    mutationFn: async ({ loanId, reason }: { loanId: number; reason?: string }) => {
      const { data } = await apiClient.post(`/payments/annul/${loanId}`, { reason });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments.list'] });
      queryClient.invalidateQueries({ queryKey: ['loans.list'] });
    },
  });

  return {
    data: getPayments.data,
    isLoading: getPayments.isLoading,
    isError: getPayments.isError,
    createPayment,
    createPartialPayment,
    createCapitalPayment,
    annulInstallment,
  };
};
