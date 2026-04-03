import { BACKEND_SUPPORTED_LOAN_STATUSES } from './loanStates';

export const NON_EXECUTABLE_INSTALLMENT_STATUSES = ['paid', 'annulled'] as const;

export const CLOSED_OR_BLOCKED_LOAN_STATUSES = [
  ...BACKEND_SUPPORTED_LOAN_STATUSES.filter((status) => status === 'closed' || status === 'rejected'),
  'completed',
] as const;
