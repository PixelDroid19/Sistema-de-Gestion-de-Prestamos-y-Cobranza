import { tTerm } from '../../i18n/terminology';
import { formatLoanAlertTypeLabel } from '../../lib/loanAlertLabels';
import { parsePositiveIntegerInput, parsePositiveMoneyInput } from '../../lib/moneyInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PayoffDenialReason = string | { code?: string; message?: string };

export type StatusPresentation = { label: string; className: string };

export type AlertPresentation = {
  typeLabel: string;
  statusLabel: string;
  statusClassName: string;
  iconClassName: string;
  summary: string;
  installmentLabel: string;
  balanceLabel: string;
  notes: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PAYABLE_STATUSES = new Set(['pending', 'overdue', 'partial']);

// ---------------------------------------------------------------------------
// Denial reason formatters
// ---------------------------------------------------------------------------

const TECHNICAL_DENIAL_MESSAGE_PATTERN = /(?:calculationProfileVersionId|calculationVersionId|policySnapshot|payableInterestAmount|state[_\s-]?machine|sequelize|sql|constraint|stack|trace|exception|[A-Za-z]+(?:Resolver|Builder)|\b[A-Za-z]+Id\b)/i;
const OPERATOR_DENIAL_MESSAGE_PATTERN = /^(?:Debe|El|La|Este|Esta|Hay|Primero|No se puede|No hay|Ya no)\b/i;

const formatSafeDenialMessage = (
  message: string | undefined,
  fallbackKey: 'creditDetails.payoff.denial.generic' | 'creditDetails.capital.denial.generic',
) => {
  const normalizedMessage = message?.trim() || '';
  if (
    normalizedMessage
    && OPERATOR_DENIAL_MESSAGE_PATTERN.test(normalizedMessage)
    && !TECHNICAL_DENIAL_MESSAGE_PATTERN.test(normalizedMessage)
  ) {
    return normalizedMessage;
  }

  return tTerm(fallbackKey);
};

export function formatPayoffDenialReason(reason: PayoffDenialReason | null): string {
  if (!reason) return '';
  if (typeof reason === 'string') {
    return formatSafeDenialMessage(reason, 'creditDetails.payoff.denial.generic');
  }
  if (reason.code) {
    switch (reason.code) {
      case 'LOAN_ALREADY_PAID':
      case 'NO_OUTSTANDING_BALANCE':
        return tTerm('creditDetails.payoff.denial.noOutstandingBalance');
      case 'LOAN_NOT_PAYABLE_STATUS':
        return tTerm('creditDetails.payoff.denial.invalidStatus');
      case 'PAYOFF_BEFORE_LOAN_START':
        return tTerm('creditDetails.payoff.denial.beforeLoanStart');
      case 'OVERDUE_UNPAID_INSTALLMENTS':
        return tTerm('creditDetails.payoff.denial.overdueInstallments');
      case 'FINANCIAL_BLOCK':
        return tTerm('creditDetails.payoff.denial.financialBlock');
      default:
        return tTerm('creditDetails.payoff.denial.generic');
    }
  }
  return formatSafeDenialMessage(reason.message, 'creditDetails.payoff.denial.generic');
}

export function formatCapitalPaymentDenialReason(reason: PayoffDenialReason | null): string {
  if (!reason) return '';
  if (typeof reason === 'string') {
    return formatSafeDenialMessage(reason, 'creditDetails.capital.denial.generic');
  }
  if (reason.code) {
    switch (reason.code) {
      case 'FIRST_INSTALLMENT_PAYMENT_REQUIRED':
        return tTerm('creditDetails.capital.denial.firstInstallmentRequired');
      case 'NO_OUTSTANDING_BALANCE':
        return tTerm('creditDetails.capital.denial.noOutstandingBalance');
      case 'LOAN_NOT_PAYABLE_STATUS':
        return tTerm('creditDetails.capital.denial.invalidStatus');
      case 'OVERDUE_UNPAID_INSTALLMENTS':
        return tTerm('creditDetails.capital.denial.overdueInstallments');
      case 'FINANCIAL_BLOCK':
        return tTerm('creditDetails.capital.denial.financialBlock');
      case 'PARTIAL_INSTALLMENT_PENDING':
        return tTerm('creditDetails.capital.denial.partialInstallmentPending');
      case 'DUE_INTEREST_PENDING':
        return tTerm('creditDetails.capital.denial.dueInterestPending');
      default:
        return tTerm('creditDetails.capital.denial.generic');
    }
  }
  return formatSafeDenialMessage(reason.message, 'creditDetails.capital.denial.generic');
}

// ---------------------------------------------------------------------------
// Key generators
// ---------------------------------------------------------------------------

export function stableCreditKey(prefix: string, ...parts: Array<unknown>): string {
  const body = parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join('-');
  return body ? `${prefix}-${body}` : prefix;
}

export function getInstallmentRowKey(row: any): string {
  return stableCreditKey(
    'installment',
    row?.id,
    row?.installmentNumber,
    row?.dueDate,
    row?.scheduledPayment,
    row?.closingBalance,
  );
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

/**
 * Converts workflow/status-history values into Spanish operator labels.
 */
export function formatOperationalStatus(status: unknown): string {
  const normalizedStatus = String(status || '').toLowerCase();
  const labels: Record<string, string> = {
    active: tTerm('creditDetails.status.active'),
    resolved: tTerm('creditDetails.status.resolved'),
    pending: tTerm('creditDetails.status.pending'),
    completed: tTerm('creditDetails.status.completed'),
    failed: tTerm('creditDetails.status.failed'),
    kept: tTerm('creditDetails.status.kept'),
    broken: tTerm('creditDetails.status.broken'),
    cancelled: tTerm('creditDetails.status.cancelled'),
  };
  return labels[normalizedStatus] || tTerm('common.status.unknown');
}

/**
 * Builds the label and chip style for the current credit status.
 */
export function getStatusInfo(status: string): StatusPresentation {
  switch (status) {
    case 'active':
      return { label: tTerm('creditDetails.loanStatus.active'), className: 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-100 dark:border-blue-500/30' };
    case 'approved':
      return { label: tTerm('creditDetails.loanStatus.approved'), className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30' };
    case 'overdue':
      return { label: tTerm('creditDetails.loanStatus.overdue'), className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 border border-orange-200 dark:border-orange-500/30' };
    case 'paid':
      return { label: tTerm('creditDetails.loanStatus.paid'), className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-200 dark:border-slate-500/30' };
    case 'completed':
    case 'closed':
      return { label: tTerm('creditDetails.loanStatus.completed'), className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-200 dark:border-slate-500/30' };
    case 'defaulted':
      return { label: tTerm('creditDetails.loanStatus.defaulted'), className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-200 dark:border-red-500/30' };
    case 'cancelled':
      return { label: tTerm('creditDetails.loanStatus.cancelled'), className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-200 dark:border-slate-500/30' };
    case 'pending':
      return {
        label: tTerm('creditDetails.loanStatus.pending'),
        className: 'bg-amber-200/95 text-amber-950 border border-amber-500/45 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-400/35',
      };
    case 'rejected':
      return { label: tTerm('creditDetails.loanStatus.rejected'), className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30' };
    default:
      return { label: status ? tTerm('common.status.unknown') : tTerm('creditDetails.loanStatus.missing'), className: 'bg-gray-100 text-gray-700 border border-gray-200' };
  }
}

export function formatPromiseStatus(status: unknown): string {
  switch (String(status || '').toLowerCase()) {
    case 'kept': return tTerm('creditDetails.status.kept');
    case 'broken': return tTerm('creditDetails.status.broken');
    case 'cancelled': return tTerm('creditDetails.status.cancelled');
    case 'pending': return tTerm('creditDetails.status.pending');
    default: return status ? tTerm('common.status.unknown') : tTerm('creditDetails.loanStatus.missing');
  }
}

export function getInstallmentStatusInfo(status: unknown): StatusPresentation {
  switch (String(status || '').toLowerCase()) {
    case 'paid':
      return { label: tTerm('credits.modal.status.paid'), className: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30' };
    case 'overdue':
      return { label: tTerm('credits.modal.status.overdue'), className: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30' };
    case 'partial':
      return { label: tTerm('credits.calendar.status.partial'), className: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30' };
    case 'annulled':
      return { label: tTerm('creditDetails.installment.status.annulled'), className: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30' };
    default:
      return { label: tTerm('credits.modal.status.pending'), className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30' };
  }
}

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

export function cleanAlertDisplayText(value: unknown): string {
  if (!value) return '';
  return String(value)
    .split(/\r?\n/)
    .map((line) => line
      .trim()
      .replace(/^\[[^\]]+\]\s*/, '')
      .replace(/^(REMINDER|PAYMENT_REMINDER|OVERDUE|FOLLOW_UP|ALERT)\b[:\s-]*/i, '')
      .replace(/\b(actor|actorId|user|userId|loan|loanId|alert|alertId|status)[:=][^\s]+/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim())
    .filter(Boolean)
    .join('\n');
}

export function extractPaymentId(eventId: unknown): number | null {
  if (typeof eventId === 'number' && Number.isFinite(eventId)) return eventId;
  if (typeof eventId === 'string' && eventId.startsWith('payment-')) {
    const id = Number(eventId.replace('payment-', ''));
    return Number.isFinite(id) ? id : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Alert presentation builder
// ---------------------------------------------------------------------------

export function getAlertPresentation(
  alert: any,
  formatCurrency: (v: unknown) => string,
): AlertPresentation {
  const status = String(alert?.status || '').toLowerCase();
  const isResolved = status === 'resolved';
  const installmentLabel = alert?.installmentNumber != null
    ? tTerm('creditDetails.alerts.installmentNumber', { number: alert.installmentNumber })
    : tTerm('creditDetails.alerts.installmentMissing');
  const outstandingAmount = Number(alert?.outstandingAmount ?? alert?.amount ?? 0);
  const balanceLabel = Number.isFinite(outstandingAmount) && Math.abs(outstandingAmount) > 0.005
    ? `${tTerm('creditDetails.alerts.label.balance')} ${formatCurrency(outstandingAmount)}`
    : tTerm('creditDetails.alerts.balanceNone');
  const cleanMessage = cleanAlertDisplayText(alert?.message);
  const cleanNotes = cleanAlertDisplayText(alert?.notes);

  return {
    typeLabel: formatLoanAlertTypeLabel(alert?.alertType || alert?.type),
    statusLabel: formatOperationalStatus(status),
    statusClassName: isResolved
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300'
      : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300',
    iconClassName: isResolved
      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
      : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    summary: cleanMessage || `${installmentLabel} · ${balanceLabel}`,
    installmentLabel,
    balanceLabel,
    notes: cleanNotes,
  };
}

// ---------------------------------------------------------------------------
// Capital preview calculation (pure)
// ---------------------------------------------------------------------------

export type CapitalPreview = {
  amount: number;
  currentPrincipal: number;
  newPrincipal: number;
  currentInstallment: number;
  estimatedPayment: number;
  remainingInstallments: number;
  estimatedInstallments: number;
};

/**
 * Builds the operator-facing preview for a capital prepayment without applying
 * JavaScript numeric coercions that the real submit path rejects.
 */
export function computeCapitalPreview(
  capitalAmount: string,
  capitalStrategy: string,
  capitalNewTermMonths: string,
  loan: any,
  paymentSnapshot: any,
): CapitalPreview {
  const amount = parsePositiveMoneyInput(capitalAmount) ?? 0;
  const currentPrincipal = Number(paymentSnapshot?.outstandingPrincipal ?? loan?.principalOutstanding ?? 0);
  const remainingInstallments = Number(paymentSnapshot?.outstandingInstallments ?? 0);
  const effectiveNewTerm = parsePositiveIntegerInput(capitalNewTermMonths) ?? remainingInstallments;
  const currentInstallment = Number(paymentSnapshot?.nextInstallment?.scheduledPayment ?? loan?.installmentAmount ?? 0);
  const annualRate = Number(loan?.interestRate ?? 0);
  const newPrincipal = Math.max(0, currentPrincipal - (Number.isFinite(amount) ? amount : 0));
  const monthlyRate = annualRate / 100 / 12;

  const estimatePayment = (principal: number, term: number) => {
    if (principal <= 0 || term <= 0) return 0;
    if (monthlyRate <= 0) return principal / term;
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
  };

  const estimateTerm = () => {
    if (newPrincipal <= 0) return 0;
    if (currentInstallment <= 0 || remainingInstallments <= 0) return remainingInstallments;
    if (monthlyRate <= 0) return Math.min(remainingInstallments, Math.ceil(newPrincipal / currentInstallment));
    if (currentInstallment <= newPrincipal * monthlyRate) return remainingInstallments;
    const rawTerm = Math.ceil(-Math.log(1 - ((newPrincipal * monthlyRate) / currentInstallment)) / Math.log(1 + monthlyRate));
    return Number.isFinite(rawTerm) ? Math.max(1, Math.min(remainingInstallments, rawTerm)) : remainingInstallments;
  };

  const estimatedInstallments = capitalStrategy === 'reduce_payment' ? effectiveNewTerm : estimateTerm();
  const estimatedPayment = capitalStrategy === 'reduce_payment'
    ? estimatePayment(newPrincipal, effectiveNewTerm)
    : Math.min(currentInstallment, estimatePayment(newPrincipal, estimatedInstallments) || currentInstallment);

  return { amount, currentPrincipal, newPrincipal, currentInstallment, estimatedPayment, remainingInstallments, estimatedInstallments };
}
