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

const mergeById = (items, nextItem, { appendIfMissing = false, sort } = {}) => {
  if (!Array.isArray(items) || !nextItem) return items;

  let found = false;
  const nextItems = items.map((item) => {
    if (Number(item?.id) !== Number(nextItem.id)) {
      return item;
    }

    found = true;
    return { ...item, ...nextItem };
  });

  if (!found && appendIfMissing) {
    nextItems.push(nextItem);
  }

  return typeof sort === 'function' ? [...nextItems].sort(sort) : nextItems;
};

const updateLoanResponse = (current, updatedLoan) => {
  if (!current || !updatedLoan) return current;

  if (Array.isArray(current?.data?.loans)) {
    return {
      ...current,
      data: {
        ...current.data,
        loans: mergeById(current.data.loans, updatedLoan),
      },
    };
  }

  if (Array.isArray(current?.data)) {
    return {
      ...current,
      data: mergeById(current.data, updatedLoan),
    };
  }

  if (current?.data?.loan && Number(current.data.loan.id) === Number(updatedLoan.id)) {
    return {
      ...current,
      data: {
        ...current.data,
        loan: {
          ...current.data.loan,
          ...updatedLoan,
        },
      },
    };
  }

  return current;
};

const updateNestedCollectionResponse = (current, collectionKey, nextItem, options) => {
  if (!nextItem) return current;

  const items = Array.isArray(current?.data?.[collectionKey])
    ? current.data[collectionKey]
    : [];

  const nextItems = mergeById(items, nextItem, options);

  return {
    ...current,
    success: current?.success ?? true,
    count: nextItems.length,
    data: {
      ...(current?.data || {}),
      [collectionKey]: nextItems,
    },
  };
};

const mergeLoanIntoCaches = (queryClient, updatedLoan) => {
  if (!updatedLoan || !updatedLoan.id) return;

  queryClient.setQueriesData({ queryKey: ['loans'] }, (current) => updateLoanResponse(current, updatedLoan));
};

const mergeAlertIntoCache = (queryClient, loanId, updatedAlert) => {
  if (!loanId || !updatedAlert || !updatedAlert.id) return;

  queryClient.setQueryData(
    queryKeys.loans.alerts(loanId),
    (current) => updateNestedCollectionResponse(current, 'alerts', updatedAlert),
  );
};

const mergePromiseIntoCache = (queryClient, loanId, promise) => {
  if (!loanId || !promise) {
    return;
  }

  queryClient.setQueryData(
    queryKeys.loans.promises(loanId),
    (current) => {
      const result = updateNestedCollectionResponse(current, 'promises', promise, {
        appendIfMissing: true,
        sort: (left, right) => {
          const leftDate = new Date(left.promisedDate || 0).getTime();
          const rightDate = new Date(right.promisedDate || 0).getTime();

          if (leftDate !== rightDate) {
            return leftDate - rightDate;
          }

          return Number(right.id || 0) - Number(left.id || 0);
        },
      });
      return result;
    },
  );
};

const invalidatePromiseSideEffects = async (queryClient, loanId) => {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['reports'] }),
  ];

  if (loanId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.detail(loanId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.promises(loanId) }),
    );
  }

  await Promise.all(invalidations);
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

const invalidateLoanScope = async (queryClient, user, loanId = null) => {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: ['loans'] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.loans.all(resolveScope(user)) }),
    queryClient.invalidateQueries({ queryKey: ['payments'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['reports'] }),
  ];

  if (loanId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.detail(loanId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.payments(loanId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.alerts(loanId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.calendar(loanId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.promises(loanId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.attachments(loanId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.creditHistory(loanId) }),
    );
  }

  await Promise.all(invalidations);
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
    onSuccess: async (response, variables) => {
      mergeLoanIntoCaches(queryClient, response?.data?.loan);
      await invalidateLoanScope(queryClient, user, variables.loanId);
    },
  });
};

export const useCreateLoanPromiseMutation = (user) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, payload }) => loanService.createLoanPromise(loanId, payload),
    onSuccess: async (response, variables) => {
      mergePromiseIntoCache(queryClient, variables.loanId, response?.data?.promise);
      await invalidatePromiseSideEffects(queryClient, variables.loanId);
    },
  });
};

export const useCreateLoanFollowUpMutation = (user) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, payload }) => loanService.createLoanFollowUp(loanId, payload),
    onSuccess: (_response, variables) => invalidateLoanScope(queryClient, user, variables.loanId),
  });
};

export const useUpdateLoanAlertStatusMutation = (user) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, alertId, payload }) => loanService.updateLoanAlertStatus(loanId, alertId, payload),
    onSuccess: async (response, variables) => {
      mergeAlertIntoCache(queryClient, variables.loanId, response?.data?.alert);
      await invalidateLoanScope(queryClient, user, variables.loanId);
    },
  });
};

export const useUpdateLoanPromiseStatusMutation = (user) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, promiseId, payload }) => loanService.updateLoanPromiseStatus(loanId, promiseId, payload),
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
