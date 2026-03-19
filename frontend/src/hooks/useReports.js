import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/api/queryKeys';
import { reportService } from '../services/reportService';

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
