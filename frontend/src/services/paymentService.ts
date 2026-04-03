import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';
import { invalidateAfterPayment } from './operationalInvalidation';
import { downloadBlob } from './blobDownload';

/**
 * Download a payment voucher PDF.
 * @param paymentId - The payment ID
 */
export const downloadVoucher = async (paymentId: number | string): Promise<void> => {
  await downloadBlob({
    url: `/payments/${paymentId}/voucher/pdf`,
    fileName: `voucher-${paymentId}.pdf`,
    mimeType: 'application/pdf',
  });
};

export const usePayments = (params?: { page?: number; pageSize?: number; search?: string; status?: string }) => {
  const queryClient = useQueryClient();

  const getPayments = useQuery({
    queryKey: queryKeys.payments.list(params),
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
      invalidateAfterPayment(queryClient, { paymentsParams: params });
    },
  });

  const createPartialPayment = useMutation({
    mutationFn: async (paymentData: any) => {
      const { data } = await apiClient.post('/payments/partial', paymentData);
      return data;
    },
    onSuccess: () => {
      invalidateAfterPayment(queryClient, { paymentsParams: params });
    },
  });

  const createCapitalPayment = useMutation({
    mutationFn: async (paymentData: any) => {
      const { data } = await apiClient.post('/payments/capital', paymentData);
      return data;
    },
    onSuccess: () => {
      invalidateAfterPayment(queryClient, { paymentsParams: params });
    },
  });

  const annulInstallment = useMutation({
    mutationFn: async ({ loanId, installmentNumber, reason }: { loanId: number; installmentNumber?: number; reason?: string }) => {
      const { data } = await apiClient.post(`/payments/annul/${loanId}`, { installmentNumber, reason });
      return data;
    },
    onSuccess: () => {
      invalidateAfterPayment(queryClient, { paymentsParams: params });
    },
  });

  const updatePaymentMetadata = useMutation({
    mutationFn: async ({ paymentId, payload }: { paymentId: number; payload: Record<string, unknown> }) => {
      const { data } = await apiClient.patch(`/payments/${paymentId}/metadata`, payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      invalidateAfterPayment(queryClient, { paymentsParams: params, loanId: Number((variables.payload as any)?.loanId) || undefined });
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
    updatePaymentMetadata,
  };
};
