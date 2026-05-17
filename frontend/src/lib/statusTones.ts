import type { ChipTone } from '../constants/uiChips';

/**
 * Canonical loan status → chip tone mapping.
 * Reused by Credits list, calendar view, and credit details.
 */
export const getLoanStatusTone = (status?: string): ChipTone => {
  switch (String(status || '').toLowerCase()) {
    case 'active':
    case 'approved':
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'overdue':
    case 'defaulted':
    case 'rejected':
      return 'danger';
    case 'closed':
    case 'cancelled':
      return 'neutral';
    default:
      return 'info';
  }
};

/**
 * Installment/calendar status → chip tone mapping.
 */
export const getInstallmentStatusTone = (status: string): ChipTone => {
  switch (String(status || '').toLowerCase()) {
    case 'paid':
      return 'success';
    case 'overdue':
      return 'danger';
    case 'partial':
      return 'warning';
    case 'annulled':
      return 'neutral';
    default:
      return 'info';
  }
};

/**
 * Payout/payment status → label + tone mapping.
 */
export const getPayoutStatusTone = (status?: string): ChipTone => {
  switch (String(status || '').toLowerCase()) {
    case 'applied':
    case 'completed':
      return 'success';
    case 'annulled':
      return 'neutral';
    case 'failed':
      return 'danger';
    default:
      return 'warning';
  }
};
