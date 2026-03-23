import { useQuery } from '@tanstack/react-query';
import { reportService } from '@/services/reportService';
import { loanService } from '@/services/loanService';
import { paymentService } from '@/services/paymentService';
import { queryKeys } from '@/lib/api/queryKeys';

const OVERVIEW_PAGINATION = { page: 1, pageSize: 10 };
const resolveLoanScope = (user) => {
  if (user?.role === 'customer') return `customer-${user?.id}`;
  return 'all';
};

export const useDashboardSummaryQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.dashboard.summary(),
  queryFn: reportService.getDashboardSummary,
  enabled,
});

export const useLoansOverviewQuery = ({ user, enabled = true } = {}) => useQuery({
  queryKey: queryKeys.loans.paged(resolveLoanScope(user), OVERVIEW_PAGINATION),
  queryFn: () => {
    if (user?.role === 'customer') return loanService.listLoansByCustomer(user.id, OVERVIEW_PAGINATION);
    return loanService.listLoans(OVERVIEW_PAGINATION);
  },
  enabled: enabled && Boolean(user),
});

export const usePaymentsOverviewQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.payments.paged(OVERVIEW_PAGINATION),
  queryFn: () => paymentService.listPayments(OVERVIEW_PAGINATION),
  enabled,
});
