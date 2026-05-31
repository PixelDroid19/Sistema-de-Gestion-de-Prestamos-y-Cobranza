import { tTerm, type TermKey } from '../i18n/terminology';

const FALLBACK_ALERT_TYPE_LABEL_KEY: TermKey = 'loanAlerts.type.fallback';

const LOAN_ALERT_TYPE_LABEL_KEYS: Record<string, TermKey> = {
  overdue_installment: 'loanAlerts.type.overdueInstallment',
  overdue: 'loanAlerts.type.overdue',
  payment_reminder: 'loanAlerts.type.paymentReminder',
  payment_due: 'loanAlerts.type.paymentDue',
  installment_due: 'loanAlerts.type.installmentDue',
  follow_up: 'loanAlerts.type.followUp',
  promise_broken: 'loanAlerts.type.promiseBroken',
};

/** Converts backend alert codes into readable UI labels. */
export function formatLoanAlertTypeLabel(raw?: string | null): string {
  if (raw == null || String(raw).trim() === '') {
    return tTerm(FALLBACK_ALERT_TYPE_LABEL_KEY);
  }

  const key = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  return tTerm(LOAN_ALERT_TYPE_LABEL_KEYS[key] ?? FALLBACK_ALERT_TYPE_LABEL_KEY);
}
