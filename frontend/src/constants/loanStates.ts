import { tTerm } from '../i18n/terminology';

export const BACKEND_SUPPORTED_LOAN_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'active',
  'overdue',
  'paid',
  'closed',
  'defaulted',
  'cancelled',
] as const;

export type BackendSupportedLoanStatus = typeof BACKEND_SUPPORTED_LOAN_STATUSES[number];

export const getBackendLoanStatusLabel = (status: BackendSupportedLoanStatus): string => {
  switch (status) {
    case 'pending':
      return tTerm('creditDetails.loanStatus.pending');
    case 'approved':
      return tTerm('creditDetails.loanStatus.approved');
    case 'rejected':
      return tTerm('creditDetails.loanStatus.rejected');
    case 'active':
      return tTerm('creditDetails.loanStatus.active');
    case 'overdue':
      return tTerm('creditDetails.loanStatus.overdue');
    case 'paid':
      return tTerm('creditDetails.loanStatus.paid');
    case 'closed':
      return tTerm('creditDetails.loanStatus.closed');
    case 'defaulted':
      return tTerm('creditDetails.loanStatus.defaulted');
    case 'cancelled':
      return tTerm('creditDetails.loanStatus.cancelled');
    default:
      return tTerm('creditDetails.loanStatus.missing');
  }
};
