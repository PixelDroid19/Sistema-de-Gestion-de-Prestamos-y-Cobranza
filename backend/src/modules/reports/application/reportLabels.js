const OPERATIONAL_STATUS_LABELS = {
  active: 'Activo',
  approved: 'Aprobado',
  closed: 'Cerrado',
  completed: 'Completado',
  defaulted: 'En mora',
  pending: 'Pendiente',
  paid: 'Pagado',
  rejected: 'Rechazado',
  annulled: 'Anulado',
  overdue: 'Vencido',
  late: 'Vencido',
  recovered: 'Recuperado',
  in_progress: 'En gestión',
  partial: 'Parcial',
  broken: 'Incumplida',
};

const PAYMENT_TYPE_LABELS = {
  installment: 'Cuota',
  partial: 'Pago parcial',
  capital: 'Abono a capital',
  payoff: 'Pago total',
};

const PAYMENT_METHOD_LABELS = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  bank_transfer: 'Transferencia',
  card: 'Tarjeta',
  check: 'Cheque',
  other: 'Otro',
};

/**
 * Formats backend enum-like values for operator-facing report artifacts.
 *
 * @param {string} value Raw status value stored by the domain model.
 * @returns {string} Spanish operational label.
 */
const formatOperationalStatus = (value) => {
  if (!value) return 'Sin estado';
  const rawValue = String(value).trim();
  const normalized = rawValue.toLowerCase();
  return OPERATIONAL_STATUS_LABELS[normalized] || rawValue;
};

/**
 * Formats payment type values for downloaded reports.
 *
 * @param {string} value Raw payment type from payment records.
 * @returns {string} Spanish operational label.
 */
const formatPaymentType = (value) => {
  if (!value) return 'Sin tipo';
  const rawValue = String(value).trim();
  const normalized = rawValue.toLowerCase();
  return PAYMENT_TYPE_LABELS[normalized] || rawValue;
};

/**
 * Formats payment method keys for downloaded reports.
 *
 * @param {string} value Raw payment method key stored by payment records.
 * @returns {string} Spanish operational label.
 */
const formatPaymentMethod = (value) => {
  if (!value) return 'Sin método';
  const rawValue = String(value).trim();
  const normalized = rawValue.toLowerCase();
  return PAYMENT_METHOD_LABELS[normalized] || rawValue;
};

module.exports = {
  formatOperationalStatus,
  formatPaymentType,
  formatPaymentMethod,
};
