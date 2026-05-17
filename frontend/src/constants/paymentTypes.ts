import { tTerm } from '../i18n/terminology';

const normalizePaymentType = (value: unknown): string => String(value || '').trim().toLowerCase();

export const getPaymentTypeLabel = (value: unknown): string => {
  const normalized = normalizePaymentType(value);
  const paymentTypeLabels: Record<string, string> = {
    installment: tTerm('payment.type.installment'),
    regular: tTerm('payment.type.installment'),
    partial: tTerm('payment.type.partial'),
    capital: tTerm('payment.type.capital'),
    payoff: tTerm('payment.type.payoff'),
  };
  if (!normalized) return tTerm('payment.type.unknown');
  return paymentTypeLabels[normalized] ?? tTerm('payment.type.unknown');
};
