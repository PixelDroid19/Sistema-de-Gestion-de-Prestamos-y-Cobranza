import { tTerm } from '../i18n/terminology';

const normalizePaymentType = (value: unknown): string => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[\s-]+/g, '_');

export const getPaymentTypeLabel = (value: unknown): string => {
  const normalized = normalizePaymentType(value);
  const paymentTypeLabels: Record<string, string> = {
    installment: tTerm('payment.type.installment'),
    regular: tTerm('payment.type.installment'),
    regular_payment: tTerm('payment.type.installment'),
    pago_regular: tTerm('payment.type.installment'),
    cuota: tTerm('payment.type.installment'),
    partial: tTerm('payment.type.partial'),
    parcial: tTerm('payment.type.partial'),
    penalty: tTerm('payment.type.penalty'),
    late_fee: tTerm('payment.type.penalty'),
    mora: tTerm('payment.type.penalty'),
    adjustment_fee: tTerm('payment.type.penalty'),
    capital: tTerm('payment.type.capital'),
    principal: tTerm('payment.type.capital'),
    principal_prepayment: tTerm('payment.type.capital'),
    abono_capital: tTerm('payment.type.capital'),
    payoff: tTerm('payment.type.payoff'),
    total: tTerm('payment.type.payoff'),
    pago_total: tTerm('payment.type.payoff'),
    liquidacion: tTerm('payment.type.payoff'),
  };
  if (!normalized) return tTerm('payment.type.unknown');
  return paymentTypeLabels[normalized] ?? tTerm('payment.type.unknown');
};

export const getPaymentMethodLabel = (value: unknown): string => {
  const normalized = normalizePaymentType(value);
  const paymentMethodLabels: Record<string, string> = {
    bank_transfer: tTerm('payment.method.transfer'),
    cash: tTerm('payment.method.cash'),
    card: tTerm('payment.method.card'),
    check: tTerm('payment.method.check'),
    transfer: tTerm('payment.method.transfer'),
    transferencia: tTerm('payment.method.transfer'),
    transferencia_bancaria: tTerm('payment.method.transfer'),
    efectivo: tTerm('payment.method.cash'),
    tarjeta: tTerm('payment.method.card'),
    cheque: tTerm('payment.method.check'),
    other: tTerm('payment.method.other'),
  };

  if (!normalized) return tTerm('common.notSpecified');
  return paymentMethodLabels[normalized] ?? tTerm('payment.method.unknown');
};
