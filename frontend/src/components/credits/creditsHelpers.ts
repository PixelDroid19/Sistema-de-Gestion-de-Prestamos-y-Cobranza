import { tTerm } from '../../i18n/terminology';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisiblePortfolioStatistics = {
  totalAmount: number;
  totalCollected: number;
  totalOverdue: number;
  totalCredits: number;
  activeCredits: number;
};

export interface InstallmentEvent {
  id: string;
  loanId: number;
  title: string;
  start: Date;
  end: Date;
  type: 'paid' | 'pending' | 'overdue';
  clientName: string;
  installmentNumber: number;
  totalInstallments: number;
  amountToPay: number;
  interest: number;
  amortizedCapital: number;
  remainingCapital: number;
  arrears: number;
  payableAmount: number;
  daysOverdue: number;
  canPay: boolean;
  disabledReason: string | null;
  isNextPayable: boolean;
  status: string;
  loanStatus: string;
}

export interface CalendarOverviewSummary {
  totalLoans: number;
  totalEntries: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  dueTodayCount: number;
  actionableCount: number;
  totalPayableAmount: number;
  totalLateFeeAmount: number;
}

export interface CalendarOverviewAgendaItem {
  loanId: number;
  customerName: string;
  totalInstallments: number;
  installmentNumber: number;
  dueDate: string;
  status: string;
  payableAmount: number;
  scheduledPayment: number;
  lateFeeDue: number;
  daysOverdue: number;
  canPay: boolean;
  isNextPayable: boolean;
  disabledReason?: string | null;
}

export interface CalendarOverviewEntry extends CalendarOverviewAgendaItem {
  loanStatus: string;
  principalComponent: number;
  interestComponent: number;
  remainingBalance: number;
  outstandingAmount: number;
}

export interface CalendarOverviewResponse {
  asOfDate: string;
  summary: CalendarOverviewSummary;
  agenda: CalendarOverviewAgendaItem[];
  nextAction: CalendarOverviewAgendaItem | null;
  entries: CalendarOverviewEntry[];
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export const getStatusColumnHelp = () => tTerm('credits.help.statusColumn');
export const getRecoveryColumnHelp = () => tTerm('credits.help.recoveryColumn');

export const getLoanStatusDescription = (status?: string) => {
  switch (String(status || '').toLowerCase()) {
    case 'pending':
      return tTerm('credits.status.description.pending');
    case 'approved':
      return tTerm('credits.status.description.approved');
    case 'active':
      return tTerm('credits.status.description.active');
    case 'overdue':
      return tTerm('credits.status.description.overdue');
    case 'defaulted':
      return tTerm('credits.status.description.defaulted');
    case 'paid':
      return tTerm('credits.status.description.paid');
    case 'closed':
      return tTerm('credits.status.description.closed');
    case 'cancelled':
      return tTerm('credits.status.description.cancelled');
    case 'rejected':
      return tTerm('credits.status.description.rejected');
    default:
      return status ? tTerm('credits.status.description.default', { status }) : tTerm('credits.status.description.missing');
  }
};

export const getRecoveryStatusDescription = (credit: any) => {
  const normalizedRecoveryStatus = String(credit?.recoveryStatus || '').toLowerCase();
  const normalizedLoanStatus = String(credit?.status || '').toLowerCase();

  if (normalizedRecoveryStatus === 'overdue' || normalizedLoanStatus === 'defaulted') {
    return tTerm('credits.recovery.description.overdue');
  }
  if (normalizedRecoveryStatus === 'pending') {
    return tTerm('credits.recovery.description.pending');
  }
  if (normalizedRecoveryStatus === 'recovered') {
    return tTerm('credits.recovery.description.recovered');
  }
  if (normalizedRecoveryStatus === 'active') {
    return tTerm('credits.recovery.description.active');
  }
  if (normalizedLoanStatus === 'closed' || normalizedLoanStatus === 'paid') {
    return tTerm('credits.recovery.description.closed');
  }
  return tTerm('credits.recovery.description.current');
};

export const getLoanStatusLabel = (status: string) => {
  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus === 'active') return tTerm('common.status.active');
  if (normalizedStatus === 'pending') return tTerm('schedule.status.pending');
  if (normalizedStatus === 'approved') return tTerm('credits.status.approved');
  if (normalizedStatus === 'overdue') return tTerm('schedule.status.overdue');
  if (normalizedStatus === 'defaulted') return tTerm('credits.status.defaulted');
  if (normalizedStatus === 'paid') return tTerm('schedule.status.paid');
  if (normalizedStatus === 'closed') return tTerm('common.status.closed');
  if (normalizedStatus === 'cancelled') return tTerm('credits.status.cancelled');
  if (normalizedStatus === 'rejected') return tTerm('credits.status.rejected');
  return status;
};

export const getRecoveryStatusLabel = (credit: any) => {
  if (credit?.recoveryStatus === 'overdue' || credit?.status === 'defaulted') return tTerm('credits.recovery.overdue');
  if (credit?.recoveryStatus === 'pending') return tTerm('credits.recovery.pending');
  if (credit?.recoveryStatus === 'recovered') return tTerm('credits.recovery.recovered');
  if (credit?.recoveryStatus === 'active') return tTerm('credits.recovery.active');
  if (credit?.recoveryStatus) return credit.recoveryStatus;
  return tTerm('credits.recovery.current');
};

export const getCalendarStatusLabel = (status: string) => {
  switch (String(status || '').toLowerCase()) {
    case 'paid':
      return tTerm('credits.modal.status.paid');
    case 'overdue':
      return tTerm('credits.modal.status.overdue');
    case 'partial':
      return tTerm('credits.calendar.status.partial');
    case 'annulled':
      return tTerm('schedule.status.annulled');
    default:
      return tTerm('schedule.status.pending');
  }
};

export const eventStyleGetter = (event: InstallmentEvent) => {
  let backgroundColor = '#3b82f6'; // pending (blue)
  if (event.type === 'paid') backgroundColor = '#10b981'; // emerald
  if (event.type === 'overdue') backgroundColor = '#ef4444'; // red

  return {
    style: {
      backgroundColor,
      borderRadius: '6px',
      opacity: 0.9,
      color: 'white',
      border: '0px',
      display: 'block',
      padding: '2px 4px',
      fontSize: '0.75rem',
      fontWeight: 500,
    },
  };
};

export const getCreditLabel = (credit: any) => {
  let name = credit?.Customer?.name || credit?.customerName || '';
  if (name) {
    name = name.replace(/(qa|seed|test|dev)\s*/ig, '').trim();
  }
  return name || (credit?.customerId ? tTerm('credits.label.customerFallback', { id: credit.customerId }) : tTerm('credits.label.customerMissing'));
};

export const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseDueDate = (value: unknown): Date | null => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
