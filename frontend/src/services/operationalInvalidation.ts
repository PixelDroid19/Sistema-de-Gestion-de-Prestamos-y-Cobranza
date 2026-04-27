import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

type InvalidateInput = {
  loanId?: number;
  paymentsParams?: { page?: number; pageSize?: number; search?: string; status?: string };
  loansParams?: { page?: number; pageSize?: number; search?: string; status?: string };
};

const invalidateCommonLoanSurface = async (queryClient: QueryClient, loanId?: number, loansParams?: InvalidateInput['loansParams']) => {
  await queryClient.invalidateQueries({ queryKey: queryKeys.loans.listRoot });
  await queryClient.invalidateQueries({ queryKey: queryKeys.loans.statistics });

  if (loanId) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.loans.detail(loanId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.loans.calendar(loanId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.loans.alerts(loanId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.loans.promises(loanId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.reports.creditHistory(loanId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.timeline.loan(loanId) });
  }
};

export const invalidateAfterDelete = async (queryClient: QueryClient, input: InvalidateInput = {}) => {
  await invalidateCommonLoanSurface(queryClient, input.loanId, input.loansParams);
  await queryClient.invalidateQueries({ queryKey: queryKeys.payments.listRoot });
  await queryClient.invalidateQueries({ queryKey: queryKeys.reports.dashboard });
  await queryClient.invalidateQueries({ queryKey: queryKeys.reports.payoutsRoot });
};

export const invalidateAfterPayment = async (queryClient: QueryClient, input: InvalidateInput = {}) => {
  await invalidateCommonLoanSurface(queryClient, input.loanId, input.loansParams);
  await queryClient.invalidateQueries({ queryKey: queryKeys.payments.listRoot });
  await queryClient.invalidateQueries({ queryKey: queryKeys.reports.dashboard });
  await queryClient.invalidateQueries({ queryKey: queryKeys.reports.payoutsRoot });

  if (input.loanId) {
    await queryClient.invalidateQueries({ queryKey: ['loans.payoffQuote', input.loanId] });
    await queryClient.invalidateQueries({ queryKey: queryKeys.reports.paymentSchedule(input.loanId) });
  }
};

export const invalidateAfterPromiseOrFollowUp = async (queryClient: QueryClient, input: InvalidateInput = {}) => {
  await invalidateCommonLoanSurface(queryClient, input.loanId, input.loansParams);
  await queryClient.invalidateQueries({ queryKey: queryKeys.payments.listRoot });
  await queryClient.invalidateQueries({ queryKey: queryKeys.reports.dashboard });
  await queryClient.invalidateQueries({ queryKey: queryKeys.reports.payoutsRoot });

  if (input.loanId) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.reports.paymentSchedule(input.loanId) });
  }
};

export const invalidateAfterReport = async (queryClient: QueryClient, input: InvalidateInput = {}) => {
  await invalidateCommonLoanSurface(queryClient, input.loanId, input.loansParams);
  await queryClient.invalidateQueries({ queryKey: queryKeys.reports.dashboard });
  await queryClient.invalidateQueries({ queryKey: queryKeys.reports.payoutsRoot });

  if (input.loanId) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.reports.paymentSchedule(input.loanId) });
  }
};
