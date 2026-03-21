import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentService } from '@/services/paymentService';
import { queryKeys } from '@/lib/api/queryKeys';

export const usePaymentsQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.payments.all(),
  queryFn: paymentService.listPayments,
  enabled,
});

export const usePaymentsByLoanQuery = (loanId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.payments.byLoan(loanId),
  queryFn: () => paymentService.listPaymentsByLoan(loanId),
  enabled: enabled && Boolean(loanId),
});

export const usePaymentDocumentsQuery = (paymentId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.payments.documents(paymentId),
  queryFn: () => paymentService.listPaymentDocuments(paymentId),
  enabled: enabled && Boolean(paymentId),
});

const invalidatePaymentQueries = (queryClient, loanId) => {
  queryClient.invalidateQueries({ queryKey: ['payments'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.payments.byLoan(loanId) });
  queryClient.invalidateQueries({ queryKey: ['loans'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.loans.calendar(loanId) });
  queryClient.invalidateQueries({ queryKey: ['loans', loanId, 'payoff-quote'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.loans.detail(loanId) });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['reports'] });
};

export const useCreatePaymentMutation = (loanId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentService.createPayment,
    onSuccess: () => {
      invalidatePaymentQueries(queryClient, loanId);
    },
  });
};

export const useCreatePartialPaymentMutation = (loanId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentService.createPartialPayment,
    onSuccess: () => {
      invalidatePaymentQueries(queryClient, loanId);
    },
  });
};

export const useCreateCapitalPaymentMutation = (loanId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentService.createCapitalPayment,
    onSuccess: () => {
      invalidatePaymentQueries(queryClient, loanId);
    },
  });
};

export const useAnnulInstallmentMutation = (loanId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => paymentService.annulInstallment(loanId),
    onSuccess: () => {
      invalidatePaymentQueries(queryClient, loanId);
    },
  });
};

export const useUploadPaymentDocumentMutation = (paymentId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData) => paymentService.uploadPaymentDocument(paymentId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.documents(paymentId) });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};
