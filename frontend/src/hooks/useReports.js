import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryKeys';
import { reportService } from '@/services/reportService';

export const useRecoveryReportQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.reports.recovery(),
  queryFn: reportService.getRecoveryReport,
  enabled,
});

export const useRecoveredLoansQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.reports.recovered(),
  queryFn: reportService.getRecoveredLoans,
  enabled,
});

export const useOutstandingLoansQuery = ({ enabled = true } = {}) => useQuery({
  queryKey: queryKeys.reports.outstanding(),
  queryFn: reportService.getOutstandingLoans,
  enabled,
});

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

export const useCustomerProfitabilityQuery = ({ enabled = true, filters = {} } = {}) => useQuery({
  queryKey: queryKeys.reports.customerProfitability(filters),
  queryFn: () => reportService.getCustomerProfitability(filters),
  enabled,
});

export const useLoanProfitabilityQuery = ({ enabled = true, filters = {} } = {}) => useQuery({
  queryKey: queryKeys.reports.loanProfitability(filters),
  queryFn: () => reportService.getLoanProfitability(filters),
  enabled,
});
