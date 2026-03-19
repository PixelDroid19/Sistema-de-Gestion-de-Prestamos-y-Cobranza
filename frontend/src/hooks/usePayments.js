import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentService } from '../services/paymentService';
import { queryKeys } from '../lib/api/queryKeys';

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

export const useCreatePaymentMutation = (loanId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentService.createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.byLoan(loanId) });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.calendar(loanId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.detail(loanId) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};
