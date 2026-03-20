import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { loanService } from '@/services/loanService';
import { paymentService } from '@/services/paymentService';
import { queryKeys } from '@/lib/api/queryKeys';

const resolveScope = (user) => {
  if (!user) return 'anonymous';
  if (user.role === 'customer') return `customer-${user.id}`;
  if (user.role === 'agent') return `agent-${user.id}`;
  return 'all';
};

export const useLoansQuery = ({ user, enabled = true } = {}) => useQuery({
  queryKey: queryKeys.loans.all(resolveScope(user)),
  queryFn: () => {
    if (user?.role === 'customer') return loanService.listLoansByCustomer(user.id);
    if (user?.role === 'agent') return loanService.listLoansByAgent(user.id);
    return loanService.listLoans();
  },
  enabled: enabled && Boolean(user),
});

export const useLoanDetailQuery = (loanId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.loans.detail(loanId),
  queryFn: () => loanService.getLoanById(loanId),
  enabled: enabled && Boolean(loanId),
});

export const useLoanCalendarQuery = (loanId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.loans.calendar(loanId),
  queryFn: () => loanService.getLoanCalendar(loanId),
  enabled: enabled && Boolean(loanId),
});

export const useLoanAttachmentsQuery = (loanId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.loans.attachments(loanId),
  queryFn: () => loanService.getLoanAttachments(loanId),
  enabled: enabled && Boolean(loanId),
});

export const useLoanAlertsQuery = (loanId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.loans.alerts(loanId),
  queryFn: () => loanService.getLoanAlerts(loanId),
  enabled: enabled && Boolean(loanId),
});

export const useLoanPromisesQuery = (loanId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.loans.promises(loanId),
  queryFn: () => loanService.getLoanPromises(loanId),
  enabled: enabled && Boolean(loanId),
});

export const useLoanPayoffQuoteQuery = (loanId, asOfDate, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.loans.payoffQuote(loanId, asOfDate),
  queryFn: () => loanService.getPayoffQuote(loanId, asOfDate),
  enabled: enabled && Boolean(loanId),
});

export const useLoanServicingQueries = (loans, user) => {
  const loanIds = useMemo(() => loans.map((loan) => loan.id), [loans]);

  const paymentQueries = useQueries({
    queries: loanIds.map((loanId) => ({
      queryKey: queryKeys.payments.byLoan(loanId),
      queryFn: () => paymentService.listPaymentsByLoan(loanId),
      enabled: Boolean(loanId),
    })),
  });

  const alertQueries = useQueries({
    queries: loanIds.map((loanId) => ({
      queryKey: queryKeys.loans.alerts(loanId),
      queryFn: () => loanService.getLoanAlerts(loanId),
      enabled: Boolean(loanId) && user?.role !== 'customer',
    })),
  });

  const promiseQueries = useQueries({
    queries: loanIds.map((loanId) => ({
      queryKey: queryKeys.loans.promises(loanId),
      queryFn: () => loanService.getLoanPromises(loanId),
      enabled: Boolean(loanId) && user?.role !== 'customer',
    })),
  });

  const attachmentQueries = useQueries({
    queries: loanIds.map((loanId) => ({
      queryKey: queryKeys.loans.attachments(loanId),
      queryFn: () => loanService.getLoanAttachments(loanId),
      enabled: Boolean(loanId),
    })),
  });

  return {
    paymentQueries,
    alertQueries,
    promiseQueries,
    attachmentQueries,
  };
};

const invalidateLoanScope = (queryClient, user, loanId = null) => {
  queryClient.invalidateQueries({ queryKey: ['loans'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.loans.all(resolveScope(user)) });
  queryClient.invalidateQueries({ queryKey: ['payments'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['reports'] });
  if (loanId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.loans.detail(loanId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.loans.payments(loanId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.loans.alerts(loanId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.loans.calendar(loanId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.loans.promises(loanId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.loans.attachments(loanId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.creditHistory(loanId) });
  }
};

export const useCreateLoanMutation = (user) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loanService.createLoan,
    onSuccess: () => invalidateLoanScope(queryClient, user),
  });
};

export const useSimulateLoanMutation = () => useMutation({ mutationFn: loanService.simulateLoan });

export const useUpdateLoanStatusMutation = (user) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, status }) => loanService.updateLoanStatus(loanId, status),
    onSuccess: (_response, variables) => invalidateLoanScope(queryClient, user, variables.loanId),
  });
};

export const useAssignAgentMutation = (user) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, agentId }) => loanService.assignAgent(loanId, agentId),
    onSuccess: (_response, variables) => invalidateLoanScope(queryClient, user, variables.loanId),
  });
};

export const useUpdateRecoveryStatusMutation = (user) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, recoveryStatus }) => loanService.updateRecoveryStatus(loanId, recoveryStatus),
    onSuccess: (_response, variables) => invalidateLoanScope(queryClient, user, variables.loanId),
  });
};

export const useCreateLoanPromiseMutation = (user) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, payload }) => loanService.createLoanPromise(loanId, payload),
    onSuccess: (_response, variables) => invalidateLoanScope(queryClient, user, variables.loanId),
  });
};

export const useUploadLoanAttachmentMutation = (user) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, formData }) => loanService.uploadLoanAttachment(loanId, formData),
    onSuccess: (_response, variables) => invalidateLoanScope(queryClient, user, variables.loanId),
  });
};

export const useDeleteLoanMutation = (user) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loanService.deleteLoan,
    onSuccess: (_response, loanId) => invalidateLoanScope(queryClient, user, loanId),
  });
};

export const useExecutePayoffMutation = (user) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, payload }) => loanService.executePayoff(loanId, payload),
    onSuccess: (_response, variables) => invalidateLoanScope(queryClient, user, variables.loanId),
  });
};
