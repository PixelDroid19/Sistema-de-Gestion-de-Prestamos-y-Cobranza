import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';
import { invalidateAfterPayment } from './operationalInvalidation';
import { downloadBlob } from './blobDownload';
import { withIdempotencyKey } from './idempotency';

/**
 * Download a payment voucher PDF.
 * @param paymentId - Payment record identifier used by the API route.
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
      const { data } = await apiClient.post('/payments', paymentData, withIdempotencyKey('payment'));
      return data;
    },
    onSuccess: () => {
      invalidateAfterPayment(queryClient, { paymentsParams: params });
    },
  });

  const createPartialPayment = useMutation({
    mutationFn: async (paymentData: any) => {
      const { data } = await apiClient.post('/payments/partial', paymentData, withIdempotencyKey('partial-payment'));
      return data;
    },
    onSuccess: () => {
      invalidateAfterPayment(queryClient, { paymentsParams: params });
    },
  });

  const createCapitalPayment = useMutation({
    mutationFn: async (paymentData: any) => {
      const { data } = await apiClient.post('/payments/capital', paymentData, withIdempotencyKey('capital-payment'));
      return data;
    },
    onSuccess: () => {
      invalidateAfterPayment(queryClient, { paymentsParams: params });
    },
  });

  const annulInstallment = useMutation({
    mutationFn: async ({ loanId, installmentNumber, reason }: { loanId: number; installmentNumber?: number; reason?: string }) => {
      const { data } = await apiClient.post(`/payments/annul/${loanId}`, { installmentNumber, reason }, withIdempotencyKey('installment-annulment'));
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

export type CapitalPaymentPreviewResponse = {
  strategyRequested: string;
  strategyApplied: string;
  newTermMonths: number | null;
  exceedsPrincipal: boolean;
  before: { outstandingPrincipal: number; remainingInstallments: number; installmentAmount: number };
  after: { outstandingPrincipal: number; outstandingBalance: number; remainingInstallments: number; installmentAmount: number };
};

/**
 * Dry-run a capital prepayment against the backend so the operator preview uses the
 * exact same amortization engine as the apply path (no duplicated formulas in the UI).
 */
export const useCapitalPaymentPreview = (
  { loanId, amount, strategy, newTermMonths }: { loanId?: number | string; amount?: string; strategy?: string; newTermMonths?: string },
  options?: { enabled?: boolean },
) => useQuery({
  queryKey: queryKeys.payments.capitalPreview(loanId, amount, strategy, newTermMonths),
  enabled: (options?.enabled ?? true) && Boolean(loanId) && Number(amount) > 0,
  queryFn: async () => {
    const { data } = await apiClient.post('/payments/capital/preview', { loanId, amount, strategy, newTermMonths });
    return data?.data?.preview as CapitalPaymentPreviewResponse;
  },
});
