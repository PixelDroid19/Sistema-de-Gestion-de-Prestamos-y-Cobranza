import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useSessionStore } from '../store/sessionStore';

/**
 * Download a payment voucher PDF.
 * @param paymentId - The payment ID
 */
export const downloadVoucher = async (paymentId: number | string): Promise<void> => {
  const token = useSessionStore.getState().accessToken;
  const response = await fetch(`/api/payments/${paymentId}/voucher/pdf`, {
    method: 'GET',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Payment not found');
    }
    if (response.status === 403) {
      throw new Error('You do not have access to this payment');
    }
    throw new Error('Failed to download voucher');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `voucher-${paymentId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

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
