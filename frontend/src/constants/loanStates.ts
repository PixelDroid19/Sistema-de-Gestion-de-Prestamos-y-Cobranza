export const BACKEND_SUPPORTED_LOAN_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'active',
  'overdue',
  'paid',
  'closed',
  'defaulted',
  'cancelled',
] as const;

export type BackendSupportedLoanStatus = typeof BACKEND_SUPPORTED_LOAN_STATUSES[number];

export const LOAN_STATUS_LABELS: Record<BackendSupportedLoanStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  active: 'Activo',
  overdue: 'Vencido',
  paid: 'Pagado',
  closed: 'Cerrado',
  defaulted: 'En mora',
  cancelled: 'Cancelado',
};
