import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryKeys';
import { normalizePaginationState } from '@/lib/api/pagination';
import { reportService } from '@/services/reportService';

export const useRecoveryReportQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.reports.recovery(),
  queryFn: () => reportService.getRecoveryReport(),
  enabled,
});

export const useRecoveredLoansQuery = ({ enabled = true, pagination } = {}) => {
  const normalizedPagination = normalizePaginationState(pagination);

  return useQuery({
    queryKey: queryKeys.reports.recovered(normalizedPagination),
    queryFn: () => reportService.getRecoveredLoans(normalizedPagination),
    enabled,
  });
};

export const useOutstandingLoansQuery = ({ enabled = true, pagination } = {}) => {
  const normalizedPagination = normalizePaginationState(pagination);

  return useQuery({
    queryKey: queryKeys.reports.outstanding(normalizedPagination),
    queryFn: () => reportService.getOutstandingLoans(normalizedPagination),
    enabled,
  });
};

export const useLoanCreditHistoryQuery = (loanId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.reports.creditHistory(loanId),
  queryFn: () => reportService.getLoanCreditHistory(loanId),
  enabled: enabled && Boolean(loanId),
});

export const useAssociateProfitabilityQuery = (associateId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.associates.profitability(associateId),
  queryFn: () => reportService.getAssociateProfitability(associateId),
  enabled,
});

export const useCustomerCreditProfileQuery = (customerId, { enabled = true } = {}) => useQuery({
  queryKey: queryKeys.reports.customerCreditProfile(customerId),
  queryFn: () => reportService.getCustomerCreditProfile(customerId),
  enabled: enabled && Boolean(customerId),
});

export const useCustomerProfitabilityQuery = ({ enabled = true, filters = {}, pagination } = {}) => {
  const normalizedPagination = normalizePaginationState(pagination);

  return useQuery({
    queryKey: queryKeys.reports.customerProfitability(filters, normalizedPagination),
    queryFn: () => reportService.getCustomerProfitability(filters, normalizedPagination),
    enabled,
  });
};

export const useLoanProfitabilityQuery = ({ enabled = true, filters = {}, pagination } = {}) => {
  const normalizedPagination = normalizePaginationState(pagination);

  return useQuery({
    queryKey: queryKeys.reports.loanProfitability(filters, normalizedPagination),
    queryFn: () => reportService.getLoanProfitability(filters, normalizedPagination),
    enabled,
  });
};
