import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

type InvalidateInput = {
  loanId?: number;
  paymentsParams?: { page?: number; pageSize?: number; search?: string; status?: string };
  loansParams?: { page?: number; pageSize?: number; search?: string; status?: string };
};

const invalidateCommonLoanSurface = async (queryClient: QueryClient, loanId?: number) => {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: queryKeys.loans.listRoot }),
    queryClient.invalidateQueries({ queryKey: queryKeys.loans.statistics }),
  ];

  if (loanId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.detail(loanId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.calendar(loanId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.alerts(loanId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.promises(loanId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.creditHistory(loanId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline.loan(loanId) }),
    );
  }

  await Promise.all(invalidations);
};

export const invalidateAfterDelete = async (queryClient: QueryClient, input: InvalidateInput = {}) => {
  await invalidateCommonLoanSurface(queryClient, input.loanId);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.listRoot }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.dashboard }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.payoutsRoot }),
  ]);
};

export const invalidateAfterPayment = async (queryClient: QueryClient, input: InvalidateInput = {}) => {
  await invalidateCommonLoanSurface(queryClient, input.loanId);
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.listRoot }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.dashboard }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.payoutsRoot }),
  ];

  if (input.loanId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: ['loans.payoffQuote', input.loanId] }),
      queryClient.invalidateQueries({ queryKey: ['loans.installmentQuote', input.loanId] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.paymentSchedule(input.loanId) }),
    );
  }

  await Promise.all(invalidations);
};

export const invalidateAfterPromiseOrFollowUp = async (queryClient: QueryClient, input: InvalidateInput = {}) => {
  await invalidateCommonLoanSurface(queryClient, input.loanId);
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.listRoot }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.dashboard }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.payoutsRoot }),
  ];

  if (input.loanId) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: queryKeys.reports.paymentSchedule(input.loanId) }));
  }

  await Promise.all(invalidations);
};

export const invalidateAfterReport = async (queryClient: QueryClient, input: InvalidateInput = {}) => {
  await invalidateCommonLoanSurface(queryClient, input.loanId);
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.dashboard }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.payoutsRoot }),
  ];

  if (input.loanId) {
    invalidations.push(queryClient.invalidateQueries({ queryKey: queryKeys.reports.paymentSchedule(input.loanId) }));
  }

  await Promise.all(invalidations);
};
