import { useQuery } from '@tanstack/react-query';
import { reportService } from '@/services/reportService';
import { loanService } from '@/services/loanService';
import { paymentService } from '@/services/paymentService';
import { queryKeys } from '@/lib/api/queryKeys';

export const useDashboardSummaryQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.dashboard.summary(),
  queryFn: reportService.getDashboardSummary,
  enabled,
});

export const useLoansOverviewQuery = ({ user, enabled = true } = {}) => useQuery({
  queryKey: queryKeys.loans.all(user?.role === 'customer' ? `customer-${user?.id}` : user?.role === 'agent' ? `agent-${user?.id}` : 'all'),
  queryFn: () => {
    if (user?.role === 'customer') return loanService.listLoansByCustomer(user.id);
    if (user?.role === 'agent') return loanService.listLoansByAgent(user.id);
    return loanService.listLoans();
  },
  enabled: enabled && Boolean(user),
});

export const usePaymentsOverviewQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.payments.all(),
  queryFn: paymentService.listPayments,
  enabled,
});
