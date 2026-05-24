import { tTerm } from '../i18n/terminology';

/**
 * Converts installment schedule status values into operator-facing labels.
 */
export const formatScheduleStatusLabel = (status?: string) => {
  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus === 'pending') return tTerm('schedule.status.pending');
  if (normalizedStatus === 'paid' || normalizedStatus === 'settled') return tTerm('credits.modal.status.paid');
  if (normalizedStatus === 'overdue' || normalizedStatus === 'defaulted') return tTerm('credits.modal.status.overdue');
  if (normalizedStatus === 'partial') return tTerm('credits.calendar.status.partial');
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'annulled') return tTerm('schedule.status.annulled');
  return status ? tTerm('common.status.unknown') : '-';
};
