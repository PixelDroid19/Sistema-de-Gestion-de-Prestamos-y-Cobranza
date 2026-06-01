import { tTerm } from '../../i18n/terminology';
import { getPaymentTypeLabel } from '../../constants/paymentTypes';
import { TableStatusPill } from '../shared/tables';
import { formatOperationalStatus } from './creditDetailsHelpers';

export const paymentTypeBadgeClass = (entry: any) => {
  if (entry.type === 'payoff') {
    return 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300';
  }
  if (entry.paymentType === 'capital') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300';
  }
  if (entry.paymentType === 'partial') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
  }
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
};

export const paymentStatusBadgeClass = (entry: any) => {
  if (entry.status === 'completed' || entry.paymentStatus === 'completed') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
  }
  if (entry.status === 'failed' || entry.paymentStatus === 'failed') {
    return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
  }
  return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
};

export function PaymentTypeBadge({ entry }: { entry: any }) {
  const label = entry.type === 'payoff'
    ? tTerm('creditDetails.payouts.type.payoff')
    : getPaymentTypeLabel(entry.paymentType);

  return (
    <TableStatusPill className={paymentTypeBadgeClass(entry)}>
      {label}
    </TableStatusPill>
  );
}

export function PaymentStatusBadge({ entry }: { entry: any }) {
  return (
    <TableStatusPill className={paymentStatusBadgeClass(entry)}>
      {formatOperationalStatus(entry.status || entry.paymentStatus || 'pending')}
    </TableStatusPill>
  );
}
