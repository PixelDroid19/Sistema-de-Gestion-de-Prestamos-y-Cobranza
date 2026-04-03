import { tTerm } from '../i18n/terminology';

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  installment: tTerm('payment.type.installment'),
  regular: tTerm('payment.type.installment'),
  partial: tTerm('payment.type.partial'),
  capital: tTerm('payment.type.capital'),
  payoff: tTerm('payment.type.payoff'),
};

const normalizePaymentType = (value: unknown): string => String(value || '').trim().toLowerCase();

export const getPaymentTypeLabel = (value: unknown): string => {
  const normalized = normalizePaymentType(value);
  if (!normalized) return tTerm('payment.type.unknown');
  return PAYMENT_TYPE_LABELS[normalized] ?? tTerm('payment.type.unknown');
};
