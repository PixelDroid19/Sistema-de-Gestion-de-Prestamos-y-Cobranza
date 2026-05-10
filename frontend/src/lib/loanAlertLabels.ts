const LOAN_ALERT_TYPE_LABELS: Record<string, string> = {
  overdue_installment: 'Cuota vencida',
  overdue: 'Saldo vencido',
  payment_reminder: 'Recordatorio de pago',
  payment_due: 'Pago próximo a vencer',
  installment_due: 'Cuota próxima a vencer',
  follow_up: 'Seguimiento de cobranza',
  promise_broken: 'Compromiso incumplido',
};

function humanizeSnakeCase(key: string): string {
  return key
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Convierte códigos de alerta del backend en textos legibles para la UI. */
export function formatLoanAlertTypeLabel(raw?: string | null): string {
  if (raw == null || String(raw).trim() === '') {
    return 'Alerta de crédito';
  }

  const key = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  if (LOAN_ALERT_TYPE_LABELS[key]) {
    return LOAN_ALERT_TYPE_LABELS[key];
  }

  return humanizeSnakeCase(key);
}
